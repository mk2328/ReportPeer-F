import argparse
import json
import os
import sys
from pathlib import Path

from docx import Document

from core.config_loader import resolve_university_pack
from core.document import DocumentBuilder
from core.file_io import remove_empty_paragraphs_before_page_break_before
from core.formatters import reapply_generated_styles
from core.image_compat import cleanup_temp_images
from core.mapper import render_project
from core.libreoffice_pdf import finalize_docx_with_libreoffice


def generate_report(payload: dict, output_path: str, university: str | None = None) -> str:
    university = university or payload.get("university")
    config, template_path = resolve_university_pack(university)

    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)

    try:
        document = Document(str(template_path))
        builder = DocumentBuilder(document, config)
        builder.prepare()
        render_project(builder, payload)
        builder.finalize()
        abs_output = os.path.abspath(str(output))
        document.save(abs_output)
        document = None

        # python-docx only. LibreOffice updates TOC/LOF/LOT/fields after styles are reapplied.
        remove_empty_paragraphs_before_page_break_before(abs_output)
        reapply_generated_styles(abs_output, config)
        return str(Path(abs_output).resolve())
    finally:
        cleanup_temp_images()


def main(argv=None):
    parser = argparse.ArgumentParser(description="Generate a formatted FYP DOCX.")
    parser.add_argument("--input", required=True, help="Path to project JSON payload")
    parser.add_argument("--output", required=True, help="Path to write the .docx")
    parser.add_argument(
        "--pdf",
        default=None,
        help="Optional path to also write a PDF via LibreOffice headless (DOCX is always generated first)",
    )
    parser.add_argument("--university", default=None, help="University slug (default: from payload or juw)")
    args = parser.parse_args(argv)

    try:
        with open(args.input, "r", encoding="utf-8-sig") as handle:
            payload = json.load(handle)
        path = generate_report(payload, args.output, args.university)
        # LibreOffice fills TOC/LOF/LOT, then we re-apply TOC run formatting
        # (TNR 10 pt, single spacing) before the PDF export pass.
        finalize_docx_with_libreoffice(path, None, update_indexes=True)
        config, _ = resolve_university_pack(
            args.university or payload.get("university")
        )
        reapply_generated_styles(path, config)
        pdf_path = None
        if args.pdf:
            pdf_path = finalize_docx_with_libreoffice(
                path, args.pdf, update_indexes=False
            )
        result = {"ok": True, "output": path}
        if pdf_path:
            result["pdf"] = pdf_path
        print(json.dumps(result))
        return 0
    except Exception as error:
        print(json.dumps({"ok": False, "error": str(error)}), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
