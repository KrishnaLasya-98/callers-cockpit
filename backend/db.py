"""Supabase data access. All DB reads/writes go through here."""
from functools import lru_cache

from supabase import Client, create_client

from config import SUPABASE_SERVICE_KEY, SUPABASE_URL

OUTCOME_WORDS = (
    "agreed_to_receive_report", "next_step_agreed", "interested", "follow_up",
    "call_again", "not_interested", "do_not_call", "wrong_person", "moved_company",
    "not_logged",
)


@lru_cache(maxsize=1)
def client() -> Client:
    """Service-role client: bypasses RLS, stays server-side only."""
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


# ------------------------------------------------------------------ leads

def list_leads(status: str | None = None) -> list[dict]:
    q = client().table("leads").select("*").order("updated_at", desc=True)
    if status:
        q = q.eq("status", status)
    return q.execute().data or []


def get_lead(lead_id: str) -> dict | None:
    res = client().table("leads").select("*").eq("id", lead_id).execute()
    if not res.data:
        return None
    lead = res.data[0]
    lead["calls"] = (
        client().table("calls").select("*").eq("lead_id", lead_id)
        .order("started_at", desc=True).limit(20).execute().data or []
    )
    return lead


def create_lead(fields: dict) -> dict:
    return client().table("leads").insert(fields).execute().data[0]


def update_lead(lead_id: str, fields: dict) -> dict | None:
    res = client().table("leads").update(fields).eq("id", lead_id).execute()
    return res.data[0] if res.data else None


# ------------------------------------------------------------------ calls

def create_call(lead_id: str, language: str | None = None) -> dict:
    """Call opens the moment dialing starts — stage taps attach to it live."""
    return (
        client().table("calls")
        .insert({"lead_id": lead_id, "language": language})
        .execute().data[0]
    )


def add_stage_event(call_id: str, stage: int, tap: str, note: str | None = None) -> dict:
    return (
        client().table("stage_events")
        .insert({"call_id": call_id, "stage": stage, "tap": tap, "note": note})
        .execute().data[0]
    )


def list_stage_events(call_id: str) -> list[dict]:
    return (
        client().table("stage_events").select("*").eq("call_id", call_id)
        .order("created_at", desc=False).execute().data or []
    )


def get_call_row(call_id: str) -> dict | None:
    res = client().table("calls").select("*").eq("id", call_id).execute()
    return res.data[0] if res.data else None


def summarize_call(call_id: str, fields: dict) -> dict:
    """Close-out fields come from the outcome sheet + optional LLM debrief."""
    allowed = {
        "outcome", "stage_reached", "duration_s", "their_words", "next_step_text",
        "next_step_has_time", "summary", "language", "llm_reviewed",
        "logged_vs_observed_note",
    }
    res = (
        client().table("calls")
        .update({k: v for k, v in fields.items() if k in allowed and v is not None})
        .eq("id", call_id)
        .execute()
    )
    if res.data:
        call = res.data[0]
    else:
        # update({}) or no-op changes return no rows — refetch instead
        ref = client().table("calls").select("*").eq("id", call_id).execute()
        call = ref.data[0] if ref.data else None
        if not call:
            return None
    _sync_lead(call)
    return call


# "highest stage whose characteristic event appears" — mirrors the analysis heuristic
_STAGE_SYNC = {
    7: {"outcome": {"agreed_to_receive_report", "next_step_agreed"}},
    6: {"outcome": {"interested"}},
    3: {"outcome": {"wrong_person", "moved_company", "do_not_call"}},
}


def _sync_lead(call: dict) -> None:
    """Keep the lead's surface synced with the truth of the last call."""
    fields: dict = {"status": call["outcome"]}
    if call.get("next_step_text"):
        fields["next_step_text"] = call["next_step_text"]
        fields["next_step_at"] = None
        if call.get("next_step_has_time"):
            # Times pinned in stage events are free text; the caller edits the
            # lead if a calendar date exists. Amber-without-time is the default.
            fields["next_step_at"] = call.get("next_step_at")
    if call["outcome"] in {"wrong_person", "moved_company", "do_not_call"}:
        fields["verify_needed"] = True
    update_lead(call["lead_id"], fields)


def list_calls(limit: int = 200) -> list[dict]:
    """Past-call log view: joined with the lead name for the second screen."""
    data = (
        client().table("calls").select(
            "id, lead_id, started_at, duration_s, outcome, stage_reached, "
            "next_step_text, next_step_has_time, summary, logged_vs_observed_note, "
            "their_words, leads(company)"
        )
        .order("started_at", desc=True)
        .limit(limit)
        .execute()
        .data or []
    )
    for row in data:
        row["company"] = (row.pop("leads") or {}).get("company")
    return data
