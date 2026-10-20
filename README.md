# Caller's Cockpit

A two-screen guide a caller keeps open during a cold call. Eight stages show purpose, common prospect reactions and one-tap events. Capture the prospect's words, record a next step, then save the call. The call log shows the stage reached and any retained debrief disagreement.

## Submission links

| Deliverable | Link / status |
|---|---|
| Public GitHub repo | https://github.com/KrishnaLasya-98/callers-cockpit |
| Vercel app | https://callers-cockpit-ui.vercel.app |
| Render health endpoint | https://callers-cockpit.onrender.com/health — process live; database environment configuration pending as of 2026-10-20 |
| Google Drive video | Pending: applicant records at least 6 minutes, visible on camera, and enables anyone-with-link viewing |

Supabase project: https://nlepmxlknpxpqehaevpr.supabase.co. LLM: **Mistral `ministral-8b-2512`**, called from the backend using a free La Plateforme key. Its single job is post-call debrief: compare captured evidence with the logged stage/outcome, suggest a summary and next step, and identify disagreement. The caller decides whether to apply the suggestion. Invalid responses or outages leave manual saving available.

## Architecture

```text
Static HTML/CSS/JS on Vercel
  -> same-origin /api/* rewrite
  -> FastAPI on Render
      -> Supabase Postgres: leads, calls, stage_events
      -> Mistral chat completions API
```

Keys live in backend environment variables. This is a public, single-user hiring-task demo; use fictional sample data only. It has no user authentication. Do not store real prospect records in this demo.

## Local setup (PowerShell)

```powershell
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r backend/requirements.txt
Copy-Item backend/.env.example backend/.env
# Fill backend/.env locally; never commit it.
.venv/Scripts/python.exe -m uvicorn main:app --app-dir backend --reload --port 8000
```

In another terminal:

```powershell
python -m http.server 5500 --directory frontend
```

Open http://localhost:5500. Local pages use http://localhost:8000. Deployed pages use same-origin `/api/*`. Optional developer overrides: `?api=<url>` or `localStorage.API_URL`.

For a new Supabase project, run `sql/schema.sql` once. It seeds ten fictional leads; running it again adds duplicate seeds. Configure `SUPABASE_URL` and a backend `SUPABASE_SERVICE_KEY` with access to all three tables. Do not run the legacy permissive anon-policy fallback for a new project. Existing deployments must be checked separately before claiming that RLS restricts access to the backend.

## Deploy

Render blueprint settings are in `render.yaml`: Python 3.12, Free plan, root `backend`, build `pip install -r requirements.txt`, start `uvicorn main:app --host 0.0.0.0 --port $PORT`, health `/health`.

Set these environment variables in Render:

- `SUPABASE_URL`: your Supabase project URL.
- `SUPABASE_SERVICE_KEY`: backend-only Supabase service-role key.
- `LLM_KEY`: Mistral La Plateforme key.
- `LLM_MODEL`: `ministral-8b-2512` (blueprint default).
- `FRONTEND_ORIGIN`: `https://callers-cockpit-ui.vercel.app`.

After Render is live, use its actual hostname in **both** `vercel.json` and `frontend/vercel.json`. Deploy Vercel with root at either the repository or `frontend/`, using the matching config. Update the health link above if the Render hostname differs.

Verify the Render health URL, then `https://callers-cockpit-ui.vercel.app/api/health`, leads and call workflow. A 200 from the static frontend alone does not verify the backend. Render's free service may need time to wake up.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Process/configuration status; not a database connectivity test |
| GET / POST | `/leads` | Queue / create lead |
| GET / PATCH | `/leads/{id}` | Detail with recent calls / edit lead |
| GET / POST | `/calls` | Joined call log / start call |
| GET / POST | `/calls/{id}/events` | Read / save stage taps |
| PATCH | `/calls/{id}` | Save final outcome, reached stage, words, next step and accepted review metadata |
| POST | `/llm/debrief` | Read-only suggestions based on taps, words and next-step capture |

## Verification

```powershell
.venv/Scripts/python.exe -m unittest discover -s tests -v
node --test tests/frontend.test.cjs
python scripts/check_deployment.py
```

The first two commands use local fakes, without touching production data. The deployment check performs read-only requests to the real public API. See `docs/TASK.md` for the completion checklist and `docs/video-script.md` for unscripted recording prompts.

Source transcripts are task-only material and are not distributed here. The research document contains aggregate observations and original design implications, not transcript excerpts. Earlier repository history may still contain removed quotations; do not publish or redistribute the source archive.
