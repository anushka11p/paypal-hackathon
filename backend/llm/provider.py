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


# How many times one structured-output call is attempted when Groq returns an empty generation.
GENERATION_ATTEMPTS = 3


def _empty_generation(e: groq.APIStatusError) -> bool:
    """Groq answers 400 json_validate_failed when the model produced nothing that fits the schema.
    The request itself is fine and the next attempt nearly always works, so it is worth retrying."""
    body = e.body if isinstance(e.body, dict) else {}
    error = body.get("error", body)
    code = error.get("code") if isinstance(error, dict) else None
    return e.status_code == 400 and (code == "json_validate_failed" or "json_validate_failed" in str(e.message))


def parse(*, role: str, system: str, user: str, output_model: type[T], effort: str = "low",
          max_tokens: int = 8000) -> T:
    """One structured-output call. Raises LLMUnavailable on any failure so callers can fail closed."""
    schema = strict_schema(output_model)
    for attempt in range(1, GENERATION_ATTEMPTS + 1):
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
            break
        except groq.APIConnectionError as e:
            raise LLMUnavailable(f"network error reaching Groq: {e}") from e
        except groq.APIStatusError as e:
            if _empty_generation(e) and attempt < GENERATION_ATTEMPTS:
                continue
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
