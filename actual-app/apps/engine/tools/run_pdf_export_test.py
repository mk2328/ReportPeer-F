"""Verify production DOCX + optional PDF export via generate.py --pdf."""

from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TOOLS = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from generate import generate_report, main as generate_main
from core.word_com import export_docx_to_pdf as com_export


def build_payload() -> dict:
    return {
        "title": "PDF Export Verification",
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
                                "text": "This system improves efficiency [[ref:ref-1]].",
                            }
                        ],
                    }
                ],
            },
        ],
        "contentMap": {
            "abstract": "PDF export verification abstract.",
            "ack": "Acknowledgement.",
        },
        "references": [
            {
                "id": "ref-1",
                "type": "book",
                "authors": "A. Khan",
                "title": "Software Engineering Practice",
                "year": "2021",
                "source": "Pearson",
                "details": "3rd ed.",
                "url": "",
                "accessed": "",
            }
        ],
        "meta": {
            "projectTitle": "PDF Export Verification",
            "projectAdvisor": "Dr. Test",
            "submissionMonthYear": "September 2026",
            "teamMembers": [{"name": "Test Student", "enrollment": "CS-001", "seatNumber": "1"}],
        },
    }


def main() -> int:
    work = Path(tempfile.mkdtemp(prefix="reportpeer-pdf-"))
    payload_path = work / "payload.json"
    docx_path = work / "report.docx"
    pdf_path = work / "report.pdf"
    payload_path.write_text(json.dumps(build_payload()), encoding="utf-8")

    # 1) DOCX-only path (no --pdf) must still succeed.
    code_docx = generate_main(
        ["--input", str(payload_path), "--output", str(docx_path)]
    )
    docx_only_ok = code_docx == 0 and docx_path.exists() and docx_path.stat().st_size > 0

    # 2) DOCX + PDF path via CLI --pdf.
    docx2 = work / "report2.docx"
    pdf2 = work / "report2.pdf"
    code_pdf = generate_main(
        ["--input", str(payload_path), "--output", str(docx2), "--pdf", str(pdf2)]
    )
    pdf_ok = (
        code_pdf == 0
        and docx2.exists()
        and docx2.stat().st_size > 0
        and pdf2.exists()
        and pdf2.stat().st_size > 0
        and pdf2.read_bytes()[:4] == b"%PDF"
    )

    # 3) Production helper matches test helper behavior.
    pdf3 = TOOLS / "generated_pdf_export_test.pdf"
    docx3 = TOOLS / "generated_pdf_export_test.docx"
    generate_report(build_payload(), str(docx3), "JUW")
    helper_ok = com_export(str(docx3.resolve()), str(pdf3.resolve()))
    if helper_ok and pdf3.exists():
        # Keep artifacts for manual inspection.
        pass

    report = {
        "docx_only_ok": docx_only_ok,
        "pdf_cli_ok": pdf_ok,
        "pdf_helper_ok": bool(helper_ok and pdf3.exists() and pdf3.stat().st_size > 0),
        "docx_bytes": docx_path.stat().st_size if docx_path.exists() else 0,
        "pdf_bytes": pdf2.stat().st_size if pdf2.exists() else 0,
        "pdf_magic": pdf2.read_bytes()[:4].decode("latin1") if pdf2.exists() else None,
        "artifacts": {
            "docx": str(docx3.resolve()) if docx3.exists() else None,
            "pdf": str(pdf3.resolve()) if pdf3.exists() else None,
        },
    }
    report["passed"] = report["docx_only_ok"] and report["pdf_cli_ok"] and report["pdf_helper_ok"]
    print(json.dumps(report, indent=2))
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
