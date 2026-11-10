"""
Shared LLM access (Groq) for the policy compiler, the intent evaluator and
the shopping agent. Model is configurable per role so trials can pin it.
"""
from __future__ import annotations

import copy
import json
import os
from typing import TypeVar

import groq
from pydantic import BaseModel, ValidationError

# No load_dotenv() here: this module is imported by the agent process,
# which must never read the .env file that holds the PayPal secrets.

DEFAULT_MODEL = "openai/gpt-oss-120b"

T = TypeVar("T", bound=BaseModel)

_client: groq.Groq | None = None


class LLMUnavailable(RuntimeError):
    pass


def model_for(role: str) -> str:
    """role is COMPILER, EVALUATOR or AGENT; e.g. LEASH_AGENT_MODEL overrides one role."""
    return os.environ.get(f"LEASH_{role}_MODEL") or os.environ.get("GROQ_MODEL") or DEFAULT_MODEL


def client() -> groq.Groq:
    global _client
    if _client is None:
        if not os.environ.get("GROQ_API_KEY"):
            raise LLMUnavailable("GROQ_API_KEY is not set")
        _client = groq.Groq(max_retries=3, timeout=90.0)
    return _client


def strict_schema(model: type[BaseModel]) -> dict:
    """Pydantic JSON schema -> strict structured-output schema (refs inlined, every field required)."""
    root = model.model_json_schema()
    defs = root.pop("$defs", {})

    def walk(node):
        if isinstance(node, list):
            return [walk(n) for n in node]
        if not isinstance(node, dict):
            return node
        if "$ref" in node:
            return walk(copy.deepcopy(defs[node["$ref"].split("/")[-1]]))
        node = {k: walk(v) for k, v in node.items() if k not in ("title", "default", "description")}
        options = node.get("anyOf")
        if options and all(set(o) <= {"type"} for o in options):
            node.pop("anyOf")
            node["type"] = [o["type"] for o in options]
        if node.get("type") == "object" and "properties" in node:
            node["required"] = list(node["properties"])
            node["additionalProperties"] = False
        return node

    return walk(root)


def parse(*, role: str, system: str, user: str, output_model: type[T], effort: str = "low",
          max_tokens: int = 8000) -> T:
    """One structured-output call. Raises LLMUnavailable on any failure so callers can fail closed."""
    schema = strict_schema(output_model)
    try:
        response = client().chat.completions.create(
            model=model_for(role),
            messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
            response_format={"type": "json_schema", "json_schema": {
                "name": output_model.__name__, "schema": schema, "strict": True}},
            reasoning_effort=effort,
            temperature=0.2,
            max_completion_tokens=max_tokens,
        )
    except groq.APIConnectionError as e:
        raise LLMUnavailable(f"network error reaching Groq: {e}") from e
    except groq.APIStatusError as e:
        raise LLMUnavailable(f"Groq API error {e.status_code}: {e.message}") from e
    except groq.GroqError as e:
        raise LLMUnavailable(str(e)) from e

    choice = response.choices[0]
    if choice.finish_reason != "stop" or not choice.message.content:
        raise LLMUnavailable(f"incomplete model response (finish_reason={choice.finish_reason})")
    try:
        return output_model.model_validate(json.loads(choice.message.content))
    except (ValueError, ValidationError) as e:
        raise LLMUnavailable(f"model returned invalid structured output: {e}") from e
