"""
The agent process. Started by start.sh with every PayPal credential removed
from its environment, and it refuses to start if one is present.

Run: uvicorn agents.service:app --port 8001
"""
from __future__ import annotations

import json
import os
import queue
import threading

from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from agents.shopping_agent import AgentError, run_shopping_agent

FORBIDDEN_ENV_PREFIXES = ("PAYPAL_", "MANDATE_SIGNING_")


def forbidden_env_present() -> list[str]:
    return sorted(k for k in os.environ if k.startswith(FORBIDDEN_ENV_PREFIXES))


if forbidden_env_present():
    raise SystemExit(f"agent process refuses to start: payment secrets in environment {forbidden_env_present()}")

app = FastAPI(title="Leash shopping agent")


class RunRequest(BaseModel):
    task: str
    catalog: list[dict]
    model: str | None = None


@app.get("/health")
def health():
    return {"status": "ok", "role": "shopping_agent"}


@app.get("/env-proof")
def env_proof():
    """Names only, never values: proves this process holds no payment credentials."""
    return {"process": "shopping_agent", "pid": os.getpid(),
            "payment_env_vars_present": forbidden_env_present(),
            "env_var_count": len(os.environ)}


@app.post("/run")
def run(req: RunRequest):
    try:
        return run_shopping_agent(task=req.task, catalog=req.catalog, model=req.model)
    except AgentError as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.post("/run-stream")
def run_stream(req: RunRequest):
    """Same as /run, but streams each agent step as an NDJSON line, then a final result line."""
    events: queue.Queue = queue.Queue()

    def work():
        try:
            result = run_shopping_agent(task=req.task, catalog=req.catalog, model=req.model,
                                        on_event=lambda e: events.put({"type": "event", "event": e}))
            events.put({"type": "result", "result": result})
        except AgentError as e:
            events.put({"type": "error", "error": str(e)})

    threading.Thread(target=work, daemon=True).start()

    def lines():
        while True:
            item = events.get()
            yield json.dumps(item) + "\n"
            if item["type"] in ("result", "error"):
                return

    return StreamingResponse(lines(), media_type="application/x-ndjson")
