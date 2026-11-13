# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
from dataclasses import dataclass
import datetime
import json
import re
import unicodedata


# --- Error classes: [EXPECTED] and [EXTERNAL] are deterministic (exact match between
# validators), [TRANSIENT] agrees when both sides are transient, [LLM_ERROR] never agrees.
ERROR_EXPECTED = "[EXPECTED]"
ERROR_EXTERNAL = "[EXTERNAL]"
ERROR_TRANSIENT = "[TRANSIENT]"
ERROR_LLM = "[LLM_ERROR]"

# --- The judged rule: a constant, never supplied by a party.
RULE_ID = "OMNIBUS_PRIOR_PRICE"
RULE_TEXT = (
    "OMNIBUS_PRIOR_PRICE. A promotion declared by the merchant shows a \"was\" (reference) "
    "price W. Under Article 6a(1)-(2) of Directive 98/6/EC as amended by Directive (EU) "
    "2019/2161, and CJEU C-330/23 Aldi Süd, the reference price must be the lowest price the "
    "trader applied during the 30 days before the reduction started. A challenge is UPHELD if "
    "an archived capture of the product page, taken in [promo_start - 30 days, promo_start), "
    "shows the same product offered for sale at an unconditional selling price strictly lower "
    "than W."
)

DAY = 86400
PRIOR_WINDOW = 30 * DAY
MIN_PAYOUT = 10**16  # 0.01 GEN; min_stake = payout // 10
PLEDGE_DAYS_MIN = 7
PLEDGE_DAYS_MAX = 365
START_PAST_MAX = 7 * DAY
START_FUTURE_MAX = 30 * DAY
MAX_PROMOS_PER_PLEDGE = 50
MAX_OPEN_PER_CHALLENGER = 5
RESOLVE_WINDOW = 3 * DAY
MAX_REDIRECTS = 2
PAGE_TEXT_MAX = 8000
HINTS_MAX = 5
MAX_PAGE_BYTES = 3_000_000
MAX_IMAGE_BYTES = 2_000_000
URL_MAX_LEN = 512
NAME_MAX = 80
VARIANT_MAX = 80
REASON_MAX = 280
LIST_MAX = 50
CURRENCIES = ("EUR",)

KIND_TEXT = "TEXT"
KIND_IMAGE = "IMAGE"
LIVE = "LIVE"
DEBUNKED = "DEBUNKED"
OPEN = "OPEN"
UPHELD = "UPHELD"
REJECTED = "REJECTED"
EVIDENCE_NOT_FOUND = "EVIDENCE_NOT_FOUND"
EXPIRED = "EXPIRED"

ARCHIVE_PREFIX = "https://web.archive.org/web/"


# --- Storage

@allow_storage
@dataclass
class Pledge:
    merchant: Address
    name: str
    domain: str
    bond: u256  # available
    reserved: u256  # reserved by OPEN challenges (one payout each)
    payout: u256
    min_stake: u256
    created_at: u64
    ends_at: u64
    active: bool
    n_promos: u32


@allow_storage
@dataclass
class Promo:
    pledge_id: u256
    product_url: str
    variant: str
    currency: str
    was_cents: u64
    promo_cents: u64
    pct: u32
    promo_start: u64
    declared_at: u64
    status: str  # LIVE | DEBUNKED
    open_challenge: bool
    n_challenges: u32


@allow_storage
@dataclass
class Challenge:
    promo_id: u256
    kind: str  # TEXT | IMAGE
    snapshot_ts: str
    image_url: str
    challenger: Address
    stake: u256
    status: str  # OPEN | UPHELD | REJECTED | EVIDENCE_NOT_FOUND | EXPIRED
    judged_ts: str
    page_sha256: str
    image_ts: str
    image_sha256: str
    observed_cents: u64
    observed_currency: str
    struck_seen: str
    reason: str
    opened_at: u64
    resolve_deadline: u64


@gl.evm.contract_interface
class _Recipient:
    class View:
        pass

    class Write:
        pass


