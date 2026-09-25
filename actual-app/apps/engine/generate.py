import argparse
import json
import os
import sys
from pathlib import Path

from docx import Document

from core.config_loader import load_university_bundle
from core.document import DocumentBuilder
from core.file_io import remove_empty_paragraphs_before_page_break_before
from core.formatters import reapply_generated_styles
from core.mapper import render_project
from core.word_com import export_docx_to_pdf, update_word_fields


def generate_report(payload: dict, output_path: str, university: str | None = None) -> str:
    university = university or payload.get("university")
    config, template_path = load_university_bundle(university)

    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)

    document = Document(str(template_path))
    builder = DocumentBuilder(document, config)
    builder.prepare()
    render_project(builder, payload)
    builder.finalize()
    abs_output = os.path.abspath(str(output))
    document.save(abs_output)
    document = None

    update_word_fields(abs_output)
    if remove_empty_paragraphs_before_page_break_before(abs_output):
        # Refresh page numbers without rebuilding TOC entries (rebuild recreates the blank para).
        update_word_fields(abs_output, page_numbers_only=True)
        remove_empty_paragraphs_before_page_break_before(abs_output)
    reapply_generated_styles(abs_output, config)
    return str(Path(abs_output).resolve())


def main(argv=None):
    parser = argparse.ArgumentParser(description="Generate a formatted FYP DOCX.")
    parser.add_argument("--input", required=True, help="Path to project JSON payload")
    parser.add_argument("--output", required=True, help="Path to write the .docx")
    parser.add_argument(
        "--pdf",
        default=None,
        help="Optional path to also write a PDF via Word COM (DOCX is always generated first)",
    )
    parser.add_argument("--university", default=None, help="University slug (default: from payload or juw)")
    args = parser.parse_args(argv)

    try:
        with open(args.input, "r", encoding="utf-8-sig") as handle:
            payload = json.load(handle)
        path = generate_report(payload, args.output, args.university)
        result = {"ok": True, "output": path}
        if args.pdf:
            pdf_ok = export_docx_to_pdf(path, args.pdf)
            if not pdf_ok:
                print(
                    json.dumps(
                        {
                            "ok": False,
                            "error": (
                                "PDF export failed. Microsoft Word must be installed "
                                "and available via Word COM on this machine."
                            ),
                        }
                    ),
                    file=sys.stderr,
                )
                return 1
            result["pdf"] = str(Path(args.pdf).resolve())
        print(json.dumps(result))
        return 0
    except Exception as error:
        print(json.dumps({"ok": False, "error": str(error)}), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
