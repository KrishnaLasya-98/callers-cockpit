# Completion checklist

See `docs/TASK.md` for the full requirements and `README.md` for setup and commands.

- [x] Implement eight-stage frontend, call log, Supabase schema and FastAPI API.
- [x] Implement Mistral post-call debrief.
- [x] Repair discard payload, lead history, next-step warnings and stage-tap display.
- [x] Validate model responses and make suggestion acceptance explicit.
- [x] Correct recording requirements: applicant visible, unscripted, at least six minutes, Google Drive.
- [x] Replace public detailed transcript excerpts with aggregate design notes; private original ignored.
- [x] Read the source structure/reference pages and all 100 transcripts privately; recompute facts and replace unsupported stage estimates with a declared annotation method.
- [x] Version 3 UI: focused workspace, one live words box, structured follow-ups, searchable journal and explicit AI decisions.
- [x] Version 3 reliability: device draft, refresh recovery, pending-event outbox, retry-safe UUIDs and paused wrap-up duration.
- [x] Version 3 API: bounded inputs/bodies, request tracing, rate/concurrency limits and optional verified-user workspace access.
- [x] Local v3 verification: 24 Python tests, 16 DOM workflow tests and 5 isolated Chromium tests pass.
- [x] Publish the repair and deploy Render Free service.
- [x] Deploy the repaired frontend to production with the correct Render rewrite URL.
- [x] Verify public frontend, Render and Vercel-proxy health/leads/calls, and a live Mistral debrief through the proxy.
- [ ] Publish and verify version 3.0.0, its redesigned assets and CI. The checks immediately above refer to the preceding deployed repair.
- [ ] Complete a persisted call walkthrough in the deployed UI; automatic approval review blocked the synthetic live-write test before execution.
- [ ] Verify service-role/RLS configuration before claiming backend-only DB access.
- [ ] Applicant records and shares the six-minute-or-longer video on Drive.
- [ ] Applicant submits repo + video through the task page and completes WhatsApp.

Use fictional demo data only. Registration was reported as 19 October afternoon, so the deadline is approximately 21 October afternoon. Existing Git history may retain removed transcript excerpts; history has not been rewritten.
