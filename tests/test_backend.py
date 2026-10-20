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
        self.leads = {"lead-1": {"id": "lead-1", "company": "Fictional demo", "status": "queue"}}
        self.calls = {}
        self.events = []

        def detail(lead_id):
            if lead_id not in self.leads:
                return None
            return {**self.leads[lead_id], "calls": [c for c in self.calls.values() if c["lead_id"] == lead_id]}

        def create(lead_id, language):
            call = {"id": "call-1", "lead_id": lead_id, "language": language,
                    "stage_reached": 1, "outcome": "not_logged"}
            self.calls[call["id"]] = call
            return copy.deepcopy(call)

        def save(call_id, fields):
            if call_id not in self.calls:
                return None
            self.calls[call_id].update(fields)
            return copy.deepcopy(self.calls[call_id])

        def event(call_id, stage, tap, note):
            row = dict(call_id=call_id, stage=stage, tap=tap, note=note)
            self.events.append(row)
            return row

        def advance(call_id, stage):
            self.calls[call_id]["stage_reached"] = max(stage, self.calls[call_id]["stage_reached"])

        self.db_patch = patch.multiple(main.db, get_lead=detail, create_call=create,
            get_call_row=lambda cid: self.calls.get(cid), summarize_call=save,
            add_stage_event=event, advance_stage=advance,
            list_stage_events=lambda cid: [e for e in self.events if e["call_id"] == cid],
            list_calls=lambda limit=200: list(self.calls.values())[:limit])
        self.db_patch.start()
        self.addCleanup(self.db_patch.stop)
        self.http = TestClient(main.app)
        self.addCleanup(self.http.close)

    def start(self):
        response = self.http.post("/calls", json={"lead_id": "lead-1", "language": "English"})
        self.assertEqual(response.status_code, 200)
        return response.json()["id"]

    def test_start_tap_close_history_and_log(self):
        cid = self.start()
        self.assertEqual(self.leads["lead-1"]["status"], "queue")
        for stage in (1, 7, 3):
            self.assertEqual(self.http.post(f"/calls/{cid}/events", json={"stage": stage, "tap": "demo tap"}).status_code, 200)
        self.assertEqual(self.calls[cid]["stage_reached"], 7)
        response = self.http.patch(f"/calls/{cid}", json={"outcome": "next_step_agreed",
            "stage_reached": 7, "their_words": "A fictional need", "duration_s": 33,
            "next_step_text": "Call Tuesday 3pm", "next_step_has_time": True})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["next_step_has_time"])
        self.assertEqual(self.http.get("/leads/lead-1").json()["calls"][0]["their_words"], "A fictional need")
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
        self.assertEqual(self.http.post("/calls", json={"lead_id": "absent"}).status_code, 404)
        self.assertEqual(self.http.post("/calls/absent/events", json={"stage": 1, "tap": "demo"}).status_code, 404)
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
        result = self.http.post("/llm/debrief", json={"call_id": "absent", "logged_outcome": "not_logged", "logged_stage": 1})
        self.assertEqual(result.status_code, 404)


class LeadSyncTests(unittest.TestCase):
    def test_clears_stale_next_step_and_keeps_contact_flag(self):
        with patch.object(db, "update_lead") as update:
            db._sync_lead({"lead_id": "demo", "outcome": "not_interested", "next_step_text": ""})
        self.assertEqual(update.call_args.args[1], {"status": "not_interested", "next_step_text": "", "next_step_at": None})


if __name__ == "__main__":
    unittest.main()
