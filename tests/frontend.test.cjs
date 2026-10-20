const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { randomUUID } = require("node:crypto");
const { JSDOM } = require("jsdom");
const domain = require("../frontend/domain.js");
const LEAD = "11111111-1111-4111-8111-111111111111";
const flush = () => new Promise((resolve) => setImmediate(resolve));
async function setup(t, { state = null, draft = null, auth = false } = {}) {
  const dom = new JSDOM(readFileSync("frontend/index.html", "utf8"), {
    url: "http://localhost:5500",
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  t.after(() => dom.window.close());
  const w = dom.window;
  w.setInterval = () => 1;
  w.clearInterval = () => {};
  w.confirm = () => true;
  if (!w.crypto.randomUUID) w.crypto.randomUUID = randomUUID;
  state ||= {
    requests: [],
    calls: new Map(),
    events: new Map(),
    failEvents: false,
    failStartResponseOnce: false,
    failSave: false,
    model: {
      available: true,
      observed_stage: 7,
      suggested_outcome: "next_step_agreed",
      summary: "Callback agreed",
      next_step_text: "Call Tuesday 3pm",
      next_step_has_time: true,
      mismatch_note: "Callback was agreed",
    },
  };
  if (draft)
    w.localStorage.setItem("cockpit.draft.v3:http://localhost:8000", draft);
  const lead = {
    id: LEAD,
    company: "<img src=x onerror=alert(1)>",
    contact_name: "Demo",
    language: "English",
    status: "queue",
  };
  const old = {
    id: "old",
    lead_id: LEAD,
    stage_reached: 3,
    outcome: "follow_up",
    started_at: "2026-10-20T10:00:00Z",
    duration_s: 20,
  };
  const history = () =>
    [...state.calls.values()].filter((c) => c.duration_s > 0).concat(old);
  w.fetch = async (url, opts = {}) => {
    const path = url.replace("http://localhost:8000", ""),
      method = opts.method || "GET",
      body = opts.body ? JSON.parse(opts.body) : null;
    state.requests.push({ path, method, body, headers: opts.headers });
    let data,
      status = 200;
    if (path === "/health")
      data = {
        status: "ok",
        auth_required: auth,
        llm_configured: true,
        version: "3.0.0",
      };
    else if (path === "/auth/login")
      data = { access_token: "test-token", expires_in: 3600 };
    else if (path === "/leads") data = [lead];
    else if (path === "/leads/" + LEAD) data = { ...lead, calls: history() };
    else if (path.startsWith("/calls?"))
      data = history().map((c) => ({ ...c, company: lead.company }));
    else if (path === "/calls" && method === "POST") {
      if (!state.calls.has(body.id))
        state.calls.set(body.id, {
          ...body,
          stage_reached: 1,
          outcome: "not_logged",
          duration_s: 0,
          started_at: new Date().toISOString(),
        });
      data = state.calls.get(body.id);
      if (state.failStartResponseOnce) {
        state.failStartResponseOnce = false;
        throw new TypeError("Connection lost after write");
      }
    } else if (path === "/llm/debrief") data = state.model;
    else {
      const match = path.match(/^\/calls\/([^/]+)(\/events)?$/);
      if (!match) throw Error("Unexpected request " + path);
      const id = match[1],
        row = state.calls.get(id);
      if (!row) {
        status = 404;
        data = { detail: "Call not found" };
      } else if (match[2]) {
        if (method === "POST") {
          if (state.failEvents) throw new TypeError("Offline");
          state.events.set(body.id, { ...body, call_id: id });
          row.stage_reached = Math.max(row.stage_reached, body.stage);
          data = body;
        } else
          data = [...state.events.values()].filter((e) => e.call_id === id);
      } else if (method === "PATCH") {
        if (state.failSave) throw new TypeError("Offline");
        Object.assign(row, body);
        data = { ...row };
      } else
        data = {
          ...row,
          events: [...state.events.values()].filter((e) => e.call_id === id),
        };
    }
    return {
      ok: status < 400,
      status,
      headers: new Map(),
      json: async () => JSON.parse(JSON.stringify(data)),
    };
  };
  w.eval(readFileSync("frontend/domain.js", "utf8"));
  w.eval(readFileSync("frontend/app.js", "utf8"));
  await flush();
  await flush();
  const el = Object.fromEntries(
    [...w.document.querySelectorAll("[id]")].map((e) => [e.id, e]),
  );
  return {
    w,
    el,
    state,
    dom,
    draft: () =>
      w.localStorage.getItem("cockpit.draft.v3:http://localhost:8000"),
    start: () => el.startBtn.onclick(),
    end: () => el.endCallBtn.onclick(),
    save: () => el.saveCallBtn.onclick(),
  };
}
const saved = (app) =>
  app.state.requests.filter((r) => r.method === "PATCH").at(-1)?.body;

test("loads and escapes lead context, has one live free-text box", async (t) => {
  const app = await setup(t);
  assert.match(app.el.leadPicker.innerHTML, /&lt;img/);
  assert.match(app.el.leadHistory.textContent, /Follow up/);
  assert.equal(
    app.w.document.querySelectorAll(
      "#screenLive textarea,#screenLive input[type=text]",
    ).length,
    1,
  );
  assert.equal(app.el.theirWords.disabled, true);
});
test("start, stage tap and discard retain stage and unlock queue", async (t) => {
  const app = await setup(t);
  await app.start();
  assert.equal(app.el.leadPicker.disabled, true);
  app.el.stepper.children[5].onclick();
  await app.el.stageTaps.children[0].onclick();
  app.end();
  await app.el.discardBtn.onclick();
  assert.equal(saved(app).outcome, "not_logged");
  assert.equal(saved(app).stage_reached, 6);
  assert.equal(app.el.leadPicker.disabled, false);
  assert.equal(app.draft(), null);
});
test("taps remain highlighted when navigating; stage eight is recordable", async (t) => {
  const app = await setup(t);
  await app.start();
  await app.el.stageTaps.children[0].onclick();
  app.el.nextStageBtn.onclick();
  app.el.stepper.children[0].onclick();
  assert.equal(
    app.el.stageTaps.children[0].getAttribute("aria-pressed"),
    "true",
  );
  app.el.stepper.children[7].onclick();
  await app.el.stageTaps.children[0].onclick();
  app.end();
  await app.save();
  assert.equal(saved(app).stage_reached, 8);
});
test("vague timing stays flagged and structured controls generate commitment", async (t) => {
  const app = await setup(t);
  await app.start();
  app.el.followupType.value = "callback";
  app.el.followupChannel.value = "Phone";
  app.el.followupType.onchange();
  assert.equal(app.el.amberNote.classList.contains("hidden"), false);
  app.el.followupDate.value = "2026-10-22";
  app.el.followupTime.value = "15:00";
  app.el.followupTime.onchange();
  assert.equal(app.el.nextStepHasTime.checked, true);
  assert.match(app.el.nextStepText.value, /2026-10-22 at 15:00/);
});
test("debrief never applies silently; accepted review saves stage, step and metadata", async (t) => {
  const app = await setup(t);
  await app.start();
  app.end();
  await app.el.debriefBtn.onclick();
  assert.equal(app.el.stageReached.value, "1");
  app.el.applyDebriefBtn.onclick();
  await app.save();
  assert.equal(saved(app).stage_reached, 7);
  assert.equal(saved(app).outcome, "next_step_agreed");
  assert.equal(saved(app).next_step_text, "Call Tuesday 3pm");
  assert.equal(saved(app).llm_reviewed, true);
  assert.equal(saved(app).logged_vs_observed_note, "");
});
test("keeping original after applying restores original outcome, stage and next step", async (t) => {
  const app = await setup(t);
  await app.start();
  app.end();
  app.el.nextStepText.value = "Original step";
  await app.el.debriefBtn.onclick();
  app.el.applyDebriefBtn.onclick();
  app.el.keepLogBtn.onclick();
  await app.save();
  assert.equal(saved(app).stage_reached, 1);
  assert.equal(saved(app).outcome, "not_logged");
  assert.equal(saved(app).next_step_text, "Original step");
  assert.match(saved(app).logged_vs_observed_note, /AI suggested/);
});
test("model outage permits manual saving", async (t) => {
  const app = await setup(t);
  app.state.model = { available: false, error: "Model offline" };
  await app.start();
  app.end();
  await app.el.debriefBtn.onclick();
  assert.equal(app.el.saveCallBtn.disabled, false);
  await app.save();
  assert.equal(saved(app).llm_reviewed, false);
});
test("journal searches, filters and escapes stored values", async (t) => {
  const app = await setup(t);
  await app.el.tabLog.onclick();
  assert.match(app.el.logList.innerHTML, /&lt;img/);
  assert.equal(app.el.logList.querySelectorAll("img").length, 0);
  app.el.logSearch.value = "no such company";
  app.el.logSearch.oninput();
  assert.match(app.el.logList.textContent, /No conversations/);
  app.el.logSearch.value = "";
  app.el.logOutcome.value = "follow_up";
  app.el.logOutcome.onchange();
  assert.match(app.el.logCount.textContent, /1 of 1/);
});
test("failed event stays queued, survives retry and blocks close save until acknowledged", async (t) => {
  const app = await setup(t);
  await app.start();
  app.state.failEvents = true;
  await app.el.stageTaps.children[0].onclick();
  app.end();
  assert.equal(app.el.saveCallBtn.disabled, true);
  assert.equal(JSON.parse(app.draft()).outbox.length, 1);
  app.state.failEvents = false;
  await app.el.retrySyncBtn.onclick();
  assert.equal(app.el.saveCallBtn.disabled, false);
  assert.equal(app.state.events.size, 1);
  await app.save();
  assert.equal(saved(app).stage_reached, 1);
});
test("uncertain start retry uses the same call id and creates one session", async (t) => {
  const app = await setup(t);
  app.state.failStartResponseOnce = true;
  await app.start();
  const first = app.state.requests.filter(
    (r) => r.method === "POST" && r.path === "/calls",
  )[0];
  await app.start();
  const attempts = app.state.requests.filter(
    (r) => r.method === "POST" && r.path === "/calls",
  );
  assert.equal(attempts.length, 2);
  assert.equal(attempts[1].body.id, first.body.id);
  assert.equal(app.state.calls.size, 1);
});
test("refresh recovers words, stage and pending events from local draft", async (t) => {
  const first = await setup(t);
  await first.start();
  first.el.theirWords.value = "A fictional need";
  first.el.theirWords.oninput();
  first.el.stepper.children[4].onclick();
  first.state.failEvents = true;
  await first.el.stageTaps.children[0].onclick();
  first.state.failEvents = false;
  const next = await setup(t, { state: first.state, draft: first.draft() });
  assert.equal(next.el.theirWords.value, "A fictional need");
  assert.equal(next.el.stageName.textContent, "Their need");
  assert.equal(next.el.leadPicker.disabled, true);
  assert.equal(next.state.events.size, 1);
});
test("failed save retains the draft and retry writes the same call", async (t) => {
  const app = await setup(t);
  await app.start();
  app.end();
  app.state.failSave = true;
  await app.save();
  assert.ok(app.draft());
  assert.equal(app.el.sheet.classList.contains("hidden"), false);
  app.state.failSave = false;
  await app.save();
  assert.equal(app.state.calls.size, 1);
  assert.equal(app.draft(), null);
});
test("review time is excluded from call duration", async (t) => {
  const app = await setup(t);
  let now = 1000000;
  app.w.Date.now = () => now;
  await app.start();
  now += 10000;
  app.end();
  now += 60000;
  await app.save();
  assert.equal(saved(app).duration_s, 10);
});
test("private mode prompts sign-in and never stores the password or bearer token", async (t) => {
  const app = await setup(t, { auth: true });
  assert.equal(app.el.loginSheet.classList.contains("hidden"), false);
  app.el.loginEmail.value = "demo@example.test";
  app.el.loginPassword.value = "private-test-password";
  await app.el.loginForm.onsubmit({ preventDefault() {} });
  assert.equal(app.el.loginPassword.value, "");
  assert.ok(
    app.state.requests.some(
      (r) =>
        r.path === "/leads" && r.headers.Authorization === "Bearer test-token",
    ),
  );
  await app.start();
  assert.doesNotMatch(app.draft(), /test-token|private-test-password/);
});
test("domain time checks reject incidental substrings and incomplete commitments", () => {
  for (const value of [
    "Send money",
    "Call tomorrow",
    "Call at 3pm",
    "Call next week",
  ])
    assert.equal(domain.hasRealTime(value), false, value);
  for (const value of [
    "Tuesday 3pm",
    "2026-10-22 15:00",
    "in 30 minutes",
    "after an hour",
  ])
    assert.equal(domain.hasRealTime(value), true, value);
  assert.equal(domain.commitmentText("", "", "", ""), "");
});
test("journal distribution counts reached stages without treating them as a funnel", () => {
  const stats = domain.summarize([
    {
      stage_reached: 7,
      outcome: "follow_up",
      next_step_text: "Next week",
      next_step_has_time: false,
    },
    { stage_reached: 3, outcome: "not_logged" },
  ]);
  assert.equal(stats.count, 2);
  assert.equal(stats.stages[6], 1);
  assert.equal(stats.stages[2], 1);
  assert.equal(stats.untimed, 1);
});
