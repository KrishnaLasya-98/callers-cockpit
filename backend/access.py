"""Optional, verified Supabase sign-in for a single private workspace."""
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

import db
from config import ALLOWED_USER_IDS, REQUIRE_AUTH

bearer = HTTPBearer(auto_error=False)


def require_user(request: Request, credentials: HTTPAuthorizationCredentials | None = Depends(bearer)):
    if request.url.path in {"/health", "/auth/login"} or not REQUIRE_AUTH:
        return None
    if not ALLOWED_USER_IDS:
        raise HTTPException(503, "Private workspace access has not been configured")
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(401, "Sign in to continue", headers={"WWW-Authenticate": "Bearer"})
    try:
        user = db.client().auth.get_user(credentials.credentials).user
    except Exception:
        raise HTTPException(401, "Session expired. Sign in again", headers={"WWW-Authenticate": "Bearer"}) from None
    if not user or user.id not in ALLOWED_USER_IDS:
        raise HTTPException(403, "This account does not have workspace access")
    return user.id
