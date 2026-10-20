import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
import llm


class ModelResponseTests(unittest.IsolatedAsyncioTestCase):
    async def run_response(self, content):
        response = httpx.Response(200, request=httpx.Request("POST", llm.MISTRAL_URL),
            json={"choices": [{"message": {"content": content}}]})

        class FakeHTTP:
            def __init__(self, **kwargs): pass
            async def __aenter__(self): return self
            async def __aexit__(self, *args): pass
            async def post(self, *args, **kwargs): return response

        with patch.object(llm, "LLM_KEY", "test-key"), patch.object(llm.httpx, "AsyncClient", FakeHTTP):
            return await llm.debrief("not_logged", 3, "Fictional prospect words", [], "Demo")

    def valid(self):
        return dict(observed_stage=7, suggested_outcome="next_step_agreed", summary="Callback agreed",
            next_step_text="Call tomorrow at 3pm", next_step_has_time=True, mismatch_note="Callback was agreed")

    async def test_valid_response(self):
        result = await self.run_response(json.dumps(self.valid()))
        self.assertTrue(result["available"])
        self.assertEqual(result["observed_stage"], 7)

    async def test_invalid_types_and_out_of_range_are_unavailable(self):
        for key, value in (("observed_stage", 12), ("observed_stage", "7"),
                           ("next_step_has_time", "false"), ("suggested_outcome", "sold")):
            with self.subTest(key=key, value=value):
                data = self.valid(); data[key] = value
                self.assertFalse((await self.run_response(json.dumps(data)))["available"])

    async def test_bad_json_and_missing_shape_are_unavailable(self):
        for raw in ("not json", "[]", "null", "{}"):
            with self.subTest(raw=raw):
                self.assertFalse((await self.run_response(raw))["available"])

    async def test_blank_next_step_does_not_claim_time(self):
        data = self.valid(); data["next_step_text"] = ""
        result = await self.run_response(json.dumps(data))
        self.assertFalse(result["next_step_has_time"])

    async def test_http_failure_keeps_manual_save_available(self):
        class FailingHTTP:
            def __init__(self, **kwargs): pass
            async def __aenter__(self): return self
            async def __aexit__(self, *args): pass
            async def post(self, *args, **kwargs): raise httpx.ConnectError("test offline")
        with patch.object(llm, "LLM_KEY", "test-key"), patch.object(llm.httpx, "AsyncClient", FailingHTTP):
            result = await llm.debrief("not_logged", 1, "", [], "Demo")
        self.assertFalse(result["available"])


if __name__ == "__main__":
    unittest.main()
