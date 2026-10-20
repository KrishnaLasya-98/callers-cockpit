/* General, original reaction prompts informed by the private task research. */
(() => {
  const STAGES = [
    {
      name: "Opening",
      purpose: "Confirm who answered and introduce yourself before the pitch.",
      say: [
        "A receptionist asks for the reason",
        "The contact has moved roles",
        "They need a different language",
      ],
      taps: [
        "Right person answers",
        "Reception screen",
        "Wrong contact",
        "Contact has left",
        "Language barrier",
        "Audio problem",
      ],
    },
    {
      name: "Purpose",
      purpose:
        "Explain the value in one sentence they could repeat to a colleague.",
      say: [
        "They need a clearer description",
        "They question the contact source",
        "They ask how the free offer benefits you",
      ],
      taps: [
        "Purpose understood",
        "Asked what we do",
        "Asked about contact source",
        "Questioned commercial intent",
        "Asked for evidence first",
      ],
    },
    {
      name: "Permission",
      purpose:
        "Get a clear yes, no, or callback commitment. Respect their answer.",
      say: [
        "They are busy but offer a callback",
        "They redirect you to a colleague",
        "They prefer written information first",
      ],
      taps: [
        "Clear yes",
        "Clear no",
        "Busy; callback offered",
        "Referral offered",
        "Contact cannot be shared",
        "No clear permission",
      ],
    },
    {
      name: "Their business",
      purpose:
        "Understand their work and decision authority before discussing your solution.",
      say: [
        "They correct the company information",
        "They explain a narrower responsibility",
        "They ask about your business first",
      ],
      taps: [
        "Business described",
        "Company details corrected",
        "Scope clarified",
        "Asked about us first",
      ],
    },
    {
      name: "Their need",
      purpose:
        "Listen for their goal or constraint. Capture their words without translating them into your pitch.",
      say: [
        "They describe a practical constraint",
        "They have no current need",
        "They keep their plans private",
      ],
      taps: [
        "Goal shared",
        "Constraint shared",
        "No current need",
        "Plans kept private",
        "Need captured in their words",
      ],
    },
    {
      name: "Objection",
      purpose:
        "Understand the reason. A provider or authority limit is evidence, not a hidden motive.",
      say: [
        "They already have a provider",
        "Another team owns the decision",
        "They need a relevant example or proof",
      ],
      taps: [
        "Existing provider",
        "No current fit",
        "Decision elsewhere",
        "Evidence requested",
        "Wrong function",
        "Data or trust concern",
        "Do not contact again",
      ],
    },
    {
      name: "Next step",
      purpose:
        "Agree one action, with a channel or a named time. Receiving a document does not prove interest.",
      say: [
        "They accept material for review",
        "They offer a specific time",
        "The follow-up is still vague",
      ],
      taps: [
        "Report on WhatsApp",
        "Report on email",
        "Timed callback agreed",
        "Meeting agreed",
        "Referral agreed",
        "Timing unspecified",
      ],
    },
    {
      name: "Close",
      purpose:
        "Reconfirm the commitment, close clearly, then record the outcome honestly.",
      say: [
        "They confirm the agreed action",
        "The line drops before confirmation",
        "A polite goodbye follows a refusal",
      ],
      taps: ["Commitment reconfirmed", "Polite close", "Line dropped"],
    },
  ];
  const OUTCOMES = [
    "agreed_to_receive_report",
    "next_step_agreed",
    "interested",
    "follow_up",
    "call_again",
    "not_interested",
    "do_not_call",
    "wrong_person",
    "moved_company",
    "not_logged",
  ];
  const LABELS = {
    agreed_to_receive_report: "Receive report",
    next_step_agreed: "Next step agreed",
    interested: "Interested",
    follow_up: "Follow up",
    call_again: "Call again",
    not_interested: "Not interested",
    do_not_call: "Do not call",
    wrong_person: "Wrong person",
    moved_company: "Moved company",
    not_logged: "Not logged",
  };
  const escapeHtml = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  function hasRealTime(text) {
    const v = (text || "").toLowerCase();
    const day =
      /\b(mon(day)?|tue(sday)?|wed(nesday)?|thu(rsday)?|fri(day)?|sat(urday)?|sun(day)?|tomorrow|today)\b|\b\d{4}-\d{2}-\d{2}\b/.test(
        v,
      );
    const time = /\b\d{1,2}(:\d{2})?\s*(am|pm)\b|\b\d{1,2}:\d{2}\b/.test(v);
    return (
      (day && time) ||
      /\b(in|after)\s+(\d+|an?|thirty|sixty)\s*(minutes?|mins?|hours?|hrs?)\b/.test(
        v,
      )
    );
  }
  const formatDuration = (s) =>
    [s / 3600, (s % 3600) / 60, s % 60]
      .map((n) => String(Math.floor(Math.max(0, n))).padStart(2, "0"))
      .join(":");
  function commitmentText(type, channel, date, time) {
    if (!type) return "";
    const action =
      {
        report: "Send report",
        callback: "Call back",
        meeting: "Meet",
        referral: "Connect with referred colleague",
      }[type] || "Follow up";
    return (
      action +
      (channel ? ` via ${channel}` : "") +
      (date
        ? ` on ${date}${time ? ` at ${time}` : " (time not set)"}`
        : time
          ? ` at ${time} (day not set)`
          : "")
    );
  }
  function summarize(calls) {
    const stages = Array(8).fill(0);
    calls.forEach((c) => {
      if (c.stage_reached >= 1 && c.stage_reached <= 8)
        stages[c.stage_reached - 1]++;
    });
    return {
      count: calls.length,
      stages,
      unlogged: calls.filter((c) => c.outcome === "not_logged").length,
      untimed: calls.filter((c) => c.next_step_text && !c.next_step_has_time)
        .length,
      reviewed: calls.filter((c) => c.llm_reviewed).length,
    };
  }
  function filterCalls(calls, query, outcome, stage) {
    const term = query.trim().toLowerCase();
    return calls.filter(
      (c) =>
        (!outcome || c.outcome === outcome) &&
        (!stage || c.stage_reached === +stage) &&
        (!term ||
          [c.company, c.summary, c.their_words, c.next_step_text].some((v) =>
            (v || "").toLowerCase().includes(term),
          )),
    );
  }
  globalThis.Cockpit = {
    STAGES,
    OUTCOMES,
    LABELS,
    escapeHtml,
    hasRealTime,
    formatDuration,
    commitmentText,
    summarize,
    filterCalls,
  };
  if (typeof module !== "undefined") module.exports = globalThis.Cockpit;
})();
