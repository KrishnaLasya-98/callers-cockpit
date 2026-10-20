/* Caller's Cockpit — v2, grounded in the 100-transcript analysis.
   Live screen = 8-stage taps; Log screen = where calls ended. */

const STAGES = [
  {
    name: "Opening",
    purpose: "Reach the right person and say who you are. They decide in ten seconds.",
    say: ["Reception: what is it about?", "Person is not available", "Number belongs to somebody who left", "Language wall"],
    taps: ["Reception screen", "Right person answers", "Wrong person", "Person left company", "Language wall"],
  },
  {
    name: "Purpose",
    purpose: "Say why you called, in words they can repeat to a colleague.",
    say: ["\u201cFrom where are you calling?\u201d", "\u201cWhat is this regarding?\u201d", "\u201cWhy free \u2014 what do you want from me?\u201d", "\u201cSend me the details first\u201d", "\u201cIs this a sales call?\u201d"],
    taps: ["Asked what we do \u00d72", "Asked where we got the number", "Said it is a sales call", "Asked for details first", "Let me go on"],
  },
  {
    name: "Permission",
    purpose: "Find out whether they are willing to talk now. A yes, a no, or a time \u2014 all good.",
    say: ["\u201cIn a meeting, call after two\u201d", "\u201cSend it on WhatsApp first\u201d", "Says yes, then goes quiet", "Keeps talking without answering"],
    taps: ["Clear yes", "Clear no", "Busy \u2014 back-time pinned", "Talking, no answer"],
  },
  {
    name: "Their business",
    purpose: "Ask about their company and work before anything about yours.",
    say: ["Answers in one line and waits for the pitch", "\u201cWe don\u2019t make that \u2014 different division\u201d", "\u201cYou tell me about yourself first\u201d"],
    taps: ["Answered in one line", "Corrected us", "Asked about us first"],
  },
  {
    name: "Their need",
    purpose: "Hear what they are trying to do, IN THEIR OWN WORDS. Write them down.",
    say: ["Names a goal: new market / new line", "\u201cEverything is fine \u2014 nothing we need\u201d", "Asks what we can do for a company like theirs"],
    taps: ["Named a goal", "Says all fine", "Asked what we can do for them"],
  },
  {
    name: "Objection",
    purpose: "Hear the reason for a no \u2014 and understand it.",
    say: ["\u201cWe already have a consultant\u201d", "\u201cWe\u2019re fine as we are\u201d", "\u201cDecisions are taken in the US\u201d", "\u201cSend your profile, we\u2019ll see\u201d", "\u201cNot my function \u2014 talk to owner\u201d"],
    taps: ["Already have provider", "Fine as we are", "Decision abroad", "Show me first", "Not my function", "Trust / data skepticism"],
  },
  {
    name: "Next step",
    purpose: "Agree ONE concrete thing: a document, a call, or a meeting \u2014 named, with a time or channel.",
    say: ["\u201cYes, send it\u201d \u2014 politeness, not interest", "\u201cSometime next week\u201d \u2014 no day", "Names THEIR own time (worth more)"],
    taps: ["Report on WhatsApp", "Report on email", "Call at a named time", "Meeting agreed", "Referral with number", "\u201cNext week\u201d, no day \u2014 amber"],
  },
  {
    name: "Close",
    purpose: "End clearly. Record the outcome, the step, and the prospect\u2019s words.",
    say: ["Line drops mid-sentence", "Polite goodbye after a no \u2014 still a no", "Logged outcome \u2260 what was said"],
    taps: ["Next step reconfirmed", "Polite close", "Line dropped"],
  },
];

const OUTCOMES = [
  "agreed_to_receive_report", "next_step_agreed", "interested", "follow_up",
  "call_again", "not_interested", "do_not_call", "wrong_person", "moved_company", "not_logged",
];

