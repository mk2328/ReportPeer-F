"""Build an isolated tables/figures payload, generate a DOCX, and verify it."""

from __future__ import annotations

import base64
import json
import struct
import sys
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TOOLS = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
if str(TOOLS) not in sys.path:
    sys.path.insert(0, str(TOOLS))

from generate import generate_report
from verify_media import inspect
FIG1 = TOOLS / "media_test_fig1.png"
FIG2 = TOOLS / "media_test_fig2.png"
PAYLOAD = TOOLS / "test_media_payload.json"
OUTPUT = TOOLS / "generated_media_test.docx"


def write_png(path: Path, red: int, green: int, blue: int, width: int = 160, height: int = 90) -> None:
    raw = b"".join(b"\x00" + bytes([red, green, blue]) * width for _ in range(height))

    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")
    path.write_bytes(png)


def as_data_url(path: Path) -> str:
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def build_payload() -> dict:
    write_png(FIG1, 80, 40, 140)
    write_png(FIG2, 20, 110, 90)
    return {
        "title": "Tables and Figures Isolated Test",
        "university": "JUW",
        "structure": [
            {"id": "abstract", "title": "Abstract", "level": 1},
            {"id": "lof", "title": "List of Figures", "level": 1},
            {"id": "lot", "title": "List of Tables", "level": 1},
            {"id": "ack", "title": "Acknowledgement", "level": 1},
            {
                "id": "ch1",
                "title": "CHAPTER 1 - INTRODUCTION",
                "level": 1,
                "subitems": [
                    {
                        "id": "ch1-media",
                        "title": "Media examples",
                        "level": 2,
                        "tables": [
                            {
                                "id": "tbl-1",
                                "caption": "Sample comparison table",
                                "columns": ["Module", "Status"],
                                "data": [
                                    ["Authentication", "Complete"],
                                    ["Reporting", "In progress"],
                                ],
                            }
                        ],
                        "figures": [
                            {
                                "id": "fig-1",
                                "caption": "Login screen",
                                "fileName": "media_test_fig1.png",
                                "mimeType": "image/png",
                                "path": str(FIG1),
                            }
                        ],
                    }
                ],
            },
            {
                "id": "ch2",
                "title": "CHAPTER 2 - DESIGN",
                "level": 1,
                "subitems": [
                    {
                        "id": "ch2-media",
                        "title": "Design figure",
                        "level": 2,
                        "figures": [
                            {
                                "id": "fig-2",
                                "caption": "Architecture overview",
                                "fileName": "media_test_fig2.png",
                                "mimeType": "image/png",
                                "dataUrl": as_data_url(FIG2),
                            }
                        ],
                    }
                ],
            },
        ],
        "contentMap": {
            "abstract": "Isolated tables and figures test. This is not a full FYP report.",
            "ack": "Acknowledgement placeholder for front matter.",
            "ch1": "Chapter 1 contains one table and one figure.",
            "ch1-media": "Structured table and figure data only. Captions do not include numbers.",
            "ch2": "Chapter 2 contains a second figure to verify chapter-based numbering.",
            "ch2-media": "The figure below is stored as a data URL, matching editor uploads.",
        },
    }


def main() -> int:
    payload = build_payload()
    PAYLOAD.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    generate_report(payload, str(OUTPUT), "JUW")
    result = inspect(OUTPUT)
    print(json.dumps(result, indent=2))
    return 0 if result["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
