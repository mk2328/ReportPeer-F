"""Generate a DOCX with figure size/alignment and verify mixed-content order."""

from __future__ import annotations

import base64
import json
import struct
import sys
import zlib
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
TOOLS = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from generate import generate_report

OUTPUT = TOOLS / "generated_figure_format_test.docx"
PDF = TOOLS / "generated_figure_format_test.pdf"
NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main", "a": "http://schemas.openxmlformats.org/drawingml/2006/main", "wp": "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing", "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships"}


def write_png(path: Path, red: int, green: int, blue: int, width: int = 240, height: int = 120) -> None:
    raw = b"".join(b"\x00" + bytes([red, green, blue]) * width for _ in range(height))

    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")
    path.write_bytes(png)


def as_data_url(path: Path) -> str:
    return "data:image/png;base64," + base64.b64encode(path.read_bytes()).decode("ascii")


def build_payload() -> dict:
    fig_path = TOOLS / "figure_format_test.png"
    write_png(fig_path, 40, 90, 160)
    data_url = as_data_url(fig_path)
    return {
        "title": "Figure Formatting Verification",
        "university": "JUW",
        "structure": [
            {"id": "abstract", "title": "Abstract", "level": 1},
            {"id": "lof", "title": "List of Figures", "level": 1},
            {"id": "lot", "title": "List of Tables", "level": 1},
            {"id": "ack", "title": "Acknowledgement", "level": 1},
            {
                "id": "ch2",
                "title": "REQUIREMENTS",
                "level": 1,
                "number": "2",
                "subitems": [
                    {
                        "id": "ch2-1",
                        "title": "Figures",
                        "level": 2,
                        "number": "2.1",
                        "blocks": [
                            {"id": "p1", "type": "paragraph", "text": "Paragraph before figure."},
                            {
                                "id": "fig1",
                                "type": "figure",
                                "caption": "System Architecture",
                                "fileName": "arch.png",
                                "mimeType": "image/png",
                                "dataUrl": data_url,
                                "widthPercent": 60,
                                "align": "left",
                            },
                            {"id": "p2", "type": "paragraph", "text": "Paragraph between figures."},
                            {
                                "id": "fig2",
                                "type": "figure",
                                "caption": "Login Screen",
                                "fileName": "login.png",
                                "mimeType": "image/png",
                                "dataUrl": data_url,
                                "widthPercent": 100,
                                "align": "right",
                            },
                            {"id": "p3", "type": "paragraph", "text": "Paragraph after figures."},
                        ],
                    }
                ],
            },
            {"id": "refs", "title": "References", "level": 1},
        ],
        "contentMap": {
            "abstract": "Figure formatting verification.",
            "ack": "Acknowledgement.",
            "ch2-1": "Paragraph before figure.\n\nParagraph between figures.\n\nParagraph after figures.",
        },
        "meta": {
            "projectTitle": "Figure Format Test",
            "projectAdvisor": "Dr. Test",
            "submissionMonthYear": "September 2026",
            "teamMembers": [{"name": "Test Student", "enrollment": "CS-001", "seatNumber": "1"}],
        },
    }


def emu_to_inches(emu: int) -> float:
    return emu / 914400.0


def inspect(docx_path: Path) -> dict:
    with zipfile.ZipFile(docx_path) as archive:
        xml = archive.read("word/document.xml")
    root = ET.fromstring(xml)
    texts = [node.text or "" for node in root.iter(f"{{{NS['w']}}}t")]
    body_text = " ".join(texts)

    extents = []
    for ext in root.findall(".//{http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing}extent"):
        cx = int(ext.get("cx") or 0)
        if cx:
            extents.append(emu_to_inches(cx))

    alignments = []
    for para in root.findall(".//w:p", NS):
        if para.find(".//{http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing}inline") is None:
            continue
        jc = para.find("./w:pPr/w:jc", NS)
        alignments.append(jc.get(f"{{{NS['w']}}}val") if jc is not None else "left")

    checks = {
        "image_count": len(extents),
        "has_left_align": "left" in alignments,
        "has_right_align": "right" in alignments,
        "has_smaller_width": any(w < 4.0 for w in extents),
        "has_fullish_width": any(w >= 5.0 for w in extents),
        "caption_arch": "System Architecture" in body_text,
        "caption_login": "Login Screen" in body_text,
        "para_before": "Paragraph before figure." in body_text,
        "para_between": "Paragraph between figures." in body_text,
        "para_after": "Paragraph after figures." in body_text,
        "figure_prefix": "Figure 2." in body_text,
        "extents_inches": [round(w, 2) for w in extents],
        "alignments": alignments,
    }
    # Prefer body-order check (skip LOF entries that also contain captions).
    from docx import Document

    paragraph_texts = [p.text.strip() for p in Document(docx_path).paragraphs if p.text.strip()]
    try:
        start = next(i for i, t in enumerate(paragraph_texts) if t == "Paragraph before figure.")
        slice_texts = paragraph_texts[start:]
    except StopIteration:
        slice_texts = paragraph_texts
    markers = [
        "Paragraph before figure.",
        "System Architecture",
        "Paragraph between figures.",
        "Login Screen",
        "Paragraph after figures.",
    ]
    found = []
    for marker in markers:
        for text in slice_texts:
            if marker in text:
                found.append(marker)
                break
    checks["mixed_order"] = found == markers
    required = [
        "has_left_align",
        "has_right_align",
        "has_smaller_width",
        "has_fullish_width",
        "caption_arch",
        "caption_login",
        "para_before",
        "para_between",
        "para_after",
        "figure_prefix",
        "mixed_order",
    ]
    checks["passed"] = checks["image_count"] >= 2 and all(checks[key] for key in required)
    return checks


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


def main() -> int:
    payload = build_payload()
    generate_report(payload, str(OUTPUT), "JUW")
    result = inspect(OUTPUT)
    pdf_ok = export_pdf(OUTPUT.resolve(), PDF.resolve())
    print(json.dumps({"output": str(OUTPUT.resolve()), "pdf": str(PDF.resolve()) if pdf_ok else None, "pdf_ok": pdf_ok, **result}, indent=2))
    return 0 if result["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
