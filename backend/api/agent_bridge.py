"""
How the Leash service reaches the shopping agent.

With AGENT_SERVICE_URL set (production, start.sh), the agent runs in its
own process with no PayPal credentials and is called over HTTP. Without it
(local dev, tests), the agent runs in-process — convenient, but then the
process-level isolation claim doesn't hold, and /demo/isolation-proof says so.
"""
from __future__ import annotations

import json
import os

import httpx


class AgentUnavailable(RuntimeError):
    pass


def run_agent(*, task: str, catalog: list[dict], on_event=None) -> dict:
    """Runs the agent; on_event receives each step as it happens."""
    url = os.environ.get("AGENT_SERVICE_URL")
    if url:
        try:
            with httpx.stream("POST", f"{url.rstrip('/')}/run-stream", json={"task": task, "catalog": catalog},
                              timeout=httpx.Timeout(240.0, connect=10.0)) as res:
                if res.status_code != 200:
                    raise AgentUnavailable(f"agent service error {res.status_code}: {res.read()[:300]!r}")
                for line in res.iter_lines():
                    if not line.strip():
                        continue
                    item = json.loads(line)
                    if item["type"] == "event" and on_event:
                        on_event(item["event"])
                    elif item["type"] == "result":
                        return item["result"]
                    elif item["type"] == "error":
                        raise AgentUnavailable(item["error"])
        except httpx.HTTPError as e:
            raise AgentUnavailable(f"agent service unreachable: {e}") from e
        raise AgentUnavailable("agent stream ended without a result")

    from agents.shopping_agent import AgentError, run_shopping_agent
    try:
        return run_shopping_agent(task=task, catalog=catalog, on_event=on_event)
    except AgentError as e:
        raise AgentUnavailable(str(e)) from e


def agent_env_proof() -> dict:
    url = os.environ.get("AGENT_SERVICE_URL")
    if not url:
        return {"mode": "in_process", "isolated": False,
                "note": "AGENT_SERVICE_URL not set: the agent shares this process (dev mode)."}
    try:
        res = httpx.get(f"{url.rstrip('/')}/env-proof", timeout=10.0)
        proof = res.json()
    except (httpx.HTTPError, ValueError) as e:
        return {"mode": "separate_process", "isolated": None, "error": str(e)}
    return {"mode": "separate_process", "isolated": not proof.get("payment_env_vars_present"), **proof}
