"""
Emotionist.ai - FastAPI backend.

A thin HTTP layer over the existing emotion engine. The engine (agents/, engine/,
entity/, emotions/) is untouched: this server drives one configurable practice-
partner Agent and serializes its state to JSON for the React frontend.

Run:  uv run python server.py     (or: uv run uvicorn server:app --reload)
"""

import os
import threading
import uuid

from dotenv import load_dotenv
from fastapi import FastAPI, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from agents.agent import Agent
from agents.personas import SCENARIOS, get_scenario, scenario_label
from engine.appraisal import REACTIVITY
from engine.memory import SessionMemory
from engine.prompt_modifier import NEUTRAL_PROFILE, weighted_params, describe_level
from entity.entity import _score_to_decay
from llm import AVAILABLE_MODELS, default_model_id, provider_of

load_dotenv()


# -- Serialization -------------------------------------------------------------
PARAM_KEYS = list(NEUTRAL_PROFILE)


def agent_state(agent: Agent) -> dict:
    dominant = agent.entity.get_dominant_emotions(n=5)
    params = weighted_params(dominant) if dominant else NEUTRAL_PROFILE.copy()
    base_decay = round(_score_to_decay(agent.entity.personality_score), 3)
    return {
        "name": agent.name,
        "personality": agent.entity.personality,
        "decay": base_decay,
        "emotions": [
            {"name": n, "intensity": round(i, 4)}
            for n, i in agent.entity.get_active_emotions()[:7]
        ],
        "params": {k: {"level": describe_level(params[k]), "value": round(params[k], 1)} for k in PARAM_KEYS},
    }


# -- API -----------------------------------------------------------------------
app = FastAPI(title="Emotionist.ai")


# Light public-exposure guard for tunnel demos (#38): cap mutating calls per IP.
# ponytail: in-process fixed window, fine for a single-box demo; swap for slowapi
# /redis only if this ever runs multi-worker or faces real traffic.
import time
from collections import defaultdict

from fastapi import Request
from fastapi.responses import JSONResponse

_RATE_MAX = int(os.environ.get("RATE_LIMIT_PER_MIN", "30"))
_hits: dict[str, list[float]] = defaultdict(list)


@app.middleware("http")
async def rate_limit(request: Request, call_next):
    if request.method == "POST" and request.url.path.startswith("/api/"):
        ip = request.client.host if request.client else "?"
        now = time.monotonic()
        recent = [t for t in _hits[ip] if now - t < 60]
        if len(recent) >= _RATE_MAX:
            return JSONResponse({"error": "Bạn gửi yêu cầu quá nhanh. Vui lòng chờ một chút."}, status_code=429)
        recent.append(now)
        _hits[ip] = recent
    return await call_next(request)


def _friendly_llm_error(exc: Exception) -> str:
    """Turn a raw provider exception into a demo-safe message (#18)."""
    msg = str(exc)
    if "api_key" in msg.lower() or "401" in msg:
        return ("Xác thực Groq thất bại - khóa API bị thiếu hoặc hết hạn. "
                "Hãy cập nhật GROQ_API_KEY trong .env hoặc chọn mô hình chạy trên máy (Ollama).")
    if "connection" in msg.lower() or "refused" in msg.lower() or "urlopen" in msg.lower():
        return ("Không thể kết nối đến mô hình - với mô hình chạy trên máy, hãy khởi động "
                "`ollama serve` và tải mô hình; nếu dùng Groq, hãy kiểm tra kết nối mạng.")
    return f"Gọi mô hình AI thất bại: {msg}"


# -- Practice-partner chat (the only mode) -------------------------------------
SEED_EMOTIONS = ["Joy", "Anger", "Fear", "Shame", "Pride", "Distress",
                 "Gratitude", "Sadness", "Anticipation", "Trust"]
PERSONALITIES = ["neurotic", "average", "resilient"]

SESSIONS: dict[str, Agent] = {}
_CHAT_SESSIONS: dict[str, "ChatSession"] = {}
_SESSIONS_LOCK = threading.Lock()


