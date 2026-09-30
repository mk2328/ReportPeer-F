"""Update ReportPeer DOCX fields and export PDF with LibreOffice headless.

Word COM remains in word_com.py for rollback. This module does not import it.
"""

from __future__ import annotations

import os
import re
import shutil
import socket
import subprocess
import sys
import tempfile
from pathlib import Path

DEFAULT_TIMEOUT_SECONDS = 90.0

_UNO_SCRIPT = r'''
import sys
import time
from pathlib import Path

import uno
from com.sun.star.beans import PropertyValue
from com.sun.star.connection import NoConnectException

DOCX = sys.argv[1]
PDF = sys.argv[2]
PORT = sys.argv[3]
UPDATE_INDEXES = True
if len(sys.argv) > 4:
    UPDATE_INDEXES = sys.argv[4] not in ("0", "false", "False", "no")

# FontSlant.NONE — avoid importing com.sun.star.awt (missing in some LO builds).
_FONT_SLANT_NONE = 0


def prop(name, value):
    item = PropertyValue()
    item.Name = name
    item.Value = value
    return item


def is_index_entry_style(style):
    s = (style or "").upper().strip()
    return (
        s.startswith("TOC")
        or s.startswith("CONTENTS")
        or s.startswith("FIGURE INDEX")
        or s == "TABLE OF FIGURES"
        or s.startswith("TABLE OF FIGURES")
    )


def normalize_toc_entries(document):
    """Force TOC/LOF/LOT entry runs upright TNR 10pt (LOT inherits italic from captions)."""
    formatted = 0
    enum = document.getText().createEnumeration()
    while enum.hasMoreElements():
        para = enum.nextElement()
        try:
            if not para.supportsService("com.sun.star.text.Paragraph"):
                continue
            style = str(para.ParaStyleName or "")
        except Exception:
            continue
        if not is_index_entry_style(style):
            continue
        try:
            para.ParaTopMargin = 0
            para.ParaBottomMargin = 0
        except Exception:
            pass
        try:
            penum = para.createEnumeration()
            while penum.hasMoreElements():
                portion = penum.nextElement()
                try:
                    portion.CharPosture = _FONT_SLANT_NONE
                    portion.CharFontName = "Times New Roman"
                    portion.CharFontNameAsian = "Times New Roman"
                    portion.CharFontNameComplex = "Times New Roman"
                    portion.CharHeight = 10
                    portion.CharHeightAsian = 10
                    portion.CharHeightComplex = 10
                    style_key = style.upper().strip()
                    # FontWeight.BOLD = 150, NORMAL = 100. Level-1 TOC lines only.
                    if style_key.startswith("TOC") or style_key.startswith("CONTENTS"):
                        try:
                            portion.CharWeight = (
                                150.0
                                if style_key in ("CONTENTS 1", "TOC 1")
                                else 100.0
                            )
                        except Exception:
                            pass
                except Exception:
                    pass
            if style.upper().strip().startswith("TOC") or style.upper().strip().startswith("CONTENTS"):
                try:
                    cursor = document.getText().createTextCursorByRange(para)
                    # CaseMap.SMALLCAPS = 4. Portions expose CharCaseMap, not CharCase.
                    cursor.CharCaseMap = 4
                except Exception:
                    pass
            formatted += 1
        except Exception:
            pass
    print("TOC_FORMATTED", formatted)


local = uno.getComponentContext()
resolver = local.ServiceManager.createInstanceWithContext(
    "com.sun.star.bridge.UnoUrlResolver", local
)
ctx = None
last = None
for _ in range(40):
    try:
        ctx = resolver.resolve(
            "uno:socket,host=127.0.0.1,port=%s;urp;StarOffice.ComponentContext" % PORT
        )
        break
    except NoConnectException as error:
        last = error
        time.sleep(0.5)
if ctx is None:
    raise SystemExit("Could not connect to LibreOffice: %s" % last)

desktop = ctx.ServiceManager.createInstanceWithContext("com.sun.star.frame.Desktop", ctx)
docx_url = Path(DOCX).resolve().as_uri()
doc = desktop.loadComponentFromURL(
    docx_url,
    "_blank",
    0,
    (prop("Hidden", True), prop("UpdateDocMode", 3)),
)
if doc is None:
    desktop.terminate()
    raise SystemExit("LibreOffice could not open the DOCX")

if UPDATE_INDEXES:
    indexes = doc.getDocumentIndexes()
    index_count = indexes.getCount()
    print("INDEX_COUNT", index_count)
    if index_count < 1:
        doc.close(False)
        desktop.terminate()
        raise SystemExit("LibreOffice did not find TOC/LOF/LOT indexes in the DOCX")
    for index in range(index_count):
        indexes.getByIndex(index).update()

    try:
        doc.getTextFields().refresh()
        print("FIELDS_REFRESHED YES")
    except Exception as error:
        doc.close(False)
        desktop.terminate()
        raise SystemExit("LibreOffice field refresh failed: %s" % error)
else:
    print("INDEX_COUNT SKIP")
    print("FIELDS_REFRESHED SKIP")

# Always normalize TOC/LOF/LOT visuals after indexes exist in this session.
normalize_toc_entries(doc)

doc.storeToURL(docx_url, (prop("FilterName", "MS Word 2007 XML"), prop("Overwrite", True)))
if PDF:
    # Export PDF in the SAME session as index update. Reloading the DOCX later
    # drops Writer-native TOC hyperlinks (Word hyperlinks are not re-imported),
    # which produces PDFs with no clickable TOC/LOF/LOT entries.
    pdf_url = Path(PDF).resolve().as_uri()
    pdf_filter_data = (
        prop("ExportBookmarks", True),
        prop("ExportBookmarksNamedDestinations", True),
        prop("ExportBmkToDest", True),
        prop("ConvertOOoTargetToPDFTarget", True),
        prop("ExportLinksRelativeFsys", False),
    )
    doc.storeToURL(
        pdf_url,
        (
            prop("FilterName", "writer_pdf_Export"),
            prop("Overwrite", True),
            prop("FilterData", pdf_filter_data),
        ),
    )
doc.close(True)
desktop.terminate()
print("UNO_OK")
'''


