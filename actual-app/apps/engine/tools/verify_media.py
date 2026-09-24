"""Programmatic checks for the isolated tables/figures test DOCX."""

from __future__ import annotations

import json
import sys
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn

DOCX_PATH = Path(__file__).with_name("generated_media_test.docx")


def text_of(element) -> str:
    if element is None:
        return ""
    return "".join(node.text or "" for node in element.iter(qn("w:t")))


def paragraph_alignment(paragraph) -> str:
    alignment = paragraph.alignment
    if alignment == WD_ALIGN_PARAGRAPH.CENTER:
        return "center"
    p_pr = paragraph._p.find(qn("w:pPr"))
    if p_pr is not None:
        jc = p_pr.find(qn("w:jc"))
        if jc is not None and jc.get(qn("w:val")) == "center":
            return "center"
    return str(alignment)


def table_is_centered(table) -> bool:
    tbl_pr = table._tbl.tblPr
    if tbl_pr is None:
        return False
    jc = tbl_pr.find(qn("w:jc"))
    return jc is not None and jc.get(qn("w:val")) == "center"


def caption_after(element, prefix: str) -> str:
    nxt = element.getnext()
    while nxt is not None:
        if nxt.tag == qn("w:p"):
            text = text_of(nxt).strip()
            if text:
                return text
        nxt = nxt.getnext()
    return ""


def inspect(path: Path) -> dict:
    document = Document(str(path))
    texts = [p.text.strip() for p in document.paragraphs if p.text.strip()]
    joined = "\n".join(texts)

    data_tables = []
    for table in document.tables:
        header = [cell.text.strip() for cell in table.rows[0].cells]
        if header == ["Field", "Details"]:
            continue
        after = caption_after(table._tbl, "Table")
        data_tables.append(
            {
                "header": header,
                "centered": table_is_centered(table),
                "caption_after": after,
                "caption_below": after.lower().startswith("table "),
            }
        )

    figures = []
    body_children = list(document.element.body.iterchildren())
    for index, child in enumerate(body_children):
        if child.tag != qn("w:p"):
            continue
        if "w:drawing" not in child.xml and "a:blip" not in child.xml:
            continue
        caption = ""
        centered = False
        for nxt in body_children[index + 1 :]:
            if nxt.tag != qn("w:p"):
                continue
            caption = text_of(nxt).strip()
            if caption:
                para = None
                for paragraph in document.paragraphs:
                    if paragraph._p is nxt:
                        para = paragraph
                        break
                centered = paragraph_alignment(para) == "center" if para is not None else False
                break
        image_para = None
        for paragraph in document.paragraphs:
            if paragraph._p is child:
                image_para = paragraph
                break
        figures.append(
            {
                "image_centered": paragraph_alignment(image_para) == "center" if image_para else False,
                "caption": caption,
                "caption_below": caption.lower().startswith("figure "),
                "caption_centered": centered,
            }
        )

    has_lof_heading = any("LIST OF FIGURES" in text.upper() for text in texts)
    has_lot_heading = any("LIST OF TABLES" in text.upper() for text in texts)
    lof_field = any('c "Figure"' in paragraph._p.xml for paragraph in document.paragraphs)
    lot_field = any('c "Table"' in paragraph._p.xml for paragraph in document.paragraphs)

    lof_has_fig_11 = "Figure 1.1" in joined
    lof_has_fig_21 = "Figure 2.1" in joined
    lot_has_table_11 = "Table 1.1" in joined

    table_caption = data_tables[0]["caption_after"] if data_tables else ""
    figure_captions = [item["caption"] for item in figures]

    checks = {
        "one_content_table": len(data_tables) == 1,
        "table_centered": bool(data_tables) and all(item["centered"] for item in data_tables),
        "table_caption_below": bool(data_tables) and all(item["caption_below"] for item in data_tables),
        "table_number_1_1": "Table 1.1" in table_caption,
        "table_caption_text": "Sample comparison table" in table_caption,
        "two_figures": len(figures) == 2,
        "figures_centered": bool(figures) and all(item["image_centered"] for item in figures),
        "figure_captions_below": bool(figures) and all(item["caption_below"] for item in figures),
        "figure_captions_centered": bool(figures) and all(item["caption_centered"] for item in figures),
        "figure_number_1_1": any("Figure 1.1" in text for text in figure_captions),
        "figure_number_2_1": any("Figure 2.1" in text for text in figure_captions),
        "figure_caption_texts": any("Login screen" in text for text in figure_captions)
        and any("Architecture overview" in text for text in figure_captions),
        "student_did_not_type_numbers": "Table 1.1" not in "Sample comparison table"
        and "Figure 1.1" not in "Login screen",
        "lof_heading_and_field": has_lof_heading and lof_field,
        "lot_heading_and_field": has_lot_heading and lot_field,
        "lof_entries": lof_has_fig_11 and lof_has_fig_21,
        "lot_entries": lot_has_table_11,
    }

    verdict = {name: "PASS" if ok else "FAIL" for name, ok in checks.items()}
    return {
        "docx": str(path),
        "verdict": verdict,
        "passed": all(checks.values()),
        "tables": data_tables,
        "figures": figures,
        "lof_heading": has_lof_heading,
        "lot_heading": has_lot_heading,
        "lof_field": lof_field,
        "lot_field": lot_field,
    }


def main() -> int:
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else DOCX_PATH
    if not path.exists():
        print(json.dumps({"ok": False, "error": f"DOCX not found: {path}"}))
        return 2
    result = inspect(path)
    print(json.dumps(result, indent=2))
    return 0 if result["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
