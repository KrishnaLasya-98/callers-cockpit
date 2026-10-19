# Transcript analysis: 100 Meridian cold calls → caller's cockpit

Source: 100 cold-call transcripts (`transcripts/T001–T100.txt`) with `index.csv`/`index.json`. All companies and people are fictional; the call structures are rewritten from real calls. Analysis date: 2026-10-19.

## 1. Outcome frequencies and duration stats

### Outcome tally (n = 100)

| outcome | n | callers' meaning (per README) |
|---|---|---|
| not_interested | 14 | prospect declined |
| agreed_to_receive_report | 14 | agreed to receive a document on WhatsApp/email |
| follow_up | 14 | caller is to call again |
| not_logged | 13 | nothing logged |
| next_step_agreed | 11 | meeting / timed call / report+follow-up agreed |
| do_not_call | 10 | prospect asked to not be called, or caller judged so |
| wrong_person | 8 | person reached was not the right one |
| interested | 7 | interested, without a fixed next step |
| moved_company | 5 | person left the listed company |
| call_again | 4 | call again — language or line quality |

Key observation: 46/100 calls ended with *some* forward motion on paper (agree_to_receive_report + next_step_agreed + follow_up + interested), but a large share of those "next steps" are brush-offs ("send it on WhatsApp / call me next week"). The vocabulary also leans on `follow_up` as the garbage-bin category (T087, T068, T019 are all logged `follow_up`/`not_logged` despite clearly diverging content).

### Duration stats (seconds) — overall

- n = 100, **mean 135.6, median 93.5**, min 30, max 687
- p10 ≈ 40, **p25 ≈ 60**, p50 ≈ 94, **p75 ≈ 158**, p90 ≈ 282
- bimodal reality: most calls are 1–2 minute affairs; 12 calls run 4+ minutes (up to 11.5 minutes)

### Duration by outcome

| outcome | n | mean | median | range |
|---|---|---|---|---|
| next_step_agreed | 11 | 190.7 | 113 | 42–687 |
| follow_up | 14 | 176.6 | 121 | 31–659 |
| agreed_to_receive_report | 14 | 171.9 | 158 | 81–290 |
| interested | 7 | 171.4 | 145 | 57–444 |
| not_logged | 13 | 132.6 | 90 | 33–425 |
| not_interested | 14 | 120.3 | 91 | 38–389 |
| do_not_call | 10 | 90.3 | 76.5 | 33–296 |
| moved_company | 5 | 66.4 | 71 | 45–97 |
| call_again | 4 | 57.2 | 45 | 35–104 |
| wrong_person | 8 | 63.8 | 57.5 | 30–109 |

Positive outcomes (agreed_report, next_step, interested) take ~70–90 s longer than dead-end outcomes. Median agreed_to_receive_report is ~2.6 min vs ~1.5 min for a decline. Turn counts: mean 19.4, median 18.

## 2. Highest stage reached — heuristic and distribution

### Heuristic (best-effort, stated explicitly)

Per call, the **highest numbered stage whose characteristic event is present in the dialogue**, where "die at stage N" = the call's substance ended at/before stage N even if a polite brush-off ("send it on WhatsApp", "call me next week") manufactured a paper next step:

1. Opening — died in/around hello + who is this (confusion, language barrier)
2. Purpose — died during/just after the pitch for what Meridian does
3. Permission — died at "is this the right time / may I ask" (refusals, being routed to someone else, interruptions, wrong-data discovery)
4. Their business — died while trying to discuss the prospect's company (or discovering it no longer exists)
5. Their need — call effectively ended once the prospect stated a need/problem in their own words (with no forward step)
6. Objection — call ended on an objection with no agreed next step
7. Next step — call ends with an agreed next step (document send, timed callback, meeting). Includes soft brush-off arrangements
8. Clean close — a next step that was confirmed in detail (day + time + channel re-confirmation) and mutual goodbyes

Calls rated 7 are split-brained: the dialogue may have contained a strong objection, but the call *ended* at the next-step arrangement. Judgements are per-file; a few are genuinely debatable (noted where relevant).

### Distribution: where calls die

| Stage | n | % | What this looks like |
|---|---|---|---|
| 1 Opening | 3 | 3% | "Vinod who?", Kannada request, 10-year-old recycled number |
| 2 Purpose | 5 | 5% | wrong number discovered after the pitch started; line quality collapse; "14 years back this number was Mr. Rao's" |
| 3 Permission | 18 | 18% | "I am not the right person", "find out Mr. Sen", "I will not share any number", referral redirects |
| 4 Their business | 2 | 2% | company acquired, call degrades into confusion |
| 5 Their need | 1 | 1% | full need stated, caller gracefully declines to push |
| 6 Objection (no salvage) | 19 | 19% | "we already have consultants", "internal team handles it", decisions taken abroad, hold-forever |
| 7 Next step (soft or real) | 41 | 41% | the modal ending: WhatsApp/email/meeting/call-next-week agreed |
| 8 Clean confirmed close | 10 | 10% | day+time+channel re-confirmed, mutual thanks |