# --- Deterministic helpers

_PRICE_RE = re.compile(r"[0-9]{1,7}\.[0-9]{2}")
_TS14_RE = re.compile(r"[0-9]{14}")
_ISO_RE = re.compile(r"([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})Z")
_DOMAIN_RE = re.compile(r"[a-z0-9.-]{3,253}")
_WEI_RE = re.compile(r"[0-9]{1,78}")
_URL_RE = re.compile(r"https://([^/?#\s]+)([^#\s]*)(?:#\S*)?", re.IGNORECASE)
_WS_RE = re.compile(r"\s+")
_SHA256_RE = re.compile(r"[0-9a-f]{64}")


def _err(msg: str) -> str:
    return f"{ERROR_EXPECTED} {msg}"


def _expected(msg: str) -> gl.vm.UserError:
    return gl.vm.UserError(_err(msg))


def _now() -> int:
    return int(datetime.datetime.now(datetime.timezone.utc).timestamp())


def _parse_cents(value: object) -> int | None:
    """Strict "39.90" -> 3990. Integers only, no float. Same rule as web/lib/price.ts."""
    if not isinstance(value, str) or _PRICE_RE.fullmatch(value) is None:
        return None
    euros, cents = value.split(".")
    return int(euros) * 100 + int(cents)


def _cents_str(cents: int) -> str:
    return f"{cents // 100}.{cents % 100:02d}"


def _dt(y: int, mo: int, d: int, h: int, mi: int, s: int) -> int | None:
    try:
        return int(datetime.datetime(y, mo, d, h, mi, s, tzinfo=datetime.timezone.utc).timestamp())
    except ValueError:
        return None


def _ts14_to_unix(value: object) -> int | None:
    if not isinstance(value, str) or _TS14_RE.fullmatch(value) is None:
        return None
    v = value
    return _dt(int(v[0:4]), int(v[4:6]), int(v[6:8]), int(v[8:10]), int(v[10:12]), int(v[12:14]))


def _unix_to_ts14(t: int) -> str:
    return datetime.datetime.fromtimestamp(t, datetime.timezone.utc).strftime("%Y%m%d%H%M%S")


def _iso_to_unix(value: object) -> int | None:
    m = _ISO_RE.fullmatch(value) if isinstance(value, str) else None
    if m is None:
        return None
    return _dt(*(int(g) for g in m.groups()))


