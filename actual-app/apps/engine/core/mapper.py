import base64
import re
import tempfile
from pathlib import Path

CHAPTER_TITLE_RE = re.compile(
    r"^CHAPTER\s+(\d+)\s*(?:[-–—:]\s*(.*))?$",
    re.IGNORECASE,
)
CHAPTER_ID_RE = re.compile(r"^ch(\d+)$", re.IGNORECASE)
# Strip legacy numbers baked into titles (Word multilevel also supplies them).
HEADING_NUMBER_PREFIX_RE = re.compile(r"^\d+(?:\.\d+)*\.?\s+")

FRONT_MATTER_BY_ID = {
    "approval": "approval",
    "paf": "approval",
    "abstract": "abstract",
    "lof": "list_of_figures",
    "lot": "list_of_tables",
    "ack": "acknowledgement",
}

FRONT_MATTER_BY_TITLE = {
    "project approval form": "approval",
    "abstract": "abstract",
    "list of figures": "list_of_figures",
    "list of tables": "list_of_tables",
    "acknowledgement": "acknowledgement",
    "acknowledgements": "acknowledgement",
    "table of contents": "table_of_contents",
}

SKIP_ROLES = {
    "approval",
    "abstract",
    "list_of_figures",
    "list_of_tables",
    "acknowledgement",
    "table_of_contents",
}


def render_project(builder, payload: dict):
    """Map editor structure + contentMap onto the DOCX builder."""
    structure = payload.get("structure") or []
    content_map = payload.get("contentMap") or {}
    meta = _project_meta(payload)

    roles = _index_front_matter(structure)

    builder.add_title_page(meta)
    builder.add_second_cover_page(meta)
    builder.add_approval_form(meta)
    builder.add_front_matter_page(
        "Abstract",
        _content_for(roles.get("abstract"), content_map),
    )
    builder.add_table_of_contents()
    builder.add_list_of_figures()
    builder.add_list_of_tables()
    builder.add_front_matter_page(
        "Acknowledgement",
        _content_for(roles.get("acknowledgement"), content_map),
        page_break_before=True,
    )

    for item in structure:
        role = _classify(item)
        if role in SKIP_ROLES:
            continue
        _render_body_item(builder, item, content_map)


def _project_meta(payload: dict) -> dict:
    """Normalize title/approval metadata from the generate payload."""
    nested = payload.get("meta") if isinstance(payload.get("meta"), dict) else {}
    meta = dict(nested)

    # Flat payload fields win over nested defaults only when present.
    for key in (
        "projectTitle",
        "title",
        "university",
        "universityName",
        "department",
        "faculty",
        "city",
        "degree",
        "supervisor",
        "projectAdvisor",
        "submissionMonthYear",
        "submissionDate",
        "approvalDate",
        "internalExaminer",
        "externalExaminer",
        "headOfDepartment",
        "logoPath",
        "logoDataUrl",
        "universityLogo",
        "internalExaminerDesignation",
        "externalExaminerDesignation",
        "externalExaminerOrganization",
        "students",
        "teamMembers",
    ):
        if key in payload and payload[key] not in (None, ""):
            meta[key] = payload[key]

    # Keep logo fields from nested meta even when empty-string checks would skip them.
    nested = payload.get("meta") if isinstance(payload.get("meta"), dict) else {}
    for key in ("logoPath", "logoDataUrl", "universityLogo"):
        if key in nested and nested[key]:
            meta[key] = nested[key]

    if not meta.get("projectTitle") and meta.get("title"):
        meta["projectTitle"] = meta["title"]
    if not meta.get("projectTitle") and payload.get("title"):
        meta["projectTitle"] = payload["title"]
    if not meta.get("university") and payload.get("university"):
        meta["university"] = payload["university"]
    if not meta.get("supervisor") and meta.get("projectAdvisor"):
        meta["supervisor"] = meta["projectAdvisor"]
    if not meta.get("students") and meta.get("teamMembers"):
        meta["students"] = meta["teamMembers"]
    return meta


def _index_front_matter(structure):
    roles = {}
    for item in structure:
        role = _classify(item)
        if role in {
            "abstract",
            "list_of_figures",
            "list_of_tables",
            "acknowledgement",
            "table_of_contents",
        }:
            roles[role] = item
    return roles


