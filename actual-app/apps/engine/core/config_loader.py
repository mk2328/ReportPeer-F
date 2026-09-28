import json
from pathlib import Path

ENGINE_ROOT = Path(__file__).resolve().parent.parent


def normalize_university(university: str | None) -> str:
    if not university:
        return "juw"
    key = university.strip().lower()
    aliases = {
        "juw": "juw",
        "jinnah university for women": "juw",
        "jinnah university for women (juw)": "juw",
    }
    return aliases.get(key, "juw")


def load_university_bundle(university: str | None) -> tuple[dict, Path]:
    """
    Load university pack formatting config + Word template.
    Pack layout: templates/<slug>/{config.json, template.docx, pack_manifest.json}.
    Phase 1 ships JUW only; unknown keys fall back to JUW.
    """
    slug = normalize_university(university)
    template_dir = ENGINE_ROOT / "templates" / slug

    config_path = template_dir / "config.json"
    if not config_path.exists():
        raise FileNotFoundError(f"University config not found: {config_path}")

    with config_path.open("r", encoding="utf-8") as handle:
        config = json.load(handle)

    template_path = template_dir / "template.docx"
    if not template_path.exists():
        template_path = ENGINE_ROOT / "template.docx"
    if not template_path.exists():
        raise FileNotFoundError("No template.docx found for report generation.")

    return config, template_path


def resolve_university_pack(university: str | None) -> tuple[dict, Path]:
    """
    University-agnostic pack resolver (alias of load_university_bundle).
    Core generation should call this so future packs (NED/IBA/…) plug in
    without changing mapper/document logic.
    """
    return load_university_bundle(university)
