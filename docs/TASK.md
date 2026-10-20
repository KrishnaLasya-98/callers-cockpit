# The Task — Fully Explained

## 1. What this is

**DeepThought CultureTech Ventures** (Sainikpuri, Hyderabad) is hiring a
**Forward Deployed Engineer** — full time, on-site in Hyderabad.

> An FDE sits with the people who run a company, builds the thing they need
> *that week*, and ships it.

Their hiring process IS the job: **48 hours**, starting the moment you register.
No reminders. Silence = your answer.

### The challenge, verbatim-ish

1. **Read** what real callers face — three readings on the task page.
2. **Build the screen a caller keeps open on a cold call** — one small product.
3. **Deploy it** on Supabase + Render + Vercel, all free tiers.
4. Use **an LLM on a free key** for at least one thing — and say *why that one*
   in the video.
5. Deliver **4 links + a 6-minute video**.
6. Then **WhatsApp the CEO** (the site fills your links into the message).

## 2. The three readings

### Reading 1 — The structure of a cold call

A first call to a stranger has **8 stages**, in this order. Most calls never
reach stage 8. The surface you build must **cover all eight**; what each stage
shows is your design decision, and *"the hundred transcripts are how you make
it."*

| # | Stage | Purpose | What tends to happen |
|---|---|---|---|
| 1 | **Opening** | Reach the right person, say who you are. They decide in 10 seconds. | Switchboard screens; person is driving/in a meeting; number is stale. |
| 2 | **Purpose** | Say why you called, in words they can *repeat to a colleague*. | "From where are you calling?"; "What is this regarding?"; "Is this a sales call?" |
| 3 | **Permission** | A clear yes, no, or a time — anything else is a bad answer. | "Call me after two", cold silence, talking without answering. |
| 4 | **Their business** | Ask about their company before anything about yours. | One-line answers; "we're not that size/division"; "tell me about yourself first." |
| 5 | **Their need** | What they're trying to do, **in their own words**. *The one stage where the caller writes down exactly what was said.* | Names a goal; "everything's fine"; turns it around. |
| 6 | **Objection** | Hear the reason for a no and *understand* it. | "We already have a consultant"; "send something in writing"; "not my function." |
| 7 | **Next step** | Agree ONE concrete thing: document, call, meeting — named, with a time or channel. | Politeness mistaken for interest; "sometime next week" (no day); referral with/without a number. |
| 8 | **Close** | End clearly. Record the outcome, the next step, and the prospect's words. | Line drops; polite goodbyes after a no; **logged outcome that doesn't match the call.** |

Three things they tell you to read the transcripts for:
1. **Where do calls end, and at which stage?**
2. **What do prospects actually say at stages 2, 3 and 6?**
3. **At stage 5, did the caller write the prospect's words down?**

> *"A surface built without that reading shows the names of the stages.
> A surface built after it shows the caller what is about to happen."*

### Reading 2 — The reference screen

They show one stage of a *fake* product (ClinicBooks): stage number + one-line
purpose; three things the prospect tends to say; **taps for "what happened"**
(four taps, one pre-pressed); **one box for the prospect's own words — the only
free text on screen**; the next stage named; **End call available from any
stage**; and a second screen: a list of past calls with the **stage each
reached**.

Design philosophy embedded in it: *"the fewer words the caller types during the
call, the more she hears."*

### Reading 3 — 100 cold-call transcripts (zip, 123 KB)

Real-shape calls by "Meridian Growth Partners" (fictional) calling
owners/directors of Indian companies. Facts of the data:

- Durations: mean 136s, median 94s — most calls are **under 2 minutes**.
- Outcome vocabulary is **their own 10 words**: `agreed_to_receive_report`,
  `next_step_agreed`, `interested`, `follow_up`, `call_again`,
  `not_interested`, `do_not_call`, `wrong_person`, `moved_company`,
  `not_logged` (13 calls logged *nothing*).
- The README warns: *"the outcome is what the caller logged — it does not
  always match what you read in the call. That is part of the data."*
- Languages: mostly English; several Hinglish; 2 Marathi; 1 Kannada request.

## 3. What the 100 transcripts actually showed (our analysis → `docs/transcript-analysis.md`)

**Stage-end distribution** (heuristic per-call read):

| Stage | % | Meaning |
|---|---|---|
| 1–2 | 8% | wrong name, line collapse |
| **3** | **18%** | wrong person, busy gates |
| 4–5 | 3% | rare — calls skip substance |
| **6** | **19%** | objections end the call |
| **7** | **41%** | agreement *without* day+time |
| 8 | 10% | clean confirmed closes |

**The three planted problems:**
1. **Back-times are volunteered constantly and never recorded** — "call me
   Monday 3 PM" disappears.
2. **Stage-5 words are almost never written down** — only phone numbers were.
3. **Logs contradict reality** — T084: a clean close logged `do_not_call`;
   T002: an explicit 30-minute callback left `not_logged`.

## 4. What we built (this repo)

**Caller's Cockpit** — a two-screen SPA, stage-shaped:

**Screen 1 — Live call.** Lead card + dial timer; stepper 1–8; per-stage card
with one-line purpose + "they tend to say" chips (archetypes pulled from the
transcripts) + **one-tap "what happened" events** (every tap = a row in
`stage_events`); the single free-text box is **their words**; a **next-step
field that turns amber without day+time**; End call from any stage.

**Screen 2 — Call log.** Every call with stage reached, outcome badge,
next step (amber if date-less), and LLM mismatch notes.

**The ONE LLM job: the post-call debrief.** From the taps + their-words, the
LLM (Mistral `ministral-8b-2512`, free La Plateforme key) returns the stage it
observed, a suggested outcome, a one-line summary, any next step with its time,
and a **mismatch note** when your log disagrees with the call — the caller can
accept or keep their own log. *Why this one:* mid-call stage-suggestion can
steer a live human wrong; cheap summaries nobody asked for don't fix anything;
but the transcripts prove the log is the broken thing.

**Architecture:** static SPA on **Vercel** (`frontend/`, no build) →
**Render** hosts **FastAPI** (`backend/`) holding the LLM key and the Supabase
key → **Supabase** Postgres (`leads`, `calls`, `stage_events`). The browser
talks to same-origin `/api/*`; Vercel rewrites it to Render.

## 5. Status board

| Deliverable | State |
|---|---|
| Supabase (schema + seed + soak) | ✅ live, 10 leads, verified via SQL |
| GitHub repo | ✅ https://github.com/KrishnaLasya-98/callers-cockpit |
| Vercel (frontend) | ✅ https://callers-cockpit-ui.vercel.app (public 200) |
| Render (API) | 🔴 blocked on one manual deploy click-through |
| Mistral LLM | ✅ `ministral-8b-2512` verified live, JSON mode |
| Soak test | ✅ passed locally on the production DB (incl. debrief catching a deliberately-wrong log) |
| Video script | ✅ `docs/video-script.md` |
| 6-min video | ⬜ after Render goes live |
| WhatsApp submission | ⬜ last step |

## 6. What's left (in order)

1. **Render deploy** — the only manual thing: paste public repo URL at
   `dashboard.render.com/select-repo?type=web` → root dir `backend` →
   `pip install -r requirements.txt` / `uvicorn main:app --host 0.0.0.0 --port $PORT`
   → 4 env vars (`SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (legacy JWT), `LLM_KEY`,
   `LLM_MODEL=ministral-8b-2512`) → Free instance.
2. Verify `https://callers-cockpit-ui.vercel.app/api/health` proxies to Render.
3. Record the 6-minute video (script ready).
4. WhatsApp the CEO from the task page.
