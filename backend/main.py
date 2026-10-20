"""Caller's Cockpit API — FastAPI backend (deploy target: Render)."""
import logging
from uuid import UUID

import httpx
from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool
from pydantic import BaseModel, Field

import db
from config import ALLOWED_USER_IDS, FRONTEND_ORIGINS, LLM_KEY, LLM_MODEL, REQUIRE_AUTH, SUPABASE_SERVICE_KEY, SUPABASE_URL
from access import require_user
from guard import RequestGuard
from llm import debrief
from models import Outcome

app = FastAPI(title="Caller's Cockpit API", version="3.0.0", dependencies=[Depends(require_user)])
app.add_middleware(RequestGuard)

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID", "Retry-After"],
)


@app.exception_handler(Exception)
async def unavailable(request: Request, exc: Exception):
    request_id = getattr(request.state, "request_id", "unknown")
    logging.getLogger("api").error("request_failed id=%s type=%s", request_id, type(exc).__name__)
    return JSONResponse({"detail": "Service temporarily unavailable. Your local draft is safe; retry shortly.",
                         "request_id": request_id}, status_code=503,
                        headers={"X-Request-ID": request_id, "Cache-Control": "no-store"})


# ---------------------------------------------------------------- schemas

STAGE = Field(ge=1, le=8)


class LeadCreate(BaseModel):
    company: str = Field(min_length=1, max_length=200)
    contact_name: str | None = Field(default=None, max_length=200)
    prospect_role: str | None = Field(default=None, max_length=200)
    phone: str | None = Field(default=None, max_length=50)
    kind: str | None = Field(default=None, max_length=200)
    language: str = Field(default="English", max_length=50)
    notes: str = Field(default="", max_length=4000)


class LeadUpdate(BaseModel):
    status: Outcome | None = None
    notes: str | None = Field(default=None, max_length=4000)
    phone: str | None = Field(default=None, max_length=50)
    next_step_text: str | None = Field(default=None, max_length=1000)
    verify_needed: bool | None = None


class CallStart(BaseModel):
    id: UUID | None = None
    lead_id: UUID
    language: str | None = Field(default=None, max_length=50)


class StageEvent(BaseModel):
    id: UUID | None = None
    stage: int = STAGE
    tap: str = Field(min_length=1, max_length=200)
    note: str | None = Field(default=None, max_length=2000)


class CallClose(BaseModel):
    outcome: Outcome
    stage_reached: int = STAGE
    duration_s: int = Field(default=0, ge=0, le=86400)
    their_words: str = Field(default="", max_length=10000)
    next_step_text: str = Field(default="", max_length=1000)
    next_step_has_time: bool = False
    summary: str = Field(default="", max_length=500)
    language: str | None = Field(default=None, max_length=50)
    llm_reviewed: bool = False
    logged_vs_observed_note: str = Field(default="", max_length=1000)


class DebriefRequest(BaseModel):
    call_id: UUID | None = None
    logged_outcome: Outcome
    logged_stage: int = STAGE
    their_words: str = Field(default="", max_length=10000)
    lead_context: str = Field(default="", max_length=1000)
    next_step_text: str = Field(default="", max_length=1000)
    next_step_has_time: bool = False


# ---------------------------------------------------------------- routes

@app.get("/")
def index():
    return {"service": "Caller's Cockpit API", "version": "3.0.0", "health": "/health", "docs": "/docs"}

@app.get("/health")
def health():
    return {
        "status": "ok",
        "supabase": SUPABASE_URL.split("//")[-1][:30] if SUPABASE_URL else "not-configured",
        "llm_model": LLM_MODEL,
        "version": "3.0.0",
        "auth_required": REQUIRE_AUTH,
        "llm_configured": bool(LLM_KEY),
    }


@app.get("/ready")
def ready():
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY or (REQUIRE_AUTH and not ALLOWED_USER_IDS):
        raise HTTPException(503, "Workspace configuration is incomplete")
    db.client().table("leads").select("id").limit(1).execute()
    return {"status": "ok", "database": "reachable"}


class Login(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=256)


