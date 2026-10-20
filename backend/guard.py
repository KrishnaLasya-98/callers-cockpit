"""Bound request bodies, rate-limit a free single-worker demo, and tag responses."""
from collections import OrderedDict, deque
from time import monotonic
from uuid import uuid4

from starlette.responses import JSONResponse


class RequestGuard:
    def __init__(self, app, max_body=65536):
        self.app = app
        self.max_body = max_body
        self.buckets = OrderedDict()

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        request_id = str(uuid4())
        scope.setdefault("state", {})["request_id"] = request_id

        async def tagged_send(message):
            if message["type"] == "http.response.start":
                message.setdefault("headers", []).extend([
                    (b"x-request-id", request_id.encode()),
                    (b"x-content-type-options", b"nosniff"),
                    (b"cache-control", b"no-store"),
                ])
            await send(message)

        async def reject(status, detail, headers=None):
            await JSONResponse({"detail": detail, "request_id": request_id}, status_code=status,
                               headers=headers)(scope, receive, tagged_send)

        path = scope.get("path", "")
        if scope["method"] != "OPTIONS" and path != "/health":
            # Do not trust client-supplied forwarding headers for the limit key.
            category = "model" if path == "/llm/debrief" else "login" if path == "/auth/login" else "api"
            key = ((scope.get("client") or ("unknown",))[0], category)
            limit = 12 if category in {"model", "login"} else 240
            now = monotonic()
            bucket = self.buckets.setdefault(key, deque())
            self.buckets.move_to_end(key)
            while bucket and now - bucket[0] >= 60:
                bucket.popleft()
            if len(bucket) >= limit:
                return await reject(429, "Too many requests. Please retry shortly", {"Retry-After": "60"})
            bucket.append(now)
            while len(self.buckets) > 4096:
                self.buckets.popitem(last=False)
        if scope["method"] in {"POST", "PATCH", "PUT"}:
            body = bytearray()
            while True:
                message = await receive()
                if message["type"] == "http.disconnect":
                    return
                body.extend(message.get("body", b""))
                if len(body) > self.max_body:
                    return await reject(413, "Request is too large")
                if not message.get("more_body", False):
                    break
            delivered = False

            async def bounded_receive():
                nonlocal delivered
                if not delivered:
                    delivered = True
                    return {"type": "http.request", "body": bytes(body), "more_body": False}
                return await receive()

            return await self.app(scope, bounded_receive, tagged_send)
        await self.app(scope, receive, tagged_send)
