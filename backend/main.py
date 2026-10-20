"""Caller's Cockpit API — FastAPI backend (deploy target: Render)."""
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import db
from config import FRONTEND_ORIGINS, LLM_MODEL, SUPABASE_URL
from llm import debrief
from models import Outcome

app = FastAPI(title="Caller's Cockpit API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------- schemas

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
    outcome: Outcome
    stage_reached: int = STAGE
    duration_s: int = Field(default=0, ge=0)
    their_words: str = ""
    next_step_text: str = ""
    next_step_has_time: bool = False
    summary: str = ""
    language: str | None = None
    llm_reviewed: bool = False
    logged_vs_observed_note: str = ""


class DebriefRequest(BaseModel):
    call_id: str | None = None
    logged_outcome: Outcome
    logged_stage: int = STAGE
    their_words: str = ""
    lead_context: str = ""
    next_step_text: str = ""
    next_step_has_time: bool = False


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
def calls(limit: int = Query(default=200, ge=1, le=500)):
    return db.list_calls(limit)


@app.post("/calls")
def start_call(body: CallStart):
    """Open the call row the moment dialing starts — taps attach live."""
    if not db.get_lead(body.lead_id):
        raise HTTPException(404, "Lead not found")
    return db.create_call(body.lead_id, body.language)


@app.post("/calls/{call_id}/events")
def tap_stage(call_id: str, body: StageEvent):
    row = db.get_call_row(call_id)
    if not row:
        raise HTTPException(404, "Call not found")
    event = db.add_stage_event(call_id, body.stage, body.tap, body.note)
    # keep the row's stage_reached moving upward with the tap
    db.advance_stage(call_id, body.stage)
    return event


@app.patch("/calls/{call_id}")
def close_call(call_id: str, body: CallClose):
    fields = body.model_dump()
    if not fields["next_step_text"].strip():
        fields["next_step_has_time"] = False
    call = db.summarize_call(call_id, fields)
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
    if body.call_id:
        call = db.get_call_row(body.call_id)
        if not call:
            raise HTTPException(404, "Call not found")
        if not context:
            lead = db.get_lead(call["lead_id"])
            context = (lead or {}).get("company", "unknown lead")
    events = db.list_stage_events(body.call_id) if body.call_id else []
    out = await debrief(
        logged_outcome=body.logged_outcome,
        logged_stage=body.logged_stage,
        their_words=body.their_words,
        events=[e.model_dump() if hasattr(e, "model_dump") else e for e in events],
        lead_context=context,
        next_step_text=body.next_step_text,
        next_step_has_time=body.next_step_has_time,
    )
    # Suggestions are saved with the caller's final decision, never mid-session.
    return out
