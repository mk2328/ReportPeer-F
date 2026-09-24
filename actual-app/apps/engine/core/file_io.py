"""Windows-safe helpers for DOCX files that Word COM may still be holding."""

from __future__ import annotations

import os
import time


def wait_until_unlocked(path: str, timeout_seconds: float = 20.0, interval: float = 0.2) -> None:
    target = os.path.abspath(path)
    deadline = time.monotonic() + timeout_seconds
    last_error = None
    while time.monotonic() < deadline:
        try:
            handle = os.open(target, os.O_RDWR)
            os.close(handle)
            return
        except OSError as error:
            last_error = error
            time.sleep(interval)
    if last_error is not None:
        raise last_error


def save_docx_replacing(document, path: str, timeout_seconds: float = 20.0) -> None:
    """Write to a sibling temp file, then replace once the destination is writable."""
    target = os.path.abspath(path)
    temp_path = f"{target}.tmp"
    if os.path.exists(temp_path):
        try:
            os.remove(temp_path)
        except OSError:
            pass

    document.save(temp_path)

    deadline = time.monotonic() + timeout_seconds
    last_error = None
    while time.monotonic() < deadline:
        try:
            os.replace(temp_path, target)
            return
        except OSError as error:
            last_error = error
            time.sleep(0.2)
    if last_error is not None:
        raise last_error


def remove_empty_paragraphs_before_page_break_before(path: str) -> int:
    """
    Word TOC/TOF updates often leave an empty paragraph that only holds the
    outer field's closing fldChar. Combined with the next heading's
    pageBreakBefore, that empty paragraph becomes a blank page (TOC → blank → LOF).

    Move any trailing fldChar end onto the previous paragraph, then remove the
    empty paragraph.
    """
    from copy import deepcopy

    from docx import Document
    from docx.oxml.ns import qn

    wait_until_unlocked(path)
    document = Document(str(path))
    body = document.element.body
    children = list(body)
    removed = 0

    for index, child in enumerate(children):
        if child.tag != qn("w:p"):
            continue
        p_pr = child.find(qn("w:pPr"))
        if p_pr is None or p_pr.find(qn("w:pageBreakBefore")) is None:
            continue
        if index == 0:
            continue

        previous = children[index - 1]
        if previous.tag != qn("w:p"):
            continue

        text = "".join(node.text or "" for node in previous.iter(qn("w:t"))).strip()
        if text:
            continue
        if previous.find(".//" + qn("w:drawing")) is not None:
            continue

        # Move closing field mark(s) onto the previous content paragraph.
        anchor = children[index - 2] if index >= 2 else None
        if anchor is not None and anchor.tag == qn("w:p"):
            for run in list(previous.findall(qn("w:r"))):
                fld_chars = list(run.findall(qn("w:fldChar")))
                if fld_chars and all(fc.get(qn("w:fldCharType")) == "end" for fc in fld_chars):
                    anchor.append(deepcopy(run))
                elif not fld_chars and not "".join(node.text or "" for node in run.iter(qn("w:t"))).strip():
                    continue
                else:
                    # Unexpected content — do not remove this paragraph.
                    anchor = None
                    break

        if anchor is None:
            continue

        body.remove(previous)
        removed += 1

    if removed:
        save_docx_replacing(document, path)
    return removed

