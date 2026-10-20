# Research → product decisions

The structure page, reference screen and all 100 supplied transcripts were read directly during this review. Source files and per-call annotations are stored only under ignored `.private/task-sources/`. No source archive, dialogue, contact details or per-call narrative is published here. Original demo seeds are independently invented.

## Recomputed facts

The index contains 100 calls. Recording duration: mean **135.58 seconds**, median **93.5 seconds**, minimum **30**, maximum **687**. These values are reproducible using `scripts/analyze_transcripts.py` against the private archive.

| Logged outcome | Calls |
|---|---:|
| `agreed_to_receive_report` | 14 |
| `follow_up` | 14 |
| `not_interested` | 14 |
| `not_logged` | 13 |
| `next_step_agreed` | 11 |
| `do_not_call` | 10 |
| `wrong_person` | 8 |
| `interested` | 7 |
| `moved_company` | 5 |
| `call_again` | 4 |

These are caller-entered labels, not independently verified sales outcomes. The archive warns about label disagreements and occasional speaker-label errors. A report acceptance does not establish interest; a polite goodbye does not establish consent to future contact.

## Where calls ended: a declared annotation rule

A fresh read-through assigns the **highest evidenced substantive milestone**. Skipped stages are permitted: a busy caller can still agree a callback at stage 7. A routine goodbye is excluded from stage 8; stage 8 requires a clearly reconfirmed commitment and close. Contact identity failures are stage 1; a role/authority discussion or refusal to route is stage 3. Where an arrangement follows an objection, stage 7 describes the arrangement without implying commercial interest.

| Highest evidenced stage | Calls |
|---|---:|
| 1 · Opening | 13 |
| 2 · Purpose | 4 |
| 3 · Permission | 9 |
| 4 · Their business | 1 |
| 5 · Their need | 1 |
| 6 · Objection | 13 |
| 7 · Next step | 55 |
| 8 · Close | 4 |

These are judgment-based annotations, not ground truth or a conversion funnel. The private annotations cover all 100 calls and can be reassessed. This method produces different counts from the earlier unsupported stage table, which mixed engagement depth with highest stage. The current table supersedes that earlier estimate. The practical implication is to preserve the event path as well as the final stage, so later readers can distinguish a short callback arrangement from a full business discussion.

## Stage-specific evidence and implementation

| Stage | Recurring situation | Product response |
|---|---|---|
| Opening | Reception, stale identity, audio trouble, language mismatch | Separate taps, visible contact verification flags and language selection |
| Purpose | Identity repeated, unclear offering, commercial intent questioned | Three concise reaction prompts and evidence-oriented event choices |
| Permission | Busy exits, referrals and no clear consent | Distinct callback/referral/no-consent taps; structured follow-up controls |
| Their business | Wrong division, incorrect description, narrow responsibility | Corrected-details and clarified-scope events |
| Their need | Practical constraints, no present need, private plans | One persistent words box and explicit goal/constraint/privacy taps |
| Objection | Existing providers, central decisions, proof and trust concerns | Distinct objections without inventing hidden motives |
| Next step | Named channel, specific callback, vague timing | Action/channel/day/time controls; unspecified timing flagged |
| Close | Reconfirmation, dropped line, a warm goodbye after refusal | Distinct close events and a caller-reviewed outcome sheet |

## What the data cannot establish

The dialogue rarely gives direct evidence that business needs were written down verbatim. That does not prove nothing was noted off-tape. Likewise, vague timing creates uncertainty but does not prove a later follow-up never happened. Avoid those stronger claims in the video.

## Why this LLM job

A post-call audit compares the caller's structured events, captured words and next-step draft with the logged stage/outcome. It proposes a summary and correction after the conversation. Strict JSON validation checks the contract; the caller checks the meaning. Suggestions do not modify the record until applied and saved. An outage leaves manual save available.

Only original general reaction prompts are shipped. The transcript archive remains private task material.
