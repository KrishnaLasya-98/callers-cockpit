"""LLM layer — the ONE LLM job we ship, the post-call debrief.

Why this job (the video argument):
- The transcripts show callers logging outcomes that don't match what happened
  (T084: a clean confirmed close was logged `do_not_call`; T002: an explicit
  30-minute call-back agreed and left `not_logged`) and not writing down the
  stage-5 words or busy-state back-times.
- So the LLM is the auditor of the log, not a chatbot: from the caller's taps,
  the prospect's own words and any notes, it returns the stage the call really
  reached, an outcome correction if the log disagrees, a clean one-line summary,
  and any next step with its day+time.
"""
import json
import logging
from typing import Any

import httpx

from config import LLM_KEY, LLM_MODEL

log = logging.getLogger("llm")

GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    f"{LLM_MODEL}:generateContent?key={LLM_KEY}"
)

SYSTEM_PROMPT = """You audit the log of ONE cold call made by a Meridian Growth
Partners caller to an Indian business owner/director. The caller sells growth
analysis and growth work.

A cold call has 8 stages: 1 Opening, 2 Purpose, 3 Permission, 4 Their business,
5 Their need (in their words), 6 Objection, 7 Next step, 8 Close.
- stage_reached: the highest stage with real substance, 1-8. Brush-offs at a
  stage count as that stage being REACHED only if the substance actually
  happened there; a "not the right person" redirect is stage 3; a concrete
  agreed document or callback is stage 7 day/time inclusion matters (use
  next_step_has_time only there is a specific-ish time or weekday).

Respond ONLY with JSON:
{
  "observed_stage":  int,     # 1-8
  "suggested_outcome": str,   # exactly one of:
                              # agreed_to_receive_report | next_step_agreed |
                              # interested | follow_up | call_again |
                              # not_interested | do_not_call | wrong_person |
                              # moved_company | not_logged
  "summary": str,             # one line, <= 15 words, what happened
  "next_step_text": str,      # "" if none
  "next_step_has_time": bool, # true only with a concrete day/time
  "mismatch_note": str        # "": if suggested_outcome != the logged outcome,
                              # one short sentence why; else ""
}

Rules: plain business English; decode "no budget"-style lines from the source
data ("we already have consultants" = no proof of ROI yet); never invent a time
that was not said. Return ONLY the JSON object."""


async def debrief(
    logged_outcome: str,
    logged_stage: int,
    their_words: str,
    events: list[dict],
    lead_context: str,
) -> dict[str, Any]:
    events_text = "\n".join(f"stage {e['stage']}: {e['tap']}" + (f" ({e['note']})" if e.get("note") else "") for e in events)
    user_text = (
        f"LEAD: {lead_context}\n"
        f"LOGGED OUTCOME: {logged_outcome}\n"
        f"LOGGED STAGE: {logged_stage}\n"
        f"PROSPECT'S OWN WORDS (stage 5 capture): {their_words or '(nothing captured)'}\n"
        f"WHAT THE CALLER TAPPED, IN ORDER:\n{events_text or '(no taps)'}"
    )
    body = {
        "system_instruction": {"parts": [{"text": SYSTEM_PROMPT}]},
        "contents": [{"role": "user", "parts": [{"text": user_text}]}],
        "generationConfig": {"temperature": 0.2, "responseMimeType": "application/json"},
    }

    try:
        async with httpx.AsyncClient(timeout=25) as http:
            res = await http.post(GEMINI_URL, json=body)
            res.raise_for_status()
    except httpx.HTTPError as exc:
        log.error("LLM debrief failed: %s", exc)
        return {"available": False,
                "error": "Model unreachable — log stands as recorded, retry debrief later."}

    try:
        p = json.loads(res.json()["candidates"][0]["content"]["parts"][0]["text"])
        norm = {"1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8}
        return {
            "available": True,
            "observed_stage": norm.get(str(p.get("observed_stage")), logged_stage),
            "suggested_outcome": str(p.get("suggested_outcome", logged_outcome)),
            "summary": str(p.get("summary", "")),
            "next_step_text": str(p.get("next_step_text", "")),
            "next_step_has_time": bool(p.get("next_step_has_time")),
            "mismatch_note": str(p.get("mismatch_note", "")),
        }
    except (KeyError, ValueError, json.JSONDecodeError) as exc:
        log.error("LLM response could not be parsed: %s", exc)
        return {"available": False, "error": "Model returned an unexpected response."}