class LibreOfficePdfError(RuntimeError):
    """PDF conversion failed or LibreOffice is unavailable."""


_CAPTION_KEY_RE = re.compile(r"^(Figure|Table)\s+(\d+\.\d+)\b", re.IGNORECASE)
_LIST_HEADING_RE = re.compile(
    r"LIST OF (FIGURES|TABLES)\b", re.IGNORECASE
)


def _caption_key(text: str) -> str | None:
    match = _CAPTION_KEY_RE.match((text or "").strip())
    if not match:
        return None
    return f"{match.group(1).lower()} {match.group(2)}"


def add_lof_lot_links_to_pdf(pdf_path: str | Path) -> int:
    """
    LibreOffice exports clickable TOC links from ContentIndex, but Illustration /
    Table indexes keep TokenHyperlinkStart without emitting PDF link annotations
    (LevelFormat is not writable for those indexes in current LO builds).

    Add GOTO links on LOF/LOT entry lines to the matching body captions.
    Returns the number of links added.
    """
    try:
        import pymupdf
    except ImportError as error:
        raise LibreOfficePdfError(
            "pymupdf is required to add LOF/LOT PDF links after LibreOffice export."
        ) from error

    path = Path(pdf_path).resolve()
    doc = pymupdf.open(str(path))
    try:
        list_pages: set[int] = set()
        destinations: dict[str, tuple[int, float]] = {}

        for page_index, page in enumerate(doc):
            plain = page.get_text("text") or ""
            if _LIST_HEADING_RE.search(plain):
                list_pages.add(page_index)

        for page_index, page in enumerate(doc):
            if page_index in list_pages:
                continue
            for block in page.get_text("dict").get("blocks", []):
                for line in block.get("lines", []):
                    line_text = "".join(
                        span.get("text", "") for span in line.get("spans", [])
                    ).strip()
                    key = _caption_key(line_text)
                    if not key:
                        continue
                    # Prefer the first body caption occurrence for each key.
                    if key in destinations:
                        continue
                    y = line["bbox"][1]
                    destinations[key] = (page_index, y)

        added = 0
        for page_index in sorted(list_pages):
            page = doc[page_index]
            existing = {
                (
                    round(link.get("from").x0, 1),
                    round(link.get("from").y0, 1),
                    round(link.get("from").x1, 1),
                    round(link.get("from").y1, 1),
                )
                for link in page.get_links()
                if link.get("from") is not None
            }
            for block in page.get_text("dict").get("blocks", []):
                for line in block.get("lines", []):
                    spans = line.get("spans", [])
                    if not spans:
                        continue
                    line_text = "".join(span.get("text", "") for span in spans).strip()
                    if _LIST_HEADING_RE.match(line_text):
                        continue
                    key = _caption_key(line_text)
                    if not key or key not in destinations:
                        continue
                    bbox = line["bbox"]
                    rect_key = (
                        round(bbox[0], 1),
                        round(bbox[1], 1),
                        round(bbox[2], 1),
                        round(bbox[3], 1),
                    )
                    if rect_key in existing:
                        continue
                    dest_page, dest_y = destinations[key]
                    link = {
                        "kind": pymupdf.LINK_GOTO,
                        "from": pymupdf.Rect(bbox),
                        "page": dest_page,
                        "to": pymupdf.Point(72, dest_y),
                    }
                    page.insert_link(link)
                    existing.add(rect_key)
                    added += 1

        if added:
            # Rewrite atomically so a failed save cannot truncate the LO PDF.
            tmp = path.with_suffix(path.suffix + ".linktmp")
            doc.save(str(tmp), incremental=False, deflate=True)
            doc.close()
            tmp.replace(path)
            return added
        return added
    finally:
        if not doc.is_closed:
            doc.close()


