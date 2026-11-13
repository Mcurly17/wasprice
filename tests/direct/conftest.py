"""Shared fixtures and helpers for WasPrice direct mode tests."""

import os
import sys
import tempfile

import pytest

if sys.platform == "win32":
    # genlayer-test 0.29.2 unlinks the stdin temp file while fd 0 still holds it open,
    # which Windows refuses (WinError 32). Same logic, with a delete-on-close file instead.
    from gltest.direct import loader as _gltest_loader

    def _inject_message_to_fd0_windows(vm):
        from genlayer.py import calldata
        from genlayer.py.types import Address

        def _addr(a):
            return Address(a) if isinstance(a, bytes) else a

        encoded = calldata.encode({
            "contract_address": _addr(vm._contract_address),
            "sender_address": _addr(vm.sender),
            "origin_address": _addr(vm.origin),
            "stack": [],
            "value": vm._value,
            "datetime": vm._datetime,
            "is_init": False,
            "chain_id": vm._chain_id,
            "entry_kind": 0,
            "entry_data": b"",
            "entry_stage_data": None,
        })
        with tempfile.TemporaryFile() as tmp:
            tmp.write(encoded)
            tmp.flush()
            os.lseek(tmp.fileno(), 0, os.SEEK_SET)
            vm._original_stdin_fd = os.dup(0)
            os.dup2(tmp.fileno(), 0)

    _gltest_loader._inject_message_to_fd0 = _inject_message_to_fd0_windows

GEN = 10**18
CONTRACT = "contracts/was_price.py"


def to_hex(addr):
    """Checksummed hex of an address (bytes or Address), as the views return it.

    Call after direct_deploy so the SDK is on sys.path.
    """
    if hasattr(addr, "as_hex"):
        return addr.as_hex
    from genlayer.py.types import Address

    return Address(addr).as_hex


@pytest.fixture
def transfers(direct_vm):
    """Record value transfers emitted by the contract (EOA transfers are EthSend calls)."""
    sent = []

    def hook(vm, request):
        for op in ("EthSend", "PostMessage"):
            if op in request:
                data = request[op]
                sent.append((to_hex(data["address"]), int(data.get("value", 0))))
        return None

    direct_vm._gl_call_hook = hook
    return sent


@pytest.fixture
def prompts(direct_vm):
    """Capture every prompt sent to the mocked LLM (wraps a private VMContext method)."""
    captured = []
    original = direct_vm._match_llm_mock

    def capture(prompt):
        captured.append(prompt)
        return original(prompt)

    direct_vm._match_llm_mock = capture
    return captured
