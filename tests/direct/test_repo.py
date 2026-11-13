"""Repository hygiene: pinned runner, ignored secrets, LF demo pages."""

import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
RUNNER = '# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }'


def test_contract_line_1_is_the_pinned_runner():
    first = (ROOT / "contracts" / "was_price.py").read_text(encoding="utf-8").splitlines()[0]
    assert first == RUNNER


def test_secrets_and_local_notes_are_ignored():
    lines = (ROOT / ".gitignore").read_text(encoding="utf-8").splitlines()
    for entry in ("SPEC.md", ".env", ".env.*", "!.env.example", ".claude/settings.local.json"):
        assert entry in lines, entry


def test_env_example_holds_no_key():
    text = (ROOT / ".env.example").read_text(encoding="utf-8")
    assert "GENLAYER_NETWORK=studionet" in text
    assert "WASPRICE_CONTRACT=" in text
    settings = [line.split("=")[0] for line in text.splitlines() if line and not line.startswith("#")]
    assert settings == ["GENLAYER_NETWORK", "WASPRICE_CONTRACT"]


def test_line_endings_and_images_are_pinned():
    text = (ROOT / ".gitattributes").read_text(encoding="utf-8")
    assert "* text=auto eol=lf" in text
    assert "*.png binary" in text
