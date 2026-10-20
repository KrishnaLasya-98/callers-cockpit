"""API regression tests with isolated in-memory data, never production writes."""
import copy
import sys
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from fastapi.testclient import TestClient
import main
import db


class CallWorkflowTests(unittest.TestCase):
    def setUp(self):
        self.leads = {"11111111-1111-4111-8111-111111111111": {"id": "11111111-1111-4111-8111-111111111111", "company": "Fictional demo", "status": "queue"}}
        self.calls = {}
        self.events = []

        def detail(lead_id):
            if lead_id not in self.leads:
                return None
            return {**self.leads[lead_id], "calls": [c for c in self.calls.values() if c["lead_id"] == lead_id]}

        def create(lead_id, language, call_id=None):
            call = {"id": call_id or "22222222-2222-4222-8222-222222222222", "lead_id": lead_id, "language": language,
                    "stage_reached": 1, "outcome": "not_logged"}
            self.calls[call["id"]] = call
            return copy.deepcopy(call)

        def save(call_id, fields):
            if call_id not in self.calls:
                return None
            self.calls[call_id].update(fields)
            return copy.deepcopy(self.calls[call_id])

        def event(call_id, stage, tap, note, event_id=None):
            row = dict(id=event_id or "event-1", call_id=call_id, stage=stage, tap=tap, note=note)
            self.events.append(row)
            return row

        def advance(call_id, stage):
            self.calls[call_id]["stage_reached"] = max(stage, self.calls[call_id]["stage_reached"])

        self.db_patch = patch.multiple(main.db, get_lead=detail, create_call=create,
            get_call_row=lambda cid: self.calls.get(cid), summarize_call=save,
            add_stage_event=event, advance_stage=advance,
            get_stage_event=lambda eid: next((e for e in self.events if e["id"] == eid), None),
            list_stage_events=lambda cid: [e for e in self.events if e["call_id"] == cid],
            list_calls=lambda limit=200: list(self.calls.values())[:limit])
        self.db_patch.start()
        self.addCleanup(self.db_patch.stop)
        self.http = TestClient(main.app)
        self.addCleanup(self.http.close)

    def start(self):
        response = self.http.post("/calls", json={"lead_id": "11111111-1111-4111-8111-111111111111", "language": "English"})
        self.assertEqual(response.status_code, 200)
        return response.json()["id"]

    def test_start_tap_close_history_and_log(self):
        cid = self.start()
        self.assertEqual(self.leads["11111111-1111-4111-8111-111111111111"]["status"], "queue")
        for stage in (1, 7, 3):
            self.assertEqual(self.http.post(f"/calls/{cid}/events", json={"stage": stage, "tap": "demo tap"}).status_code, 200)
        self.assertEqual(self.calls[cid]["stage_reached"], 7)
        response = self.http.patch(f"/calls/{cid}", json={"outcome": "next_step_agreed",
            "stage_reached": 7, "their_words": "A fictional need", "duration_s": 33,
            "next_step_text": "Call Tuesday 3pm", "next_step_has_time": True})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["next_step_has_time"])
        self.assertEqual(self.http.get("/leads/11111111-1111-4111-8111-111111111111").json()["calls"][0]["their_words"], "A fictional need")
        self.assertEqual(len(self.http.get("/calls").json()), 1)
        self.assertEqual(len(self.http.get(f"/calls/{cid}/events").json()), 3)

    def test_discard_retains_reached_stage(self):
        cid = self.start()
        response = self.http.patch(f"/calls/{cid}", json={"outcome": "not_logged", "stage_reached": 6, "duration_s": 15})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["stage_reached"], 6)

    def test_blank_next_step_cannot_claim_time(self):
        cid = self.start()
        result = self.http.patch(f"/calls/{cid}", json={"outcome": "not_interested", "stage_reached": 6,
            "next_step_text": "  ", "next_step_has_time": True})
        self.assertFalse(result.json()["next_step_has_time"])

    def test_bad_input_and_missing_records(self):
        cid = self.start()
        for fields in ({"outcome": "invented", "stage_reached": 7},
                       {"outcome": "not_logged", "stage_reached": 9},
                       {"outcome": "not_logged", "stage_reached": 1, "duration_s": -1}):
            self.assertEqual(self.http.patch(f"/calls/{cid}", json=fields).status_code, 422)
        self.assertEqual(self.http.post("/calls", json={"lead_id": "00000000-0000-4000-8000-000000000000"}).status_code, 404)
        self.assertEqual(self.http.post("/calls/00000000-0000-4000-8000-000000000000/events", json={"stage": 1, "tap": "demo"}).status_code, 404)
        self.assertEqual(self.http.get("/calls?limit=-1").status_code, 422)

    def test_debrief_has_no_write_side_effect_and_receives_next_step(self):
        cid = self.start()
        before = copy.deepcopy(self.calls)
        result = dict(available=True, observed_stage=7, suggested_outcome="next_step_agreed",
                      summary="Callback agreed", next_step_text="Tomorrow 3pm",
                      next_step_has_time=True, mismatch_note="Timed callback was agreed")
        with patch.object(main, "debrief", new_callable=AsyncMock, return_value=result) as model:
            response = self.http.post("/llm/debrief", json={"call_id": cid, "logged_outcome": "not_logged",
                "logged_stage": 3, "next_step_text": "Tomorrow 3pm", "next_step_has_time": True})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(model.call_args.kwargs["next_step_text"], "Tomorrow 3pm")
        self.assertEqual(before, self.calls)

    def test_missing_call_debrief_returns_404(self):
        result = self.http.post("/llm/debrief", json={"call_id": "00000000-0000-4000-8000-000000000000", "logged_outcome": "not_logged", "logged_stage": 1})
        self.assertEqual(result.status_code, 404)

    def test_idempotent_start_and_tap_do_not_duplicate_records(self):
        call_id = "33333333-3333-4333-8333-333333333333"
        body = {"id": call_id, "lead_id": "11111111-1111-4111-8111-111111111111"}
        for _ in range(2):
            self.assertEqual(self.http.post("/calls", json=body).json()["id"], call_id)
        self.assertEqual(len(self.calls), 1)
        event = {"id": "44444444-4444-4444-8444-444444444444", "stage": 7, "tap": "Timed callback agreed"}
        for _ in range(2):
            self.assertEqual(self.http.post(f"/calls/{call_id}/events", json=event).status_code, 200)
        self.assertEqual(len(self.events), 1)
        self.assertEqual(self.http.get(f"/calls/{call_id}").json()["events"][0]["stage"], 7)

    def test_closed_call_rejects_new_taps(self):
        cid = self.start()
        self.http.patch(f"/calls/{cid}", json={"outcome": "not_logged", "stage_reached": 3})
        self.assertEqual(self.calls[cid]["duration_s"], 1)
        self.assertEqual(self.http.post(f"/calls/{cid}/events", json={"stage": 4, "tap": "Late tap"}).status_code, 409)

    def test_identifiers_and_long_input_are_validated(self):
        self.assertEqual(self.http.get("/leads/not-a-uuid").status_code, 422)
        cid = self.start()
        self.assertEqual(self.http.post(f"/calls/{cid}/events", json={"stage": 1, "tap": ""}).status_code, 422)
        self.assertEqual(self.http.patch(f"/calls/{cid}", json={"outcome": "not_logged", "stage_reached": 1, "their_words": "x" * 10001}).status_code, 422)

    def test_opted_out_prospect_cannot_be_started_through_the_api(self):
        self.leads["11111111-1111-4111-8111-111111111111"]["status"] = "do_not_call"
        result = self.http.post("/calls", json={"lead_id": "11111111-1111-4111-8111-111111111111"})
        self.assertEqual(result.status_code, 409)
        self.assertEqual(self.calls, {})


class LeadSyncTests(unittest.TestCase):
    def test_clears_stale_next_step_and_keeps_contact_flag(self):
        with patch.object(db, "update_lead") as update:
            db._sync_lead({"lead_id": "demo", "outcome": "not_interested", "next_step_text": ""})
        self.assertEqual(update.call_args.args[1], {"status": "not_interested", "next_step_text": "", "next_step_at": None})


if __name__ == "__main__":
    unittest.main()
