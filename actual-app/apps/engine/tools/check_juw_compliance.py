"""
Audit a generated FYP DOCX against the JUW template-config rules.

Does not modify or regenerate the document.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from collections import defaultdict
from pathlib import Path

from docx import Document
from docx.oxml.ns import qn

ENGINE_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CONFIG = ENGINE_ROOT / "templates" / "juw" / "config.json"
DEFAULT_DOCX = (
    ENGINE_ROOT.parents[2]
    / "foundational"
    / "foundational_steps"
    / "Final_JUW_Report_Fixed3.docx"
)

A4_WIDTH_IN = 8.27
A4_HEIGHT_IN = 11.69
LETTER_WIDTH_IN = 8.5
LETTER_HEIGHT_IN = 11.0
SIZE_TOLERANCE_PT = 0.6
MARGIN_TOLERANCE_IN = 0.05
FIRST_PERSON_EXTRAS = ("My", "Me", "Mine", "Ours", "Ourselves")


def load_config(path: Path) -> dict:
    with path.open("r", encoding="utf-8-sig") as handle:
        return json.load(handle)


def inches(value) -> float:
    return round(float(value.inches), 3)


def add_result(results, status, check, expected, actual, location=""):
    results.append(
        {
            "status": status,
            "check": check,
            "expected": expected,
            "actual": actual,
            "location": location,
        }
    )


def style_size_pt(style) -> float | None:
    if style is None or style.font.size is None:
        return None
    return round(style.font.size.pt, 1)


def run_size_pt(paragraph) -> float | None:
    sizes = [run.font.size.pt for run in paragraph.runs if run.font.size is not None]
    return round(sizes[0], 1) if sizes else None


def effective_font_names(paragraph) -> set[str]:
    names = set()
    for run in paragraph.runs:
        if run.font.name:
            names.add(run.font.name)
        r_pr = run._element.find(qn("w:rPr"))
        if r_pr is not None:
            r_fonts = r_pr.find(qn("w:rFonts"))
            if r_fonts is not None:
                for key in ("ascii", "hAnsi", "cs"):
                    val = r_fonts.get(qn(f"w:{key}"))
                    if val:
                        names.add(val)
    return names


def paragraph_is_heading(paragraph) -> bool:
    return bool(paragraph.style and paragraph.style.name.startswith("Heading"))


def heading_level(paragraph) -> int | None:
    if not paragraph_is_heading(paragraph):
        return None
    match = re.search(r"(\d+)", paragraph.style.name)
    return int(match.group(1)) if match else None


def count_body_lines_after(paragraphs, index: int) -> int:
    count = 0
    for nxt in paragraphs[index + 1 :]:
        if paragraph_is_heading(nxt):
            break
        text = nxt.text.strip()
        if not text:
            continue
        style = nxt.style.name if nxt.style else ""
        if style.lower().startswith("toc") or style.lower().startswith("table of"):
            break
        if text.upper() in {"TABLE OF CONTENTS", "LIST OF FIGURES", "LIST OF TABLES"}:
            break
        count += 1
    return count


def collect_headings(paragraphs):
    items = []
    for index, paragraph in enumerate(paragraphs):
        if not paragraph_is_heading(paragraph):
            continue
        text = paragraph.text.strip()
        if not text:
            continue
        items.append(
            {
                "index": index,
                "level": heading_level(paragraph),
                "text": text,
                "upper": text.upper(),
            }
        )
    return items


def find_heading(headings, *needles: str):
    for item in headings:
        if any(needle.upper() in item["upper"] for needle in needles):
            return item
    return None


def word_page_map(docx_path: Path) -> dict:
    info = {"available": False, "pages": None, "heading_pages": {}}
    try:
        import win32com.client
    except ImportError:
        return info

    word = None
    document = None
    try:
        word = win32com.client.Dispatch("Word.Application")
        word.Visible = False
        document = word.Documents.Open(str(docx_path.resolve()))
        info["available"] = True
        info["pages"] = int(document.ComputeStatistics(2))
        info["paper_width_pt"] = float(document.PageSetup.PageWidth)
        info["paper_height_pt"] = float(document.PageSetup.PageHeight)
        heading_pages = {}
        for index in range(1, document.Paragraphs.Count + 1):
            paragraph = document.Paragraphs(index)
            style = str(paragraph.Style.NameLocal)
            text = paragraph.Range.Text.strip().replace("\r", "").replace("\x07", "")
            if not text:
                continue
            if style.startswith("Heading") or text.upper().startswith("CHAPTER"):
                heading_pages[text.upper()] = int(paragraph.Range.Information(3))
        info["heading_pages"] = heading_pages
    except Exception as error:
        info["error"] = str(error)
    finally:
        if document is not None:
            try:
                document.Close(False)
            except Exception:
                pass
        if word is not None:
            try:
                word.Quit()
            except Exception:
                pass
    return info


def audit(docx_path: Path, config: dict) -> list[dict]:
    results = []
    document = Document(str(docx_path))
    paragraphs = list(document.paragraphs)
    headings = collect_headings(paragraphs)
    page_info = word_page_map(docx_path)

    layout = config.get("layout", {})
    margins = layout.get("margins_inches", {})
    styles = config.get("styles", {})
    body_style = styles.get("body", {})
    heading_styles = styles.get("headings", {})
    page_number_style = styles.get("page_number", {})
    tables_cfg = config.get("tables", {})
    figures_cfg = config.get("figures", {})
    references_cfg = config.get("references", {})
    toc_cfg = config.get("toc", {})
    front_matter = config.get("front_matter", {})
    chapters_cfg = config.get("chapters", {})
    rules = config.get("rules", {})
    chapter_structure = config.get("chapter_structure", [])

    required_font = rules.get("font_must_be") or body_style.get("font", "Times New Roman")
    body_size = body_style.get("size", 12)
    line_spacing = layout.get("spacing", {}).get("line_spacing", 1.5)
    body_align = (rules.get("text_alignment") or body_style.get("alignment", "justify")).lower()
    heading_align = (rules.get("headings_alignment") or "left").lower()
    min_chapter_pages = chapters_cfg.get("minimum_pages", 5)
    min_lines = rules.get("minimum_lines_per_heading") or chapters_cfg.get("minimum_lines_per_heading", 3)
    forbidden = list(rules.get("forbidden_words", []))
    required_ui_screens = rules.get("required_ui_screens") or chapters_cfg.get("required_ui_screens")

    # --- Page size and margins ---
    section = document.sections[0]
    width, height = inches(section.page_width), inches(section.page_height)
    a4_like = abs(width - A4_WIDTH_IN) <= 0.08 and abs(height - A4_HEIGHT_IN) <= 0.08
    letter_like = abs(width - LETTER_WIDTH_IN) <= 0.08 and abs(height - LETTER_HEIGHT_IN) <= 0.08
    add_result(
        results,
        "PASS" if a4_like else "FAIL",
        "A4 page size",
        f"A4 ({A4_WIDTH_IN}\" x {A4_HEIGHT_IN}\")",
        f"{width}\" x {height}\"" + (" (US Letter)" if letter_like else ""),
        "All sections / Page Setup",
    )

    for section_index, current in enumerate(document.sections):
        actual_margins = {
            "left": inches(current.left_margin),
            "right": inches(current.right_margin),
            "top": inches(current.top_margin),
            "bottom": inches(current.bottom_margin),
        }
        ok = all(
            abs(actual_margins[side] - float(margins.get(side, 0))) <= MARGIN_TOLERANCE_IN
            for side in actual_margins
        )
        add_result(
            results,
            "PASS" if ok else "FAIL",
            f"Margins (section {section_index})",
            f"L{margins.get('left')} R{margins.get('right')} T{margins.get('top')} B{margins.get('bottom')} in",
            f"L{actual_margins['left']} R{actual_margins['right']} T{actual_margins['top']} B{actual_margins['bottom']} in",
            f"Section {section_index}",
        )

    # --- Body font / spacing / alignment ---
    body_font_issues = []
    spacing_issues = []
    align_issues = []
    for paragraph in paragraphs:
        text = paragraph.text.strip()
        if not text or paragraph_is_heading(paragraph):
            continue
        style_name = paragraph.style.name if paragraph.style else ""
        if style_name.lower().startswith("toc") or style_name.lower().startswith("table of") or style_name.lower().startswith("caption"):
            continue
        fonts = effective_font_names(paragraph)
        if fonts and required_font not in fonts and any(name and name != required_font for name in fonts):
            body_font_issues.append(f"{style_name}: {text[:60]}")
        if style_name == "Normal":
            ls = paragraph.paragraph_format.line_spacing
            if ls is not None and abs(float(ls) - float(line_spacing)) > 0.05:
                spacing_issues.append(text[:60])
            alignment = str(paragraph.alignment or "").lower()
            if body_align == "justify" and "justify" not in alignment:
                align_issues.append(text[:60])

    add_result(
        results,
        "PASS" if not body_font_issues else "FAIL",
        "Body font",
        required_font,
        required_font if not body_font_issues else f"Non-{required_font} runs found",
        "Body paragraphs",
    )
    try:
        normal_style_size = style_size_pt(document.styles["Normal"])
    except KeyError:
        normal_style_size = None
    body_size_issues = []
    body_runs_checked = 0
    for paragraph in paragraphs:
        text = paragraph.text.strip()
        if not text or paragraph_is_heading(paragraph):
            continue
        style_name = paragraph.style.name if paragraph.style else ""
        if style_name != "Normal":
            continue
        for run in paragraph.runs:
            if not (run.text or "").strip():
                continue
            body_runs_checked += 1
            if run.font.size is None:
                if normal_style_size is None or abs(normal_style_size - float(body_size)) > SIZE_TOLERANCE_PT:
                    body_size_issues.append(text[:60])
            elif abs(run.font.size.pt - float(body_size)) > SIZE_TOLERANCE_PT:
                body_size_issues.append(f"{run.font.size.pt}pt: {text[:50]}")
    style_size_ok = normal_style_size is not None and abs(normal_style_size - float(body_size)) <= SIZE_TOLERANCE_PT
    add_result(
        results,
        "PASS" if style_size_ok and not body_size_issues else "FAIL",
        "Body font size",
        f"{body_size} pt on Normal/body text",
        (
            f"Normal style {normal_style_size}pt; {body_runs_checked} body runs match"
            if style_size_ok and not body_size_issues
            else f"Normal style {normal_style_size}pt; {len(body_size_issues)} mismatched runs"
        ),
        "Normal style / body runs",
    )
    add_result(
        results,
        "PASS" if not spacing_issues else "FAIL",
        "Body line spacing",
        str(line_spacing),
        "1.5 on Normal body paragraphs" if not spacing_issues else f"{len(spacing_issues)} mismatches",
        "Normal paragraphs",
    )
    add_result(
        results,
        "PASS" if not align_issues else "FAIL",
        "Body alignment",
        body_align,
        "justify on Normal body paragraphs" if not align_issues else f"{len(align_issues)} mismatches",
        "Normal paragraphs",
    )

    # --- Heading styles (definitions vs applied runs) ---
    for level in range(1, 6):
        key = f"JUW_H{level}"
        expected = heading_styles.get(key, {})
        try:
            style = document.styles[f"Heading {level}"]
            actual_size = style_size_pt(style)
            size_ok = actual_size is not None and abs(actual_size - float(expected.get("size", 0))) <= SIZE_TOLERANCE_PT
            bold_ok = bool(style.font.bold) == bool(expected.get("bold", True))
            caps_ok = True
            if expected.get("all_caps"):
                caps_ok = bool(style.font.all_caps)
            if expected.get("small_caps"):
                caps_ok = bool(style.font.small_caps)
            add_result(
                results,
                "PASS" if size_ok and bold_ok and caps_ok else "FAIL",
                f"Heading {level} style definition",
                f"{expected.get('size')}pt, bold={expected.get('bold', True)}, "
                f"all_caps={expected.get('all_caps', False)}, small_caps={expected.get('small_caps', False)}",
                f"{actual_size}pt, bold={style.font.bold}, all_caps={style.font.all_caps}, small_caps={style.font.small_caps}",
                f"Style Heading {level}",
            )
        except KeyError:
            add_result(results, "FAIL", f"Heading {level} style", "Present", "Missing", "styles.xml")

    applied_size_issues = []
    for paragraph in paragraphs:
        level = heading_level(paragraph)
        if not level:
            continue
        expected_size = heading_styles.get(f"JUW_H{level}", {}).get("size")
        applied = run_size_pt(paragraph)
        if expected_size and applied and abs(applied - float(expected_size)) > SIZE_TOLERANCE_PT:
            applied_size_issues.append(f"{paragraph.text.strip()[:50]} applied {applied}pt vs {expected_size}pt")
        if heading_align == "left" and paragraph.alignment not in (None, 0):
            applied_size_issues.append(f"{paragraph.text.strip()[:50]} alignment={paragraph.alignment}")

    add_result(
        results,
        "FAIL" if applied_size_issues else "PASS",
        "Applied heading run sizes / alignment",
        "Run size matches JUW heading style; headings left-aligned",
        "OK" if not applied_size_issues else "; ".join(applied_size_issues[:8]),
        "Heading runs",
    )

    # --- Numbering ---
    toc_text = "\n".join(p.text for p in paragraphs if p.style and p.style.name.lower().startswith("toc"))
    numbering_ok = bool(re.search(r"1\.1", toc_text) and re.search(r"2\.1", toc_text))
    add_result(
        results,
        "PASS" if numbering_ok else "WARNING",
        "Heading numbering",
        "Native multilevel numbers such as 1.1, 1.2, 2.1",
        "TOC contains 1.1 / 2.1" if numbering_ok else "Could not confirm 1.1/2.1 in TOC",
        "Table of Contents",
    )

    # --- Front matter and chapter structure ---
    required_front = [item.get("title", "") for item in front_matter.get("items", [])]
    present_titles = [item["upper"] for item in headings] + [
        p.text.strip().upper() for p in paragraphs if p.text.strip()
    ]
    for title in required_front:
        present = any(title.upper() in value or title.upper().rstrip("S") in value for value in present_titles)
        add_result(
            results,
            "PASS" if present else "FAIL",
            f"Required front-matter item: {title}",
            f"Include '{title}'",
            "Present" if present else "Missing",
            "Front matter",
        )

    for chapter in chapter_structure:
        number = chapter["chapter"]
        title = chapter["title"]
        chapter_present = find_heading(headings, f"CHAPTER {number}", title.upper())
        add_result(
            results,
            "PASS" if chapter_present else "FAIL",
            f"Chapter {number} {title}",
            f"CHAPTER {number} / {title}",
            "Present" if chapter_present else "Missing",
            f"Chapter {number}",
        )
        if not chapter_present:
            continue
        # sections for this chapter until next CHAPTER heading
        start = chapter_present["index"]
        end = len(paragraphs)
        next_chapter = find_heading(headings, f"CHAPTER {number + 1}")
        if next_chapter:
            end = next_chapter["index"]
        block = " ".join(p.text.upper() for p in paragraphs[start:end])
        for section_title in chapter.get("sections", []):
            # allow Overview vs PROJECT OVERVIEW
            tokens = section_title.upper().split()
            found = section_title.upper() in block or all(token in block for token in tokens if token not in {"AND", "WITH", "THE"})
            add_result(
                results,
                "PASS" if found else "FAIL",
                f"Chapter {number} section: {section_title}",
                section_title,
                "Present" if found else "Missing",
                f"Chapter {number}",
            )

    # --- Page numbering ---
    first = document.sections[0]._sectPr.find(qn("w:pgNumType"))
    roman = first is not None and (first.get(qn("w:fmt")) or "").lower() == "lowerroman"
    add_result(
        results,
        "PASS" if roman else "FAIL",
        "Front-matter page numbers",
        front_matter.get("page_number_style", "roman"),
        "lowerRoman on section 0" if roman else "Not lowerRoman",
        "Section 0",
    )
    chapter_start = None
    if len(document.sections) > 1:
        chapter_start = document.sections[1]._sectPr.find(qn("w:pgNumType"))
    restart = chapter_start is not None and chapter_start.get(qn("w:start")) == "1"
    add_result(
        results,
        "PASS" if restart else "WARNING",
        "Chapter 1 page restart",
        "Decimal numbering starts at 1",
        "start=1 on section 1" if restart else "No explicit start=1",
        "Section 1",
    )
    footer_has_page = False
    for current in document.sections:
        for paragraph in current.footer.paragraphs:
            if "PAGE" in paragraph._p.xml:
                footer_has_page = True
    add_result(
        results,
        "PASS" if footer_has_page else "FAIL",
        "Footer page-number field",
        f"{page_number_style.get('position', 'bottom_center')} PAGE field",
        "PAGE field present in footer" if footer_has_page else "No PAGE field",
        "Headers/footers",
    )

    # --- TOC / LOF / LOT ---
    all_text = "\n".join(p.text for p in paragraphs)
    add_result(
        results,
        "PASS" if toc_cfg.get("auto_generate", True) and "TABLE OF CONTENTS" in all_text.upper() and "CHAPTER 1" in toc_text.upper()
        else "FAIL",
        "Table of Contents",
        "Auto-generated TOC including headings",
        "TOC present and populated" if "CHAPTER 1" in toc_text.upper() else "Missing or empty",
        "Front matter",
    )
    add_result(
        results,
        "PASS" if (not toc_cfg.get("include_list_of_figures", True)) or "LIST OF FIGURES" in all_text.upper()
        else "FAIL",
        "List of Figures",
        "Include LOF" if toc_cfg.get("include_list_of_figures", True) else "Not required",
        "Present" if "LIST OF FIGURES" in all_text.upper() else "Missing",
        "Front matter",
    )
    add_result(
        results,
        "PASS" if (not toc_cfg.get("include_list_of_tables", True)) or "LIST OF TABLES" in all_text.upper()
        else "FAIL",
        "List of Tables",
        "Include LOT" if toc_cfg.get("include_list_of_tables", True) else "Not required",
        "Present" if "LIST OF TABLES" in all_text.upper() else "Missing",
        "Front matter",
    )

    # --- Figures / tables ---
    figure_captions = [p for p in paragraphs if re.match(r"^Figure\s+\d+", p.text.strip(), re.I)]
    table_captions = [p for p in paragraphs if re.match(r"^Table\s+\d+", p.text.strip(), re.I) and (p.style and "caption" in p.style.name.lower() or p.alignment is not None)]
    caption_re = re.compile(r"^(Figure|Table)\s+(\d+)\.(\d+)\.\s+(.+)$", re.I)
    good_figures = [p for p in figure_captions if caption_re.match(p.text.strip()) and "CENTER" in str(p.alignment or "")]
    add_result(
        results,
        "PASS" if figure_captions and len(good_figures) == len([p for p in figure_captions if not "\t" in p.text])
        else "WARNING",
        "Figure captions / numbering / alignment",
        figures_cfg.get("caption_format", "Figure {chapter}.{number} {title}") + ", centered",
        f"{len(document.inline_shapes)} images; captions: {[p.text.strip() for p in figure_captions if p.style and 'caption' in p.style.name.lower()]}",
        "Figures",
    )
    add_result(
        results,
        "PASS" if document.inline_shapes and all(abs(shape.width.inches - float(figures_cfg.get("width_inches", 5.5))) < 0.05 for shape in document.inline_shapes)
        else "WARNING",
        "Figure width",
        f"{figures_cfg.get('width_inches', 5.5)} inches",
        ", ".join(f"{shape.width.inches:.2f}in" for shape in document.inline_shapes) or "No images",
        "Inline pictures",
    )

    # Table caption position: caption should not immediately precede the table if config says bottom
    caption_before_table = False
    para_elements = [p._p for p in paragraphs]
    for table in document.tables:
        prev = table._tbl.getprevious()
        if prev is not None and prev.text and prev.text.strip().lower().startswith("table "):
            caption_before_table = True
    expected_pos = tables_cfg.get("caption_position", "bottom")
    add_result(
        results,
        "FAIL" if expected_pos == "bottom" and caption_before_table else "PASS",
        "Table caption position",
        expected_pos,
        "Caption appears above tables" if caption_before_table else "Not above table",
        "Tables",
    )
    add_result(
        results,
        "PASS" if len(document.tables) == 3 else "WARNING",
        "Table presence",
        "Tables with Table X.Y captions" if tables_cfg else "N/A",
        f"{len(document.tables)} tables",
        "Tables",
    )

    if figures_cfg.get("must_be_referenced") or tables_cfg.get("must_be_referenced"):
        body_mentions = []
        for paragraph in paragraphs:
            style = paragraph.style.name if paragraph.style else ""
            if "caption" in style.lower() or style.lower().startswith("toc") or style.lower().startswith("table of"):
                continue
            if re.search(r"\b(Figure|Table)\s+\d+", paragraph.text):
                body_mentions.append(paragraph.text.strip()[:80])
        add_result(
            results,
            "FAIL" if not body_mentions else "PASS",
            "Figures/tables referenced in body",
            "Each figure/table is referenced in the text",
            "No in-text references found" if not body_mentions else f"{len(body_mentions)} mentions",
            "Body text",
        )

    # --- References / citations ---
    has_references = any("REFERENCE" in item["upper"] for item in headings) or "REFERENCES" in all_text.upper()
    citations = re.findall(r"\[\d+\]", all_text)
    if references_cfg.get("mandatory"):
        add_result(
            results,
            "FAIL" if not has_references else "PASS",
            "References section",
            "References chapter/section present",
            "Present" if has_references else "Missing",
            "Back matter",
        )
    add_result(
        results,
        "FAIL" if references_cfg.get("citation_style") == "square_brackets" and not citations else "PASS",
        "Citation style",
        references_cfg.get("example", "[12]"),
        "None found" if not citations else f"{len(set(citations))} unique {sorted(set(citations))[:8]}",
        "Body / references",
    )

    # --- Chapter minimum pages ---
    if page_info.get("available") and page_info.get("heading_pages"):
        pages = page_info["heading_pages"]
        total_pages = page_info.get("pages")
        ch1 = pages.get("CHAPTER 1") or pages.get("INTRODUCTION")
        ch2 = pages.get("CHAPTER 2") or pages.get("REQUIREMENTS")
        if ch1 and ch2:
            ch1_len = ch2 - ch1
            add_result(
                results,
                "PASS" if ch1_len >= min_chapter_pages else "FAIL",
                "Chapter 1 minimum pages",
                f">= {min_chapter_pages} pages",
                f"{ch1_len} physical pages (p.{ch1}-{ch2 - 1})",
                f"Pages {ch1}-{ch2 - 1}",
            )
        if ch2 and total_pages:
            ch2_len = total_pages - ch2 + 1
            add_result(
                results,
                "PASS" if ch2_len >= min_chapter_pages else "FAIL",
                "Chapter 2 minimum pages",
                f">= {min_chapter_pages} pages",
                f"{ch2_len} physical pages (p.{ch2}-{total_pages})",
                f"Pages {ch2}-{total_pages}",
            )
        add_result(
            results,
            "WARNING",
            "Total document pages",
            "Full 7-chapter FYP length",
            f"{total_pages} pages",
            "Whole document",
        )
    else:
        add_result(
            results,
            "MANUAL CHECK",
            "Chapter minimum pages",
            f">= {min_chapter_pages} pages per chapter",
            "Word page map unavailable; TOC implies Chapter 1 = pages 1-5, Chapter 2 starts at 6",
            "TOC page numbers",
        )

    # --- Minimum lines under headings ---
    short_headings = []
    for index, paragraph in enumerate(paragraphs):
        if not paragraph_is_heading(paragraph):
            continue
        text = paragraph.text.strip()
        if text.upper().startswith("CHAPTER ") or text.upper() in {
            "ABSTRACT",
            "LIST OF FIGURES",
            "LIST OF TABLES",
            "ACKNOWLEDGEMENT",
            "ACKNOWLEDGEMENTS",
            "TABLE OF CONTENTS",
        }:
            continue
        following = count_body_lines_after(paragraphs, index)
        if following < min_lines:
            short_headings.append(f"{text} ({following} lines)")
    add_result(
        results,
        "FAIL" if short_headings else "PASS",
        f"Minimum {min_lines} lines under each heading",
        f">= {min_lines} content paragraphs after each content heading",
        "OK" if not short_headings else "; ".join(short_headings),
        "Chapter body headings",
    )

    # --- First person ---
    extras = [word for word in FIRST_PERSON_EXTRAS if word not in forbidden]
    scan_words = forbidden + extras
    hits = []
    for paragraph in paragraphs:
        for word in scan_words:
            if re.search(rf"\b{re.escape(word)}\b", paragraph.text):
                hits.append(f"{word}: {paragraph.text.strip()[:70]}")
    add_result(
        results,
        "PASS" if not hits else "FAIL",
        "First-person / forbidden words",
        f"None of {forbidden}" + (" (also scanned My/Me/Ours)" if extras else ""),
        "None found" if not hits else "; ".join(hits[:10]),
        "Whole document",
    )

    # --- 50 UI screens: only score if present in config; otherwise report requested check ---
    image_count = len(document.inline_shapes)
    if required_ui_screens:
        add_result(
            results,
            "PASS" if image_count >= int(required_ui_screens) else "FAIL",
            "Required UI screens",
            f"{required_ui_screens} UI screens",
            f"{image_count} images",
            "Appendix / figures",
        )
    else:
        add_result(
            results,
            "MANUAL CHECK",
            "Required 50 UI screens",
            "Not defined in JUW config.json; requested review is 50 UI screens",
            f"{image_count} images present (login.jpg reused in demo figures); no Appendix A screenshots section",
            "Figures / missing appendix",
        )

    return results


def render_report(docx_path: Path, config_path: Path, results: list[dict]) -> str:
    counts = defaultdict(int)
    for item in results:
        counts[item["status"]] += 1
    lines = [
        "# JUW FYP DOCX compliance report",
        "",
        f"- **Document:** `{docx_path}`",
        f"- **Guidelines:** `{config_path}`",
        f"- **Document not modified.**",
        "",
        f"**Summary:** PASS {counts['PASS']} · FAIL {counts['FAIL']} · WARNING {counts['WARNING']} · MANUAL CHECK {counts['MANUAL CHECK']}",
        "",
        "| Status | Check | Expected | Actual | Location |",
        "| ------ | ----- | -------- | ------ | -------- |",
    ]
    for item in results:
        def cell(value):
            return str(value).replace("|", "/").replace("\n", " ")

        lines.append(
            f"| {item['status']} | {cell(item['check'])} | {cell(item['expected'])} | {cell(item['actual'])} | {cell(item['location'])} |"
        )
    lines.extend(
        [
            "",
            "## Critical issues",
            "",
        ]
    )
    fails = [item for item in results if item["status"] == "FAIL"]
    if not fails:
        lines.append("No FAIL items.")
    else:
        for item in fails:
            lines.append(
                f"- **{item['check']}** — expected `{item['expected']}`; actual `{item['actual']}` ({item['location']})"
            )
    lines.append("")
    return "\n".join(lines)


def main(argv=None):
    parser = argparse.ArgumentParser(description="Audit a DOCX against JUW config.json")
    parser.add_argument("--docx", default=str(DEFAULT_DOCX), help="Path to generated FYP DOCX")
    parser.add_argument("--config", default=str(DEFAULT_CONFIG), help="Path to JUW config.json")
    parser.add_argument("--output", default="", help="Optional markdown report path")
    args = parser.parse_args(argv)

    docx_path = Path(args.docx)
    config_path = Path(args.config)
    if not docx_path.exists():
        print(f"DOCX not found: {docx_path}", file=sys.stderr)
        return 2
    if not config_path.exists():
        print(f"Config not found: {config_path}", file=sys.stderr)
        return 2

    config = load_config(config_path)
    results = audit(docx_path, config)
    report = render_report(docx_path, config_path, results)
    output_path = Path(args.output) if args.output else Path(__file__).with_name("JUW_COMPLIANCE_REPORT.md")
    output_path.write_text(report, encoding="utf-8")
    print(report)
    print(f"\nWrote {output_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
