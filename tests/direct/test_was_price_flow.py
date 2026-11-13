"""Direct mode tests: pledges, promo declarations, challenge filing, previews, settlement."""

import json

import pytest

from .conftest import (
    BOND, DOMAIN, GEN, IMAGE_E, PAYOUT, STAKE, START, T0, T_CHALLENGE, TS_IN, URL_A, URL_B,
    URL_C, URL_D, WINDOW_FROM, WINDOW_TO, check_solvency, declare, make_pledge, open_challenge,
    pay, revert_message, to_hex,
)


def preview_pledge(contract, sender, name="Demo Maison", domain=DOMAIN, payout=PAYOUT, days=30, value=BOND):
    return contract.preview_pledge(to_hex(sender), name, domain, str(payout), days, str(value))


def assert_same_refusal(write, preview, needle):
    """The write fails with exactly the message the preview returned."""
    msg = revert_message(write)
    assert msg == preview, (msg, preview)
    assert preview.startswith("[EXPECTED] ")
    assert needle in preview, preview


def setup_promo(vm, contract, merchant, ledger, **kw):
    make_pledge(vm, contract, merchant, ledger)
    return declare(vm, contract, merchant, **kw)


# 1. create_pledge ------------------------------------------------------------------------

def test_create_pledge_stores_bond_and_terms(direct_vm, contract, direct_alice, ledger, transfers):
    assert preview_pledge(contract, direct_alice) == ""
    assert make_pledge(direct_vm, contract, direct_alice, ledger) == 0
    p = json.loads(contract.get_pledge(0))
    assert p["merchant"] == to_hex(direct_alice)
    assert (p["bond"], p["reserved"], p["payout"], p["min_stake"]) == (str(BOND), "0", str(PAYOUT), str(PAYOUT // 10))
    assert p["created_at"] == T0 and p["ends_at"] == "2026-12-13T12:00:00Z"
    assert p["active"] is True and p["n_promos"] == 0 and p["domain"] == DOMAIN
    check_solvency(contract, ledger, transfers)


@pytest.mark.parametrize("kw, needle", [
    ({"payout": GEN // 1000}, "payout must be at least"),
    ({"bond": PAYOUT - 1}, "bond (message value) must be at least the payout"),
    ({"domain": "Mcurly17.github.io"}, "domain must be a lowercase host name"),
    ({"domain": "localhost"}, "domain must be a lowercase host name"),
    ({"domain": "shop example.fr"}, "domain must be a lowercase host name"),
    ({"days": 6}, "days must be between 7 and 365"),
    ({"days": 366}, "days must be between 7 and 365"),
    ({"name": "   "}, "name must be 1 to 80 characters"),
])
def test_create_pledge_refusals_match_preview(direct_vm, contract, direct_alice, ledger, transfers, kw, needle):
    bond = kw.pop("bond", BOND)
    args = {"name": "Demo Maison", "domain": DOMAIN, "payout": PAYOUT, "days": 30, **kw}
    preview = preview_pledge(contract, direct_alice, value=bond, **args)
    assert_same_refusal(
        lambda: make_pledge(direct_vm, contract, direct_alice, ledger, bond=bond, **args), preview, needle
    )
    assert json.loads(contract.get_stats())["pledges"] == 0
    check_solvency(contract, ledger, transfers)


def test_preview_pledge_rejects_bad_amount_strings(contract, direct_alice):
    assert "decimal strings of wei" in contract.preview_pledge(to_hex(direct_alice), "D", DOMAIN, "0.1", 30, "1")
    assert "invalid sender address" in contract.preview_pledge("0x12", "D", DOMAIN, str(PAYOUT), 30, str(BOND))


def test_top_up_by_merchant_only(direct_vm, contract, direct_alice, direct_bob, ledger, transfers):
    make_pledge(direct_vm, contract, direct_alice, ledger)
    assert pay(direct_vm, ledger, direct_alice, GEN // 10, lambda: contract.top_up(0)) == BOND + GEN // 10
    assert "only the merchant can top up" in revert_message(
        lambda: pay(direct_vm, ledger, direct_bob, GEN // 10, lambda: contract.top_up(0)))
    assert "greater than 0" in revert_message(lambda: pay(direct_vm, ledger, direct_alice, 0, lambda: contract.top_up(0)))
    assert "unknown pledge" in revert_message(lambda: pay(direct_vm, ledger, direct_alice, 1, lambda: contract.top_up(9)))
    check_solvency(contract, ledger, transfers)


# 2. declare_promo ------------------------------------------------------------------------

def preview_declare(contract, sender, url=URL_A, was="39.90", promo="34.90", pct=13, start=START, variant="", pledge_id=0):
    return contract.preview_declare(to_hex(sender), pledge_id, url, variant, was, promo, pct, start)


def test_declare_promo_normalizes_and_stores(direct_vm, contract, direct_alice, ledger, transfers):
    make_pledge(direct_vm, contract, direct_alice, ledger)
    url = "https://MCURLY17.GitHub.io:443/wasprice/demo/bouilloire.html#offre"
    assert preview_declare(contract, direct_alice, url=url, variant="1,7 L, inox") == ""
    assert declare(direct_vm, contract, direct_alice, url=url, variant="1,7 L, inox") == 0
    pr = json.loads(contract.get_promo(0))
    assert pr["product_url"] == URL_A
    assert (pr["was_price"], pr["promo_price"], pr["pct"], pr["currency"]) == ("39.90", "34.90", 13, "EUR")
    assert pr["promo_start"] == START and pr["status"] == "LIVE" and pr["variant"] == "1,7 L, inox"
    assert (pr["window_from_ts"], pr["window_to_ts"]) == (WINDOW_FROM, WINDOW_TO)
    assert json.loads(contract.get_pledge(0))["n_promos"] == 1
    assert contract.promo_status(0) == "LIVE"
    check_solvency(contract, ledger, transfers)


@pytest.mark.parametrize("kw, needle", [
    ({"url": "https://example.org/bouilloire.html"}, "product_url must be on mcurly17.github.io"),
    ({"url": "http://mcurly17.github.io/wasprice/demo/bouilloire.html"}, "product_url must be an https URL"),
    ({"url": "https://mcurly17.github.io/a b.html"}, "product_url must not contain spaces"),
    ({"url": "https://mcurly17.github.io/" + "a" * 520}, "product_url is too long"),
    ({"was": "39,90"}, "prices must look like 39.90"),
    ({"was": "39.9"}, "prices must look like 39.90"),
    ({"promo": "-1.00"}, "prices must look like 39.90"),
    ({"promo": "39.90", "pct": 0}, "promo_price must be above 0 and below was_price"),
    ({"promo": "0.00", "pct": 0}, "promo_price must be above 0 and below was_price"),
    ({"pct": 15}, "pct must be 0 or within 1 point of 13"),
    ({"pct": -1}, "pct must be 0 or within 1 point of 13"),
    ({"start": "2026-11-06T11:59:59Z"}, "promo_start must be between 7 days ago and 30 days ahead"),
    ({"start": "2026-12-13T12:00:01Z"}, "promo_start must be between 7 days ago and 30 days ahead"),
    ({"start": "2026-11-13 12:00:00"}, "promo_start must be ISO 8601 UTC"),
    ({"start": "2026-02-30T12:00:00Z"}, "promo_start must be ISO 8601 UTC"),
    ({"variant": "x" * 81}, "variant must be at most 80 characters"),
    ({"variant": "inox\x07"}, "variant must be at most 80 characters"),
    ({"pledge_id": 7}, "unknown pledge"),
])
def test_declare_refusals_match_preview(direct_vm, contract, direct_alice, ledger, kw, needle):
    make_pledge(direct_vm, contract, direct_alice, ledger)
    preview = preview_declare(contract, direct_alice, **kw)
    assert_same_refusal(lambda: declare(direct_vm, contract, direct_alice, **kw), preview, needle)
    assert json.loads(contract.get_stats())["promos"] == 0


def test_declare_pct_tolerance(direct_vm, contract, direct_alice, ledger):
    make_pledge(direct_vm, contract, direct_alice, ledger)
    for pct in (0, 12, 13, 14):
        assert preview_declare(contract, direct_alice, pct=pct) == ""
    assert "within 1 point of 13" in preview_declare(contract, direct_alice, pct=15)
    assert "within 1 point of 13" in preview_declare(contract, direct_alice, pct=11)
    # Demo promos B, C, D, E: 20 %, 23 %, 25 %, 14 %.
    for was, promo, pct in (("39.90", "31.90", 20), ("12.90", "9.90", 23), ("39.90", "29.90", 25), ("34.90", "29.90", 14)):
        assert preview_declare(contract, direct_alice, was=was, promo=promo, pct=pct) == "", (was, promo)


def test_declare_only_by_merchant(direct_vm, contract, direct_alice, direct_bob, ledger):
    make_pledge(direct_vm, contract, direct_alice, ledger)
    preview = preview_declare(contract, direct_bob)
    assert_same_refusal(lambda: declare(direct_vm, contract, direct_bob), preview, "only the merchant can declare promos")


def test_declare_cap_of_50_promos(direct_vm, contract, direct_alice, ledger):
    make_pledge(direct_vm, contract, direct_alice, ledger)
    for i in range(50):
        declare(direct_vm, contract, direct_alice, url=f"{URL_A}?i={i}")
    preview = preview_declare(contract, direct_alice)
    assert_same_refusal(lambda: declare(direct_vm, contract, direct_alice), preview, "too many promos on this pledge (max 50)")
    assert json.loads(contract.list_promos(0, 40, 50))[-1]["id"] == 49
    assert len(json.loads(contract.list_promos(0, 0, 50))) == 50
    assert "limit between 1 and 50" in revert_message(lambda: contract.list_promos(0, 0, 51))


def test_declare_after_pledge_end_is_refused(direct_vm, contract, direct_alice, ledger):
    make_pledge(direct_vm, contract, direct_alice, ledger, days=7)
    direct_vm.warp("2026-11-20T12:00:00Z")
    preview = preview_declare(contract, direct_alice, start="2026-11-20T12:00:00Z")
    assert_same_refusal(
        lambda: declare(direct_vm, contract, direct_alice, start="2026-11-20T12:00:00Z"), preview, "pledge coverage has ended"
    )


# 3. challenge / challenge_image --------------------------------------------------------

def preview_challenge(vm, contract, challenger, promo_id=0, ts=TS_IN, stake=STAKE, image_url=None, at=T_CHALLENGE):
    vm.warp(at)
    if image_url is None:
        return contract.preview_challenge(promo_id, ts, to_hex(challenger), str(stake))
    return contract.preview_challenge_image(promo_id, ts, image_url, to_hex(challenger), str(stake))


def test_challenge_reserves_the_payout(direct_vm, contract, direct_alice, direct_bob, ledger, transfers):
    setup_promo(direct_vm, contract, direct_alice, ledger)
    assert preview_challenge(direct_vm, contract, direct_bob) == ""
    assert preview_challenge(direct_vm, contract, direct_bob, image_url=IMAGE_E) == ""
    assert open_challenge(direct_vm, contract, direct_bob, ledger) == 0
    p = json.loads(contract.get_pledge(0))
    assert (int(p["bond"]), int(p["reserved"])) == (BOND - PAYOUT, PAYOUT)
    c = json.loads(contract.get_challenge(0))
    assert (c["status"], c["kind"], c["snapshot_ts"], c["stake"]) == ("OPEN", "TEXT", TS_IN, str(STAKE))
    assert c["opened_at"] == T_CHALLENGE and c["resolve_deadline"] == "2026-11-16T13:00:00Z"
    pr = json.loads(contract.get_promo(0))
    assert pr["open_challenge"] is True and pr["n_challenges"] == 1
    assert [x["id"] for x in json.loads(contract.list_challenges(0))] == [0]
    check_solvency(contract, ledger, transfers)


@pytest.mark.parametrize("ts, needle", [
    ("2026110112000", "snapshot_ts must be a valid 14-digit UTC time"),
    ("2026-11-01T12", "snapshot_ts must be a valid 14-digit UTC time"),
    ("20261301120000", "snapshot_ts must be a valid 14-digit UTC time"),
    ("20261014115959", "snapshot_ts is before the 30-day window (from 20261014120000)"),
    ("20261013120000", "snapshot_ts is before the 30-day window"),
    ("20261113120000", "snapshot_ts must be before promo_start (20261113120000)"),
    ("20261113125959", "snapshot_ts must be before promo_start"),
    ("20261113130001", "snapshot_ts is in the future"),
])
def test_challenge_snapshot_window(direct_vm, contract, direct_alice, direct_bob, ledger, transfers, ts, needle):
    setup_promo(direct_vm, contract, direct_alice, ledger)
    for image in (None, IMAGE_E):
        preview = preview_challenge(direct_vm, contract, direct_bob, ts=ts, image_url=image)
        assert_same_refusal(lambda: open_challenge(direct_vm, contract, direct_bob, ledger, ts=ts, image_url=image), preview, needle)
    assert preview_challenge(direct_vm, contract, direct_bob, ts=WINDOW_FROM) == ""  # lower bound included
    check_solvency(contract, ledger, transfers)


def test_challenge_refusals_match_preview(direct_vm, contract, direct_alice, direct_bob, direct_charlie, ledger, transfers):
    setup_promo(direct_vm, contract, direct_alice, ledger)
    cases = [
        (direct_alice, {}, "the merchant cannot challenge its own promo"),
        (direct_bob, {"stake": PAYOUT // 10 - 1}, "stake below minimum (10000000000000000 wei)"),
        (direct_bob, {"stake": 0}, "stake below minimum"),
        (direct_bob, {"promo_id": 5}, "unknown promo"),
        (direct_bob, {"image_url": "http://mcurly17.github.io/x.png"}, "image_url must be an https URL"),
        (direct_bob, {"image_url": "https://mcurly17.github.io/a b.png"}, "image_url must not contain spaces"),
        (direct_bob, {"image_url": "https://x.org/" + "a" * 520}, "image_url is too long"),
    ]
    for who, kw, needle in cases:
        preview = preview_challenge(direct_vm, contract, who, **kw)
        assert_same_refusal(lambda: open_challenge(direct_vm, contract, who, ledger, **kw), preview, needle)
    open_challenge(direct_vm, contract, direct_bob, ledger)
    for who in (direct_bob, direct_charlie):
        for image in (None, IMAGE_E):
            preview = preview_challenge(direct_vm, contract, who, ts="20261102120000", image_url=image)
            assert_same_refusal(
                lambda: open_challenge(direct_vm, contract, who, ledger, ts="20261102120000", image_url=image),
                preview, "a challenge is already open on this promo",
            )
    check_solvency(contract, ledger, transfers)


def test_challenge_needs_a_full_payout_in_the_bond(direct_vm, contract, direct_alice, direct_bob, ledger, transfers):
    make_pledge(direct_vm, contract, direct_alice, ledger, bond=PAYOUT)
    declare(direct_vm, contract, direct_alice)
    declare(direct_vm, contract, direct_alice, url=URL_B, promo="31.90", pct=20)
    open_challenge(direct_vm, contract, direct_bob, ledger, promo_id=0)
    preview = preview_challenge(direct_vm, contract, direct_bob, promo_id=1)
    assert_same_refusal(lambda: open_challenge(direct_vm, contract, direct_bob, ledger, promo_id=1), preview,
                        "insufficient bond to reserve the payout")
    pay(direct_vm, ledger, direct_alice, PAYOUT, lambda: contract.top_up(0))
    assert preview_challenge(direct_vm, contract, direct_bob, promo_id=1) == ""
    check_solvency(contract, ledger, transfers)


def test_sixth_open_challenge_of_one_challenger_is_refused(direct_vm, contract, direct_alice, direct_bob, ledger, transfers):
    make_pledge(direct_vm, contract, direct_alice, ledger, bond=GEN)
    for i in range(6):
        declare(direct_vm, contract, direct_alice, url=f"{URL_A}?i={i}")
    for i in range(5):
        open_challenge(direct_vm, contract, direct_bob, ledger, promo_id=i)
    preview = preview_challenge(direct_vm, contract, direct_bob, promo_id=5)
    assert_same_refusal(lambda: open_challenge(direct_vm, contract, direct_bob, ledger, promo_id=5), preview,
                        "too many open challenges for this challenger (max 5)")
    assert json.loads(contract.get_pledge(0))["reserved"] == str(5 * PAYOUT)
    check_solvency(contract, ledger, transfers)


def test_challenge_after_pledge_end_is_refused(direct_vm, contract, direct_alice, direct_bob, ledger):
    make_pledge(direct_vm, contract, direct_alice, ledger, days=7)
    declare(direct_vm, contract, direct_alice)
    preview = preview_challenge(direct_vm, contract, direct_bob, at="2026-11-20T12:00:00Z")
    assert_same_refusal(lambda: open_challenge(direct_vm, contract, direct_bob, ledger, at="2026-11-20T12:00:00Z"),
                        preview, "pledge coverage has ended")


def test_preview_challenge_rejects_bad_inputs(direct_vm, contract, direct_alice, direct_bob, ledger):
    setup_promo(direct_vm, contract, direct_alice, ledger)
    direct_vm.warp(T_CHALLENGE)
    assert "invalid challenger address" in contract.preview_challenge(0, TS_IN, "bob", str(STAKE))
    assert "decimal strings of wei" in contract.preview_challenge(0, TS_IN, to_hex(direct_bob), "1e16")


# 4. expire -------------------------------------------------------------------------------

def test_expire_refunds_after_the_deadline(direct_vm, contract, direct_alice, direct_bob, ledger, transfers):
    setup_promo(direct_vm, contract, direct_alice, ledger)
    open_challenge(direct_vm, contract, direct_bob, ledger)
    direct_vm.warp("2026-11-16T12:59:59Z")
    assert "resolution window still open" in revert_message(lambda: contract.expire(0))
    direct_vm.warp("2026-11-16T13:00:00Z")
    assert "resolution window closed, call expire" in revert_message(lambda: contract.resolve(0))
    assert contract.expire(0) == "EXPIRED"
    c = json.loads(contract.get_challenge(0))
    assert c["status"] == "EXPIRED" and "refunded" in c["reason"]
    p = json.loads(contract.get_pledge(0))
    assert (int(p["bond"]), int(p["reserved"])) == (BOND, 0)
    assert json.loads(contract.get_credit(to_hex(direct_bob)))["credit"] == str(STAKE)
    assert json.loads(contract.get_promo(0))["open_challenge"] is False
    assert "challenge is not open" in revert_message(lambda: contract.expire(0))
    # The same capture can be filed again: an expiry decides nothing.
    assert preview_challenge(direct_vm, contract, direct_bob, at="2026-11-16T13:00:00Z") == ""
    check_solvency(contract, ledger, transfers)


# 5. close_pledge -------------------------------------------------------------------------

def test_close_pledge_rules(direct_vm, contract, direct_alice, direct_bob, ledger, transfers):
    make_pledge(direct_vm, contract, direct_alice, ledger, days=7)
    declare(direct_vm, contract, direct_alice)
    open_challenge(direct_vm, contract, direct_bob, ledger)
    direct_vm.sender = direct_alice
    assert "coverage has not ended" in revert_message(lambda: contract.close_pledge(0))
    direct_vm.warp("2026-11-20T12:00:00Z")
    direct_vm.sender = direct_bob
    assert "only the merchant can close" in revert_message(lambda: contract.close_pledge(0))
    direct_vm.sender = direct_alice
    assert "a challenge is still open on this pledge" in revert_message(lambda: contract.close_pledge(0))
    direct_vm.warp("2026-11-20T12:00:00Z")
    contract.expire(0)
    direct_vm.sender = direct_alice
    assert contract.close_pledge(0) == str(BOND)
    p = json.loads(contract.get_pledge(0))
    assert p["active"] is False and p["bond"] == "0"
    assert json.loads(contract.get_credit(to_hex(direct_alice)))["credit"] == str(BOND)
    assert "pledge is not active" in revert_message(lambda: contract.close_pledge(0))
    assert "pledge is not active" in revert_message(lambda: pay(direct_vm, ledger, direct_alice, 1, lambda: contract.top_up(0)))
    check_solvency(contract, ledger, transfers)


# 6. withdraw -----------------------------------------------------------------------------

def test_withdraw_pays_the_exact_credit_once(direct_vm, contract, direct_alice, direct_bob, ledger, transfers):
    make_pledge(direct_vm, contract, direct_alice, ledger, days=7)
    declare(direct_vm, contract, direct_alice)
    open_challenge(direct_vm, contract, direct_bob, ledger)
    direct_vm.warp("2026-11-20T12:00:00Z")
    contract.expire(0)
    direct_vm.sender = direct_alice
    contract.close_pledge(0)
    direct_vm.sender = direct_bob
    assert contract.withdraw() == STAKE
    direct_vm.sender = direct_alice
    assert contract.withdraw() == BOND
    assert transfers == [(to_hex(direct_bob), STAKE), (to_hex(direct_alice), BOND)]
    for who in (direct_alice, direct_bob):
        direct_vm.sender = who
        assert revert_message(lambda: contract.withdraw()) == "[EXPECTED] nothing to withdraw"
    assert json.loads(contract.get_stats())["total_credits"] == "0"
    check_solvency(contract, ledger, transfers)


# 7. views --------------------------------------------------------------------------------

def test_promo_window_bounds_and_calendar(direct_vm, contract, direct_alice, ledger):
    setup_promo(direct_vm, contract, direct_alice, ledger, url=URL_C, was="12.90", promo="9.90", pct=23)
    w = json.loads(contract.promo_window(0))
    assert w == {
        "from_ts": WINDOW_FROM,
        "to_ts": WINDOW_TO,
        "wayback_calendar": f"https://web.archive.org/web/{WINDOW_FROM}*/{URL_C}",
    }
    assert "unknown promo" in revert_message(lambda: contract.promo_window(3))


def test_standing_counts_and_bond(direct_vm, contract, direct_alice, direct_bob, ledger, transfers):
    make_pledge(direct_vm, contract, direct_alice, ledger)
    for url in (URL_A, URL_D):
        declare(direct_vm, contract, direct_alice, url=url)
    open_challenge(direct_vm, contract, direct_bob, ledger)
    s = json.loads(contract.standing(to_hex(direct_alice)))
    assert s == {
        "merchant": to_hex(direct_alice), "pledges": 1, "promos": 2, "debunked": 0, "rejected": 0,
        "evidence_not_found": 0, "bonded_now": str(BOND),
    }
    assert json.loads(contract.standing(to_hex(direct_bob)))["pledges"] == 0
    assert "invalid merchant address" in revert_message(lambda: contract.standing("nope"))
    assert "Aldi" in contract.get_rule() and json.loads(contract.get_stats())["rule"] == "OMNIBUS_PRIOR_PRICE"
    check_solvency(contract, ledger, transfers)
