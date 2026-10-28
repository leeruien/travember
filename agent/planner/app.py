"""
The planner's HTTP API. Run it with:

    uv run uvicorn planner.app:app --port 8000

POST /plan takes {"request": "..."} with a Supabase access token, and answers with a stream of
server-sent events: one `tool` event per tool the agent uses, then `itinerary` or `error`, then `done`.
"""

import json
import logging
import os
import sys
from contextlib import asynccontextmanager
from datetime import date
from pathlib import Path

import jwt
from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from google import genai
from google.genai import errors as genai_errors
from google.genai import types
from langgraph.errors import GraphRecursionError
from mcp import Client
from mcp.client.stdio import StdioServerParameters
from pydantic import BaseModel, Field

from planner.auth import RateLimiter, SupabaseAuth
from planner.gemini import GeminiModel
from planner.graph import RECURSION_LIMIT, SUBMIT_DEFINITION, SUBMIT_TOOL, SYSTEM_PROMPT, McpToolBox, build_graph, initial_state

AGENT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(AGENT_DIR / ".env")

# An alias for Google's current Flash-Lite model: on the free tier it's the least often "busy" and has
# the highest request limits. gemini-flash-latest plans a little better when it isn't overloaded.
MODEL = os.environ.get("AGENT_MODEL", "gemini-flash-lite-latest")

log = logging.getLogger("uvicorn.error")  # uvicorn's logger, so these lines show up alongside its own


@asynccontextmanager
async def lifespan(app: FastAPI):
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("Set GEMINI_API_KEY in agent/.env (get one free at https://aistudio.google.com/apikey).")

    # The MCP server runs as a child process for as long as the API does, and every plan shares it.
    server = StdioServerParameters(command=sys.executable, args=["-m", "travel_mcp.server"], cwd=str(AGENT_DIR),
                                   env=dict(os.environ))
    async with Client(server) as mcp_client:
        listed = await mcp_client.list_tools()
        tools = McpToolBox(mcp_client, listed.tools)
        # A few quick retries ride out a brief "high demand" spike without leaving the user waiting for minutes.
        client = genai.Client(api_key=api_key, http_options=types.HttpOptions(
            timeout=90_000, retry_options=types.HttpRetryOptions(attempts=3)))
        app.state.model = GeminiModel(client, MODEL, SYSTEM_PROMPT, tools.definitions + [SUBMIT_DEFINITION])
        app.state.graph = build_graph(app.state.model, tools)
        app.state.auth = SupabaseAuth(os.environ["SUPABASE_URL"], os.environ.get("SUPABASE_JWT_SECRET"))
        app.state.limiter = RateLimiter(int(os.environ.get("AGENT_PLANS_PER_HOUR", "10")))
        log.info("Planner ready: %s, tools: %s", MODEL, [t["name"] for t in tools.definitions])
        try:
            yield
        finally:
            await client.aio.aclose()


app = FastAPI(title="Travember itinerary planner", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=os.environ.get("CORS_ORIGIN_REGEX", r"http://(localhost|127\.0\.0\.1)(:\d+)?"),
    allow_methods=["POST"],
    allow_headers=["Authorization", "Content-Type"],
)


class PlanRequest(BaseModel):
    request: str = Field(min_length=10, max_length=2000)


def sse(event: dict) -> str:
    return f"data: {json.dumps(event, default=str)}\n\n"


@app.get("/health")
async def health() -> dict:
    return {"ok": True, "model": MODEL}


@app.post("/plan")
async def plan(body: PlanRequest, authorization: str | None = Header(default=None)) -> StreamingResponse:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Sign in to plan a trip.")
    try:
        user_id = await app.state.auth.user_id(authorization.removeprefix("Bearer "))
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Your session has expired. Please sign in again.")
    if not app.state.limiter.allow(user_id):
        raise HTTPException(429, "That's a lot of planning! Try again in an hour.")

    return StreamingResponse(
        run_plan(body.request),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


async def run_plan(request: str):
    state = initial_state(app.state.model, request, date.today().isoformat())
    try:
        async for update in app.state.graph.astream(state, {"recursion_limit": RECURSION_LIMIT}, stream_mode="updates"):
            for node, change in update.items():
                if node == "agent":
                    for call in change["calls"]:
                        if call.name != SUBMIT_TOOL:
                            yield sse({"type": "tool", "name": call.name, "input": call.args})
                elif node == "tools" and change.get("itinerary"):
                    yield sse({"type": "itinerary", "itinerary": change["itinerary"]})
                elif node == "fail":
                    yield sse({"type": "error", "message": change["error"]})
    except genai_errors.ClientError as e:
        if e.code == 429:
            message = "The planner has reached Gemini's free-tier limit. Wait a minute and try again."
        elif e.code in (401, 403) or "API key" in (e.message or ""):
            message = "The planner isn't set up yet: its Gemini API key is missing or invalid."
        elif e.code == 404:
            message = f"Gemini doesn't offer the model {MODEL!r} to this API key. Change AGENT_MODEL in agent/.env."
        else:
            message = f"The planner hit an error talking to Gemini (error {e.code}). Please try again."
        log.warning("Gemini API error %s: %s", e.code, e.message)
        yield sse({"type": "error", "message": message})
    except genai_errors.ServerError as e:
        log.warning("Gemini API error %s: %s", e.code, e.message)
        yield sse({"type": "error", "message": "Gemini is very busy right now (high demand). Try again in a minute."})
    except GraphRecursionError:
        yield sse({"type": "error", "message": "The planner went round in circles. Try a simpler request."})
    except Exception:
        log.exception("Plan failed")
        yield sse({"type": "error", "message": "Something went wrong while planning. Please try again."})
    yield sse({"type": "done"})
