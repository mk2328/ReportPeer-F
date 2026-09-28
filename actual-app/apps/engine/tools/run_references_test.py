"""Generate a DOCX with inline citations + References section and verify both."""

from __future__ import annotations

import json
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
TOOLS = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from generate import generate_report

OUTPUT = TOOLS / "generated_references_test.docx"
PDF = TOOLS / "generated_references_test.pdf"
NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}

R1 = "ref-book-1"
R2 = "ref-journal-2"
R3 = "ref-web-3"
R4 = "ref-unused-4"


def build_payload(*, with_references_heading: bool = True, with_citations: bool = True) -> dict:
    def cite(ref_id: str) -> str:
        return f"[[ref:{ref_id}]]" if with_citations else ""

    return {
        "title": "Reference Management Verification",
        "university": "JUW",
        "structure": [
            {"id": "abstract", "title": "Abstract", "level": 1},
            {"id": "lof", "title": "List of Figures", "level": 1},
            {"id": "lot", "title": "List of Tables", "level": 1},
            {"id": "ack", "title": "Acknowledgement", "level": 1},
            {
                "id": "ch1",
                "title": "INTRODUCTION",
                "level": 1,
                "number": "1",
                "subitems": [
                    {
                        "id": "ch1-1",
                        "title": "Background",
                        "level": 2,
                        "number": "1.1",
                        "blocks": [
                            {
                                "id": "p1",
                                "type": "paragraph",
                                # Intentionally stores punct-before-token; resolver must emit JUW style.
                                "text": f"This system improves efficiency.{cite(R1)}",
                            },
                            {
                                "id": "p2",
                                "type": "paragraph",
                                "text": (
                                    f"Prior studies {cite(R2)} and online sources "
                                    f"{cite(R3)} agree."
                                ),
                            },
                            {
                                "id": "p3",
                                "type": "paragraph",
                                "text": f"The first work is revisited here {cite(R1)}.",
                            },
                            {
                                "id": "p4",
                                "type": "paragraph",
                                "text": f"Combined evidence {cite(R1)}, {cite(R3)} is strong.",
                            },
                            {
                                "id": "p5",
                                "type": "paragraph",
                                "text": f"software development.{cite(R1)}" if with_citations else "software development.",
                            },
                        ],
                    }
                ],
            },
            *(
                [{"id": "refs", "title": "References", "level": 1}]
                if with_references_heading
                else []
            ),
        ],
        "contentMap": {
            "abstract": "Reference management verification.",
            "ack": "Acknowledgement.",
        },
        "references": [
            {
                "id": R1,
                "type": "book",
                "authors": "A. Khan",
                "title": "Software Engineering Practice",
                "year": "2021",
                "source": "Pearson",
                "details": "3rd ed.",
                "url": "",
                "accessed": "",
            },
            {
                "id": R2,
                "type": "journal",
                "authors": "B. Ahmed and C. Ali",
                "title": "Automating Report Formatting",
                "year": "2023",
                "source": "IEEE Access",
                "details": "vol. 11, pp. 45-52",
                "url": "",
                "accessed": "",
            },
            {
                "id": R3,
                "type": "website",
                "authors": "ReportPeer",
                "title": "Formatting Guidelines",
                "year": "2026",
                "source": "reportpeer.example",
                "details": "",
                "url": "https://reportpeer.example/guide",
                "accessed": "12-Sep-2026",
            },
            {
                "id": R4,
                "type": "other",
                "authors": "D. Uncited",
                "title": "Never Cited Work",
                "year": "2020",
                "source": "Nowhere",
                "details": "",
                "url": "",
                "accessed": "",
            },
        ],
        "meta": {
            "projectTitle": "Reference Test",
            "projectAdvisor": "Dr. Test",
            "submissionMonthYear": "September 2026",
            "teamMembers": [{"name": "Test Student", "enrollment": "CS-001", "seatNumber": "1"}],
        },
    }