def _unix_to_iso(t: int) -> str:
    return datetime.datetime.fromtimestamp(t, datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _pct_ok(was: int, promo: int, pct: int) -> bool:
    # Round half up of (was - promo) * 100 / was, in integers; +/- 1 point accepted.
    expected = (200 * (was - promo) + was) // (2 * was)
    return pct == 0 or abs(pct - expected) <= 1


def _expected_pct(was: int, promo: int) -> int:
    return (200 * (was - promo) + was) // (2 * was)


def _has_control(text: str) -> bool:
    return any(unicodedata.category(ch) == "Cc" for ch in text)


def _norm_url(raw: object, what: str) -> tuple[str, str]:
    """https only, host lowercased, :443 and fragment dropped. Returns (url, error)."""
    url = raw.strip() if isinstance(raw, str) else ""
    if len(url) > URL_MAX_LEN:
        return "", _err(f"{what} is too long (max {URL_MAX_LEN})")
    if url == "" or any(ch.isspace() for ch in url) or _has_control(url):
        return "", _err(f"{what} must not contain spaces")
    m = _URL_RE.fullmatch(url)
    if m is None or "@" in m.group(1):
        return "", _err(f"{what} must be an https URL")
    host = m.group(1).lower()
    if host.endswith(":443"):
        host = host[:-4]
    if ":" in host or host.strip(".") == "":
        return "", _err(f"{what} must use the default https port")
    return "https://" + host.rstrip(".") + (m.group(2) or "/"), ""


def _url_host(url: str) -> str:
    return url[len("https://"):].split("/", 1)[0].split("?", 1)[0]


def _clean_name(name: object) -> str:
    return _WS_RE.sub(" ", name).strip() if isinstance(name, str) else ""


def _domain_ok(domain: object) -> bool:
    return (
        isinstance(domain, str)
        and _DOMAIN_RE.fullmatch(domain) is not None
        and "." in domain
        and not domain.startswith((".", "-"))
        and not domain.endswith((".", "-"))
        and ".." not in domain
    )


def _wei(value: object) -> int | None:
    if not isinstance(value, str) or _WEI_RE.fullmatch(value) is None:
        return None
    return int(value)


def _check_pledge(name: object, domain: object, payout: int, days: int, value: int) -> str:
    clean = _clean_name(name)
    if clean == "" or len(clean) > NAME_MAX or _has_control(clean):
        return _err(f"name must be 1 to {NAME_MAX} characters")
    if payout < MIN_PAYOUT:
        return _err(f"payout must be at least {MIN_PAYOUT} wei (0.01 GEN)")
    if value < payout:
        return _err("bond (message value) must be at least the payout")
    if not _domain_ok(domain):
        return _err("domain must be a lowercase host name such as shop.example")
    if days < PLEDGE_DAYS_MIN or days > PLEDGE_DAYS_MAX:
        return _err(f"days must be between {PLEDGE_DAYS_MIN} and {PLEDGE_DAYS_MAX}")
    return ""


def _decided_key(promo_id: int, ts: str, kind: str, image_url: str) -> str:
    return f"{promo_id}:{ts}:{kind}:{image_url}"


def _error_message(err: object) -> str:
    msg = getattr(err, "message", None)
    return msg if isinstance(msg, str) else str(err)


def _clip(text: str, limit: int) -> str:
    text = _WS_RE.sub(" ", text).strip()
    return text if len(text) <= limit else text[: limit - 3].rstrip() + "..."


def _valid(value: object, pattern: re.Pattern) -> str:
    return value if isinstance(value, str) and pattern.fullmatch(value) is not None else ""


def _parse_address(raw: object) -> Address | None:
    try:
        return Address(raw)
    except Exception:
        return None


# --- Contract

class WasPrice(gl.Contract):
    pledges: TreeMap[u256, Pledge]
    promos: TreeMap[u256, Promo]
    challenges: TreeMap[u256, Challenge]
    next_pledge: u256
    next_promo: u256
    next_challenge: u256
    decided: TreeMap[str, bool]
    open_by_challenger: TreeMap[Address, u32]
    credits: TreeMap[Address, u256]
    total_credits: u256

    def __init__(self):
        self.next_pledge = u256(0)
        self.next_promo = u256(0)
        self.next_challenge = u256(0)
        self.total_credits = u256(0)

    # -- internal accessors

    def _pledge(self, pledge_id: int) -> Pledge | None:
        if pledge_id < 0 or pledge_id >= int(self.next_pledge):
            return None
        return self.pledges[u256(pledge_id)]

    def _promo(self, promo_id: int) -> Promo | None:
        if promo_id < 0 or promo_id >= int(self.next_promo):
            return None
        return self.promos[u256(promo_id)]

    def _challenge(self, challenge_id: int) -> Challenge:
        if challenge_id < 0 or challenge_id >= int(self.next_challenge):
            raise _expected("unknown challenge")
        return self.challenges[u256(challenge_id)]

    def _open_count(self, addr: Address) -> int:
        return int(self.open_by_challenger[addr]) if addr in self.open_by_challenger else 0

    def _credit(self, addr: Address, amount: int) -> None:
        if amount <= 0:
            return
        current = int(self.credits[addr]) if addr in self.credits else 0
        self.credits[addr] = u256(current + amount)
        self.total_credits = u256(int(self.total_credits) + amount)

    # -- checks shared by each write and its preview: "" or the exact [EXPECTED] message

    def _check_declare(
        self, sender: Address, pledge_id: int, product_url: object, variant: object,
        was_price: object, promo_price: object, pct: int, promo_start: object, now: int,
    ) -> tuple[str, tuple]:
        p = self._pledge(pledge_id)
        if p is None:
            return _err("unknown pledge"), ()
        if sender != p.merchant:
            return _err("only the merchant can declare promos"), ()
        if not p.active:
            return _err("pledge is not active"), ()
        if now >= int(p.ends_at):
            return _err("pledge coverage has ended"), ()
        if int(p.n_promos) >= MAX_PROMOS_PER_PLEDGE:
            return _err(f"too many promos on this pledge (max {MAX_PROMOS_PER_PLEDGE})"), ()
        url, err = _norm_url(product_url, "product_url")
        if err != "":
            return err, ()
        if _url_host(url) != p.domain:
            return _err(f"product_url must be on {p.domain}"), ()
        if not isinstance(variant, str) or len(variant) > VARIANT_MAX or _has_control(variant):
            return _err(f"variant must be at most {VARIANT_MAX} characters, without control characters"), ()
        was = _parse_cents(was_price)
        promo = _parse_cents(promo_price)
        if was is None or promo is None:
            return _err("prices must look like 39.90 (digits, a dot, two decimals)"), ()
        if promo <= 0 or promo >= was:
            return _err("promo_price must be above 0 and below was_price"), ()
        if pct < 0 or pct > 100 or not _pct_ok(was, promo, pct):
            return _err(f"pct must be 0 or within 1 point of {_expected_pct(was, promo)}"), ()
        start = _iso_to_unix(promo_start)
        if start is None:
            return _err("promo_start must be ISO 8601 UTC (YYYY-MM-DDTHH:MM:SSZ)"), ()
        if start < now - START_PAST_MAX or start > now + START_FUTURE_MAX:
            return _err("promo_start must be between 7 days ago and 30 days ahead"), ()
        return "", (url, variant.strip(), was, promo, start)

    def _check_challenge(
        self, promo_id: int, snapshot_ts: object, kind: str, image_url: object,
        sender: Address, stake: int, now: int,
    ) -> tuple[str, str]:
        promo = self._promo(promo_id)
        if promo is None:
            return _err("unknown promo"), ""
        p = self.pledges[promo.pledge_id]
        if not p.active:
            return _err("pledge is not active"), ""
        if now >= int(p.ends_at):
            return _err("pledge coverage has ended"), ""
        if sender == p.merchant:
            return _err("the merchant cannot challenge its own promo"), ""
        if promo.status != LIVE:
            return _err("promo is already debunked"), ""
        clean_image = ""
        if kind == KIND_IMAGE:
            clean_image, err = _norm_url(image_url, "image_url")
            if err != "":
                return err, ""
        ts = _ts14_to_unix(snapshot_ts)
        if ts is None:
            return _err("snapshot_ts must be a valid 14-digit UTC time (YYYYMMDDhhmmss)"), ""
        start = int(promo.promo_start)
        if ts > now:
            return _err("snapshot_ts is in the future"), ""
        if ts < start - PRIOR_WINDOW:
            return _err(f"snapshot_ts is before the 30-day window (from {_unix_to_ts14(start - PRIOR_WINDOW)})"), ""
        if ts >= start:
            return _err(f"snapshot_ts must be before promo_start ({_unix_to_ts14(start)})"), ""
        if promo.open_challenge:
            return _err("a challenge is already open on this promo"), ""
        if _decided_key(promo_id, str(snapshot_ts), kind, clean_image) in self.decided:
            return _err("this capture was already judged for this promo"), ""
        if stake < int(p.min_stake):
            return _err(f"stake below minimum ({int(p.min_stake)} wei)"), ""
        if int(p.bond) < int(p.payout):
            return _err("insufficient bond to reserve the payout"), ""
        if self._open_count(sender) >= MAX_OPEN_PER_CHALLENGER:
            return _err(f"too many open challenges for this challenger (max {MAX_OPEN_PER_CHALLENGER})"), ""
        return "", clean_image

    # -- settlement (pull model: amounts go to credits, withdraw() transfers)

    def _settle(self, challenge_id: int, status: str, reason: str) -> None:
        c = self.challenges[u256(challenge_id)]
        promo = self.promos[c.promo_id]
        p = self.pledges[promo.pledge_id]
        payout = int(p.payout)
        stake = int(c.stake)
        p.reserved = u256(int(p.reserved) - payout)
        if status == UPHELD:
            self._credit(c.challenger, stake + payout)
            promo.status = DEBUNKED
        elif status == EXPIRED:
            p.bond = u256(int(p.bond) + payout)
            self._credit(c.challenger, stake)
        else:  # REJECTED, EVIDENCE_NOT_FOUND: the lost stake grows the bond
            p.bond = u256(int(p.bond) + payout + stake)
        if status != EXPIRED:
            for ts in (c.snapshot_ts, c.judged_ts):
                if ts != "":
                    self.decided[_decided_key(int(c.promo_id), ts, c.kind, c.image_url)] = True
        c.status = status
        c.reason = _clip(reason, REASON_MAX)
        promo.open_challenge = False
        self.open_by_challenger[c.challenger] = u32(max(0, self._open_count(c.challenger) - 1))

    # -- writes

    @gl.public.write.payable
    def create_pledge(self, name: str, domain: str, payout: int, days: int) -> int:
        value = int(gl.message.value)
        err = _check_pledge(name, domain, payout, days, value)
        if err != "":
            raise gl.vm.UserError(err)
        now = _now()
        pledge_id = int(self.next_pledge)
        self.pledges[u256(pledge_id)] = Pledge(
            merchant=gl.message.sender_address,
            name=_clean_name(name),
            domain=domain,
            bond=u256(value),
            reserved=u256(0),
            payout=u256(payout),
            min_stake=u256(payout // 10),
            created_at=u64(now),
            ends_at=u64(now + days * DAY),
            active=True,
            n_promos=u32(0),
        )
        self.next_pledge = u256(pledge_id + 1)
        return pledge_id

    @gl.public.write.payable
    def top_up(self, pledge_id: int) -> int:
        value = int(gl.message.value)
        p = self._pledge(pledge_id)
        if p is None:
            raise _expected("unknown pledge")
        if gl.message.sender_address != p.merchant:
            raise _expected("only the merchant can top up its pledge")
        if not p.active:
            raise _expected("pledge is not active")
        if value <= 0:
            raise _expected("top-up value must be greater than 0")
        p.bond = u256(int(p.bond) + value)
        return int(p.bond)

    @gl.public.write
    def declare_promo(
        self, pledge_id: int, product_url: str, variant: str, was_price: str,
        promo_price: str, pct: int, promo_start: str,
    ) -> int:
        now = _now()
        err, data = self._check_declare(
            gl.message.sender_address, pledge_id, product_url, variant, was_price,
            promo_price, pct, promo_start, now,
        )
        if err != "":
            raise gl.vm.UserError(err)
        url, clean_variant, was, promo, start = data
        promo_id = int(self.next_promo)
        self.promos[u256(promo_id)] = Promo(
            pledge_id=u256(pledge_id),
            product_url=url,
            variant=clean_variant,
            currency=CURRENCIES[0],
            was_cents=u64(was),
            promo_cents=u64(promo),
            pct=u32(pct),
            promo_start=u64(start),
            declared_at=u64(now),
            status=LIVE,
            open_challenge=False,
            n_challenges=u32(0),
        )
        p = self.pledges[u256(pledge_id)]
        p.n_promos = u32(int(p.n_promos) + 1)
        self.next_promo = u256(promo_id + 1)
        return promo_id

    @gl.public.write.payable
    def challenge(self, promo_id: int, snapshot_ts: str) -> int:
        return self._file(promo_id, snapshot_ts, KIND_TEXT, "")

    @gl.public.write.payable
    def challenge_image(self, promo_id: int, snapshot_ts: str, image_url: str) -> int:
        return self._file(promo_id, snapshot_ts, KIND_IMAGE, image_url)

    def _file(self, promo_id: int, snapshot_ts: str, kind: str, image_url: str) -> int:
        # No web or LLM call here: the capture is read in resolve().
        stake = int(gl.message.value)
        sender = gl.message.sender_address
        now = _now()
        err, clean_image = self._check_challenge(promo_id, snapshot_ts, kind, image_url, sender, stake, now)
        if err != "":
            raise gl.vm.UserError(err)
        promo = self.promos[u256(promo_id)]
        p = self.pledges[promo.pledge_id]
        p.bond = u256(int(p.bond) - int(p.payout))
        p.reserved = u256(int(p.reserved) + int(p.payout))
        promo.open_challenge = True
        promo.n_challenges = u32(int(promo.n_challenges) + 1)
        self.open_by_challenger[sender] = u32(self._open_count(sender) + 1)
        challenge_id = int(self.next_challenge)
        self.challenges[u256(challenge_id)] = Challenge(
            promo_id=u256(promo_id),
            kind=kind,
            snapshot_ts=snapshot_ts,
            image_url=clean_image,
            challenger=sender,
            stake=u256(stake),
            status=OPEN,
            judged_ts="",
            page_sha256="",
            image_ts="",
            image_sha256="",
            observed_cents=u64(0),
            observed_currency="",
            struck_seen="",
            reason="",
            opened_at=u64(now),
            resolve_deadline=u64(now + RESOLVE_WINDOW),
        )
        self.next_challenge = u256(challenge_id + 1)
        return challenge_id

    @gl.public.write
    def resolve(self, challenge_id: int) -> str:
        c = self._challenge(challenge_id)
        if c.status != OPEN:
            raise _expected("challenge is not open")
        if _now() >= int(c.resolve_deadline):
            raise _expected("resolution window closed, call expire")
        raise _expected("not implemented")

    @gl.public.write
    def expire(self, challenge_id: int) -> str:
        c = self._challenge(challenge_id)
        if c.status != OPEN:
            raise _expected("challenge is not open")
        if _now() < int(c.resolve_deadline):
            raise _expected("resolution window still open")
        self._settle(challenge_id, EXPIRED, "not resolved before the deadline, stake refunded")
        return EXPIRED

    @gl.public.write
    def close_pledge(self, pledge_id: int) -> str:
        p = self._pledge(pledge_id)
        if p is None:
            raise _expected("unknown pledge")
        if gl.message.sender_address != p.merchant:
            raise _expected("only the merchant can close its pledge")
        if not p.active:
            raise _expected("pledge is not active")
        if _now() < int(p.ends_at):
            raise _expected("coverage has not ended")
        if int(p.reserved) > 0:
            raise _expected("a challenge is still open on this pledge")
        amount = int(p.bond)
        p.bond = u256(0)
        p.active = False
        self._credit(p.merchant, amount)
        return str(amount)

    @gl.public.write
    def withdraw(self) -> int:
        sender = gl.message.sender_address
        amount = int(self.credits[sender]) if sender in self.credits else 0
        if amount <= 0:
            raise _expected("nothing to withdraw")
        self.credits[sender] = u256(0)
        self.total_credits = u256(int(self.total_credits) - amount)
        _Recipient(sender).emit_transfer(value=u256(amount))
        return amount

    # -- previews: no web, no LLM; "" when the write would pass now, else its exact message

    @gl.public.view
    def preview_pledge(
        self, sender: str, name: str, domain: str, payout_wei: str, days: int, value_wei: str
    ) -> str:
        payout = _wei(payout_wei)
        value = _wei(value_wei)
        if _parse_address(sender) is None:
            return _err("invalid sender address")
        if payout is None or value is None:
            return _err("amounts must be decimal strings of wei")
        return _check_pledge(name, domain, payout, days, value)

    @gl.public.view
    def preview_declare(
        self, sender: str, pledge_id: int, product_url: str, variant: str, was_price: str,
        promo_price: str, pct: int, promo_start: str,
    ) -> str:
        addr = _parse_address(sender)
        if addr is None:
            return _err("invalid sender address")
        return self._check_declare(
            addr, pledge_id, product_url, variant, was_price, promo_price, pct, promo_start, _now()
        )[0]

    @gl.public.view
    def preview_challenge(self, promo_id: int, snapshot_ts: str, challenger: str, stake_wei: str) -> str:
        return self._preview(promo_id, snapshot_ts, KIND_TEXT, "", challenger, stake_wei)

    @gl.public.view
    def preview_challenge_image(
        self, promo_id: int, snapshot_ts: str, image_url: str, challenger: str, stake_wei: str
    ) -> str:
        return self._preview(promo_id, snapshot_ts, KIND_IMAGE, image_url, challenger, stake_wei)

    def _preview(
        self, promo_id: int, snapshot_ts: str, kind: str, image_url: str, challenger: str, stake_wei: str
    ) -> str:
        addr = _parse_address(challenger)
        stake = _wei(stake_wei)
        if addr is None:
            return _err("invalid challenger address")
        if stake is None:
            return _err("amounts must be decimal strings of wei")
        return self._check_challenge(promo_id, snapshot_ts, kind, image_url, addr, stake, _now())[0]

    # -- reads (JSON in str; amounts in decimal wei strings)

    def _pledge_view(self, pledge_id: int, p: Pledge) -> dict:
        return {
            "id": pledge_id,
            "merchant": p.merchant.as_hex,
            "name": p.name,
            "domain": p.domain,
            "bond": str(int(p.bond)),
            "reserved": str(int(p.reserved)),
            "payout": str(int(p.payout)),
            "min_stake": str(int(p.min_stake)),
            "created_at": _unix_to_iso(int(p.created_at)),
            "ends_at": _unix_to_iso(int(p.ends_at)),
            "active": p.active,
            "n_promos": int(p.n_promos),
        }

    def _promo_view(self, promo_id: int, pr: Promo) -> dict:
        start = int(pr.promo_start)
        return {
            "id": promo_id,
            "pledge_id": int(pr.pledge_id),
            "product_url": pr.product_url,
            "variant": pr.variant,
            "currency": pr.currency,
            "was_price": _cents_str(int(pr.was_cents)),
            "promo_price": _cents_str(int(pr.promo_cents)),
            "pct": int(pr.pct),
            "promo_start": _unix_to_iso(start),
            "declared_at": _unix_to_iso(int(pr.declared_at)),
            "window_from_ts": _unix_to_ts14(start - PRIOR_WINDOW),
            "window_to_ts": _unix_to_ts14(start),
            "status": pr.status,
            "open_challenge": pr.open_challenge,
            "n_challenges": int(pr.n_challenges),
        }

    def _challenge_view(self, challenge_id: int, c: Challenge) -> dict:
        observed = int(c.observed_cents)
        return {
            "id": challenge_id,
            "promo_id": int(c.promo_id),
            "kind": c.kind,
            "snapshot_ts": c.snapshot_ts,
            "image_url": c.image_url,
            "challenger": c.challenger.as_hex,
            "stake": str(int(c.stake)),
            "status": c.status,
            "judged_ts": c.judged_ts,
            "page_sha256": c.page_sha256,
            "image_ts": c.image_ts,
            "image_sha256": c.image_sha256,
            "observed_price": _cents_str(observed) if observed > 0 else "",
            "observed_currency": c.observed_currency,
            "struck_seen": c.struck_seen,
            "reason": c.reason,
            "opened_at": _unix_to_iso(int(c.opened_at)),
            "resolve_deadline": _unix_to_iso(int(c.resolve_deadline)),
        }

    @gl.public.view
    def get_pledge(self, pledge_id: int) -> str:
        p = self._pledge(pledge_id)
        if p is None:
            raise _expected("unknown pledge")
        return json.dumps(self._pledge_view(pledge_id, p))

    @gl.public.view
    def get_promo(self, promo_id: int) -> str:
        pr = self._promo(promo_id)
        if pr is None:
            raise _expected("unknown promo")
        return json.dumps(self._promo_view(promo_id, pr))

    @gl.public.view
    def get_challenge(self, challenge_id: int) -> str:
        return json.dumps(self._challenge_view(challenge_id, self._challenge(challenge_id)))

    @gl.public.view
    def list_promos(self, pledge_id: int, offset: int, limit: int) -> str:
        if self._pledge(pledge_id) is None:
            raise _expected("unknown pledge")
        if offset < 0 or limit < 1 or limit > LIST_MAX:
            raise _expected(f"offset must be >= 0 and limit between 1 and {LIST_MAX}")
        out = []
        for pid in range(int(self.next_promo)):
            pr = self.promos[u256(pid)]
            if int(pr.pledge_id) == pledge_id:
                out.append(self._promo_view(pid, pr))
        return json.dumps(out[offset:offset + limit])

    @gl.public.view
    def list_challenges(self, promo_id: int) -> str:
        if self._promo(promo_id) is None:
            raise _expected("unknown promo")
        out = []
        for cid in range(int(self.next_challenge)):
            c = self.challenges[u256(cid)]
            if int(c.promo_id) == promo_id:
                out.append(self._challenge_view(cid, c))
        return json.dumps(out)

    @gl.public.view
    def get_credit(self, addr: str) -> str:
        a = _parse_address(addr)
        if a is None:
            raise _expected("invalid address")
        credit = int(self.credits[a]) if a in self.credits else 0
        return json.dumps({"address": a.as_hex, "credit": str(credit)})

    @gl.public.view
    def get_stats(self) -> str:
        return json.dumps({
            "pledges": int(self.next_pledge),
            "promos": int(self.next_promo),
            "challenges": int(self.next_challenge),
            "total_credits": str(int(self.total_credits)),
            "rule": RULE_ID,
        })

    @gl.public.view
    def get_rule(self) -> str:
        return RULE_TEXT

    @gl.public.view
    def promo_window(self, promo_id: int) -> str:
        pr = self._promo(promo_id)
        if pr is None:
            raise _expected("unknown promo")
        start = int(pr.promo_start)
        from_ts = _unix_to_ts14(start - PRIOR_WINDOW)
        return json.dumps({
            "from_ts": from_ts,
            "to_ts": _unix_to_ts14(start),
            "wayback_calendar": f"{ARCHIVE_PREFIX}{from_ts}*/{pr.product_url}",
        })

    @gl.public.view
    def promo_status(self, promo_id: int) -> str:
        pr = self._promo(promo_id)
        if pr is None:
            raise _expected("unknown promo")
        return pr.status

    @gl.public.view
    def standing(self, merchant: str) -> str:
        addr = _parse_address(merchant)
        if addr is None:
            raise _expected("invalid merchant address")
        pledges = promos = debunked = rejected = not_found = bonded = 0
        mine: set[int] = set()
        for pid in range(int(self.next_pledge)):
            p = self.pledges[u256(pid)]
            if p.merchant == addr:
                mine.add(pid)
                pledges += 1
                if p.active:
                    bonded += int(p.bond) + int(p.reserved)
        for prid in range(int(self.next_promo)):
            pr = self.promos[u256(prid)]
            if int(pr.pledge_id) in mine:
                promos += 1
                debunked += 1 if pr.status == DEBUNKED else 0
        for cid in range(int(self.next_challenge)):
            c = self.challenges[u256(cid)]
            if int(self.promos[c.promo_id].pledge_id) in mine:
                rejected += 1 if c.status == REJECTED else 0
                not_found += 1 if c.status == EVIDENCE_NOT_FOUND else 0
        return json.dumps({
            "merchant": addr.as_hex,
            "pledges": pledges,
            "promos": promos,
            "debunked": debunked,
            "rejected": rejected,
            "evidence_not_found": not_found,
            "bonded_now": str(bonded),
        })