def _classify(item):
    item_id = str(item.get("id") or "").strip().lower()
    title = str(item.get("title") or "").strip().lower()
    if item_id in FRONT_MATTER_BY_ID:
        return FRONT_MATTER_BY_ID[item_id]
    if title in FRONT_MATTER_BY_TITLE:
        return FRONT_MATTER_BY_TITLE[title]
    if _parse_chapter(item):
        return "chapter"
    return "section"


def _parse_chapter(item):
    title = str(item.get("title") or "").strip()
    match = CHAPTER_TITLE_RE.match(title)
    if match:
        number = int(match.group(1))
        remainder = (match.group(2) or "").strip()
        return number, remainder or title

    item_id = str(item.get("id") or "").strip()
    id_match = CHAPTER_ID_RE.match(item_id)
    if id_match:
        return int(id_match.group(1)), title or f"Chapter {id_match.group(1)}"
    return None


def _render_body_item(builder, item, content_map):
    chapter = _parse_chapter(item)
    blocks = item.get("blocks")
    has_blocks = isinstance(blocks, list) and len(blocks) > 0

    if chapter:
        number, title = chapter
        builder.start_chapter(number, title)
        if has_blocks:
            _render_section_body(builder, item, content_map, heading_level=1)
            for child in item.get("subitems") or []:
                _render_heading_tree(builder, child, content_map, level=2)
        else:
            # Legacy chapter order: body paragraphs, then all subheadings,
            # then chapter-level lists/tables/figures.
            builder.add_paragraphs(_content_for(item, content_map), level=1)
            for child in item.get("subitems") or []:
                _render_heading_tree(builder, child, content_map, level=2)
            _render_lists(builder, item.get("lists"), heading_level=1)
            _render_tables(builder, item.get("tables"))
            _render_figures(builder, item.get("figures"))
        return

    builder.start_unnumbered_section(str(item.get("title") or "Section"))
    if has_blocks:
        _render_section_body(builder, item, content_map, heading_level=1)
        for child in item.get("subitems") or []:
            _render_heading_tree(builder, child, content_map, level=2)
    else:
        builder.add_paragraphs(_content_for(item, content_map), level=1)
        for child in item.get("subitems") or []:
            _render_heading_tree(builder, child, content_map, level=2)
        _render_lists(builder, item.get("lists"), heading_level=1)
        _render_tables(builder, item.get("tables"))
        _render_figures(builder, item.get("figures"))


def _render_heading_tree(builder, item, content_map, level):
    heading_level = min(max(level, 2), 5)
    # Title only — Word numId 999 renders 1.1 / 1.2.1 once for TOC + body.
    builder.add_heading(_clean_heading_title(item), heading_level)
    _render_section_body(builder, item, content_map, heading_level=heading_level)
    for child in item.get("subitems") or []:
        _render_heading_tree(builder, child, content_map, heading_level + 1)


def _clean_heading_title(item):
    """Return heading text without a leading outline number."""
    title = str(item.get("title") or "Section").strip()
    cleaned = HEADING_NUMBER_PREFIX_RE.sub("", title).strip()
    return cleaned or title


def _render_section_body(builder, item, content_map, heading_level):
    """Render mixed content in explicit block order when available."""
    blocks = item.get("blocks")
    if isinstance(blocks, list) and blocks:
        for block in blocks:
            if not isinstance(block, dict):
                continue
            block_type = str(block.get("type") or "").strip().lower()
            if block_type == "paragraph":
                builder.add_paragraphs(str(block.get("text") or ""), level=heading_level)
            elif block_type == "list":
                list_type = block.get("listType") or block.get("kind") or "bullet"
                _render_lists(
                    builder,
                    [{"type": list_type, "items": block.get("items") or []}],
                    heading_level=heading_level,
                )
            elif block_type == "table":
                _render_tables(builder, [block])
            elif block_type == "figure":
                _render_figures(builder, [block])
        return

    # Legacy path: paragraphs then lists/tables/figures.
    builder.add_paragraphs(_content_for(item, content_map), level=heading_level)
    _render_lists(builder, item.get("lists"), heading_level=heading_level)
    _render_tables(builder, item.get("tables"))
    _render_figures(builder, item.get("figures"))