def find_soffice() -> str:
    """Resolve the soffice executable. Raises LibreOfficePdfError when missing."""
    configured = os.environ.get("REPORTPEER_SOFFICE", "").strip().strip('"')
    if configured:
        if os.path.isfile(configured):
            return configured
        raise LibreOfficePdfError(
            "LibreOffice was not found at REPORTPEER_SOFFICE="
            f"{configured}. Install LibreOffice or point REPORTPEER_SOFFICE at soffice."
        )

    found = shutil.which("soffice") or shutil.which("soffice.exe")
    if found:
        return found

    candidates: list[str] = []
    if os.name == "nt":
        program_files = os.environ.get("ProgramFiles", r"C:\Program Files")
        program_files_x86 = os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)")
        local_app = os.environ.get("LOCALAPPDATA", "")
        candidates.extend(
            [
                os.path.join(program_files, "LibreOffice", "program", "soffice.exe"),
                os.path.join(program_files_x86, "LibreOffice", "program", "soffice.exe"),
            ]
        )
        if local_app:
            candidates.append(
                os.path.join(local_app, "Programs", "LibreOffice", "program", "soffice.exe")
            )
    else:
        candidates.extend(
            [
                "/usr/bin/soffice",
                "/usr/bin/libreoffice",
                "/usr/lib/libreoffice/program/soffice",
            ]
        )

    for path in candidates:
        if path and os.path.isfile(path):
            return path

    raise LibreOfficePdfError(
        "LibreOffice is not installed or soffice was not found. "
        "Install LibreOffice and ensure soffice is on PATH, or set REPORTPEER_SOFFICE "
        "to the full path of soffice."
    )


