"""Direct mode tests: per-promotion challenge periods, the CLOSED status and the bond lock."""

import json

import pytest

from .conftest import (
    BOND, CONTRACT, PAYOUT, STAKE, START, T0, URL_A, URL_B, check_solvency, declare, make_pledge,
    open_challenge, pay, revert_message, to_hex,
)
from .test_was_price_judge import T1, V1, mock_get, mock_reading

T10 = "2026-11-13T12:10:00Z"   # START + 10 minutes
T60 = "2026-11-13T13:00:00Z"   # START + 60 minutes
MAX_MINUTES = 90 * 1440


def preview_declare(contract, sender, start=START, minutes=10, url=URL_A):
    return contract.preview_declare(to_hex(sender), 0, url, "", "39.90", "34.90", 13, start, minutes)


def status(contract, promo_id):
    """The status of a promo as every view reports it; they must agree."""
    one = json.loads(contract.get_promo(promo_id))["status"]
    listed = json.loads(contract.list_promos(0, 0, 50))[promo_id]["status"]
    composable = contract.promo_status(promo_id)
    assert one == listed == composable, (one, listed, composable)
    return one


def close(vm, contract, merchant):
    vm.sender = merchant
    return contract.close_pledge(0)


# Deployment ------------------------------------------------------------------------------

@pytest.mark.parametrize("minutes", [9, 0, MAX_MINUTES + 1])
def test_constructor_refuses_a_minimum_outside_the_bounds(direct_vm, direct_deploy, minutes):
    direct_vm.warp(T0)
    msg = revert_message(lambda: direct_deploy(CONTRACT, minutes))
    assert f"min_challenge_minutes must be between 10 and {MAX_MINUTES}" in msg, msg


def test_stats_publish_the_period_bounds(contract):
    s = json.loads(contract.get_stats())
    assert (s["min_challenge_minutes"], s["max_challenge_minutes"]) == (10, MAX_MINUTES)


# Declaration -------------------------------------------------------------------------------

@pytest.mark.parametrize("start, minutes, needle", [
    (START, 9, f"challenge_minutes must be between 10 and {MAX_MINUTES}"),
    (START, MAX_MINUTES + 1, f"challenge_minutes must be between 10 and {MAX_MINUTES}"),
    (START, 30 * 1440 + 1, "challenge period must end by the pledge end (2026-12-13T12:00:00Z)"),
    ("2026-11-20T12:00:00Z", 23 * 1440 + 1, "challenge period must end by the pledge end (2026-12-13T12:00:00Z)"),
])
def test_declaration_outside_the_bond_coverage_is_refused(direct_vm, contract, direct_alice, ledger, start, minutes, needle):
    make_pledge(direct_vm, contract, direct_alice, ledger, days=30)
    preview = preview_declare(contract, direct_alice, start=start, minutes=minutes)
    assert preview.startswith("[EXPECTED] ") and needle in preview, preview
    assert revert_message(lambda: declare(direct_vm, contract, direct_alice, start=start, minutes=minutes)) == preview
    assert json.loads(contract.get_stats())["promos"] == 0


@pytest.mark.parametrize("start, minutes, until", [
    (START, 30 * 1440, "2026-12-13T12:00:00Z"),                  # ends exactly at the pledge end
    ("2026-11-20T12:00:00Z", 23 * 1440, "2026-12-13T12:00:00Z"),  # a future start: counted from the start
    ("2026-11-10T12:00:00Z", 10, T10),                           # a past start: counted from the declaration
])
def test_challenge_until_is_computed_at_declaration(direct_vm, contract, direct_alice, ledger, start, minutes, until):
    make_pledge(direct_vm, contract, direct_alice, ledger, days=30)
    assert preview_declare(contract, direct_alice, start=start, minutes=minutes) == ""
    declare(direct_vm, contract, direct_alice, start=start, minutes=minutes)
    assert json.loads(contract.get_promo(0))["challenge_until"] == until
    assert json.loads(contract.get_pledge(0))["locked_until"] == until


def test_a_deployment_minimum_is_enforced(direct_vm, direct_deploy, direct_alice, ledger):
    direct_vm.warp(T0)
    week = direct_deploy(CONTRACT, 7 * 1440)
    make_pledge(direct_vm, week, direct_alice, ledger)
    assert f"challenge_minutes must be between 10080 and {MAX_MINUTES}" in preview_declare(week, direct_alice, minutes=10)
    assert preview_declare(week, direct_alice, minutes=7 * 1440) == ""


# Late challenge and CLOSED status ----------------------------------------------------------

def test_late_challenge_is_refused(direct_vm, contract, direct_alice, direct_bob, ledger, transfers):
    make_pledge(direct_vm, contract, direct_alice, ledger)
    declare(direct_vm, contract, direct_alice, minutes=10)
    direct_vm.warp("2026-11-13T12:09:59Z")
    assert contract.preview_challenge(0, T1, to_hex(direct_bob), str(STAKE)) == ""
    direct_vm.warp(T10)
    for preview, file in (
        (contract.preview_challenge(0, T1, to_hex(direct_bob), str(STAKE)),
         lambda: open_challenge(direct_vm, contract, direct_bob, ledger, ts=T1, at=T10)),
        (contract.preview_challenge_image(0, T1, URL_A + ".png", to_hex(direct_bob), str(STAKE)),
         lambda: open_challenge(direct_vm, contract, direct_bob, ledger, ts=T1, at=T10, image_url=URL_A + ".png")),
    ):
        assert preview == f"[EXPECTED] challenge period ended ({T10})"
        assert revert_message(file) == preview
    # A zero-value attempt fails on the period too (it is checked before the stake).
    assert contract.preview_challenge(0, T1, to_hex(direct_bob), "0") == preview
    assert json.loads(contract.get_stats())["challenges"] == 0
    check_solvency(contract, ledger, transfers)