**Reading:** ~64% of calls reach stage 6 or past it. The single most common ending is stage 7 (41%) — but in roughly a dozen of those the "next step" is a deferral-first-sentinel ("send me the details, *then* we'll see"). Stages 4 and 5 are almost never 'death points' — calls that get deep enough to talk about the business tend to end at 6, 7 or 8. Only **10 calls** have a properly confirmed close (day + time + medium); most stage-7 agreements leave time unspecified ("sometime next week", "call me tomorrow").

## 3. Common prospect language at stages 2, 3, 6

### Stage 2 — Purpose: what prospects say when the caller states why they are calling

**A. "From where are you calling?" (identity grilling).** The single most frequent stage-2 response — prospects do not engage with the pitch until they know the origin.
- "From where? From where?" (T075)
- "You are calling from which company?" (T052)
- "Kahan se?" (T030)
- "From?" … "From Meridian Growth Partners." … "Meridian, yes. Tell me." (T011 side pattern; also T048 "From? / Tell me.")

**B. "What is this regarding? / What do you do?" (what-for questions).**
- "Regarding what?" (T034, T075)
- "What is your company providing?" (T043)
- "Okay, what is the company doing?" (T053)
- "Which kind of service are you providing?" (T062)

**C. "What do you want from me / why free?" (motive suspicion).** Appears whenever the word "free" lands.
- "What do you want from me? Why should I provide these details?" (T053)
- "Then why are you doing this? … Are you an NGO, or an organisation working for profit?" (T060)
- "So what is in it for you?" (T081)
- "But who suggested our name to you? And is there any way it will harm us… report will go to our competitors and affect us negatively?" (T086)

**D. "Send me the details first" (pre-emptive deferral),** effectively refusing to discuss anything before receiving evidence.
- "You can send it on WhatsApp, but it will be better if you email me also." (T054)
- "First you send me your website and your projects… Then I will ask about the brief." (T062)
- "Can you send an email on this, and any of your previous such profiles, whatever case studies you have done?" (T072)

### Stage 3 — Permission: prospects' responses to "right time? / may I ask?"

**A. "Not the right person to speak on this."** (routing refusal with or without a pointer)
- "I don't think I am the right person to speak on behalf of Broadline on this. So, thank you." (T029)
- "You will have to speak to somebody at the head office… The people sitting at the head office are the deciding factors." (T041)
- "I am not the proper person because I will not be able to add value to this." (T049 variant)
- "I'm a very small person here, so I don't know what exactly…" (T075)

**B. "Not a good time / I'm busy."** (genuine or taken)
- "Actually, right now I'm in a meeting with a customer. So can I call you after?" (T033)
- "I am driving right now. So how much time will you take?" (T087)
- "Yeah, a little bit." (T100)
- "I am just going into another meeting… can you make it a little fast, please?" (T056)

**C. "Here is the right person's number" (voluntary redirect — the most valuable stage-3 exit).**
- "I'll just let you know the concerned person… So, note it down. [number]" (T010)
- "I will share a number with you, right? I want you to connect with Mr. Naik. He handles our entire company operations." (T050)
- "Call me in the evening. I'll tell you the right person." (T014)
- "Find out Mr. Sen. He might help you." (T030)

**D. "I can't share that" (information barrier).**
- "No, I cannot share the number. Sorry." (T041)
- "No, no, I don't think I can give any of those contacts to you." (T029)
- "Regarding Astrella, I can't reveal any answers to anyone outside." (T018)
- "I am not supposed to reveal any financial data or innovation data… so you better be in touch with our CFO." (T024)

### Stage 6 — Objection: the objection zoo, grouped

**A. "We already have X."** (biggest single archetype: internal team / consultant / Big 4 / MNC global agreement)
- "Actually, we've already engaged a consultant to do pretty much exactly what you've described. So this, at least for this year, doesn't make any sense." (T092)
- "Our company is the market leader. So it doesn't fall in the category of growing faster than the market leader." (T048)
- "Madam, all these things Marudhar already has. It is a 40, 45 year old company, a very big organisation." (T049)
- "We already have such consultants at a global level… it's all driven through a global single contract agreement." (T088)