def _python_can_import_uno(python_path: str) -> bool:
    try:
        probe = subprocess.run(
            [python_path, "-c", "import uno"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=30,
            check=False,
        )
    except (OSError, subprocess.SubprocessError):
        return False
    return probe.returncode == 0


def find_libreoffice_python(soffice: str) -> str:
    """Interpreter that can drive UNO. Required for index/field updates."""
    configured = os.environ.get("REPORTPEER_UNO_PYTHON", "").strip().strip('"')
    if configured and os.path.isfile(configured):
        return configured

    program = Path(soffice).resolve().parent
    for name in ("python.exe", "python.bin", "python"):
        candidate = program / name
        if candidate.is_file():
            return str(candidate)

    # Debian/Ubuntu ship UNO for the system interpreter (python3-uno) rather than
    # bundling a python next to soffice.
    if os.name != "nt":
        seen: set[str] = set()
        for candidate in (sys.executable, shutil.which("python3"), "/usr/bin/python3"):
            if not candidate or candidate in seen:
                continue
            seen.add(candidate)
            if os.path.isfile(candidate) and _python_can_import_uno(candidate):
                return candidate

    raise LibreOfficePdfError(
        "LibreOffice was found, but no Python runtime can import uno "
        f"(looked next to {program}). Install python3-uno, or set "
        "REPORTPEER_UNO_PYTHON to an interpreter that can import uno."
    )


def _timeout_seconds() -> float:
    raw = os.environ.get("REPORTPEER_LIBREOFFICE_TIMEOUT", "").strip()
    if not raw:
        return DEFAULT_TIMEOUT_SECONDS
    try:
        value = float(raw)
    except ValueError:
        return DEFAULT_TIMEOUT_SECONDS
    return value if value > 0 else DEFAULT_TIMEOUT_SECONDS


def _kill_process_tree(proc: subprocess.Popen) -> None:
    if proc.poll() is not None:
        return
    if os.name == "nt":
        subprocess.run(
            ["taskkill", "/F", "/T", "/PID", str(proc.pid)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        )
    else:
        proc.kill()
    try:
        proc.wait(timeout=15)
    except subprocess.TimeoutExpired:
        pass


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def finalize_docx_with_libreoffice(
    docx_path: str,
    pdf_path: str | None = None,
    timeout_seconds: float | None = None,
    *,
    update_indexes: bool = True,
) -> str | None:
    """
    Open docx_path in LibreOffice, optionally update TOC/LOF/LOT indexes, refresh
    fields, save the DOCX in place, and export pdf_path when requested.

    Uses a fresh user profile and a private listener socket. Does not call Word.
    """
    source = Path(docx_path).resolve()
    if not source.is_file():
        raise LibreOfficePdfError(f"DOCX not found for LibreOffice update: {source}")

    target: Path | None = None
    if pdf_path:
        target = Path(pdf_path).resolve()
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.exists():
            target.unlink()

    soffice = find_soffice()
    lo_python = find_libreoffice_python(soffice)
    timeout = _timeout_seconds() if timeout_seconds is None else timeout_seconds
    port = _free_port()
    profile_dir = tempfile.mkdtemp(prefix="reportpeer-lo-profile-")
    uno_dir = tempfile.mkdtemp(prefix="reportpeer-lo-uno-")
    uno_path = Path(uno_dir) / "update_and_export.py"
    uno_path.write_text(_UNO_SCRIPT, encoding="utf-8")
    user_installation = Path(profile_dir).resolve().as_uri()
    listener = [
        soffice,
        "--headless",
        "--norestore",
        "--nolockcheck",
        "--nologo",
        "--nodefault",
        "--nofirststartwizard",
        f"-env:UserInstallation={user_installation}",
        f"--accept=socket,host=127.0.0.1,port={port};urp;StarOffice.ServiceManager",
    ]
    proc: subprocess.Popen | None = None
    try:
        proc = subprocess.Popen(listener, cwd=str(Path(soffice).resolve().parent))
        result = subprocess.run(
            [
                lo_python,
                str(uno_path),
                str(source),
                str(target or ""),
                str(port),
                "1" if update_indexes else "0",
            ],
            cwd=str(Path(lo_python).resolve().parent),
            capture_output=True,
            text=True,
            timeout=timeout,
        )
    except subprocess.TimeoutExpired as error:
        raise LibreOfficePdfError(
            f"LibreOffice PDF conversion timed out after {int(timeout)} seconds."
        ) from error
    finally:
        if proc is not None:
            _kill_process_tree(proc)
        shutil.rmtree(profile_dir, ignore_errors=True)
        shutil.rmtree(uno_dir, ignore_errors=True)

    stdout = result.stdout or ""
    stderr = (result.stderr or "").strip()
    if result.returncode != 0 or "UNO_OK" not in stdout:
        lines = [line for line in (stderr or stdout).splitlines() if line.strip()]
        tail = lines[-1][:400] if lines else ""
        message = "LibreOffice field update failed."
        if result.returncode not in (0, None):
            message += f" Exit code {result.returncode}."
        if tail:
            message += f" {tail}"
        raise LibreOfficePdfError(message)
    if update_indexes and "FIELDS_REFRESHED YES" not in stdout:
        raise LibreOfficePdfError("LibreOffice did not refresh document fields.")
    if not source.is_file() or source.stat().st_size <= 0:
        raise LibreOfficePdfError("LibreOffice left the DOCX empty or missing.")
    if target is not None:
        if not target.is_file() or target.stat().st_size <= 0:
            raise LibreOfficePdfError("LibreOffice produced an empty PDF.")
        # TOC links come from same-session LO export; LOF/LOT need a small
        # post-pass because Writer does not emit PDF annotations for those indexes.
        add_lof_lot_links_to_pdf(target)
        return str(target)
    return None


def export_docx_via_libreoffice(
    docx_path: str,
    pdf_path: str,
    timeout_seconds: float | None = None,
) -> str:
    """Update indexes/fields and write a non-empty PDF. Returns the PDF path."""
    pdf = finalize_docx_with_libreoffice(docx_path, pdf_path, timeout_seconds)
    if not pdf:
        raise LibreOfficePdfError("LibreOffice produced an empty PDF.")
    return pdf