class ChatSession:
    """One configurable agent the human talks to directly (no witness track).

    Two ways to populate it: free-form manual config, or a scenario preset
    (#13) - picking a practice counterpart overrides name/personality/persona/
    seeds from agents/personas.py. Each session owns a SessionMemory for RAG (#22).
    """

    def __init__(self, session_id: str | None = None):
        self.session_id = session_id
        self.lock = threading.RLock()
        self.language = "vi"          # response language; persists across resets
        self.reset(scenario_id="angry_customer")

    def reset(self, name="Morgan", personality="average", reactivity=None,
              persona="You are Morgan, a thoughtful person having a conversation.",
              seed_emotion=None, seed_intensity=0.0, model_id=None, scenario_id=None,
              language=None):
        if language in ("vi", "en"):
            self.language = language
        self.model_id = model_id or default_model_id()
        self.scenario_id = None
        seeds: dict[str, float] = {}

        persona_preset = get_scenario(scenario_id)
        if persona_preset:                                    # scenario takes precedence
            self.scenario_id = persona_preset.id
            name = persona_preset.display_name
            personality = scenario_label(persona_preset)
            reactivity = persona_preset.reactivity
            self._persona_original = persona_preset.base_persona
            self._persona_en = persona_preset.persona_for("en")
            seeds = dict(persona_preset.seed_emotions)
        else:
            if personality not in PERSONALITIES:
                personality = "average"
            if reactivity is None:
                reactivity = REACTIVITY.get(personality, 1.0)
            # custom agents have no translation - the language directive does the work
            self._persona_original = self._persona_en = persona or ""
            if (seed_emotion and seed_emotion != "None" and seed_intensity > 0):
                seeds = {seed_emotion: seed_intensity}

        self.agent = Agent(name or "Morgan", personality, self._persona_original,
                           model=self.model_id, provider=provider_of(self.model_id),
                           reactivity=reactivity)
        if self.session_id is not None:
            SESSIONS[self.session_id] = self.agent
        self._apply_language()
        self.messages: list[dict] = []
        self.memory = SessionMemory()
        self.last_retrieved: list[dict] = []
        for emo, intensity in seeds.items():
            if emo in self.agent.entity.emotions and intensity > 0:
                self.agent.entity.emotions[emo].activate(intensity)

    def _apply_language(self):
        """Point the agent at the persona text for the current language."""
        self.agent.base_persona = (
            self._persona_en if self.language == "en" else self._persona_original
        )

    def send(self, message: str) -> str:
        # RAG: retrieve relevant prior turns *before* storing this one (#25, #26).
        context, hits = self.memory.context_block(message, k=3)
        self.last_retrieved = hits
        reply = self.agent.receive_and_respond(message, retrieved_context=context,
                                               language=self.language)
        self.memory.add(f"User said: {message}")
        self.memory.add(f"{self.agent.name} replied: {reply}")
        self.messages.append({"role": "user", "text": message})
        self.messages.append({"role": "agent", "text": reply, "event": self.agent.last_event})
        return reply


def get_chat_session(session_id: str | None = None) -> tuple[str, ChatSession]:
    """Return the requested session, creating one when no session exists yet."""
    session_id = session_id or uuid.uuid4().hex
    with _SESSIONS_LOCK:
        session = _CHAT_SESSIONS.get(session_id)
        if session is None:
            session = ChatSession(session_id)
            _CHAT_SESSIONS[session_id] = session
        return session_id, session


def chat_state(session_id: str, chat: ChatSession) -> dict:
    a = chat.agent
    s = agent_state(a)
    s["persona"] = a.base_persona
    s["reactivity"] = round(a.entity.reactivity, 2)
    s["system_prompt"] = a.prompt_modifier.build_system_prompt(
        a.entity, a.base_persona, language=chat.language)
    has_key = bool(os.environ.get("GROQ_API_KEY"))
    # A Groq model needs a key; local (Ollama) models are always offerable.
    models = [{**m, "available": has_key if m["provider"] == "groq" else True}
              for m in AVAILABLE_MODELS]
    scenarios = [
        {"id": p.id, "display_name": p.display_name, "situation": p.situation,
         "category": p.category, "your_role": p.your_role}
        for p in SCENARIOS.values()
    ]
    return {
        "session_id": session_id,
        "agent": s,
        "messages": chat.messages,
        "seed_options": SEED_EMOTIONS,
        "personalities": PERSONALITIES,
        "reactivity_ref": REACTIVITY,
        "has_key": has_key,
        "models": models,
        "model_id": chat.model_id,
        "scenarios": scenarios,
        "scenario_id": chat.scenario_id,
        "retrieved": chat.last_retrieved,
        "retrieval_backend": chat.memory.backend,
        "language": chat.language,
    }


