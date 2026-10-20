/* Single workspace controller. Secrets stay on the API; local drafts hold call data only. */
(() => {
  "use strict";
  const {
    STAGES,
    OUTCOMES,
    LABELS,
    escapeHtml: esc,
    hasRealTime,
    formatDuration,
    commitmentText,
    summarize,
    filterCalls,
  } = Cockpit;
  const $ = (id) => document.getElementById(id);
  const ids = [
    "apiStatus",
    "connectionText",
    "clock",
    "tabLive",
    "tabLog",
    "screenLive",
    "screenLog",
    "notice",
    "leadPicker",
    "refreshBtn",
    "leadInitials",
    "leadName",
    "leadContact",
    "leadKind",
    "leadNotes",
    "leadNextStep",
    "leadFlags",
    "leadHistory",
    "stepper",
    "stageCounter",
    "stageName",
    "stagePurpose",
    "stageSay",
    "stageTaps",
    "tapStatus",
    "nextStageBtn",
    "endCallBtn",
    "startBtn",
    "langSel",
    "callStage",
    "timer",
    "livePill",
    "theirWords",
    "wordCount",
    "draftStatus",
    "followupType",
    "followupChannel",
    "followupDate",
    "followupTime",
    "commitmentPreview",
    "retrySyncBtn",
    "nextStepText",
    "nextStepHasTime",
    "amberNote",
    "logList",
    "journalStats",
    "stageStats",
    "logSearch",
    "logOutcome",
    "logStage",
    "logCount",
    "refreshLogBtn",
    "sheet",
    "sheetStage",
    "stageReached",
    "outcomeChips",
    "debriefBtn",
    "debriefOut",
    "dbStage",
    "dbOutcome",
    "dbSummary",
    "dbMatch",
    "dbNext",
    "applyDebriefBtn",
    "keepLogBtn",
    "reviewDecision",
    "saveCallBtn",
    "discardBtn",
    "backToCallBtn",
    "workspaceMode",
    "loginSheet",
    "loginForm",
    "loginEmail",
    "loginPassword",
    "loginBtn",
    "loginError",
    "logoutBtn",
  ];
  const el = Object.fromEntries(ids.map((id) => [id, $(id)]));
  const local = ["localhost", "127.0.0.1"].includes(location.hostname);
  let override = null;
  try {
    override = localStorage.getItem("API_URL");
  } catch (_) {
    /* Storage can be disabled. */
  }
  const API = (
    new URLSearchParams(location.search).get("api") ||
    override ||
    (local ? "http://localhost:8000" : location.origin + "/api")
  ).replace(/\/$/, "");
  const DRAFT_KEY = "cockpit.draft.v3:" + API;
  let leads = [],
    journal = [],
    current = null;
  let stage = 1,
    reached = 1,
    callId = null,
    startId = null;
  let startedAt = null,
    endedAt = null,
    timer = null;
  let events = [],
    outbox = [],
    syncing = false,
    starting = false,
    closing = false,
    reviewing = false;
  let outcome = "not_logged",
    review = null,
    reviewApplied = false,
    reviewOriginal = null;
  let accessToken = null,
    authRequired = false,
    modelConfigured = true,
    backendReady = false;

  function notice(text, kind = "") {
    el.notice.textContent = text;
    el.notice.className =
      "notice" + (kind ? " " + kind : "") + (text ? "" : " hidden");
  }
  async function api(path, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      path === "/llm/debrief" ? 35000 : 60000,
    );
    try {
      const response = await fetch(API + path, {
        ...options,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: "Bearer " + accessToken } : {}),
          ...options.headers,
        },
      });
      let data;
      try {
        data = await response.json();
      } catch (_) {
        throw new Error(
          "The service returned an unexpected response. Your draft is retained.",
        );
      }
      if (!response.ok) {
        if (response.status === 401 && authRequired) showLogin();
        const detail =
          typeof data.detail === "string"
            ? data.detail
            : "The request was rejected. Check the entered values.";
        const trace = response.headers?.get("X-Request-ID");
        const error = new Error(
          detail + (trace ? ` (reference ${trace.slice(0, 8)})` : ""),
        );
        error.status = response.status;
        throw error;
      }
      el.apiStatus.classList.add("ok");
      el.connectionText.textContent = "Connected";
      return data;
    } catch (error) {
      if (error.name === "AbortError")
        throw new Error(
          "The service took too long. It may be waking up. Your draft is retained; retry shortly.",
        );
      if (!error.status) {
        el.apiStatus.classList.remove("ok");
        el.connectionText.textContent = "Connection interrupted";
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
  const post = (path, data, method = "POST") =>
    api(path, { method, body: JSON.stringify(data) });
  const duration = () =>
    startedAt
      ? Math.max(0, Math.floor(((endedAt || Date.now()) - startedAt) / 1000))
      : 0;
  const uuid = () => crypto.randomUUID();
  const when = (value) =>
    new Date(value).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  const isPending = (event) => outbox.some((item) => item.id === event.id);
  function persist() {
    if (!callId && !startId) return;
    const draft = {
      version: 3,
      savedAt: Date.now(),
      callId,
      startId,
      leadId: current?.id,
      stage,
      reached,
      startedAt,
      endedAt,
      events,
      outbox,
      outcome,
      words: el.theirWords.value,
      nextStep: el.nextStepText.value,
      hasTime: el.nextStepHasTime.checked,
      language: el.langSel.value,
      followup: [
        el.followupType.value,
        el.followupChannel.value,
        el.followupDate.value,
        el.followupTime.value,
      ],
    };
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      el.draftStatus.textContent = "Draft saved on this device";
    } catch (_) {
      el.draftStatus.textContent =
        "Device storage unavailable. Keep this tab open until saved.";
    }
  }
  function forgetDraft() {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch (_) {}
  }
  function controls() {
    const active = !!callId;
    const busy = starting || closing || reviewing;
    const blocked = current?.status === "do_not_call";
    document.body.classList.toggle("on-call", active);
    el.leadPicker.disabled = active || starting;
    el.refreshBtn.disabled = active || starting;
    el.langSel.disabled = active || starting;
    el.startBtn.disabled =
      active || starting || closing || !current || blocked || !backendReady;
    el.startBtn.textContent = starting
      ? "Opening call…"
      : active
        ? "Call in progress"
        : blocked
          ? "Contact opted out"
          : "Start call ↗";
    el.endCallBtn.disabled = !active || busy;
    el.theirWords.disabled = !active || busy || !!endedAt;
    ["followupType", "followupChannel", "followupDate", "followupTime"].forEach(
      (id) => (el[id].disabled = !active || busy || !!endedAt),
    );
    el.saveCallBtn.disabled = !active || busy || syncing || outbox.length > 0;
    el.discardBtn.disabled = el.saveCallBtn.disabled;
    el.backToCallBtn.disabled = busy;
    el.debriefBtn.disabled =
      !active || busy || syncing || outbox.length > 0 || !modelConfigured;
    el.applyDebriefBtn.disabled = !review || busy;
    el.keepLogBtn.disabled = !review || busy;
    el.stageReached.disabled = busy;
    el.nextStepText.disabled = busy;
    el.nextStepHasTime.disabled = busy;
    el.saveCallBtn.textContent = closing ? "Saving…" : "Save conversation";
    el.debriefBtn.textContent = reviewing
      ? "Reviewing evidence…"
      : modelConfigured
        ? "Run debrief ↗"
        : "AI not configured";
    el.retrySyncBtn.classList.toggle("hidden", !outbox.length || syncing);
    el.tapStatus.textContent = outbox.length
      ? `${outbox.length} event${outbox.length === 1 ? "" : "s"} waiting to sync. Keep this tab open.`
      : active
        ? `${events.length} stage event${events.length === 1 ? "" : "s"} saved`
        : "Start a call to record events.";
    el.livePill.textContent = active
      ? endedAt
        ? "Reviewing"
        : "On call"
      : "Standby";
    el.livePill.classList.toggle("active", active);
    el.callStage.textContent = active
      ? endedAt
        ? "CALL ENDED · REVIEW YOUR LOG"
        : `${STAGES[stage - 1].name.toUpperCase()} · STAGE ${stage}`
      : "READY WHEN YOU ARE";
    el.timer.textContent = formatDuration(duration());
  }
  function invalidateReview() {
    review = null;
    reviewApplied = false;
    reviewOriginal = null;
    el.debriefOut.classList.add("hidden");
  }
  function timingWarning() {
    el.amberNote.classList.toggle(
      "hidden",
      !el.nextStepText.value.trim() ||
        el.nextStepHasTime.checked ||
        hasRealTime(el.nextStepText.value),
    );
    el.commitmentPreview.textContent =
      el.nextStepText.value || "No next step captured yet.";
  }
  function structuredStep() {
    invalidateReview();
    el.nextStepText.value = commitmentText(
      el.followupType.value,
      el.followupChannel.value,
      el.followupDate.value,
      el.followupTime.value,
    );
    el.nextStepHasTime.checked =
      !!el.followupType.value &&
      !!el.followupDate.value &&
      !!el.followupTime.value;
    timingWarning();
    persist();
  }
  ["followupType", "followupChannel", "followupDate", "followupTime"].forEach(
    (id) => (el[id].onchange = structuredStep),
  );
  el.nextStepText.oninput = () => {
    invalidateReview();
    el.nextStepHasTime.checked = false;
    timingWarning();
    persist();
  };
  el.nextStepHasTime.onchange = () => {
    invalidateReview();
    timingWarning();
    persist();
  };
  el.theirWords.oninput = () => {
    el.wordCount.textContent = `${el.theirWords.value.length} / 10000`;
    invalidateReview();
    persist();
  };

  function renderLead(lead) {
    current = lead;
    el.leadInitials.textContent = lead
      ? lead.company
          .split(/\s+/)
          .slice(0, 2)
          .map((word) => word[0])
          .join("")
          .toUpperCase()
      : "—";
    el.leadName.textContent = lead?.company || "No prospects yet";
    el.leadContact.textContent = lead
      ? [lead.contact_name, lead.prospect_role, lead.phone]
          .filter(Boolean)
          .join(" · ")
      : "";
    el.leadKind.textContent = lead
      ? [lead.kind, lead.language].filter(Boolean).join(" · ")
      : "";
    el.leadNotes.textContent = lead?.notes || "No context added yet.";
    el.leadNextStep.textContent = lead?.next_step_text
      ? "Next: " + lead.next_step_text
      : "";
    el.leadFlags.innerHTML =
      (lead?.status === "do_not_call"
        ? '<span class="flag stop">Do not contact</span>'
        : "") +
      (lead?.verify_needed
        ? '<span class="flag warn">Verify contact details</span>'
        : "");
    el.leadHistory.innerHTML = lead?.calls?.length
      ? lead.calls
          .slice(0, 3)
          .map(
            (c) =>
              `<div class="history-item"><strong>${esc(LABELS[c.outcome] || c.outcome)} · ${esc(STAGES[c.stage_reached - 1]?.name || "Unknown stage")}</strong>${esc(when(c.started_at))}</div>`,
          )
          .join("")
      : "No conversations recorded yet.";
    if (!callId && lead) el.langSel.value = lead.language || "English";
    controls();
  }
  async function selectLead(lead) {
    renderLead(lead);
    if (!lead) return;
    el.leadHistory.textContent = "Loading recent conversations…";
    try {
      const detail = await api(`/leads/${encodeURIComponent(lead.id)}`);
      if (current?.id === lead.id) renderLead(detail);
    } catch (error) {
      if (current?.id === lead.id)
        el.leadHistory.textContent = "History unavailable. Refresh to retry.";
      notice(error.message, "error");
    }
  }
  async function loadLeads() {
    if (callId || starting) return;
    const previous = current?.id;
    el.refreshBtn.disabled = true;
    try {
      leads = await api("/leads");
      el.leadPicker.innerHTML = leads.length
        ? leads
            .map(
              (l) =>
                `<option value="${esc(l.id)}">${esc(l.company)} · ${esc(LABELS[l.status] || "Queue")}</option>`,
            )
            .join("")
        : '<option value="">No prospects</option>';
      const lead =
        leads.find((l) => l.id === previous) ||
        leads.find((l) => l.status !== "do_not_call") ||
        leads[0] ||
        null;
      await selectLead(lead);
      el.leadPicker.value = lead?.id || "";
    } finally {
      controls();
    }
  }
  el.leadPicker.onchange = () =>
    selectLead(leads.find((l) => l.id === el.leadPicker.value));
  el.refreshBtn.onclick = () =>
    loadLeads().catch((e) => notice(e.message, "error"));

  function renderStages() {
    el.stepper.innerHTML = STAGES.map((s, i) => {
      const recorded = events.some((e) => e.stage === i + 1);
      return `<button class="step ${i + 1 === stage ? "cur" : recorded ? "done" : ""}" data-n="${i + 1}" data-recorded="${recorded}" aria-label="Stage ${i + 1}: ${esc(s.name)}" ${i + 1 === stage ? 'aria-current="step"' : ""}>${i + 1}</button>`;
    }).join("");
    [...el.stepper.children].forEach(
      (b) =>
        (b.onclick = () => {
          stage = +b.dataset.n;
          renderStages();
          persist();
        }),
    );
    const s = STAGES[stage - 1];
    el.stageCounter.textContent = `STAGE ${String(stage).padStart(2, "0")} / 08`;
    el.stageName.textContent = s.name;
    el.stagePurpose.textContent = s.purpose;
    el.stageSay.innerHTML = s.say
      .map((t) => `<div class="reaction">${esc(t)}</div>`)
      .join("");
    el.stageTaps.innerHTML = s.taps
      .map((t) => {
        const item = events.find((e) => e.stage === stage && e.tap === t);
        return `<button class="chip tap ${item ? "pressed" : ""} ${item && isPending(item) ? "pending" : ""}" data-t="${esc(t)}" aria-pressed="${!!item}" ${!callId || endedAt || closing ? "disabled" : ""}>${esc(t)}</button>`;
      })
      .join("");
    [...el.stageTaps.children].forEach(
      (b) => (b.onclick = () => tap(b.dataset.t)),
    );
    el.nextStageBtn.textContent =
      stage < 8 ? `Next: ${STAGES[stage].name} →` : "All eight stages";
    el.nextStageBtn.disabled = stage === 8;
    controls();
  }
  el.nextStageBtn.onclick = () => {
    stage = Math.min(8, stage + 1);
    renderStages();
    persist();
  };
  async function flushEvents() {
    if (syncing || !callId || !outbox.length) return;
    syncing = true;
    controls();
    try {
      while (outbox.length) {
        const event = outbox[0];
        await post(`/calls/${callId}/events`, event);
        outbox.shift();
        persist();
        renderStages();
      }
    } catch (error) {
      notice(
        error.message + " Use Retry unsaved events before saving.",
        "error",
      );
    } finally {
      syncing = false;
      renderStages();
      persist();
    }
  }
  function tap(text) {
    if (
      !callId ||
      endedAt ||
      events.some((e) => e.stage === stage && e.tap === text)
    )
      return;
    const event = {
      id: uuid(),
      stage,
      tap: text,
      note: el.nextStepText.value || null,
    };
    events.push(event);
    outbox.push(event);
    reached = Math.max(reached, stage);
    invalidateReview();
    if (text.includes("callback")) {
      el.followupType.value = "callback";
      el.followupChannel.value = "Phone";
      structuredStep();
    }
    if (text === "Report on WhatsApp" || text === "Report on email") {
      el.followupType.value = "report";
      el.followupChannel.value = text.endsWith("email") ? "Email" : "WhatsApp";
      structuredStep();
    }
    persist();
    renderStages();
    return flushEvents();
  }
  el.retrySyncBtn.onclick = flushEvents;
  el.startBtn.onclick = async () => {
    if (
      !current ||
      callId ||
      starting ||
      closing ||
      !backendReady ||
      current.status === "do_not_call"
    )
      return;
    starting = true;
    startId ||= uuid();
    startedAt ||= Date.now();
    persist();
    controls();
    try {
      const call = await post("/calls", {
        id: startId,
        lead_id: current.id,
        language: el.langSel.value,
      });
      callId = call.id;
      stage = 1;
      reached = 1;
      events = [];
      outbox = [];
      endedAt = null;
      timer && clearInterval(timer);
      timer = setInterval(controls, 1000);
      notice("");
      persist();
      renderStages();
    } catch (error) {
      notice(
        error.message + " Press Start call to retry the same session.",
        "error",
      );
    } finally {
      starting = false;
      controls();
    }
  };
  function renderOutcomes() {
    el.outcomeChips.innerHTML = OUTCOMES.map(
      (o) =>
        `<button class="chip ${o === outcome ? "pressed" : ""}" data-o="${o}" aria-pressed="${o === outcome}">${LABELS[o]}</button>`,
    ).join("");
    [...el.outcomeChips.children].forEach(
      (b) =>
        (b.onclick = () => {
          outcome = b.dataset.o;
          reviewApplied = false;
          renderOutcomes();
          persist();
        }),
    );
  }
  function modal(open) {
    el.sheet.classList.toggle("hidden", !open);
    el.screenLive.inert = open;
    el.screenLog.inert = open;
    el.tabLive.disabled = open;
    el.tabLog.disabled = open;
    document.body.style.overflow = open ? "hidden" : "";
    if (open) el.stageReached.focus();
    else el.endCallBtn.focus();
  }
  el.endCallBtn.onclick = () => {
    if (!callId || starting) return;
    endedAt ||= Date.now();
    el.stageReached.value = String(reached);
    el.sheetStage.textContent = `Stage ${reached} · ${formatDuration(duration())}`;
    renderOutcomes();
    timingWarning();
    modal(true);
    controls();
    persist();
  };
  el.backToCallBtn.onclick = () => {
    if (closing || reviewing) return;
    if (endedAt) startedAt += Date.now() - endedAt;
    endedAt = null;
    modal(false);
    invalidateReview();
    renderStages();
    persist();
  };
  el.stageReached.onchange = () => {
    reached = +el.stageReached.value;
    invalidateReview();
    el.sheetStage.textContent = `Stage ${reached} · ${formatDuration(duration())}`;
    persist();
  };
  function clearSession() {
    callId = null;
    startId = null;
    startedAt = null;
    endedAt = null;
    events = [];
    outbox = [];
    stage = 1;
    reached = 1;
    outcome = "not_logged";
    invalidateReview();
    timer && clearInterval(timer);
    timer = null;
    forgetDraft();
    el.theirWords.value = "";
    el.wordCount.textContent = "0 / 10000";
    el.nextStepText.value = "";
    el.nextStepHasTime.checked = false;
    ["followupType", "followupChannel", "followupDate", "followupTime"].forEach(
      (id) => (el[id].value = ""),
    );
    el.draftStatus.textContent = "No active draft";
    timingWarning();
    modal(false);
    renderStages();
  }
  async function save(discard = false) {
    if (!callId || closing || reviewing || syncing || outbox.length) return;
    if (
      discard &&
      !confirm(
        "Close without your notes? The call and its stage taps remain recorded as not logged.",
      )
    )
      return;
    closing = true;
    controls();
    const savedId = callId;
    try {
      await post(
        `/calls/${savedId}`,
        {
          outcome: discard ? "not_logged" : outcome,
          stage_reached: reached,
          duration_s: Math.max(1, duration()),
          their_words: discard ? "" : el.theirWords.value,
          next_step_text: discard ? "" : el.nextStepText.value,
          next_step_has_time:
            !discard &&
            !!el.nextStepText.value.trim() &&
            (el.nextStepHasTime.checked || hasRealTime(el.nextStepText.value)),
          summary: !discard && review ? review.summary : "",
          language: el.langSel.value,
          llm_reviewed: !discard && !!review,
          logged_vs_observed_note:
            !discard &&
            review &&
            !reviewApplied &&
            (review.suggested_outcome !== outcome ||
              review.observed_stage !== reached)
              ? `Caller kept stage ${reached}, ${LABELS[outcome]}. AI suggested stage ${review.observed_stage}, ${LABELS[review.suggested_outcome]}.`
              : "",
        },
        "PATCH",
      );
      clearSession();
      notice(
        discard
          ? "Session closed as not logged."
          : "Conversation saved. Ready for the next one.",
        "success",
      );
      await loadLeads();
    } catch (error) {
      notice(
        error.message + " Your draft is retained. Retry Save when connected.",
        "error",
      );
      persist();
    } finally {
      closing = false;
      controls();
    }
  }
  el.saveCallBtn.onclick = () => save(false);
  el.discardBtn.onclick = () => save(true);

  el.debriefBtn.onclick = async () => {
    if (!callId || reviewing || outbox.length || !modelConfigured) return;
    reviewing = true;
    controls();
    try {
      const result = await post("/llm/debrief", {
        call_id: callId,
        logged_outcome: outcome,
        logged_stage: reached,
        their_words: el.theirWords.value,
        next_step_text: el.nextStepText.value,
        next_step_has_time:
          el.nextStepHasTime.checked || hasRealTime(el.nextStepText.value),
      });
      if (!result.available) {
        notice(
          (result.error || "Debrief unavailable.") + " You can save manually.",
        );
        return;
      }
      reviewOriginal = {
        outcome,
        reached,
        nextStep: el.nextStepText.value,
        hasTime: el.nextStepHasTime.checked,
      };
      review = result;
      reviewApplied = false;
      el.debriefOut.classList.remove("hidden");
      el.dbStage.textContent = `${result.observed_stage} · ${STAGES[result.observed_stage - 1].name}`;
      el.dbOutcome.textContent = LABELS[result.suggested_outcome];
      el.dbSummary.textContent = result.summary;
      const differs =
        result.suggested_outcome !== outcome ||
        result.observed_stage !== reached;
      el.dbMatch.classList.toggle("hidden", !differs);
      el.dbMatch.textContent = differs
        ? result.mismatch_note ||
          "The suggested stage or outcome differs from your draft."
        : "";
      el.dbNext.textContent = result.next_step_text
        ? "Next: " + result.next_step_text
        : "No next step found in the evidence.";
      el.reviewDecision.textContent =
        "Suggestion only. Your log has not changed.";
    } catch (error) {
      notice(error.message + " You can still save manually.", "error");
    } finally {
      reviewing = false;
      controls();
    }
  };
  el.applyDebriefBtn.onclick = () => {
    if (!review) return;
    outcome = review.suggested_outcome;
    reached = review.observed_stage;
    reviewApplied = true;
    el.stageReached.value = String(reached);
    el.nextStepText.value = review.next_step_text;
    el.nextStepHasTime.checked = review.next_step_has_time;
    el.sheetStage.textContent = `Stage ${reached} · reviewed`;
    el.reviewDecision.textContent = "Suggestion applied. Review it, then save.";
    renderOutcomes();
    timingWarning();
    persist();
  };
  el.keepLogBtn.onclick = () => {
    if (reviewApplied && reviewOriginal) {
      outcome = reviewOriginal.outcome;
      reached = reviewOriginal.reached;
      el.stageReached.value = String(reached);
      el.nextStepText.value = reviewOriginal.nextStep;
      el.nextStepHasTime.checked = reviewOriginal.hasTime;
      renderOutcomes();
      timingWarning();
    }
    reviewApplied = false;
    el.reviewDecision.textContent =
      "Your original log is kept. A disagreement note will be retained when saved.";
    persist();
  };

  function renderJournal() {
    const rows = filterCalls(
      journal,
      el.logSearch.value,
      el.logOutcome.value,
      el.logStage.value,
    );
    el.logCount.textContent = `${rows.length} of ${journal.length} recent conversations`;
    el.logList.innerHTML =
      rows
        .map(
          (c) =>
            `<article class="log-row"><span class="log-stage">${esc(String(c.stage_reached).padStart(2, "0"))} · ${esc(STAGES[c.stage_reached - 1]?.name || "Unknown")}</span><div><div class="log-co">${esc(c.company || "Unknown prospect")}</div><p class="log-next ${c.next_step_text && !c.next_step_has_time ? "amber" : ""}">${esc(c.next_step_text || "No next step recorded")}</p></div><span class="badge ${esc(c.outcome)}">${esc(LABELS[c.outcome] || c.outcome)}</span><span class="log-date">${esc(when(c.started_at))}<br/>${esc(formatDuration(c.duration_s || 0))}</span>${c.logged_vs_observed_note ? `<div class="mismatch row-note">Review: ${esc(c.logged_vs_observed_note)}</div>` : ""}<details><summary>Conversation record${c.llm_reviewed ? " · AI reviewed" : ""}</summary><p>${esc(c.summary || "No summary recorded")}</p><blockquote>${esc(c.their_words || "No prospect words captured")}</blockquote></details></article>`,
        )
        .join("") ||
      '<div class="empty-state"><strong>No conversations here yet.</strong>Try a different filter, or save your first conversation.</div>';
  }
  async function loadJournal() {
    el.refreshLogBtn.disabled = true;
    try {
      journal = await api("/calls?limit=200");
      const stats = summarize(journal);
      el.journalStats.innerHTML = [
        [stats.count, "Recent conversations"],
        [stats.untimed, "Next steps without timing"],
        [stats.unlogged, "Unlogged outcomes"],
        [stats.reviewed, "AI reviewed"],
      ]
        .map(
          ([n, title]) =>
            `<div class="stat-card"><strong>${n}</strong><span>${title}</span></div>`,
        )
        .join("");
      const maximum = Math.max(1, ...stats.stages);
      el.stageStats.innerHTML = stats.stages
        .map(
          (n, i) =>
            `<div class="stage-stat"><strong>${n}</strong><div class="stage-bar"><span style="height:${Math.round((n / maximum) * 100)}%"></span></div>${i + 1} · ${STAGES[i].name}</div>`,
        )
        .join("");
      renderJournal();
    } catch (error) {
      el.logList.textContent =
        "Journal unavailable. Your active call is retained.";
      notice(error.message, "error");
    } finally {
      el.refreshLogBtn.disabled = false;
    }
  }
  el.logSearch.oninput = renderJournal;
  el.logOutcome.onchange = renderJournal;
  el.logStage.onchange = renderJournal;
  el.refreshLogBtn.onclick = loadJournal;
  function tab(log) {
    el.screenLive.classList.toggle("hidden", log);
    el.screenLog.classList.toggle("hidden", !log);
    el.tabLive.classList.toggle("active", !log);
    el.tabLog.classList.toggle("active", log);
    el.tabLive.setAttribute("aria-current", log ? "false" : "page");
    el.tabLog.setAttribute("aria-current", log ? "page" : "false");
    if (log) return loadJournal();
  }
  el.tabLive.onclick = () => tab(false);
  el.tabLog.onclick = () => tab(true);
  const options = STAGES.map(
    (s, i) => `<option value="${i + 1}">${i + 1} · ${s.name}</option>`,
  ).join("");
  el.stageReached.innerHTML = options;
  el.logStage.innerHTML += "" + options;
  el.logOutcome.innerHTML += OUTCOMES.map(
    (o) => `<option value="${o}">${LABELS[o]}</option>`,
  ).join("");

  async function recoverDraft() {
    let draft;
    try {
      draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
    } catch (_) {
      forgetDraft();
      return;
    }
    if (
      !draft ||
      draft.version !== 3 ||
      Date.now() - draft.savedAt > 86400000
    ) {
      forgetDraft();
      return;
    }
    const id = draft.callId || draft.startId;
    if (!id || !draft.leadId) {
      forgetDraft();
      return;
    }
    let server;
    try {
      server = await api(`/calls/${encodeURIComponent(id)}`);
    } catch (error) {
      if (error.status !== 404) throw error;
    }
    if (server && (server.outcome !== "not_logged" || server.duration_s > 0)) {
      forgetDraft();
      return;
    }
    const lead = leads.find((l) => l.id === draft.leadId);
    if (!lead) {
      notice(
        "A local draft refers to a prospect that is no longer in this workspace.",
      );
      return;
    }
    await selectLead(lead);
    el.leadPicker.value = lead.id;
    callId = server?.id || null;
    startId = draft.startId;
    startedAt = draft.startedAt;
    endedAt = draft.endedAt;
    stage = Math.max(1, Math.min(8, draft.stage || 1));
    reached = Math.max(1, Math.min(8, draft.reached || 1));
    outcome = OUTCOMES.includes(draft.outcome) ? draft.outcome : "not_logged";
    const confirmed = server?.events || [];
    const known = new Set(confirmed.map((e) => e.id));
    outbox = (draft.outbox || []).filter((e) => !known.has(e.id));
    events = [...confirmed, ...outbox];
    el.theirWords.value = draft.words || "";
    el.wordCount.textContent = `${el.theirWords.value.length} / 10000`;
    el.nextStepText.value = draft.nextStep || "";
    el.nextStepHasTime.checked = !!draft.hasTime;
    el.langSel.value = draft.language || "English";
    ["followupType", "followupChannel", "followupDate", "followupTime"].forEach(
      (key, i) => (el[key].value = draft.followup?.[i] || ""),
    );
    timingWarning();
    renderStages();
    persist();
    if (callId) {
      timer = setInterval(controls, 1000);
      if (endedAt) el.endCallBtn.onclick();
      await flushEvents();
    }
    notice(
      "Your unfinished conversation was restored from this device. Review it before continuing.",
    );
  }
  function showLogin() {
    el.loginSheet.classList.remove("hidden");
    el.screenLive.inert = true;
    el.screenLog.inert = true;
    el.loginEmail.focus();
  }
  el.loginForm.onsubmit = async (event) => {
    event.preventDefault();
    el.loginBtn.disabled = true;
    el.loginError.textContent = "";
    try {
      const result = await post("/auth/login", {
        email: el.loginEmail.value,
        password: el.loginPassword.value,
      });
      accessToken = result.access_token;
      el.loginPassword.value = "";
      el.loginSheet.classList.add("hidden");
      el.screenLive.inert = false;
      el.screenLog.inert = false;
      el.logoutBtn.classList.remove("hidden");
      await loadLeads();
      if (!callId) await recoverDraft();
    } catch (error) {
      el.loginError.textContent = error.message;
    } finally {
      el.loginBtn.disabled = false;
    }
  };
  el.logoutBtn.onclick = () => {
    if (callId) {
      notice("Save or close the current conversation before signing out.");
      return;
    }
    accessToken = null;
    leads = [];
    journal = [];
    renderLead(null);
    el.logList.textContent = "Sign in to view the journal.";
    showLogin();
  };
  document.addEventListener("keydown", (event) => {
    const dialog = !el.loginSheet.classList.contains("hidden")
      ? el.loginSheet
      : !el.sheet.classList.contains("hidden")
        ? el.sheet
        : null;
    if (!dialog) return;
    if (
      event.key === "Escape" &&
      dialog === el.sheet &&
      !closing &&
      !reviewing
    ) {
      el.backToCallBtn.onclick();
      event.preventDefault();
    }
    if (event.key === "Tab") {
      const focusable = [
        ...dialog.querySelectorAll(
          "button:not([disabled]),input:not([disabled]),select:not([disabled])",
        ),
      ].filter((node) => !node.closest(".hidden"));
      if (!focusable.length) return;
      const first = focusable[0],
        last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        last.focus();
        event.preventDefault();
      } else if (!event.shiftKey && document.activeElement === last) {
        first.focus();
        event.preventDefault();
      }
    }
  });
  addEventListener("beforeunload", (event) => {
    if (callId || startId) {
      persist();
      event.preventDefault();
      event.returnValue = "";
    }
  });
  addEventListener("offline", () => {
    notice(
      "You are offline. Words and pending taps stay on this device until you reconnect.",
    );
  });
  addEventListener("online", () => {
    notice("Connection restored. Retrying pending stage events.");
    flushEvents();
  });
  const clock = () =>
    (el.clock.textContent = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }));
  clock();
  setInterval(clock, 15000);
  renderStages();
  async function boot() {
    try {
      const health = await api("/health");
      backendReady = Number((health.version || "0").split(".")[0]) >= 3;
      authRequired = !!health.auth_required;
      modelConfigured = health.llm_configured !== false;
      el.workspaceMode.textContent = authRequired
        ? "Private workspace · approved accounts only"
        : "Public demo · fictional data only";
      controls();
      if (authRequired) {
        showLogin();
        return;
      }
      await loadLeads();
      if (backendReady) await recoverDraft();
      else
        notice(
          "This workspace update needs API version 3. Deploy the latest Render commit, then refresh this page.",
        );
    } catch (error) {
      el.leadName.textContent = "Workspace is waking up";
      notice(error.message + " Refresh prospects to retry.", "error");
    }
  }
  boot();
})();
