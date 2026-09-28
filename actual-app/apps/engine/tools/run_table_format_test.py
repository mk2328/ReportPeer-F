"""Generate a DOCX with rich table formatting and inspect cell properties."""

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

PAYLOAD = TOOLS / "test_table_format_payload.json"
OUTPUT = TOOLS / "generated_table_format_test.docx"
NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}


def inspect_table_formatting(docx_path: Path) -> dict:
    with zipfile.ZipFile(docx_path) as archive:
        xml = archive.read("word/document.xml")
    root = ET.fromstring(xml)
    tables = root.findall(".//w:tbl", NS)
    checks = {
        "table_count": len(tables),
        "has_shading": False,
        "has_text_color": False,
        "has_bold": False,
        "has_center_align": False,
        "has_right_align": False,
        "has_merge_hmerge": False,
        "has_merge_vmerge": False,
        "caption_found": False,
        "para_before": False,
        "para_after": False,
    }
    body_text = " ".join(node.text or "" for node in root.iter(f"{{{NS['w']}}}t"))
    checks["para_before"] = "Paragraph before the formatted table." in body_text
    checks["para_after"] = "Paragraph after the formatted table." in body_text
    checks["caption_found"] = "Formatted sample table" in body_text

    for table in tables:
        for tc in table.findall(".//w:tc", NS):
            shd = tc.find("./w:tcPr/w:shd", NS)
            if shd is not None and shd.get(f"{{{NS['w']}}}fill") not in (None, "auto", "FFFFFF"):
                checks["has_shading"] = True
            grid_span = tc.find("./w:tcPr/w:gridSpan", NS)
            if grid_span is not None and int(grid_span.get(f"{{{NS['w']}}}val") or "1") > 1:
                checks["has_merge_hmerge"] = True
            vmerge = tc.find("./w:tcPr/w:vMerge", NS)
            if vmerge is not None:
                checks["has_merge_vmerge"] = True
            for run in tc.findall(".//w:r", NS):
                rpr = run.find("./w:rPr", NS)
                if rpr is None:
                    continue
                if rpr.find("./w:b", NS) is not None:
                    checks["has_bold"] = True
                color = rpr.find("./w:color", NS)
                if color is not None and color.get(f"{{{NS['w']}}}val") not in (None, "000000", "auto"):
                    checks["has_text_color"] = True
            for para in tc.findall("./w:p", NS):
                jc = para.find("./w:pPr/w:jc", NS)
                if jc is None:
                    continue
                val = jc.get(f"{{{NS['w']}}}val")
                if val == "center":
                    checks["has_center_align"] = True
                if val == "right":
                    checks["has_right_align"] = True

    required = [
        "has_shading",
        "has_text_color",
        "has_bold",
        "has_center_align",
        "has_right_align",
        "has_merge_hmerge",
        "caption_found",
        "para_before",
        "para_after",
    ]
    checks["passed"] = all(checks[key] for key in required) and checks["table_count"] >= 1
    checks["required"] = {key: checks[key] for key in required}
    return checks


def main() -> int:
    payload = json.loads(PAYLOAD.read_text(encoding="utf-8-sig"))
    generate_report(payload, str(OUTPUT), "JUW")
    result = inspect_table_formatting(OUTPUT)
    print(json.dumps({"output": str(OUTPUT.resolve()), **result}, indent=2))
    return 0 if result["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