class ChatResetReq(BaseModel):
    session_id: str = Field(min_length=1, max_length=128)
    name: str = "Morgan"
    personality: str = "average"
    reactivity: float | None = None
    persona: str = "You are Morgan, a thoughtful person having a conversation."
    seed_emotion: str | None = None
    seed_intensity: float = 0.0
    model_id: str | None = None
    scenario_id: str | None = None
    language: str | None = None


class ChatSendReq(BaseModel):
    session_id: str = Field(min_length=1, max_length=128)
    message: str


class ChatLangReq(BaseModel):
    session_id: str = Field(min_length=1, max_length=128)
    language: str = "vi"


@app.get("/api/chat/state")
def chat_get_state(session_id: str | None = Query(default=None, min_length=1, max_length=128)):
    session_id, chat = get_chat_session(session_id)
    with chat.lock:
        return chat_state(session_id, chat)


@app.post("/api/chat/reset")
def chat_reset(req: ChatResetReq):
    session_id, chat = get_chat_session(req.session_id)
    with chat.lock:
        chat.reset(req.name, req.personality, req.reactivity, req.persona,
                   req.seed_emotion, req.seed_intensity, req.model_id, req.scenario_id,
                   req.language)
        return chat_state(session_id, chat)


@app.post("/api/chat/language")
def chat_set_language(req: ChatLangReq):
    session_id, chat = get_chat_session(req.session_id)
    # Switch response language mid-conversation - takes effect on the next message,
    # no reset (the prompt is rebuilt every turn).
    with chat.lock:
        chat.language = req.language if req.language in ("vi", "en") else "vi"
        chat._apply_language()
        return chat_state(session_id, chat)


@app.post("/api/chat/send")
def chat_send(req: ChatSendReq):
    session_id, chat = get_chat_session(req.session_id)
    # Only Groq models need a key; local (Ollama) models run offline.
    with chat.lock:
        if provider_of(chat.model_id) == "groq" and not os.environ.get("GROQ_API_KEY"):
            return {"error": "Chưa cấu hình GROQ_API_KEY trong .env. Hãy chọn một mô hình "
                             "chạy trên máy nếu muốn sử dụng ngoại tuyến."}
        if req.message.strip():
            try:
                chat.send(req.message.strip())
            except Exception as e:
                return {"error": _friendly_llm_error(e)}
        return chat_state(session_id, chat)


# -- Static frontend -----------------------------------------------------------
# Serve the React build (web-dist/) when present; otherwise fall back to the
# legacy vanilla frontend (web/) so a missing/failed build never breaks the demo.
_HERE = os.path.dirname(__file__)
_DIST = os.path.join(_HERE, "web-dist")
REACT = os.path.isfile(os.path.join(_DIST, "index.html"))
WEB_DIR = _DIST if REACT else os.path.join(_HERE, "web")


# The HTML shell must never be cached, or the browser keeps an old build's asset
# refs after a rebuild (hashed JS/CSS can cache forever - they're content-named).
_NO_CACHE = {"Cache-Control": "no-store, max-age=0"}


# React build -> index.html (SPA). Legacy fallback -> chat.html (the only view now).
_SHELL = "index.html" if REACT else "chat.html"


@app.get("/")
def index():
    return FileResponse(os.path.join(WEB_DIR, _SHELL), headers=_NO_CACHE)


@app.get("/chat")
def chat_page():
    return FileResponse(os.path.join(WEB_DIR, _SHELL), headers=_NO_CACHE)


app.mount("/", StaticFiles(directory=WEB_DIR), name="web")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=True)
