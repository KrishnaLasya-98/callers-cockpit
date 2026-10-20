"""Production-boundary checks without external accounts or database writes."""
from types import SimpleNamespace
import sys
from pathlib import Path
from unittest import TestCase
from unittest.mock import Mock, patch
from fastapi.testclient import TestClient
from starlette.responses import JSONResponse
from starlette.applications import Starlette
from starlette.routing import Route

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
import access
import main
from guard import RequestGuard


class AccessTests(TestCase):
    def test_private_workspace_rejects_missing_token_and_unapproved_user(self):
        with patch.object(access, "REQUIRE_AUTH", True), patch.object(access, "ALLOWED_USER_IDS", {"approved"}):
            with TestClient(main.app) as http:
                self.assertEqual(http.get("/health").status_code, 200)
                self.assertEqual(http.get("/leads").status_code, 401)
                fake = Mock()
                fake.auth.get_user.return_value = SimpleNamespace(user=SimpleNamespace(id="other"))
                with patch.object(access.db, "client", return_value=fake):
                    self.assertEqual(http.get("/leads", headers={"Authorization": "Bearer sample"}).status_code, 403)

    def test_approved_verified_user_can_read(self):
        fake = Mock()
        fake.auth.get_user.return_value = SimpleNamespace(user=SimpleNamespace(id="approved"))
        with patch.object(access, "REQUIRE_AUTH", True), patch.object(access, "ALLOWED_USER_IDS", {"approved"}), \
             patch.object(access.db, "client", return_value=fake), patch.object(main.db, "list_leads", return_value=[]):
            with TestClient(main.app) as http:
                self.assertEqual(http.get("/leads", headers={"Authorization": "Bearer verified-token"}).status_code, 200)
            fake.auth.get_user.assert_called_once_with("verified-token")

    def test_private_mode_without_allowlist_fails_closed(self):
        with patch.object(access, "REQUIRE_AUTH", True), patch.object(access, "ALLOWED_USER_IDS", set()):
            with TestClient(main.app) as http:
                self.assertEqual(http.get("/leads").status_code, 503)

    def test_invalid_token_cannot_fall_back_to_demo(self):
        fake = Mock()
        fake.auth.get_user.side_effect = ValueError("expired")
        with patch.object(access, "REQUIRE_AUTH", True), patch.object(access, "ALLOWED_USER_IDS", {"approved"}), \
             patch.object(access.db, "client", return_value=fake):
            with TestClient(main.app) as http:
                self.assertEqual(http.get("/leads", headers={"Authorization": "Bearer expired"}).status_code, 401)


class RequestLimitTests(TestCase):
    def test_large_body_is_rejected_before_route_execution(self):
        with TestClient(main.app) as http:
            response = http.post("/leads", content=b"x" * 65537, headers={"Content-Type": "application/json"})
        self.assertEqual(response.status_code, 413)
        self.assertTrue(response.headers["X-Request-ID"])

    def test_model_limit_and_health_exemption(self):
        async def endpoint(request):
            return JSONResponse({"status": "ok"})
        application = Starlette(routes=[Route("/llm/debrief", endpoint), Route("/health", endpoint)])
        with TestClient(RequestGuard(application)) as http:
            for _ in range(12):
                self.assertEqual(http.get("/llm/debrief").status_code, 200)
            response = http.get("/llm/debrief")
            self.assertEqual(response.status_code, 429)
            self.assertEqual(response.headers["Retry-After"], "60")
            self.assertEqual(http.get("/health").status_code, 200)

    def test_internal_errors_expose_reference_without_secrets(self):
        with patch.object(main.db, "list_leads", side_effect=RuntimeError("secret-credential")):
            with TestClient(main.app, raise_server_exceptions=False) as http:
                response = http.get("/leads")
        self.assertEqual(response.status_code, 503)
        self.assertNotIn("secret-credential", response.text)
        self.assertTrue(response.headers["X-Request-ID"])