**B. "We are not looking / we are fine as we are."** (contentment/satisfaction objection)
- "No, not really. We are not looking… We have an internal business model, actually, and we are following it. Definitely." (T009)
- "Nahin, nahin, nahin. Sorry. Meri internal team hai, to hum log nahi karte abhi… Hamara chal hi raha hai." (T021)
- "In this line we don't believe in experiments… we don't want any new customers. We are fine with our current business, which is really good." (T043)
- "No. Thankfully we are on the right track." (T082)

**C. "Organisational wall" (decision-maker level / head office / geography).** Specific to MNC arms.
- "So, beta, I don't think I can help you out, because all those decisions are taken somewhere else, at corporate in the US." (T044)
- "We are an MNC, we already have such consultants at a global level… central contracts and central agreements." (T088)
- "I don't think I can help you out, because all those decisions are taken somewhere else." (T044 again, "beta" — note the elder-to-younger register)
- "It is a back office, so nothing of that sort happens here." (T003)

**D. "Send me the profile first / let me check, then decide."** (show-me-the-receipts)
- "First send me an introductory mail about your services, the scope, your website, your clients. Then I'll tell you." (T063)
- "Mala pahile he samajna garjeche aahe ki tumcha nakki commercial intention kay aahe… [Marathi: I first need to understand your exact commercial intention]" (T057)
- "I'll go through your company profile, and if there's something interesting, I can reach out." (T091)
- "Let me go through your website first, and see how your input can add value for me." (T081)

**E. "Not my function / conflict of scope."** (senior people at big firms rejecting the frame)
- "You are talking about a complete company, and I take care of a particular solution area… you should start with the leadership of Novara India." (T097)
- "How will supply chain help with that? … Supply chain comes only at a very later stage." (T097)
- "So I understood, it pertains to my own function, not the whole company." (T085 — resolved)
- "Company level profit is not my KRA. I am not very clear how I'll be able to help you in this." (T087)

**F. Trust/skepticism bundle.** ("data marketing", wrong numbers, fear of competitor leakage, suspected recruitments)
- "Is this related to some opening, or what?" (T099 — thought it was a job call)
- "But what will I do with that report?" (T053)
- "Is that when you start charging?" (T063)
- "Naka sir, punha naka pathvu. [Marathi: no sir, please don't send it again]" (T037)

## 4. Stage 5 — the prospect's own words

Ten strong "in their own words" quotes (goals, struggles, self-described constraints):

1. *"Right now we are fighting with the government to tell them, let's scale this to a thousand more cities in India, but change the model from contracting to a model where you think of us like a data utility."* — (T096) — plus: *"We've let go of all our employees in the recent past. I'm a single man right now… until we see a change in this direction, I think I'm going to close the company."*
2. *"Our company majorly works on a job work basis… technically there is hardly any margin. As soon as I increase my margins… the people who are my customers will go to some other job worker. So currently I'm not looking for such models. Probably I'm looking for people who can help me with… new products, with our facility."* — (T095)
3. *"Right now Stellar's situation is not very good. There are a lot of frequent re-orgs and the sales are not well. That's the challenging part: due to the reorganisation, every time we have to change the goals."* — (T098)
4. *"The biggest challenge is manpower requirement. Skilled manpower."* — (T089)
5. *"We are already using somebody for our business analysis, and at the end of the day we are interested in somebody to guide us on the way ahead. Where should we hire from, what other markets should we look at."* — (T090)
6. *"I'm currently dealing in India only, and the clients I work with are very old relations… my line is very different from others and my work ethic is also different… In this line we don't believe in experiments."* — (T043)
7. *"There was a drop, a dip, in the last two years. So the organisation has made some changes. It was in negative the last two years."* — (T100)
8. *"If I talk about my overall business through the year, it has been constant for the last three years, but I provide constant growth to my people, to my employees."* — (T084)
9. *"Nowadays my customers are more and more into sustainability. So what best can we offer them in terms of a sustainable solution? … It's not only about financials anymore… how the business is sustainable, those metrics are also coming into the picture now."* — (T093)
10. *"To be very honest with you, ma'am, I know what is lacking."* (T042 — then refuses to elaborate), plus *"Very, very small company… I appreciate your intentions, but I know my limitations, ma'am."*

Also representative content at stage 5: T092 ("we just started [the consultant] around last month… some of the results are already starting to become visible"), T083 ("a bumpy state for everyone… we are doing a lot of R&D internally"), T082 ("In the current stage I am in, I would say revenue" / "I am not really comfortable sharing my plan with you").

### Did callers write down the prospect's words?

