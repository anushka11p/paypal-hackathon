"""
Shared Claude access for the policy compiler, the intent evaluator and the
shopping agent. Model and effort are configurable so trials can pin them.
"""
from __future__ import annotations

import os
from typing import TypeVar

import anthropic
from pydantic import BaseModel

# No load_dotenv() here: this module is imported by the agent process,
# which must never read the .env file that holds the PayPal secrets.

DEFAULT_MODEL = "claude-opus-5-5"
# Server-side refusal fallback: if a model declines, the API re-runs the
# request on a fallback model inside the same call.
FALLBACK_BETA = "server-side-fallback-2026-07-01"

T = TypeVar("T", bound=BaseModel)

_client: anthropic.Anthropic | None = None


class LLMUnavailable(RuntimeError):
    pass


def model_for(role: str) -> str:
    """role is COMPILER, EVALUATOR or AGENT; e.g. LEASH_AGENT_MODEL overrides one role."""
    return os.environ.get(f"LEASH_{role}_MODEL") or os.environ.get("LEASH_MODEL") or DEFAULT_MODEL


def client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic(max_retries=3)
    return _client


def parse(*, role: str, system: str, user: str, output_model: type[T],
          effort: str = "low", max_tokens: int = 8000) -> T:
    """One structured-output call. Raises LLMUnavailable on any failure so callers can fail closed."""
    try:
        response = client().beta.messages.parse(
            model=model_for(role),
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": user}],
            output_format=output_model,
            output_config={"effort": effort},
            betas=[FALLBACK_BETA],
            fallbacks="default",
        )
    except anthropic.APIConnectionError as e:
        raise LLMUnavailable(f"network error reaching Claude: {e}") from e
    except anthropic.APIStatusError as e:
        raise LLMUnavailable(f"Claude API error {e.status_code}: {e.message}") from e
    except anthropic.AnthropicError as e:
        raise LLMUnavailable(str(e)) from e
    except TypeError as e:
        # The SDK raises TypeError when no credentials are configured at all.
        raise LLMUnavailable(f"Claude is not configured: {e}") from e
    if response.stop_reason == "refusal":
        raise LLMUnavailable("Claude declined the request")
    if response.stop_reason == "max_tokens" or response.parsed_output is None:
        raise LLMUnavailable("Claude response was incomplete")
    return response.parsed_output
