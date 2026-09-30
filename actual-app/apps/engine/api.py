"""Authenticated HTTP wrapper around the ReportPeer generation engine.

Same pipeline as the CLI (generate.py): python-docx builds the DOCX, then a
single LibreOffice session updates TOC/LOF/LOT and exports the PDF. Word COM is
never imported here, so this module runs unchanged on Linux.
"""

from __future__ import annotations

import hmac
import os
import re
import shutil
import tempfile
import threading
from pathlib import Path
from typing import Any

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field
from starlette.background import BackgroundTask

from core.libreoffice_pdf import (
    LibreOfficePdfError,
    find_libreoffice_python,
    find_soffice,
)
from generate import generate_report_files

DOCX_CONTENT_TYPE = (
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
)
PDF_CONTENT_TYPE = "application/pdf"

FILENAME_STRIP_RE = re.compile(r'[<>:"/\\|?*\u0000-\u001f]')
FILENAME_KEEP_RE = re.compile(r"[^\w.-]")

# LibreOffice is CPU and memory heavy; serialize reports per container.
_MAX_CONCURRENT = max(1, int(os.environ.get("REPORTPEER_MAX_CONCURRENT", "1") or 1))
_generation_slots = threading.Semaphore(_MAX_CONCURRENT)

app = FastAPI(title="ReportPeer Generation Service")


class ReportRequest(BaseModel):
    """Mirrors the payload the Next.js report service already builds."""

    title: str | None = None
    university: str | None = "JUW"
    structure: list[dict[str, Any]] = Field(default_factory=list)
    contentMap: dict[str, Any] = Field(default_factory=dict)
    references: list[dict[str, Any]] = Field(default_factory=list)
    meta: dict[str, Any] = Field(default_factory=dict)
    format: str | None = None

    model_config = {"extra": "allow"}


def _configured_secret() -> str:
    return (os.environ.get("REPORTPEER_ENGINE_SECRET") or "").strip()


def require_engine_secret(
    authorization: str | None = Header(default=None),
    x_engine_secret: str | None = Header(default=None, alias="X-Engine-Secret"),
) -> None:
    """Shared-secret auth. Fails closed when the secret is not configured."""
    expected = _configured_secret()
    if not expected:
        raise HTTPException(
            status_code=503,
            detail="REPORTPEER_ENGINE_SECRET is not configured on the engine.",
        )

    presented = ""
    if authorization:
        scheme, _, value = authorization.partition(" ")
        presented = value.strip() if scheme.lower() == "bearer" else authorization.strip()
    if not presented and x_engine_secret:
        presented = x_engine_secret.strip()

    if not presented or not hmac.compare_digest(presented, expected):
        raise HTTPException(status_code=401, detail="Invalid engine credentials.")


def _download_filename(title: str | None, fmt: str) -> str:
    cleaned = FILENAME_STRIP_RE.sub("", str(title or "FYP_Report"))
    cleaned = re.sub(r"\s+", "_", cleaned)
    cleaned = FILENAME_KEEP_RE.sub("", cleaned)[:80] or "FYP_Report"
    return f"{cleaned}.pdf" if fmt == "pdf" else f"{cleaned}.docx"


def _resolve_format(body_format: str | None, query_format: str | None) -> str:
    for candidate in (query_format, body_format):
        value = str(candidate or "").strip().lower()
        if value in {"docx", "pdf"}:
            return value
    return "docx"


@app.get("/health")
def health(deep: int = Query(default=0)) -> JSONResponse:
    """Liveness plus a LibreOffice check, so a broken image fails visibly.

    `?deep=1` also resolves the UNO interpreter. That spawns a probe process,
    so it is opt-in and kept out of the platform health check.
    """
    payload: dict[str, Any] = {
        "ok": True,
        "service": "reportpeer-engine",
        "authConfigured": bool(_configured_secret()),
    }
    try:
        soffice = find_soffice()
        payload["soffice"] = soffice
    except LibreOfficePdfError as error:
        payload["ok"] = False
        payload["soffice"] = None
        payload["error"] = str(error)
        return JSONResponse(payload, status_code=503)

    if deep:
        try:
            payload["unoPython"] = find_libreoffice_python(soffice)
        except LibreOfficePdfError as error:
            payload["ok"] = False
            payload["unoPython"] = None
            payload["error"] = str(error)

    return JSONResponse(payload, status_code=200 if payload["ok"] else 503)


@app.post("/generate-report", dependencies=[Depends(require_engine_secret)])
def generate_report_endpoint(
    request: ReportRequest,
    format: str | None = Query(default=None),
):
    if not request.structure:
        raise HTTPException(status_code=400, detail="Project structure is empty.")

    export_format = _resolve_format(request.format, format)
    payload = request.model_dump(exclude_none=False)
    payload.pop("format", None)
    payload["university"] = request.university or "JUW"
    payload["title"] = request.title or "FYP Report"

    work_dir = tempfile.mkdtemp(prefix="reportpeer-engine-")
    cleanup = BackgroundTask(shutil.rmtree, work_dir, ignore_errors=True)
    docx_path = str(Path(work_dir) / "report.docx")
    pdf_path = str(Path(work_dir) / "report.pdf") if export_format == "pdf" else None

    acquired = _generation_slots.acquire(timeout=float(
        os.environ.get("REPORTPEER_QUEUE_TIMEOUT", "300") or 300
    ))
    if not acquired:
        shutil.rmtree(work_dir, ignore_errors=True)
        raise HTTPException(status_code=503, detail="Engine is busy. Retry shortly.")

    try:
        written_docx, written_pdf = generate_report_files(
            payload, docx_path, pdf_path, payload["university"]
        )
    except Exception as error:
        shutil.rmtree(work_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail=str(error)) from error
    finally:
        _generation_slots.release()

    artifact = written_pdf if export_format == "pdf" else written_docx
    if not artifact or not Path(artifact).is_file() or Path(artifact).stat().st_size <= 0:
        shutil.rmtree(work_dir, ignore_errors=True)
        raise HTTPException(
            status_code=500, detail=f"The engine produced an empty {export_format.upper()}."
        )

    return FileResponse(
        artifact,
        media_type=PDF_CONTENT_TYPE if export_format == "pdf" else DOCX_CONTENT_TYPE,
        filename=_download_filename(payload["title"], export_format),
        background=cleanup,
    )
