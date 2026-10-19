"""Caller's Cockpit API — FastAPI backend (deploy target: Render)."""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import db
from config import FRONTEND_ORIGINS, LLM_MODEL, PORT, SUPABASE_URL
from llm import debrief

app = FastAPI(title="Caller's Cockpit API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------- schemas

OUTCOME = Field(pattern="^(agreed_to_receive_report|next_step_agreed|interested|"
                        "follow_up|call_again|not_interested|do_not_call|"
                        "wrong_person|moved_company|not_logged)$")
STAGE = Field(ge=1, le=8)


class LeadCreate(BaseModel):
    company: str
    contact_name: str | None = None
    prospect_role: str | None = None
    phone: str | None = None
    kind: str | None = None
    language: str = "English"
    notes: str = ""


class LeadUpdate(BaseModel):
    status: str | None = None
    notes: str | None = None
    phone: str | None = None
    next_step_text: str | None = None
    verify_needed: bool | None = None


class CallStart(BaseModel):
    lead_id: str
    language: str | None = None


class StageEvent(BaseModel):
    stage: int = STAGE
    tap: str
    note: str | None = None


class CallClose(BaseModel):
    outcome: str = OUTCOME
    stage_reached: int = STAGE
    duration_s: int = 0
    their_words: str = ""
    next_step_text: str = ""
    next_step_has_time: bool = False
    summary: str = ""
    language: str | None = None


class DebriefRequest(BaseModel):
    call_id: str | None = None
    logged_outcome: str = OUTCOME
    logged_stage: int = STAGE
    their_words: str = ""
    lead_context: str = ""


# ---------------------------------------------------------------- routes

@app.get("/health")
def health():
    return {
        "status": "ok",
        "supabase": SUPABASE_URL.split("//")[-1][:30] if SUPABASE_URL else "not-configured",
        "llm_model": LLM_MODEL,
    }


# ---------------- leads ----------------

@app.get("/leads")
def leads(status: str | None = None):
    return db.list_leads(status)


@app.post("/leads")
def new_lead(body: LeadCreate):
    return db.create_lead(body.model_dump())


@app.get("/leads/{lead_id}")
def lead_detail(lead_id: str):
    lead = db.get_lead(lead_id)
    if not lead:
        raise HTTPException(404, "Lead not found")
    return lead


@app.patch("/leads/{lead_id}")
def lead_update(lead_id: str, body: LeadUpdate):
    fields = {k: v for k, v in body.model_dump().items() if v is not None}
    if not fields:
        raise HTTPException(400, "Nothing to update")
    updated = db.update_lead(lead_id, fields)
    if not updated:
        raise HTTPException(404, "Lead not found")
    return updated


# ---------------- calls ----------------

@app.get("/calls")
def calls(limit: int = 200):
    return db.list_calls(limit)


@app.post("/calls")
def start_call(body: CallStart):
    """Open the call row the moment dialing starts — taps attach live."""
    call = db.create_call(body.lead_id, body.language)
    return db.summarize_call(call["id"], {}) or call


@app.post("/calls/{call_id}/events")
def tap_stage(call_id: str, body: StageEvent):
    event = db.add_stage_event(call_id, body.stage, body.tap, body.note)
    # keep the row's stage_reached moving upward with the tap
    db.summarize_call(call_id, {"stage_reached": max(body.stage, _current_stage(call_id))})
    return event


@app.patch("/calls/{call_id}")
def close_call(call_id: str, body: CallClose):
    call = db.summarize_call(call_id, body.model_dump())
    if not call:
        raise HTTPException(404, "Call not found")
    return call


@app.get("/calls/{call_id}/events")
def events(call_id: str):
    return db.list_stage_events(call_id)


# ---------------- the ONE LLM job: post-call debrief ----------------

@app.post("/llm/debrief")
async def llm_debrief(body: DebriefRequest):
    context = body.lead_context
    if body.call_id and not context:
        call = db.list_calls(500)
        for c in call:
            if c["id"] == body.call_id:
                context = f"{c.get('company') or 'unknown lead'} (stage {body.logged_stage})"
                break
    events = db.list_stage_events(body.call_id) if body.call_id else []
    out = await debrief(
        logged_outcome=body.logged_outcome,
        logged_stage=body.logged_stage,
        their_words=body.their_words,
        events=[e.model_dump() if hasattr(e, "model_dump") else e for e in events],
        lead_context=context,
    )
    if out.get("available") and body.call_id:
        note = out["mismatch_note"] or None
        db.summarize_call(body.call_id, {
            "summary": out["summary"] or None,
            "llm_reviewed": True,
            **({"logged_vs_observed_note": note} if note else {}),
        })
    return out
