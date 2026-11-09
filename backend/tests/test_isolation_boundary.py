from __future__ import annotations
import ast
import os
import pathlib
import subprocess
import sys

import pytest

BACKEND_ROOT = pathlib.Path(__file__).resolve().parents[1]
FORBIDDEN_FOR_AGENT = ("payment_core", "policy", "api", "models")


def _imports(path: pathlib.Path) -> set[str]:
    """Every import anywhere in the file, including inside functions."""
    names: set[str] = set()
    for node in ast.walk(ast.parse(path.read_text())):
        if isinstance(node, ast.Import):
            names.update(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            names.add(node.module)
    return names


@pytest.mark.parametrize("path", sorted((BACKEND_ROOT / "agents").glob("*.py")), ids=lambda p: p.name)
def test_agent_package_has_no_import_of_payment_or_policy(path):
    for name in _imports(path):
        assert name.split(".")[0] not in FORBIDDEN_FOR_AGENT, f"{path.name} imports {name}"


def test_import_linter_contracts_hold():
    result = subprocess.run([sys.executable, "-m", "importlinter.cli"], cwd=BACKEND_ROOT,
                            capture_output=True, text=True)
    if "No module named" in result.stderr:
        result = subprocess.run([str(pathlib.Path(sys.executable).parent / "lint-imports")], cwd=BACKEND_ROOT,
                                capture_output=True, text=True)
    assert result.returncode == 0, result.stdout + result.stderr


def test_compromised_agent_cannot_reach_paypal():
    from agents.hack import attempt_direct_payment_hack
    from payment_core._guard import PaymentAccessDenied
    with pytest.raises(PaymentAccessDenied, match="only PolicyEngine may access payment client"):
        attempt_direct_payment_hack()


def test_no_other_module_can_call_payment_functions():
    from payment_core import paypal_client
    from payment_core._guard import PaymentAccessDenied
    for fn, kwargs in [
        (paypal_client.capture_authorization, dict(authorization_id="A", amount_cents=1, currency="USD",
                                                   final_capture=True, request_id="r")),
        (paypal_client.void_authorization, dict(authorization_id="A", request_id="r")),
        (paypal_client.get_authorization, dict(authorization_id="A")),
        (paypal_client.authorize_order, dict(order_id="O")),
    ]:
        with pytest.raises(PaymentAccessDenied):
            fn(**kwargs)


def test_agent_process_refuses_to_start_with_payment_secrets():
    env = {**os.environ, "PAYPAL_CLIENT_SECRET": "leaked", "PYTHONPATH": str(BACKEND_ROOT)}
    result = subprocess.run([sys.executable, "-c", "import agents.service"], cwd=BACKEND_ROOT,
                            env=env, capture_output=True, text=True)
    assert result.returncode != 0
    assert "refuses to start" in (result.stderr + result.stdout)


def test_agent_process_starts_without_payment_secrets():
    env = {k: v for k, v in os.environ.items() if not k.startswith(("PAYPAL_", "MANDATE_SIGNING_"))}
    env["PYTHONPATH"] = str(BACKEND_ROOT)
    result = subprocess.run([sys.executable, "-c", "import agents.service; print('ok')"], cwd=BACKEND_ROOT,
                            env=env, capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
