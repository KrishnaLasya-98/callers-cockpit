# Completion checklist

See `docs/TASK.md` for the full requirements and `README.md` for setup and commands.

- [x] Implement eight-stage frontend, call log, Supabase schema and FastAPI API.
- [x] Implement Mistral post-call debrief.
- [x] Repair discard payload, lead history, next-step warnings and stage-tap display.
- [x] Validate model responses and make suggestion acceptance explicit.
- [x] Correct recording requirements: applicant visible, unscripted, at least six minutes, Google Drive.
- [x] Replace public detailed transcript excerpts with aggregate design notes; private original ignored.
- [x] Local verification: 12 Python API/model tests and 8 JavaScript workflow tests pass; JS syntax and diff whitespace checks pass. Four live Mistral scenarios passed (timed callback, wrong contact, do-not-call, untimed callback).
- [ ] Publish this patch and deploy Render Free service.
- [ ] Deploy frontend with verified Render rewrite URL.
- [ ] Verify deployed API and complete a persisted call walkthrough.
- [ ] Verify service-role/RLS configuration before claiming backend-only DB access.
- [ ] Applicant records and shares the six-minute-or-longer video on Drive.
- [ ] Applicant submits repo + video through the task page and completes WhatsApp.

Use fictional demo data only. Registration timestamp is still needed to calculate the deadline. Existing Git history may retain removed transcript excerpts; history has not been rewritten.