def inspect(docx_path: Path) -> dict:
    heading_count = heading_count_of(docx_path)
    with zipfile.ZipFile(docx_path) as archive:
        root = ET.fromstring(archive.read("word/document.xml"))
    paragraphs = [
        "".join(node.text or "" for node in para.iter(f"{{{NS['w']}}}t")).strip()
        for para in root.findall(".//w:p", NS)
    ]
    paragraphs = [text for text in paragraphs if text]
    body = "\n".join(paragraphs)

    checks = {
        "no_raw_tokens": "[[ref:" not in body,
        "cite_1_first": "This system improves efficiency [1]." in body,
        "cite_2_and_3": "Prior studies [2] and online sources [3] agree." in body,
        "reuse_keeps_1": "The first work is revisited here [1]." in body,
        "multiple_citation": "Combined evidence [1], [3] is strong." in body,
        "juw_punct_style": "software development [1]." in body and "software development.[1]" not in body,
        "entry_1": any(text.startswith("[1]") and "Software Engineering Practice" in text for text in paragraphs),
        "entry_2": any(text.startswith("[2]") and "Automating Report Formatting" in text for text in paragraphs),
        "entry_3": any(text.startswith("[3]") and "Formatting Guidelines" in text for text in paragraphs),
        "uncited_excluded": "Never Cited Work" not in body,
        "references_heading": heading_count == 1,
    }
    checks["passed"] = all(checks.values())
    checks["reference_entries"] = [text for text in paragraphs if text.startswith("[")][:6]
    return checks


def heading_count_of(docx_path: Path) -> int:
    """How many times a References heading appears in the body (TOC lines excluded)."""
    with zipfile.ZipFile(docx_path) as archive:
        root = ET.fromstring(archive.read("word/document.xml"))
    count = 0
    for para in root.findall(".//w:p", NS):
        style = para.find("./w:pPr/w:pStyle", NS)
        style_name = style.get(f"{{{NS['w']}}}val") if style is not None else ""
        if not str(style_name).lower().startswith("heading"):
            continue
        text = "".join(node.text or "" for node in para.iter(f"{{{NS['w']}}}t")).strip()
        if text.upper() == "REFERENCES":
            count += 1
    return count


def export_pdf(docx_path: Path, pdf_path: Path) -> bool:
    try:
        import win32com.client

        word = win32com.client.DispatchEx("Word.Application")
        word.Visible = False
        doc = word.Documents.Open(str(docx_path))
        doc.ExportAsFixedFormat(str(pdf_path), 17)
        doc.Close(False)
        word.Quit()
        return pdf_path.exists() and pdf_path.stat().st_size > 0
    except Exception as error:
        print(f"PDF export skipped: {error}")
        return False


def scenario_auto_created() -> dict:
    """Citations but no References heading in the structure."""
    path = TOOLS / "generated_references_auto.docx"
    generate_report(build_payload(with_references_heading=False), str(path), "JUW")
    checks = inspect(path)
    return {
        "section_created": checks["references_heading"],
        "no_duplicate": heading_count_of(path) == 1,
        "entries_numbered": checks["entry_1"] and checks["entry_2"] and checks["entry_3"],
        "uncited_excluded": checks["uncited_excluded"],
        "citations_resolved": checks["no_raw_tokens"] and checks["reuse_keeps_1"],
        "passed": checks["passed"],
    }


def scenario_no_citations() -> dict:
    """No citations and no References heading: nothing should be invented."""
    path = TOOLS / "generated_references_none.docx"
    generate_report(
        build_payload(with_references_heading=False, with_citations=False), str(path), "JUW"
    )
    with zipfile.ZipFile(path) as archive:
        root = ET.fromstring(archive.read("word/document.xml"))
    body = "\n".join(
        "".join(node.text or "" for node in para.iter(f"{{{NS['w']}}}t"))
        for para in root.findall(".//w:p", NS)
    )
    checks = {
        "no_references_section": heading_count_of(path) == 0,
        "no_entries": "Software Engineering Practice" not in body,
        "body_intact": "This system improves efficiency" in body,
    }
    checks["passed"] = all(checks.values())
    return checks


def main() -> int:
    generate_report(build_payload(), str(OUTPUT), "JUW")
    existing = inspect(OUTPUT)
    existing["pdf_ok"] = export_pdf(OUTPUT.resolve(), PDF.resolve())

    auto = scenario_auto_created()
    none = scenario_no_citations()

    report = {
        "output": str(OUTPUT.resolve()),
        "existing_references_section": existing,
        "auto_created_references_section": auto,
        "no_citations": none,
    }
    report["passed"] = existing["passed"] and auto["passed"] and none["passed"]
    print(json.dumps(report, indent=2))
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