@app.post("/auth/login")
async def login(body: Login):
    if not REQUIRE_AUTH:
        raise HTTPException(404, "Sign-in is not enabled for this demo")
    if not ALLOWED_USER_IDS or not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        raise HTTPException(503, "Private workspace access has not been configured")
    try:
        async with httpx.AsyncClient(timeout=15) as http:
            response = await http.post(SUPABASE_URL.rstrip("/") + "/auth/v1/token?grant_type=password",
                headers={"apikey": SUPABASE_SERVICE_KEY}, json=body.model_dump())
        if response.status_code != 200:
            raise HTTPException(401, "Email or password was not accepted")
        data = response.json()
        if data.get("user", {}).get("id") not in ALLOWED_USER_IDS:
            raise HTTPException(403, "This account does not have workspace access")
        return {"access_token": data["access_token"], "expires_in": data["expires_in"]}
    except (httpx.HTTPError, KeyError, ValueError):
        raise HTTPException(503, "Sign-in service is temporarily unavailable") from None


# ---------------- leads ----------------

@app.get("/leads")
def leads(status: str | None = None):
    return db.list_leads(status)


@app.post("/leads")
def new_lead(body: LeadCreate):
    return db.create_lead(body.model_dump())


@app.get("/leads/{lead_id}")
def lead_detail(lead_id: UUID):
    lead_id = str(lead_id)
    lead = db.get_lead(lead_id)
    if not lead:
        raise HTTPException(404, "Lead not found")
    return lead


@app.patch("/leads/{lead_id}")
def lead_update(lead_id: UUID, body: LeadUpdate):
    lead_id = str(lead_id)
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
    lead = db.get_lead(str(body.lead_id))
    if not lead:
        raise HTTPException(404, "Lead not found")
    if lead.get("status") == "do_not_call":
        raise HTTPException(409, "This prospect has opted out of further calls")
    if body.id:
        existing = db.get_call_row(str(body.id))
        if existing:
            if existing["lead_id"] != str(body.lead_id):
                raise HTTPException(409, "Call identifier belongs to a different lead")
            return existing
    return db.create_call(str(body.lead_id), body.language, str(body.id) if body.id else None)


@app.get("/calls/{call_id}")
def call_detail(call_id: UUID):
    call = db.get_call_row(str(call_id))
    if not call:
        raise HTTPException(404, "Call not found")
    return {**call, "events": db.list_stage_events(str(call_id))}


@app.post("/calls/{call_id}/events")
def tap_stage(call_id: UUID, body: StageEvent):
    call_id = str(call_id)
    row = db.get_call_row(call_id)
    if not row:
        raise HTTPException(404, "Call not found")
    if row.get("duration_s", 0) > 0 or row.get("outcome", "not_logged") != "not_logged":
        raise HTTPException(409, "This call is already closed")
    if body.id:
        existing = db.get_stage_event(str(body.id))
        if existing:
            if existing["call_id"] != call_id or existing["stage"] != body.stage or existing["tap"] != body.tap or existing.get("note") != body.note:
                raise HTTPException(409, "Event identifier already belongs to another event")
            db.advance_stage(call_id, body.stage)
            return existing
    event = db.add_stage_event(call_id, body.stage, body.tap, body.note, str(body.id) if body.id else None)
    # keep the row's stage_reached moving upward with the tap
    db.advance_stage(call_id, body.stage)
    return event


@app.patch("/calls/{call_id}")
def close_call(call_id: UUID, body: CallClose):
    call_id = str(call_id)
    fields = body.model_dump()
    fields["duration_s"] = max(1, fields["duration_s"])
    if not fields["next_step_text"].strip():
        fields["next_step_has_time"] = False
    call = db.summarize_call(call_id, fields)
    if not call:
        raise HTTPException(404, "Call not found")
    return call


@app.get("/calls/{call_id}/events")
def events(call_id: UUID):
    if not db.get_call_row(str(call_id)):
        raise HTTPException(404, "Call not found")
    return db.list_stage_events(str(call_id))


# ---------------- the ONE LLM job: post-call debrief ----------------

@app.post("/llm/debrief")
async def llm_debrief(body: DebriefRequest):
    context = body.lead_context
    if body.call_id:
        call = await run_in_threadpool(db.get_call_row, str(body.call_id))
        if not call:
            raise HTTPException(404, "Call not found")
        if not context:
            lead = await run_in_threadpool(db.get_lead, call["lead_id"])
            context = (lead or {}).get("company", "unknown lead")
    events = await run_in_threadpool(db.list_stage_events, str(body.call_id)) if body.call_id else []
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
