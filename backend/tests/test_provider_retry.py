"""Groq sometimes returns an empty answer for a structured-output call (400 json_validate_failed).
That is a one-off bad generation, not a bad request, so the provider tries again before giving up."""
import json
from types import SimpleNamespace

import groq
import httpx
import pytest
from pydantic import BaseModel

from llm import provider


class Answer(BaseModel):
    ok: bool


def bad_request(code: str) -> groq.BadRequestError:
    body = {"error": {"message": "Failed to validate JSON.", "type": "invalid_request_error",
                      "code": code, "failed_generation": ""}}
    response = httpx.Response(400, request=httpx.Request("POST", "https://api.groq.com/x"), json=body)
    return groq.BadRequestError(f"Error code: 400 - {body}", response=response, body=body)


def good_reply() -> SimpleNamespace:
    message = SimpleNamespace(content=json.dumps({"ok": True}))
    return SimpleNamespace(choices=[SimpleNamespace(finish_reason="stop", message=message)])


def fake_client(monkeypatch, script: list):
    """Each call to create() pops the next scripted outcome: an exception to raise or a reply."""
    calls = []

    def create(**kwargs):
        calls.append(kwargs)
        outcome = script.pop(0)
        if isinstance(outcome, Exception):
            raise outcome
        return outcome

    client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
    monkeypatch.setattr(provider, "client", lambda: client)
    return calls


def ask():
    return provider.parse(role="COMPILER", system="s", user="u", output_model=Answer)


def test_one_empty_generation_is_retried(monkeypatch):
    calls = fake_client(monkeypatch, [bad_request("json_validate_failed"), good_reply()])
    assert ask().ok is True
    assert len(calls) == 2


def test_gives_up_after_three_empty_generations(monkeypatch):
    calls = fake_client(monkeypatch, [bad_request("json_validate_failed")] * 3)
    with pytest.raises(provider.LLMUnavailable):
        ask()
    assert len(calls) == 3


def test_other_bad_requests_are_not_retried(monkeypatch):
    calls = fake_client(monkeypatch, [bad_request("model_not_found"), good_reply()])
    with pytest.raises(provider.LLMUnavailable):
        ask()
    assert len(calls) == 1
