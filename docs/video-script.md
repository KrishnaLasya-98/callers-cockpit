# Video script — 6 minutes (target ~4:30–5:30 to leave headroom)

Call it: **"Caller's Cockpit — built from 100 transcripts"**
Record: screen + mic. One take + one spare. Start the screen recording FIRST, camera optional.

---

## 0:00–0:40 — The problem, in their own numbers

> "DeepThought's callers sell growth work. I read the hundred transcripts, and three numbers
> defined the problem:
>
> **One —** about 1 in 5 calls dies at stage 3: wrong person, or 'in a meeting, call after two.'
> Those back-times are volunteered constantly — and in every transcript, none of them are
> recorded anywhere. Free follow-up intelligence, thrown away.
>
> **Two —** stage 5 is the goldmine: what the prospect wants, in their own words. The reading
> says 'the caller writes down exactly what was said.' In practice, across 100 calls, callers
> wrote down phone numbers — almost never the words.
>
> **Three —** the log lies sometimes. T084: a clean, confirmed close, logged as `do_not_call`.
> T002: an explicit thirty-minute call-back agreed — logged as `not_logged`. Thirteen calls
> were not logged at all.
>
> So my surface is built to fix those three, and nothing more."

*Screen: keep `docs/transcript-analysis.md` stage distribution table visible during this.*

## 0:40–2:40 — The live screen (slow walk)

> "This is what a caller keeps open on the phone. Everything here is big enough to read while
> the prospect is talking."

1. Stepper + stage card — *"Eight stages in the order the reading defines. One line on what the
   stage is for — read at a glance."*
2. "They tend to say" — *"For stage 2, these exact patterns — 'From where are you calling?'
   'What is this regarding?' — come from the transcripts, not from guessing. Sideways reading
   is faster than memory."*
3. **Taps, not typing** — *"The reference screen taught this: the fewer words the caller types,
   the more they hear. What-happened is one tap; every tap is a stage event, stored in
   Supabase."*
4. **Their words** — *"The only free text on the screen, exactly like the reference. This one
   field is what makes the next call smarter."*
5. **Stage 3 = exit type, not yes/no** — *"wrong person, busy with a pinned back-time, referral
   with a number."* — Pin a back-time in the demo.
6. **Stage 6 = the objection zoo** — *"Six archetypes, straight from the transcripts: 'we
   already have a consultant' being the top one."*
7. **Amber rule** — *"A next step without day + time shows amber, because in those transcripts
   'sometime next week' never got followed up."*
8. **End call from any stage** — *"Most calls die early — the screen respects that."*

## 2:40–4:10 — The LLM: one job, argued

> "The brief asked the LLM to do at least one thing, and asked me to say why that one. I chose
> the **post-call debrief** — the LLM as auditor of the log, not chatbot.
>
> Why this one: mid-call stage-suggestion risks steering a live human wrong, and cheap
> summaries nobody asked for don't solve a data problem. But the transcripts SHOW a data
> problem: logs that contradict the call, and missing words no one wrote down.
>
> So after the call: my taps + their words go to Gemini 2.0 Flash on a free key, called from my
> Render backend — **the key is never in the browser**, for the reason the brief itself gives.
> It returns the stage it observed, a suggested outcome, a one-line summary, any next step with
> a time, and — if my log disagrees — a mismatch note, which the caller can accept or ignore.
>
> *Demo: save the call with an obviously wrong outcome, run debrief, accept the correction.*"

## 4:10–5:10 — Architecture, and why each platform

> "Four links: Vercel serves one static page — zero build step, it loads on a phone in the field.
> Render runs FastAPI — Python, because that's what I'd ship on a real FDE team; it holds the
> Supabase service key and the LLM key server-side. Supabase is Postgres with
> row-level-security locked to the backend. Three tables: leads, calls, stage_events — the
> stage path of every call is first-class data, because 'where do calls end' is exactly what
> the reading told us to measure."

*Screen: swap to the architecture line in the README. Name the fallback aesthetic: "The LLM call has a timeout; the UI degrades to taps-only if it's down."*

## 5:10–6:00 — Decisions + what I'd build next

> "Three decisions I can defend: **taps over typing** (from the reference screen and the data),
> **one LLM job** — the audit — because it's the only place the model fixes something the data
> proves is broken, and **amber honesty** — the screen refuses to pretend a date-less next step
> is a real one.
>
> What I'd build next with one more day: per-caller stage funnel across weeks, language-wall
> routing wired to the language taps, and the debrief running over the whole week's calls to
> rank which leads deserve the next dial.
>
> Links are in the message. Thank you."

---

### Recording checklist
- [ ] Fresh Supabase seed: 2 leads loved (one `promised`, one unknown) before recording
- [ ] Do ONE complete live walk beforehand so the demo flow is muscle memory (dial → 3 taps → their words → objection type → next step with time → save → debrief)
- [ ] Warm the Render API 60 s before recording (cheap cold-start insurance)
- [ ] 1080p, cursor BIG, don't zoom mid-take
- [ ] Watch the immediate playback for mic clipping, then re-record any shaky section only