def _content_for(item, content_map):
    if not item:
        return ""
    return content_map.get(item.get("id"), "") or ""


def _render_tables(builder, tables):
    for table in tables or []:
        columns, data = _normalize_table(table)
        if not columns:
            continue
        builder.add_custom_table(
            data,
            columns,
            caption=_clean_caption(table.get("caption") or table.get("title") or "", "table"),
            with_caption=True,
        )


def _normalize_table_cell(value):
    """Accept plain strings or rich cell objects from the editor."""
    if isinstance(value, dict):
        align = value.get("align")
        if align not in {"left", "center", "right"}:
            align = None
        colspan = int(value.get("colspan") or 1)
        rowspan = int(value.get("rowspan") or 1)
        bold = value.get("bold")
        if bold is None:
            bold_value = None
        else:
            bold_value = bool(bold)
        return {
            "text": str(value.get("text") or ""),
            "background": str(value.get("background") or "").lstrip("#") or None,
            "textColor": str(value.get("textColor") or value.get("text_color") or "").lstrip("#")
            or None,
            "bold": bold_value,
            "align": align,
            "colspan": colspan if colspan > 1 else None,
            "rowspan": rowspan if rowspan > 1 else None,
            "hidden": bool(value.get("hidden")) or None,
        }
    return {"text": str(value or "")}


def _normalize_table(table):
    columns = [_normalize_table_cell(cell) for cell in (table.get("columns") or [])]
    data = [
        [_normalize_table_cell(cell) for cell in row]
        for row in (table.get("data") or [])
    ]
    rows = table.get("rows")
    if (not columns) and rows:
        columns = [_normalize_table_cell(cell) for cell in (rows[0] or [])]
        data = [[_normalize_table_cell(cell) for cell in row] for row in rows[1:]]
    return columns, data


def _clean_caption(text, kind):
    cleaned = str(text or "").strip()
    # Strip only generator-assigned numbers such as "Table 3.1." / "Figure 1.2."
    # Do not wipe student text like "Table 01".
    cleaned = re.sub(rf"^{kind}\s+\d+\.\d+\.?\s*", "", cleaned, flags=re.I)
    return cleaned


def _render_lists(builder, lists, heading_level=2):
    for block in lists or []:
        items = _normalize_list_items(block)
        if not items:
            continue
        builder.add_body_list(
            items,
            kind=str(block.get("type") or "bullet"),
            heading_level=heading_level,
        )


def _normalize_list_items(block):
    default_level = int(block.get("level") or 1)
    normalized = []
    for item in block.get("items") or []:
        if isinstance(item, dict):
            text = str(item.get("text") or item.get("title") or "").strip()
            level = int(item.get("level") or default_level)
        else:
            text = str(item).strip()
            level = default_level
        if text:
            normalized.append((text, level))
    return normalized


def _render_figures(builder, figures):
    for figure in figures or []:
        path = _resolve_figure_path(figure)
        if not path:
            continue
        width_percent = figure.get("widthPercent")
        if width_percent is None:
            width_percent = figure.get("width_percent")
        align = figure.get("align") or figure.get("alignment")
        builder.add_figure(
            path,
            _clean_caption(figure.get("caption") or figure.get("title") or "", "figure"),
            width_percent=width_percent,
            alignment=align,
        )


def _resolve_figure_path(figure):
    path = figure.get("path") or figure.get("image") or figure.get("src")
    if path and Path(str(path)).exists():
        return str(path)

    data = figure.get("dataUrl") or figure.get("data") or ""
    if not str(data).strip():
        return None

    payload = str(data)
    header, separator, encoded = payload.partition(",")
    raw = encoded if separator else payload
    try:
        binary = base64.b64decode(raw)
    except Exception:
        return None

    extension = "png"
    lowered = header.lower()
    if "jpeg" in lowered or "jpg" in lowered:
        extension = "jpg"
    elif "gif" in lowered:
        extension = "gif"
    elif "webp" in lowered:
        extension = "webp"

    handle = tempfile.NamedTemporaryFile(delete=False, suffix=f".{extension}")
    handle.write(binary)
    handle.close()
    return handle.name