**No — there is no direct evidence of verbatim note-taking in any transcript, and the evidence for paraphrase-capture is implicit and partial:**
- Callers explicitly say they are writing down only *contact data*: "So, note it down. [number]" (T010), "I'm noting it down, sir. Can I repeat it for confirmation?" (T082 — a phone number), "[He spells out his email address]" in T054, T063, T074, T087, T094, T099.
- Understanding is *confirmed by paraphrase-back* in roughly 10–15 calls: "With your facility. Okay." (T095), "Okay, so the biggest challenge right now is that the government isn't supporting it as a utility model" (T096), "Skilled manpower. Do you think that's the only obstacle?" (T089), "I see that you have remembered quite well, sir." (T082).
- The company's measurable-question scaffold (the 3 yes/no questions on review/experiments/people-growth) is asked in ~25 calls and produces answers the caller summarises as "you have set clear goals… Am I correct?", never as captured verbatim text.
- No caller ever says "let me write that down" in relation to what the prospect *said about their business*; nothing in the transcripts shows a repeat-verbatim feedback loop on their needs.

Note: the transcripts are rewrites — a note-taking moment may exist off-tape. But on the evidence available, the only promises of fidelity are for WhatsApp numbers, email addresses and the caller's own research.

## 5. Language breakdown (approximate)

| Language | ~calls | Notes |
|---|---|---|
| English (with light Hindi touches like "Haan ji", "boliye") | ~75 | the default register, including all India-arm MNC calls |
| Hinglish (substantive code-mixing; Hindi carries meaning) | ~17 | e.g. T003, T015, T021, T022, T061, T062, T067, T070, T081, T094, T095 |
| Hindi written in Devanagari | 1 | T031 (public sector utility; recycled number) |
| Marathi | 2 | T037, T057 (caller offers Marathi immediately in T037) |
| Kannada | 1 | T032 — prospect answers in Kannada request; call can't proceed |

Additional texture: many English calls contain one or two openers in Hindi ("Kahan se?", "Achha"); Malayalam-like phonetics and Devanagari encoding artifacts appear in T031; the caller side occasionally switches to smooth the flow ("Aapko value dikhe to aap further baat kar sakte hain", T061). **Roughly one call in five hits a genuine language wall or code-switch within the first 30 seconds — that is a first-class design constraint, not an edge case.**

## 6. Instructive and unusual calls

1. **T084 (296 s, logged `do_not_call`)** — the fullest, most successful call in the set: three questions answered thoughtfully, objection handled, report to WhatsApp *and* a Thursday follow-up expressly agreed ("Done."). Yet it is logged do_not_call. The outcome label and the dialogue flatly contradict.
2. **T002 (54 s, `not_logged`)** — prospect explicitly says "call after 30 minutes… we can talk" — a concrete follow-up that goes unlogged. Combined with T057/T061, logging discipline is the weakest link in the dataset.
3. **T032 (`call_again`)** — "Kannada maatadi." One language barrier → call ends at stage 1 with "someone else will call you back." Language routing is unexploited.
4. **T031 (Devanagari Hindi, `call_again`)** — the number has belonged to "Raju" for 10–11 years and was once Sunita ji's. CRM data rot: lines die of old numbers, not only of objections.
5. **T099 (`agreed_to_receive_report`)** — the listed "Director of Software Engineering" is really in insurance sales and initially thinks the call is a job enquiry ("Is this related to some opening?"). Label/name rot in the account data, logged as a success anyway.
6. **T048 (`follow_up`, 132 s)** — prospect disputes the premise ("Our company is the market leader"), interrogates the objective, then says "Hold on one second" — and puts the caller on hold forever.Logged cross-up: "follow_up" was logged for a call that ended in a dropped hold.
7. **T096 (687 s, `next_step_agreed`)** — eleven minutes of the prospect talking about drone-data policy, closing his own company; the caller barely speaks. The longest call is basically the prospect filling stage 5/4; the "next step" is only "I'll make the report."
8. **T066 (`not_interested`, 91 s)** — the ex-CEO (left eight years ago, now a CA) turns the call into coaching: "You can save your time by first verifying which company and which person it is." An unusable contact delivers the dataset's best advice.
9. **T082 (425 s, `not_logged`)** — the prospect reveals Meridian promised a report in an earlier call that never arrived; he remembers the pitch better than the caller does. Operating history leaks into the call and the CRM never did.
10. **T070 (`wrong_person`, Hindi)** — a heated dispute about call history ("Woh ho hi nahi sakta ma'am" — it is impossible Mahesh was ever talkable on this number); the Director sits in Chennai. Follow-up-on-same-number assumptions get contested in real time.

