# Task and completion checklist

Source: https://sainikpuri.deepthought.education/fde-hyderabad-v2 and the applicant's registered task text. The structure page, reference page and all 100 transcript files were read directly during the v3 review. Registration was reported as the afternoon of 19 October 2026, putting the approximate deadline on the afternoon of 21 October; the exact clock time is unknown.

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

## Verified status as of 2026-10-20

| Component | Evidence |
|---|---|
| GitHub | Repair source and regression tests are included in this revision; repository URL is in README |
| Vercel | Public production URL serves the repaired frontend |
| Render | https://callers-cockpit.onrender.com/health, /leads and /calls all pass |
| Vercel API proxy | Public /api/health, /api/leads and /api/calls all pass |
| Supabase | Backend credentials can read all three tables: 10 leads, 3 calls, 13 events at the initial check |
| Mistral | Live debrief through the public Vercel proxy correctly identifies a timed callback as next_step_agreed at stage 7 |
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

The applicant configured Render's environment and promoted Vercel deployment f4f831f to production. The public frontend, direct API and proxy now pass all seven read-only deployment checks. A live Mistral debrief through the proxy also passes. The service root `/` has no route and its 404 is expected; use `/health`.

Automatic approval review rejected a proposed synthetic live-write test with only the reason "blocked by policy"; it did not execute or create any records. The final deployed save-and-reload workflow and browser layout checks remain for the applicant's rehearsal. Local workflow tests passed.

## Version 3 acceptance map

The status above describes the preceding deployed revision. Version 3.0.0 adds the changes below. Verify the API version and static assets after publishing; do not claim it is live merely because the source exists.

| Requirement | Implementation |
|---|---|
| Eight stages in the original order | `frontend/domain.js`, named stage buttons and a purpose for each stage |
| Likely reactions grounded in the readings | Three original, concise reaction prompts per stage; research rationale in `transcript-analysis.md` |
| Tap for what happened | UUID-keyed events, persistent selection, acknowledgement and retry outbox |
| One live free-text box | Prospect-word textarea; follow-up action/channel/day/time are structured controls. Text editing of next steps is in the post-call dialog |
| Named next stage; end anywhere | The next button names its destination; End call pauses duration and opens review |
| Saved-call second screen | Search, outcome/stage filters, reached-stage counts and expandable records |
| Supabase / Render / Vercel | Existing three-table contracts, typed API, health/readiness and same-origin proxy |
| Free-key LLM in the backend | Bounded Mistral evidence audit; explicit Use suggestion / Keep my log; manual save on model failure |
| Useful engineering explanation | README covers flow, storage, errors, retries, access, deployment, verification and limits |
| Applicant video / submission | Still required: personal camera-on unscripted video of at least six minutes on Drive, task-page acceptance and personal WhatsApp step |

## Explain it end to end

**Start with the caller.** The reference screen emphasizes fewer keystrokes while listening. The archive shows routing and identity problems, busy exits, authority limits, existing providers, vague commitments and unreliable labels. Explain which events and controls address those patterns. Stage order guides the conversation; the software does not require inventing evidence for stages that were skipped.

**Follow Start call through the stack.** The browser generates a UUID before posting the selected lead and language to Vercel `/api/calls`. Vercel forwards it to Render. FastAPI validates the input, optionally verifies an approved user's token, checks the lead and calls `db.py`. Supabase's primary key makes retrying that same call ID safe if the network response is lost.

**Follow a tap.** It gets its own UUID, enters the device outbox and appears pending. Render persists the event and conditionally advances the reached stage. A late stage-3 update cannot overwrite stage 7. On acknowledgement the browser removes the queued item. On failure it keeps the same ID and blocks final save until pending events are acknowledged.

**Follow the words.** The words box and structured commitment controls update a device-local draft. Refresh reloads the server record, merges confirmed events and retries unsent IDs. Drafts expire after 24 hours. Unknown commitment details remain unspecified; a named report channel is useful without a callback date.

**Follow the debrief.** End call pauses the timer. Render assembles bounded event evidence, words and the next-step draft into JSON and calls Mistral with its server-held key. The response must match a strict schema. The model can still misunderstand meaning, so the UI displays a suggestion without changing the log. Apply uses it; Keep restores the original draft. Only Save writes the final review metadata.

**Follow Save.** Render saves the call, then synchronizes the lead's status and next step. Success is displayed only after the API response, and only then is the local draft cleared. The two database updates are separate; a retry can recover a partial failure, but a transactional close-and-sync would be the stronger next improvement. The journal queries the most recent 200 closed records and joins company context. Its stage counts describe reached stages, not a sequential sales funnel.

**Explain the stack choice.** Static HTML/CSS/JS has no runtime npm dependency. FastAPI holds validation, provider calls and access checks. Supabase provides relational data and optional identity verification. The one model job addresses recording quality after the conversation. Reliability work concentrates on retaining words and avoiding duplicate records.

## Public demo and private workspace

Default public mode is for fictional reviewer data only. A real-data setup requires approved Supabase Auth accounts, `REQUIRE_AUTH=true`, an `ALLOWED_USER_IDS` allowlist and a real server-only service-role key. The API verifies bearer tokens with Supabase and fails closed on missing configuration. Approved accounts share one workspace; this is not multi-tenant isolation.

The earlier database used permissive anon policies and an anon backend key. Before real-data use, replace the key, rotate credentials exposed in earlier screenshots, review all policies and apply the optional `sql/production-lockdown.sql` only when the backend's service-role access is verified. No deployed policies or existing records are changed automatically by this revision. New SQL seeds are independently invented; source-derived records in an existing database are not silently replaced.

Request bodies, inputs, model output and concurrency are bounded. Request IDs support debugging without exposing errors. In-memory rate limits protect the free single-worker service, reset on restart and are not distributed quotas. Device drafts do not synchronize across devices. Bearer tokens remain memory-only. These are boundaries to explain candidly.

## Final walkthrough

Run the Python, DOM and isolated Chromium tests in README. Verify deployment version 3.0.0 and public assets, then rehearse the actual deployed flow with fictional data, including save and reload. Browser tests use mock API responses and do not claim production-database write coverage.

For the personal video, show a privately selected transcript scenario, the resulting stage path and captured need, an AI suggestion you accept or reject, and the saved record. Explain one decision and its tradeoff in your own words. Keep the video at least six minutes, with your face and microphone visible/audible, and share the actual video through Google Drive with anyone-with-link viewing. Submit the repo and video in their respective task-page boxes, confirm acceptance and complete the CEO WhatsApp step yourself.
