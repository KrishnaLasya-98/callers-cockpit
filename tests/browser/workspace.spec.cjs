const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const leadId = "11111111-1111-4111-8111-111111111111";

async function mockWorkspace(page) {
  const calls = new Map(),
    events = new Map();
  const lead = {
    id: leadId,
    company: "Aster Precision",
    contact_name: "Maya S.",
    prospect_role: "Operations director",
    kind: "Precision manufacturing",
    language: "English",
    status: "queue",
    notes:
      "Confirm the current production priorities. Ask before proposing a solution.",
    verify_needed: false,
  };
  await page.route("http://localhost:8000/**", async (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname;
    let data,
      status = 200;
    const body = request.postDataJSON();
    if (request.method() === "OPTIONS") data = {};
    else if (path === "/health")
      data = {
        status: "ok",
        auth_required: false,
        llm_configured: true,
        version: "3.0.0",
      };
    else if (path === "/leads") data = [lead];
    else if (path === "/leads/" + leadId)
      data = {
        ...lead,
        calls: [...calls.values()].filter((c) => c.duration_s > 0),
      };
    else if (path === "/calls" && request.method() === "POST") {
      if (!calls.has(body.id))
        calls.set(body.id, {
          ...body,
          outcome: "not_logged",
          stage_reached: 1,
          duration_s: 0,
          started_at: "2026-10-20T11:00:00Z",
        });
      data = calls.get(body.id);
    } else if (path === "/calls")
      data = [...calls.values()]
        .filter((c) => c.duration_s > 0)
        .map((c) => ({ ...c, company: lead.company }));
    else if (path === "/llm/debrief")
      data = {
        available: true,
        observed_stage: 7,
        suggested_outcome: "next_step_agreed",
        summary: "Prospect agreed to a timed callback.",
        next_step_text: "Call tomorrow at 3 pm",
        next_step_has_time: true,
        mismatch_note: "The draft omitted the agreed callback.",
      };
    else {
      const match = path.match(/^\/calls\/([^/]+)(\/events)?$/),
        row = match && calls.get(match[1]);
      if (!row) {
        status = 404;
        data = { detail: "Call not found" };
      } else if (match[2]) {
        if (request.method() === "POST") {
          events.set(body.id, { ...body, call_id: row.id });
          row.stage_reached = Math.max(row.stage_reached, body.stage);
          data = body;
        } else data = [...events.values()].filter((e) => e.call_id === row.id);
      } else if (request.method() === "PATCH") {
        Object.assign(row, body);
        data = row;
      } else
        data = {
          ...row,
          events: [...events.values()].filter((e) => e.call_id === row.id),
        };
    }
    await route.fulfill({
      status,
      contentType: "application/json",
      headers: {
        "Access-Control-Allow-Origin": "http://127.0.0.1:5500",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
      body: JSON.stringify(data),
    });
  });
  await page.goto("/");
  await expect(page.locator("#leadName")).toHaveText("Aster Precision");
  return { calls, events };
}

for (const viewport of [
  { width: 1440, height: 1000 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
]) {
  test(`responsive workspace ${viewport.width}px has no overflow and one live words box`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await mockWorkspace(page);
    await expect(page.locator("#stageName")).toHaveText("Opening");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(
      page.locator("#screenLive textarea,#screenLive input[type=text]"),
    ).toHaveCount(1);
    fs.mkdirSync(".private/previews", { recursive: true });
    await page.screenshot({
      path: `.private/previews/workspace-${viewport.width}.png`,
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });
}

test("complete browser flow, explicit AI decision, persisted journal and reload", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const state = await mockWorkspace(page);
  await page.getByRole("button", { name: "Start call" }).click();
  await page
    .getByRole("button", { name: "Stage 3: Permission", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Busy; callback offered", exact: true })
    .click();
  await page
    .locator("#theirWords")
    .fill("The prospect is busy and offered a callback tomorrow at 3 pm.");
  await page.locator(".followup summary").click();
  await page.locator("#followupDate").fill("2026-10-21");
  await page.locator("#followupTime").fill("15:00");
  await page.getByRole("button", { name: "End call here" }).click();
  await expect(
    page.getByRole("dialog", { name: "What happened?" }),
  ).toBeVisible();
  await expect(page.locator("#stageReached")).toBeFocused();
  await expect(page.locator("#debriefBtn")).toBeEnabled();
  await page.locator("#debriefBtn").click();
  await expect(page.locator("#dbOutcome")).toHaveText("Next step agreed");
  await expect(page.locator("#stageReached")).toHaveValue("3");
  await page
    .getByRole("button", { name: "Use suggestion", exact: true })
    .click();
  await expect(page.locator("#stageReached")).toHaveValue("7");
  await page.screenshot({
    path: ".private/previews/review-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Save conversation", exact: true })
    .click();
  await expect(page.locator("#notice")).toContainText("Conversation saved");
  await page.getByRole("button", { name: "Call journal", exact: true }).click();
  await expect(page.locator(".log-row")).toHaveCount(1);
  await page.locator(".log-row summary").click();
  await expect(page.locator(".log-row blockquote")).toContainText(
    "prospect is busy",
  );
  expect([...state.calls.values()][0].llm_reviewed).toBe(true);
  await page.screenshot({
    path: ".private/previews/journal-desktop.png",
    fullPage: true,
  });
  await page.reload();
  await expect(page.locator("#startBtn")).toBeEnabled();
  await page.getByRole("button", { name: "Call journal", exact: true }).click();
  await expect(page.locator(".log-row")).toHaveCount(1);
});

test("refresh recovers active draft and keyboard dialog traps focus", async ({
  page,
}) => {
  await mockWorkspace(page);
  await page.getByRole("button", { name: "Start call" }).click();
  await page
    .locator("#theirWords")
    .fill("An original fictional need to preserve.");
  await page.reload();
  await expect(page.locator("#theirWords")).toHaveValue(
    "An original fictional need to preserve.",
  );
  await expect(page.locator("#notice")).toContainText("restored");
  await page.getByRole("button", { name: "End call here" }).click();
  await expect(page.locator("#stageReached")).toBeFocused();
  await page.locator("#discardBtn").focus();
  await page.keyboard.press("Tab");
  await expect(page.locator("#stageReached")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator("#sheet")).toBeHidden();
  await expect(page.locator("#endCallBtn")).toBeFocused();
});
