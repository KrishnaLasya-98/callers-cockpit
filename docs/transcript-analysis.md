# Research summary and design implications

The supplied 100-call archive is task-only material. This public summary contains aggregate observations and original design reasoning; it does not reproduce source transcripts, prospect quotations, contact details or per-call narratives. Original detailed notes are kept locally under ignored `.private/` when available. Removed excerpts may remain in earlier Git history.

## Aggregate observations from the earlier analysis

The earlier analysis reported a mean call duration near 136 seconds and median near 94 seconds. Thirteen outcomes were unlogged. The original transcript files are not in this repository, so these calculations have not been independently rerun during the current repair.

The stage assignments were a judgment-based heuristic, not ground truth. The previous summary reported 3%, 5%, 18%, 2%, 1%, 19%, 41% and 10% for stages 1 through 8. Its appendix has inconsistent stage counts, so treat this distribution as approximate until recomputed against the private archive. Do not present it as a precisely verified statistic in the video.

The useful qualitative patterns are stronger than the exact counts: contact routing and busy exits happen early; prospects question the purpose and credibility of the call; objections often concern existing providers, fit or decision authority; agreements can leave follow-up timing unspecified; recorded labels can differ from the conversation.

There is limited evidence of business-needs note-taking in the available dialogue. Absence of an audible note-taking statement does not establish that no notes were taken off-tape. Likewise, unspecified timing is a follow-up risk; these transcripts alone do not establish whether a later follow-up occurred.

## How those observations shape the product

| Observation | Product decision |
|---|---|
| Calls can end early | End-call control is available at every stage |
| Callers need to listen while recording | Structured one-tap events instead of long forms |
| Purpose and permission invite predictable reactions | Stage-specific reaction prompts and event choices |
| The prospect's need is easy to lose | Persistent prospect-word capture |
| Follow-up timing can be vague | Next-step capture and amber warning without confirmed day/time |
| Outcome labels can disagree with evidence | Optional post-call LLM audit, with caller approval |
| A returning caller needs context | Lead detail fetches recent calls |
| A model can be unavailable or wrong | Strict response validation and manual save independent of the model |

The eight-stage structure and ten-outcome vocabulary are implemented in code and schema. The prompts are general original examples, not an archive of the supplied dialogue.