def test_promo_is_closed_after_its_period(direct_vm, contract, direct_alice, ledger):
    make_pledge(direct_vm, contract, direct_alice, ledger)
    declare(direct_vm, contract, direct_alice, minutes=10)
    assert status(contract, 0) == "LIVE"
    direct_vm.warp("2026-11-13T12:09:59Z")
    assert status(contract, 0) == "LIVE"
    direct_vm.warp(T10)
    assert status(contract, 0) == "CLOSED"
    direct_vm.warp("2026-12-30T00:00:00Z")
    assert status(contract, 0) == "CLOSED"


# Bond lock ---------------------------------------------------------------------------------

def test_bond_is_locked_during_the_period_then_released(direct_vm, contract, direct_alice, direct_bob, ledger, transfers):
    make_pledge(direct_vm, contract, direct_alice, ledger)
    declare(direct_vm, contract, direct_alice, minutes=10)
    locked = f"[EXPECTED] a promo challenge period is open until {T10}"
    assert revert_message(lambda: close(direct_vm, contract, direct_alice)) == locked
    direct_vm.warp("2026-11-13T12:09:59Z")
    assert revert_message(lambda: close(direct_vm, contract, direct_alice)) == locked
    direct_vm.sender = direct_alice
    assert revert_message(lambda: contract.withdraw()) == "[EXPECTED] nothing to withdraw"
    # A top-up is not a recovery: still allowed during the period.
    pay(direct_vm, ledger, direct_alice, PAYOUT, lambda: contract.top_up(0))
    direct_vm.warp(T10)
    assert close(direct_vm, contract, direct_alice) == str(BOND + PAYOUT)
    assert contract.withdraw() == BOND + PAYOUT
    assert transfers == [(to_hex(direct_alice), BOND + PAYOUT)]
    assert status(contract, 0) == "CLOSED"
    check_solvency(contract, ledger, transfers)


def test_open_challenge_blocks_closing_until_resolved(direct_vm, contract, direct_alice, direct_bob, direct_charlie,
                                                      ledger, transfers):
    make_pledge(direct_vm, contract, direct_alice, ledger)
    declare(direct_vm, contract, direct_alice, minutes=10)
    open_challenge(direct_vm, contract, direct_bob, ledger, ts=T1, at="2026-11-13T12:05:00Z")
    direct_vm.warp("2026-11-13T12:30:00Z")
    # The period is over but the challenge filed in time is still open: the promo stays LIVE.
    assert status(contract, 0) == "LIVE"
    assert "challenge period ended" in contract.preview_challenge(0, "20261106100000", to_hex(direct_charlie), str(STAKE))
    assert revert_message(lambda: close(direct_vm, contract, direct_alice)) == "[EXPECTED] a challenge is still open on this pledge"
    mock_get(direct_vm, URL_A, V1["bouilloire"])
    mock_reading(direct_vm, URL_A, "39.90")
    assert contract.resolve(0) == "REJECTED"
    assert status(contract, 0) == "CLOSED"
    assert close(direct_vm, contract, direct_alice) == str(BOND + STAKE)
    check_solvency(contract, ledger, transfers)


def test_upheld_after_the_period_stays_debunked(direct_vm, contract, direct_alice, direct_bob, ledger, transfers):
    make_pledge(direct_vm, contract, direct_alice, ledger)
    declare(direct_vm, contract, direct_alice, minutes=10)
    open_challenge(direct_vm, contract, direct_bob, ledger, ts=T1, at="2026-11-13T12:05:00Z")
    direct_vm.warp("2026-11-13T12:20:00Z")
    mock_get(direct_vm, URL_A, V1["bouilloire"])
    mock_reading(direct_vm, URL_A, "29.90")
    assert contract.resolve(0) == "UPHELD"
    assert status(contract, 0) == "DEBUNKED"
    assert close(direct_vm, contract, direct_alice) == str(BOND - PAYOUT)
    check_solvency(contract, ledger, transfers)


# Several promos ----------------------------------------------------------------------------

def test_promos_with_different_periods(direct_vm, contract, direct_alice, direct_bob, ledger, transfers):
    make_pledge(direct_vm, contract, direct_alice, ledger)
    declare(direct_vm, contract, direct_alice, url=URL_B, promo="31.90", pct=20, minutes=60)
    declare(direct_vm, contract, direct_alice, minutes=10)
    a, b = json.loads(contract.get_promo(1)), json.loads(contract.get_promo(0))
    assert (a["challenge_until"], b["challenge_until"]) == (T10, T60)
    assert json.loads(contract.get_pledge(0))["locked_until"] == T60  # the latest period, whatever the order
    direct_vm.warp("2026-11-13T12:30:00Z")
    assert (status(contract, 1), status(contract, 0)) == ("CLOSED", "LIVE")
    assert contract.preview_challenge(1, T1, to_hex(direct_bob), str(STAKE)) == f"[EXPECTED] challenge period ended ({T10})"
    assert contract.preview_challenge(0, T1, to_hex(direct_bob), str(STAKE)) == ""
    assert revert_message(lambda: close(direct_vm, contract, direct_alice)) == f"[EXPECTED] a promo challenge period is open until {T60}"
    direct_vm.warp(T60)
    assert (status(contract, 1), status(contract, 0)) == ("CLOSED", "CLOSED")
    assert close(direct_vm, contract, direct_alice) == str(BOND)
    check_solvency(contract, ledger, transfers)
