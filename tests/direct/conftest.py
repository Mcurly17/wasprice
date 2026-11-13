"""Shared fixtures and helpers for WasPrice direct mode tests."""

import json
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

T0 = "2026-11-13T12:00:00Z"          # deployment, pledge creation and promo declarations
START = "2026-11-13T12:00:00Z"       # promo_start of every demo promo
T_CHALLENGE = "2026-11-13T13:00:00Z"  # challenge filing
WINDOW_FROM = "20261014120000"       # START - 30 days
WINDOW_TO = "20261113120000"         # START (exclusive)
TS_IN = "20261101120000"             # a capture inside the window

DOMAIN = "mcurly17.github.io"
BASE = "https://mcurly17.github.io/wasprice/demo/"
URL_A = BASE + "bouilloire.html"
URL_B = BASE + "theiere.html"
URL_C = BASE + "mug.html"
URL_D = BASE + "grille-pain.html"
URL_E = BASE + "radio.html"
IMAGE_E = BASE + "img/radio-prix.png"

PAYOUT = GEN // 10
BOND = 4 * GEN // 10
STAKE = GEN // 100


class Ledger:
    """What the contract must hold: every accepted payable value minus every transfer out."""

    def __init__(self):
        self.deposits = 0


@pytest.fixture
def ledger():
    return Ledger()


@pytest.fixture
def contract(direct_vm, direct_deploy):
    direct_vm.warp(T0)
    return direct_deploy(CONTRACT)


def revert_message(fn):
    """Runs a write expected to fail and returns its exact error message."""
    try:
        fn()
    except Exception as e:  # noqa: BLE001 - the direct VM raises various exception types
        msg = getattr(e, "message", None)
        return msg if isinstance(msg, str) else str(e)
    raise AssertionError("the call succeeded")


def pay(vm, ledger, sender, value, fn):
    """Calls a payable write with `value`; counts it only if the call is accepted."""
    vm.sender = sender
    vm.value = value
    try:
        out = fn()
    finally:
        vm.value = 0
    if ledger is not None:
        ledger.deposits += value
    return out


def make_pledge(vm, contract, merchant, ledger=None, bond=BOND, payout=PAYOUT, days=30,
                name="Demo Maison", domain=DOMAIN):
    return pay(vm, ledger, merchant, bond, lambda: contract.create_pledge(name, domain, payout, days))


def declare(vm, contract, merchant, url=URL_A, was="39.90", promo="34.90", pct=13,
            start=START, variant="", pledge_id=0):
    vm.sender = merchant
    return contract.declare_promo(pledge_id, url, variant, was, promo, pct, start)


def open_challenge(vm, contract, challenger, ledger=None, promo_id=0, ts=TS_IN, stake=STAKE,
                   image_url=None, at=T_CHALLENGE):
    vm.warp(at)
    if image_url is None:
        return pay(vm, ledger, challenger, stake, lambda: contract.challenge(promo_id, ts))
    return pay(vm, ledger, challenger, stake, lambda: contract.challenge_image(promo_id, ts, image_url))


def check_solvency(contract, ledger, transfers):
    """balance = sum(bond + reserved) of active pledges + OPEN stakes + total_credits."""
    stats = json.loads(contract.get_stats())
    held = 0
    for pid in range(stats["pledges"]):
        p = json.loads(contract.get_pledge(pid))
        if p["active"]:
            held += int(p["bond"]) + int(p["reserved"])
        else:
            assert p["bond"] == "0" and p["reserved"] == "0"
    for cid in range(stats["challenges"]):
        c = json.loads(contract.get_challenge(cid))
        if c["status"] == "OPEN":
            held += int(c["stake"])
    held += int(stats["total_credits"])
    balance = ledger.deposits - sum(v for _, v in transfers)
    assert balance == held, (balance, held)
    return held


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