## 7. Design implications for the cockpit screen

1. **Outcomes ≠ dialogue — show the deltas on every call.** Buttons must capture the full 8-stage journey, not one label. Pre-fill "highest stage reached" from the stage taps (e.g. T084 would be stage 8 but logged `do_not_call` — the screen should resurface that mismatch for coaching).
2. **Auto-suggest the stage where this call died, since 3/5/18/2/1/19/41/10 is the real distribution.** A "death stage" picklist (Opening → Purpose → Permission → Their business → Objection) is more informative than the current 10-word vocabulary; one stage per tap, ordered, with stage 5 only reachable after stage 4.
3. **Stage 2 tap = the prospect's *disbelief* at the purpose.** Show the four archetypes as one-tap chips: "From where?", "What is this regarding?", "Why free / what do you want from me?", "Send me details first." Most stage‑2 answers are one of these — that is 80% of what callers face in the first minute.
4. **Stage 3 tap must capture the *exit type*, not just yes/no.** At least: right-person confirmed, wrong person (+ who), not-a-good-time (+ back-time), voluntary redirect (with the ability to log a referred *name + number* — T010/T050 show these are routine and gold), info barrier ("won't share/no number"), question/probe.
5. **Stage 4/5 must allow the prospect's voice — verbatim or paraphrased.** The current process does not show whether callers record the prospect's words; provide a "quote capture" field (with a paraphrase mode as minimum) plus the 3 standard yes/no questions as fixed tiles so callers don't have to remember which of them they asked (T005, T030, T053, T076 all have versions of these).
6. **Stage 6 tap = the objection zoo on pick-lists.** At least six first-class archetypes deserve button-level status: already-have-a-provider, not-looking/doing-fine, decision-abroad/head office, send-details-first, wrong-function/scope, trust-doubt (data/confidentiality/competitor-fear). These are repeat offenders; make them structured data, not prose.
7. **A "next step" is not the same as a "sold" next step.** Require: (a) type (report send / timed call / meeting), (b) channel (WhatsApp/email/phone/Google Meet), (c) day+time (or "unspecified — flagged"), (d) who executes. Stage‑8 close only when (c) exists and is re-confirmed in-call. Most stage‑7 calls have no date at all — the screen should show "next step without a time" as amber.
8. **Language must be a first-class tap, not an afterthought.** ~1/5 calls hit a code-switch or wall in under 30 s. Have a native-language toggle (En/Hindi/Hinglish/Marathi/Kannada/other) right on the opening screen, plus a "seek language specialist" fallback. `call_again` currently means "line broke/language" — splitting that into "language wall" vs "audio quality" makes re-assignment actionable.
9. **Data-validity signals are frequent enough to need their own chip.** Wrong-person (8 calls), moved/left (5 calls) + "company acquired" (T045), recycled numbers (T031, T015) and "we have already spoken and I never got the report" (T082) all recur. The cockpit needs a "verify this is still X" pre-call state, and a post-call route for "left the company" to flow directly into a correction task, not silently into `moved_company`.
10. **Busy-state management deserves a visual.** Calls that die at "in a meeting / driving / travelling / with my CA" are the single biggest stage-3 pile. Show a "promise to call back" state with an automatic pinned back-time (which stage-3 exits repeatedly feature: "call me in an hour", "Monday 3 PM", "day after tomorrow", "after 30 minutes") — many are given precisely but never written anywhere in these transcripts.

---

### Appendix: quick tally checks

- Caller distribution: Arjun 21, Divya 14, Neha 13, then Priya/Anjali/Sana/Sameer 7 each, Meera 5, Rohit/Rachel/Manish 4, Kavya 3, Pallavi 2, Vidya/Kiran 1.
- Stage-heuristic assignments per call (id → stage) — my working list for reproducibility:
  S1: T028, T031, T032.
  S2: T004, T005, T015, T022, T029.
  S3: T003, T007, T010, T012, T013, T014, T016, T024, T030, T038, T039, T040, T041, T050, T059, T070, T075, T079.
  S4: T034, T045.
  S5: T043.
  S6: T002, T009, T017, T018, T020, T021, T025, T037, T044, T048, T049, T053, T057, T066, T071, T076, T097, T098.
  S7: T006, T011, T019, T023, T027, T033, T036, T047, T052, T054, T055, T056, T058, T060, T061, T062, T063, T064, T065, T067, T068, T069, T072, T073, T074, T078, T080, T081, T082, T083, T086, T087, T088, T089, T090, T091, T092, T094, T095, T096, T099, T100.
  S8: T001, T008, T026, T035, T042, T046, T051, T084, T085, T093.
