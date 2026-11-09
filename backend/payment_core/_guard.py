from __future__ import annotations
import inspect
import os

# The only modules allowed to move money. policy/engine.py captures or
# voids after a cart is checked; policy/mandate_service.py creates and
# authorizes the hold the user approved, and voids it on revoke.
ALLOWED_CALLER_SUFFIXES = (
    os.path.join("policy", "engine.py"),
    os.path.join("policy", "mandate_service.py"),
)


class PaymentAccessDenied(PermissionError):
    pass


def verify_caller() -> None:
    """
    Called as the first line of every public payment function. Inspects
    the real call stack: stack[0] is this function, stack[1] the payment
    function, stack[2] whoever called it.
    """
    stack = inspect.stack()
    if len(stack) < 3:
        raise PaymentAccessDenied(
            "Permission denied – only PolicyEngine may access payment client"
        )
    caller_file = stack[2].filename
    if not any(caller_file.endswith(suffix) for suffix in ALLOWED_CALLER_SUFFIXES):
        raise PaymentAccessDenied(
            "Permission denied – only PolicyEngine may access payment client "
            f"(blocked caller: {os.path.join(*caller_file.split(os.sep)[-2:])})"
        )