(() => {
  const paramApi = new URLSearchParams(location.search).get("api");
  const localHost = ["localhost", "127.0.0.1"].includes(location.hostname);
  const API_URL =
    paramApi ||
    localStorage.getItem("API_URL") ||
    (localHost ? "http://localhost:8000" : location.origin + "/api");

  const $ = (id) => document.getElementById(id);
  const el = {};
  ["apiStatus", "clock", "tabLive", "tabLog", "screenLive", "screenLog",
   "leadPicker", "refreshBtn", "leadName", "leadContact", "leadKind", "leadNotes",
   "leadNextStep", "leadFlags", "leadHistory", "stepper", "stageName", "stagePurpose",
   "stageSay", "stageTaps", "nextStageBtn", "endCallBtn", "startBtn", "langSel",
   "callStage", "timer", "theirWords", "nextStepText", "nextStepHasTime", "amberNote",
   "logList", "stageStats", "sheet", "sheetStage", "outcomeChips", "debriefBtn",
   "debriefOut", "dbStage", "dbOutcome", "dbSummary", "dbMatch", "dbNext", "saveCallBtn",
   "discardBtn"].forEach((id) => (el[id] = $(id)));

  let leads = [];
  let current = null;
  let stage = 1;            // current stage being worked
  let observedMax = 1;      // highest stage with a tap
  let activeCallId = null;  // call row id once dialing
  let ticking = null, startedAt = null;
  let debriefResult = null; // last debrief for this call
  let saveOutcome = "not_logged";
  let tapped = new Set();
  let pendingTaps = 0;
  let closing = false;
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

  function updateControls() {
    el.leadPicker.disabled = !!activeCallId || el.startBtn.disabled;
    el.refreshBtn.disabled = !!activeCallId || el.startBtn.disabled;
    el.langSel.disabled = !!activeCallId;
    el.saveCallBtn.disabled = closing || pendingTaps > 0 || el.debriefBtn.disabled;
    el.discardBtn.disabled = el.saveCallBtn.disabled;
    el.endCallBtn.disabled = pendingTaps > 0;
  }

  const api = (path, opts = {}) =>
    fetch(API_URL + path, { headers: { "Content-Type": "application/json" }, ...opts })
      .then((r) => { if (!r.ok) throw new Error(`${path}: ${r.status}`); return r.json(); });

  // ---------- health + clock ----------
  api("/health")
    .then(() => el.apiStatus.classList.add("ok"))
    .catch(() => el.apiStatus.classList.remove("ok"));
  const setClock = () => (el.clock.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
  setClock(); setInterval(setClock, 15000);

  // ---------- tabs ----------
  el.tabLive.onclick = () => { el.screenLive.classList.remove("hidden"); el.screenLog.classList.add("hidden"); el.tabLive.classList.add("active"); el.tabLog.classList.remove("active"); };
  el.tabLog.onclick = () => { el.screenLog.classList.remove("hidden"); el.screenLive.classList.add("hidden"); el.tabLog.classList.add("active"); el.tabLive.classList.remove("active"); loadLog(); };

  // ---------- leads ----------
  async function loadLeads() {
    if (activeCallId) return;
    const previousId = current?.id;
    leads = await api("/leads");
    el.leadPicker.innerHTML = leads.map((l) =>
      `<option value="${escapeHtml(l.id)}">${escapeHtml(l.company)} \u00b7 ${escapeHtml(l.contact_name || "\u2014")} \u00b7 ${escapeHtml(l.status)}</option>`).join("");
    await selectLead(leads.find((l) => l.id === previousId) || leads[0] || null);
    if (current) el.leadPicker.value = current.id;
  }
  async function selectLead(lead) {
    renderLead(lead);
    if (!lead) return;
    el.leadHistory.textContent = "Loading history…";
    try {
      const detail = await api(`/leads/${encodeURIComponent(lead.id)}`);
      if (current?.id === lead.id) renderLead(detail);
    } catch (e) {
      if (current?.id === lead.id) el.leadHistory.textContent = "Could not load history: " + e.message;
    }
  }
  el.leadPicker.onchange = () => selectLead(leads.find((l) => l.id === el.leadPicker.value));
  el.refreshBtn.onclick = () => loadLeads().catch((e) => alert(e.message));

  function renderLead(lead) {
    current = lead;
    if (!lead) {
      el.leadName.textContent = "No lead";
      ["leadContact", "leadKind", "leadNotes", "leadNextStep", "leadFlags", "leadHistory"].forEach((id) => el[id].textContent = "");
      return;
    }
    if (!activeCallId) el.langSel.value = lead.language || "English";
    el.leadName.textContent = lead.company;
    el.leadContact.textContent = `${lead.contact_name || "\u2014"} \u00b7 ${lead.prospect_role || "\u2014"} \u00b7 ${lead.phone || "\u2014"}`;
    el.leadKind.textContent = `${lead.kind || "\u2014"} \u00b7 ${lead.language}`;
    el.leadNotes.textContent = lead.notes || "\u2014";
    el.leadNextStep.textContent = lead.next_step_text ? `Next: ${lead.next_step_text}` : "";
    el.leadFlags.innerHTML = (lead.verify_needed ? `<span class="flag warn">\u2691 verify \u2014 wrong person / moved / stale number</span>` : "");
    el.leadHistory.textContent = "No calls yet";
    if (lead.calls?.length) el.leadHistory.textContent = "";
    (lead.calls || []).slice(0, 3).forEach((c) => {
      const d = new Date(c.started_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
      const row = document.createElement("div");
      row.textContent = `stage ${c.stage_reached} \u00b7 ${c.outcome} \u00b7 ${d}`;
      el.leadHistory.appendChild(row);
    });
  }

  // ---------- stage machinery ----------
  function renderStages() {
    el.stepper.innerHTML = STAGES.map((s, i) =>
      `<button class="step ${i + 1 === stage ? "cur" : ""} ${i + 1 < stage ? "done" : ""}" data-n="${i + 1}">${i + 1}</button>`).join("");
    document.querySelectorAll(".step").forEach((b) => (b.onclick = () => setStage(+b.dataset.n)));
    const s = STAGES[stage - 1];
    el.stageName.textContent = `Stage ${stage} of 8 \u2014 ${s.name}`;
    el.stagePurpose.textContent = s.purpose;
    el.stageSay.innerHTML = s.say.map((t) => `<span class="chip say">${t}</span>`).join("");
    el.stageTaps.innerHTML = s.taps.map((t) => `<button class="chip tap ${tapped.has(`${stage}:${t}`) ? "pressed" : ""}" data-t="${escapeHtml(t)}">${escapeHtml(t)}</button>`).join("");
    [...el.stageTaps.children].forEach((b) => (b.onclick = () => tap(b.dataset.t)));
    el.nextStageBtn.textContent = stage < 8 ? `Next: ${STAGES[stage].name} →` : "Final stage";
    el.nextStageBtn.disabled = stage === 8;
    el.callStage.textContent = activeCallId ? `${s.name} \u00b7 max reached: stage ${observedMax}` : "call not started";
  }
  function setStage(n) { stage = Math.min(8, Math.max(1, n)); renderStages(); }

  async function tap(text) {
    if (!activeCallId) { alert("Press \u201cDial started\u201d first \u2014 the call row opens then."); return; }
    const tappedStage = stage;
    pendingTaps++; updateControls();
    try {
      await api(`/calls/${activeCallId}/events`, { method: "POST", body: JSON.stringify({ stage: tappedStage, tap: text }) });
      tapped.add(`${tappedStage}:${text}`);
      observedMax = Math.max(observedMax, tappedStage);
      invalidateDebrief();
      renderStages();
    } catch (e) { alert(e.message); }
    finally { pendingTaps--; updateControls(); }
  }

  el.nextStageBtn.onclick = () => setStage(stage + 1);
  renderStages();

  // ---------- call lifecycle ----------
  el.startBtn.onclick = async () => {
    if (!current) { alert("Pick a lead"); return; }
    if (activeCallId) { alert("A call is already open"); return; }
    el.startBtn.disabled = true; updateControls();
    try {
      const call = await api("/calls", { method: "POST", body: JSON.stringify({ lead_id: current.id, language: el.langSel.value }) });
      activeCallId = call.id;
      stage = 1; tapped.clear();
      observedMax = 1;
      startedAt = Date.now();
      ticking = setInterval(() => (el.timer.textContent = fmt((Date.now() - startedAt) / 1000)), 1000);
      renderStages();
    } catch (e) { alert(e.message); }
    finally { el.startBtn.disabled = !!activeCallId; updateControls(); }
  };

  const fmt = (s) => [s / 3600, (s % 3600) / 60, s % 60].map((n) => `0${Math.floor(n)}`.slice(-2)).join(":");

  el.endCallBtn.onclick = () => {
    if (!activeCallId) { alert("Start the call first"); return; }
    renderOutcomes();
    el.sheetStage.textContent = `stage ${observedMax} tapped`;
    el.sheet.classList.remove("hidden");
  };

  function renderOutcomes() {
    el.outcomeChips.innerHTML = OUTCOMES.map((o) =>
      `<button class="chip tap ${o === saveOutcome ? "pressed" : ""}" data-o="${o}">${o.replace(/_/g, " ")}</button>`).join("");
    [...el.outcomeChips.children].forEach((b) => (b.onclick = () => {
      saveOutcome = b.dataset.o; renderOutcomes();
    }));
  }

  function invalidateDebrief() {
    debriefResult = null;
    el.debriefOut.classList.add("hidden");
  }
  function updateTimeWarning() {
    el.amberNote.classList.toggle("hidden", !el.nextStepText.value.trim() || hasRealTime(el.nextStepText.value) || el.nextStepHasTime.checked);
  }
  el.theirWords.oninput = invalidateDebrief;
  el.nextStepText.oninput = () => { invalidateDebrief(); el.nextStepHasTime.checked = false; updateTimeWarning(); };
  el.nextStepHasTime.onchange = () => { invalidateDebrief(); updateTimeWarning(); };

  function hasRealTime(t) {
    const v = (t || "").toLowerCase();
    const day = /\b(mon(day)?|tue(sday)?|wed(nesday)?|thu(rsday)?|fri(day)?|sat(urday)?|sun(day)?|tomorrow|today)\b|\b\d{4}-\d{2}-\d{2}\b/.test(v);
    const time = /\b\d{1,2}(:\d{2})?\s*(am|pm)\b|\b\d{1,2}:\d{2}\b/.test(v);
    const relative = /\b(in|after)\s+\d+\s*(minutes?|mins?|hours?|hrs?)\b/.test(v);
    return (day && time) || relative;
  }

  el.discardBtn.onclick = async () => {
    if (confirm("Discard WITHOUT saving? The call row stays not_logged.")) {
      closing = true; updateControls();
      try {
        await closeRow({ outcome: "not_logged", stage_reached: observedMax,
          duration_s: startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0 });
        el.sheet.classList.add("hidden");
        await loadLeads();
      } catch (e) { alert(e.message); }
      finally { closing = false; updateControls(); }
    }
  };

  el.saveCallBtn.onclick = async () => {
    if (closing || pendingTaps) return;
    closing = true; updateControls();
    try {
      await closeRow({
        outcome: saveOutcome,
        stage_reached: observedMax,
        duration_s: startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0,
        their_words: el.theirWords.value,
        next_step_text: el.nextStepText.value,
        next_step_has_time: !!el.nextStepText.value.trim() && (el.nextStepHasTime.checked || hasRealTime(el.nextStepText.value)),
        summary: debriefResult?.summary || "",
        language: el.langSel.value,
        llm_reviewed: !!debriefResult,
        logged_vs_observed_note: debriefResult && debriefResult.suggested_outcome !== saveOutcome ? debriefResult.mismatch_note : "",
      });
      el.sheet.classList.add("hidden");
      await loadLeads();
    } catch (e) { alert(e.message); }
    finally { closing = false; updateControls(); }
  };

  async function closeRow(fields) {
    if (!activeCallId) return;
    await api(`/calls/${activeCallId}`, { method: "PATCH", body: JSON.stringify(fields) });
    activeCallId = null; ticking && clearInterval(ticking); ticking = null;
    el.timer.textContent = "00:00:00";
    stage = 1; observedMax = 1; debriefResult = null; saveOutcome = "not_logged";
    tapped.clear(); startedAt = null;
    el.startBtn.disabled = false;
    el.debriefOut.classList.add("hidden");
    el.theirWords.value = ""; el.nextStepText.value = ""; el.nextStepHasTime.checked = false;
    el.amberNote.classList.add("hidden");
    document.querySelectorAll(".chip.tap.pressed").forEach((b) => b.classList.remove("pressed"));
    renderStages();
    updateControls();
  }

  // ---------- debrief (the ONE LLM job) ----------
  el.debriefBtn.onclick = async () => {
    if (!activeCallId) return;
    el.debriefBtn.disabled = true; el.debriefBtn.textContent = "Auditing my log\u2026";
    updateControls();
    try {
      const out = await api("/llm/debrief", {
        method: "POST",
        body: JSON.stringify({
          call_id: activeCallId,
          logged_outcome: saveOutcome,
          logged_stage: Math.max(observedMax, 1),
          their_words: el.theirWords.value,
          next_step_text: el.nextStepText.value,
          next_step_has_time: el.nextStepHasTime.checked || hasRealTime(el.nextStepText.value),
        }),
      });
      if (!out.available) { alert(out.error || "Debrief unavailable"); return; }
      debriefResult = out;
      el.debriefOut.classList.remove("hidden");
      el.dbStage.textContent = out.observed_stage;
      el.dbOutcome.textContent = out.suggested_outcome.replace(/_/g, " ");
      el.dbSummary.textContent = out.summary;
      const mismatch = out.suggested_outcome !== saveOutcome;
      el.dbMatch.classList.toggle("hidden", !mismatch);
      if (mismatch) el.dbMatch.textContent = `Your log says "${saveOutcome.replace(/_/g, " ")}" but the call suggests otherwise: ${out.mismatch_note}`;
      el.dbNext.textContent = out.next_step_text ? `Next step: ${out.next_step_text}${out.next_step_has_time ? " (has a time)" : " (no day+time \u2014 amber)"}` : "";
      if (confirm(`Apply the debrief suggestion: stage ${out.observed_stage}, "${out.suggested_outcome.replace(/_/g, " ")}" and its next step?`)) {
        saveOutcome = out.suggested_outcome;
        observedMax = out.observed_stage;
        el.nextStepText.value = out.next_step_text;
        el.nextStepHasTime.checked = out.next_step_has_time;
        updateTimeWarning(); renderOutcomes(); renderStages();
        el.sheetStage.textContent = `stage ${observedMax} reviewed`;
      }
    } catch (e) { alert(e.message); }
    finally {
      el.debriefBtn.disabled = false;
      el.debriefBtn.textContent = "\u270e Run debrief on my log";
      updateControls();
    }
  };

  // ---------- log screen ----------
  async function loadLog() {
    try {
      const calls = await api("/calls");
      el.stageStats.innerHTML = calls.slice(0, 50).map((c) => `s${c.stage_reached}`).join(" \u00b7 ")
        + " \u2014 stage reached per call (last 50)";
      el.logList.innerHTML = calls.map((c) => {
        const d = new Date(c.started_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
        const amber = c.next_step_text && !c.next_step_has_time;
        return `<div class="log-row">
          <span class="log-stage">stage ${escapeHtml(c.stage_reached)}</span>
          <span class="log-co">${escapeHtml(c.company || "\u2014")}</span>
          <span class="badge ${escapeHtml(c.outcome)}">${escapeHtml(c.outcome.replace(/_/g, " "))}</span>
          <span class="log-next ${amber ? "amber" : ""}">${escapeHtml(c.next_step_text)}</span>
          <span class="muted log-date">${d}</span>
          ${c.logged_vs_observed_note ? `<div class="mismatch row-note">LLM: ${escapeHtml(c.logged_vs_observed_note)}</div>` : ""}
        </div>`;
      }).join("") || "no calls yet";
    } catch (e) { el.logList.textContent = "Could not load calls: " + e.message; }
  }

  loadLeads().catch((e) => { el.leadName.textContent = "Could not load leads"; el.leadNotes.textContent = e.message + ". The backend may be waking up; press refresh to retry."; });
})();
