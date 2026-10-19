"""Central configuration, loaded from environment / .env once."""
import os

from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")

LLM_KEY = os.getenv("LLM_KEY", "")
LLM_MODEL = os.getenv("LLM_MODEL", "ministral-8b-2512")

_raw_origins = os.getenv("FRONTEND_ORIGIN", "")
FRONTEND_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]
# Allow local dev alongside the deployed Vercel origin.
FRONTEND_ORIGINS += ["http://localhost:5500", "http://localhost:5173", "http://127.0.0.1:5500"]

PORT = int(os.getenv("PORT", "8000"))
