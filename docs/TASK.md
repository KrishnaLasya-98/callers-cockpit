# Task and completion checklist

Source: https://sainikpuri.deepthought.education/fde-hyderabad-v2 and the applicant's registered task text. Deadline: 48 hours from registration; registration time has not been supplied.

## Required product

Build the screen a caller keeps open on a cold call. Cover all eight stages: Opening, Purpose, Permission, Their business, Their need, Objection, Next step, Close. Each stage shows its purpose, common prospect reactions, taps for what happened and access to the prospect-word capture. End the call from any stage. A second screen lists saved calls and the stage reached.

Use Supabase for data, Render for start/event/close/list/health endpoints, and Vercel for the screen, all on free tiers. Use an LLM with a free key for at least one justified purpose; hold that key in the backend.

Read all three task resources: the call structure, reference screen and supplied transcript archive. Source transcripts are task-only material and must not be published. Aggregate observations and design implications are in `transcript-analysis.md`; private original notes, if present, are ignored under `.private/`.

## What is built

- Static HTML/CSS/JS live-call guide and call log.
- Eight stage cards with tap events, prospect words, outcome and next-step capture.
- FastAPI routes backed by `leads`, `calls`, `stage_events` in Supabase.
- Mistral `ministral-8b-2512` post-call audit. Suggestions are optional and saved with the final caller decision. Strict output validation rejects malformed results; manual save remains available on failure.
- Lead history fetched from lead detail, stage taps retained visually, and missing next-step time flagged.

## Verified status as of 2026-10-20 (before this patch is deployed)

| Component | Evidence |
|---|---|
| GitHub | Repair source and regression tests are included in this revision; repository URL is in README |
| Vercel | Existing static app responds 200; patched version still needs deployment |
| Render | Configured `/health` returns 404; service creation or URL correction required |
| Vercel API proxy | `/api/health` returns 404 while Render is unavailable |
| Supabase | Backend credentials can read all three tables: 10 leads, 3 calls, 13 events at the initial check |
| Mistral | API responds; quality checks required in addition to connectivity |
| Local repair checks | 12 Python tests and 8 JavaScript workflow tests pass; four live Mistral scenarios pass. Browser layout and deployed walkthrough are still pending |
| Video | Not provided or verified |
| Submission | Not verified |

## Finish in this order

1. Run the local regression checks in README and review the patch.
2. Publish the fixed source to GitHub and deploy the Render Free service. Use `render.yaml` or its settings from README. Set Supabase credentials, Mistral key/model and frontend origin.
3. Verify Render `/health`, update both Vercel rewrite configurations if its hostname changed, and deploy the frontend.
4. Run `python scripts/check_deployment.py`. Walk through a complete call, debrief, save and reload on the deployed UI, including a narrow phone viewport and a model failure/manual-save case.
5. Update README and this status board with the exact verified URLs and results. Do not mark deploy complete until the live endpoints work.
6. Applicant records an **unscripted video at least 6 minutes long, visible on camera**, walking through a provided transcript scenario and explaining a design decision and the LLM choice. Screen plus camera overlay is suitable. Use prompts in `video-script.md`, not a read-out script.
7. Applicant uploads the actual video to **Google Drive** and sets **anyone with the link can view**. Check duration, media type, face visibility, audio and access without the owner's sign-in. Other video hosts are not accepted.
8. Submit the **GitHub repo in the first box** and the **Drive video in the second box** on the applicant's task page. Confirm acceptance; the form checks file access/type and rejects video shorter than six minutes.
9. Applicant completes the CEO WhatsApp step from the task page, with the Vercel URL, Render health URL and requested answers. The video and WhatsApp message must be the applicant's own work.

## Limits and remaining account work

Browser access and the registration timestamp are still needed for dashboard work and deadline calculation. Existing permissive anon policies were recorded in earlier notes; do not claim backend-only database access without checking/removing those policies using a working service-role key. The demo API itself is public and must contain only fictional data.

The Windows integration found the signed-in Render window. An initial attempt stopped because it could not verify the browser URL; a later retry read the correct setup page but failed to activate the window and timed out during recovery. No Render settings or secrets were changed. The read-only deployment checker still reports 404 for all configured Render and Vercel-proxy API paths. Source publication does not complete deployment; verify the live endpoints separately.
