"""LLM layer — Mistral via plain REST (httpx), key stays server-side.

The ONE LLM job we ship: the post-call debrief.

Why this job (the video argument):
- The transcripts show callers logging outcomes that don't match what happened
  (T084: a clean confirmed close was logged `do_not_call`; T002: an explicit
  30-minute call-back agreed and left `not_logged`) and not writing down the
  stage-5 words or busy-state back-times.
- So the LLM audits the log, not the caller: from the caller's taps, the
  prospect's own words and any notes, it returns the stage the call really
  reached, an outcome correction if the log disagrees, a clean one-line summary,
  and any next step with its day+time.
"""
import json
import logging
from typing import Any

import httpx

from config import LLM_KEY, LLM_MODEL

log = logging.getLogger("llm")

MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions"

SYSTEM_PROMPT = """You audit the log of ONE cold call made by a Meridian Growth
Partners caller to an Indian business owner/director. The caller sells growth
analysis and growth work.

A cold call has 8 stages: 1 Opening, 2 Purpose, 3 Permission, 4 Their business,
5 Their need (in their words), 6 Objection, 7 Next step, 8 Close.
- stage_reached: the highest stage with real substance, 1-8. A "not the right
  person" redirect is stage 3; a concrete agreed document or callback is stage 7
  (use next_step_has_time only when a specific-ish time or weekday was said).

Respond ONLY with JSON:
{
  "observed_stage":        int,   # 1-8
  "suggested_outcome":     str,   # exactly one of:
                                  # agreed_to_receive_report | next_step_agreed |
                                  # interested | follow_up | call_again |
                                  # not_interested | do_not_call | wrong_person |
                                  # moved_company | not_logged
  "summary":               str,   # one line, <= 15 words, what happened
  "next_step_text":        str,   # "" if none
  "next_step_has_time":    bool,  # true only with a concrete day/time
  "mismatch_note":         str    # "" if suggested_outcome == logged outcome;
                                  # else one short sentence why it differs
}

Rules: plain business English; decode "no budget"-style lines into what they
mean ("we already have consultants" = no proof of ROI yet); never invent a time
that was not said. Return ONLY the JSON object."""


async def debrief(
    logged_outcome: str,
    logged_stage: int,
    their_words: str,
    events: list[dict],
    lead_context: str,
) -> dict[str, Any]:
    events_text = "\n".join(
        f"stage {e['stage']}: {e['tap']}" + (f" ({e['note']})" if e.get("note") else "")
        for e in events
    )
    user_text = (
        f"LEAD: {lead_context}\n"
        f"LOGGED OUTCOME: {logged_outcome}\n"
        f"LOGGED STAGE: {logged_stage}\n"
        f"PROSPECT'S OWN WORDS (stage 5 capture): {their_words or '(nothing captured)'}\n"
        f"WHAT THE CALLER TAPPED, IN ORDER:\n{events_text or '(no taps)'}"
    )
    body = {
        "model": LLM_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_text},
        ],
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
    }

    try:
        async with httpx.AsyncClient(timeout=25) as http:
            res = await http.post(
                MISTRAL_URL,
                headers={"Authorization": f"Bearer {LLM_KEY}"},
                json=body,
            )
            res.raise_for_status()
    except httpx.HTTPError as exc:
        log.error("LLM debrief failed: %s", exc)
        return {
            "available": False,
            "error": "Model unreachable — log stands as recorded, retry debrief later.",
        }

    try:
        parsed = json.loads(res.json()["choices"][0]["message"]["content"])
        return {
            "available": True,
            "observed_stage": int(str(parsed.get("observed_stage", logged_stage))[:1]) or logged_stage,
            "suggested_outcome": str(parsed.get("suggested_outcome", logged_outcome)),
            "summary": str(parsed.get("summary", "")),
            "next_step_text": str(parsed.get("next_step_text", "")),
            "next_step_has_time": bool(parsed.get("next_step_has_time")),
            "mismatch_note": str(parsed.get("mismatch_note", "")),
        }
    except (KeyError, ValueError, IndexError, json.JSONDecodeError) as exc:
        log.error("LLM response could not be parsed: %s", exc)
        return {"available": False, "error": "Model returned an unexpected response."}
