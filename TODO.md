# TODO — Caller's Cockpit (48h FDE build)

## Phase 0 — Read & decide ✅
- [x] Read all 3 readings fully (structure ✓, reference ✓, transcripts → `docs/transcript-analysis.md`)
- [x] Lock the 8-stage model: Opening · Purpose · Permission · Their business · Their need · Objection · Next step · Close
- [x] Adopt the transcripts' outcome vocabulary (agreed_to_receive_report, next_step_agreed, interested, follow_up, call_again, not_interested, do_not_call, wrong_person, moved_company, not_logged)
- [x] Decide the LLM's ONE job: **post-call debrief** — audits the log (observed stage, suggested outcome, one-line summary, next step, mismatch note). Rationale for video: T084 logged do_not_call on a clean close; T002 left an explicit 30-min call-back as not_logged; 13% not_logged → the LLM guards against exactly this.
- [x] Decide stage-by-stage taps from the analysis (stage 3 = exit-type taps; stage 6 = objection zoo; stage 7 = day+time check)

## Phase 1 — Data rebuild ✅
- [x] New schema: stage_reached 1–8 on calls, 10-word outcome check constraint, their_words, next_step_has_time, stage_events per tap, verify_needed on leads
- [x] Rewrite sql/schema.sql + seed 10 Meridian-style leads (with verify_needed flags)
- [x] Prompts grounded in the transcript world (growth work; decode "already have consultants")

## Phase 2 — Backend (v2) ✅ (import/boot-verified; DB-backed flows need creds)
- [x] db.py: call row opens at dial start, stage events, call close-out, lead sync (status + next step + verify flag)
- [x] POST /llm/debrief implemented (Gemini REST, JSON out, fallback when unreachable)
- [x] Routes: /health · /leads (GET/POST) · /leads/{id} (GET/PATCH) · /calls (GET/POST) · /calls/{id}/events (GET/POST) · /calls/{id} (PATCH)
- [ ] **TODO curl-test each endpoint with live Supabase creds** (blocked until user adds .env values)

## Phase 3 — Frontend rebuild ✅ (44/44 element ids verified; JS syntax checked)
- [x] Screen 1 = live call: lead card + stepper 1–8 + stage card (purpose, "they tend to say", what-happened taps) + their-words box + next-step input with amber day+time warning
- [x] Screen 2 = call log: stage-reached strip + rows with outcome badges, amber date-less next steps, LLM mismatch notes
- [x] Outcome sheet modal with the 10-word vocabulary + debrief button (LLM suggests, caller accepts or keeps)

## Phase 4 — Deploy ⬜
- [ ] Supabase: run sql/schema.sql once .env values exist
- [ ] Render: backend up, env vars, /health green, warm-up ping in video
- [ ] Vercel: frontend, /api rewrite pointed at the live Render URL
- [ ] End-to-end soak on a phone (arm's-length usability)

## Phase 5 — Video + submit ⬜
- [ ] 6-min script draft: caller pain from transcripts → screen → why debrief LLM → deployments → decisions
- [ ] Record (screen + mic), one take + one spare
- [ ] WhatsApp submission before the 48h deadline

## Standing rules
- Frozen scope: nothing extra goes into code at hour 24+; ideas go under "what I'd build next" in the video.
- The LLM key never ships in the frontend.
- Every design choice in the video cites either the readings or `docs/transcript-analysis.md`.

## Key numbers to cite in the video (from the analysis)
- 18% of calls die at stage 3 (wrong person / busy gates); 40%+ if you count early exits
- 41% of "forward" calls reach stage 7, most without a day+time
- Stage-5 verbatim capture: ~never happens in the transcripts
- 13 calls ended not_logged; mismatches exist (T084, T002)
