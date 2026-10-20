"""Shared outcome vocabulary and strict model response contract."""
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Outcome = Literal[
    "agreed_to_receive_report", "next_step_agreed", "interested", "follow_up",
    "call_again", "not_interested", "do_not_call", "wrong_person",
    "moved_company", "not_logged",
]


class DebriefResult(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid")

    observed_stage: int = Field(ge=1, le=8)
    suggested_outcome: Outcome
    summary: str = Field(max_length=500)
    next_step_text: str = Field(max_length=1000)
    next_step_has_time: bool
    mismatch_note: str = Field(max_length=1000)
