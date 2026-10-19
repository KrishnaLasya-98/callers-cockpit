# Caller's Cockpit

**The screen a caller keeps open on a cold call.**

Built for the DeepThought FDE task. One screen, live in 48 hours:

- **Who am I calling** — lead details, notes, call history, P&L opening script
- **Live call** — dial timer, one-tap outcome logging *(loaded from your calls endpoint)*
- **Objection decoder** — type what the MD said → LLM returns *what it actually means* + the next line to say

---

## Stack (one job per platform)

| Platform | Role | Deployed at |
|---|---|---|
| **Vercel** | Static frontend (`frontend/`) | `https://caller-s-cockpit.vercel.app` |
| **Render** | FastAPI backend (`backend/`) — holds the LLM key server-side | `https://callers-cockpit-api.onrender.com` |
| **Supabase** | Postgres (leads / calls / objections) + Auth toggle | `https://YOURPROJECT.supabase.co` |
| **LLM** | Google **Mistral **ministral-8b-2512****, free key from AI Studio | key lives only in Render env vars |

```
Vite-less static SPA ──▶ FastAPI (Render) ──▶ Supabase Postgres
                              └──▶ Gemini (REST, free key)
```

---

## Local setup

### Backend

```bash
cd backend
python -m venv .venv && .venv\Scripts\activate        # Windows
pip install -r requirements.txt
copy .env.example .env                                 # fill in real values
uvicorn main:app --reload --port 8000
```

### Side database

1. Create a project at supabase.com (free).
2. SQL Editor → run **`sql/schema.sql`** (creates tables + trigger + seeds 10 sample leads).
3. Project Settings → API → copy **URL** and **service_role key** into `backend/.env`.

### LLM key

1. Get a free key at https://console.mistral.ai.
2. Put it in `backend/.env` as `LLM_KEY`.

### Frontend

```bash
cd frontend
python -m http.server 5500        # or any static server
# open http://localhost:5500  (auto-uses http://localhost:8000)
```

**API resolution (automatic):** locally the frontend targets `http://localhost:8000`; when deployed
on Vercel it calls same-origin `/api/*`, which vercel.json rewrites to the Render backend. After
deploying to Render, update the `destination` URL inside `vercel.json` and redeploy Vercel. A
one-off override is still possible via `?api=<url>` or `localStorage.API_URL`.

---

## Deploy

### 1. Render (backend)

Option A — **blueprint**: push the repo, on Render "New > Blueprint" → picks up `render.yaml`, then set the three env vars (`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `LLM_KEY`, `FRONTEND_ORIGIN`).

Option B — **manual**: New > Web Service → root dir `backend` → build `pip install -r requirements.txt` → start `uvicorn main:app --host 0.0.0.0 --port $PORT`.

Verify: `GET /health` returns `{"status":"ok", ...}`.

### 2. Vercel (frontend)

```bash
npm i -g vercel
vercel                    # framework: Other → picks up vercel.json (static, frontend/)
vercel --prod
```
Then add the deployed Vercel URL to `FRONTEND_ORIGIN` in Render (comma-separated) and redeploy — CORS.

### 3. Supabase link

Project URL goes in `.env` and in your deliverables — the schema lives in `sql/schema.sql`.

---

## API (quick reference)

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | status probe |
| GET | `/leads?status=…` · `POST /leads` | call queue / add a lead |
| GET/PATCH | `/leads/{id}` | lead detail / status, notes, verify flags |
| GET/POST | `/calls` | past-call log (joined w/ company) / open a live call |
| POST | `/calls/{id}/events` | a stage tap mid-call (stage, tap, note) |
| PATCH | `/calls/{id}` | close-out: outcome, stage reached, their words, next step |
| POST | `/llm/debrief` | **the one LLM job** — audits the log: observed stage, suggested outcome, one-line summary, next step, mismatch note |

The 8-stage model and the 10-word outcome vocabulary come straight from the task's readings and
the 100-transcript analysis (`docs/transcript-analysis.md`).

---

## Deliverables (4 links + 6-min video)

- [ ] Vercel — frontend
- [ ] Render — API
- [ ] Supabase — project URL
- [ ] LLM — provider (Mistral **ministral-8b-2512**, free key), used via Render only
- [ ] 6-minute video: caller's pain → the screen → LLM decode → architecture → decisions
- [ ] WhatsApp the CEO before the 48-hour window closes
