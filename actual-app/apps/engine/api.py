"""Optional HTTP wrapper. The website uses the CLI via the Next.js service layer."""
from pathlib import Path
from tempfile import NamedTemporaryFile

from fastapi import FastAPI
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from generate import generate_report

app = FastAPI(title="ReportPeer Generation Service")


class ReportRequest(BaseModel):
    title: str = "FYP Report"
    university: str = "JUW"
    structure: list = Field(default_factory=list)
    contentMap: dict = Field(default_factory=dict)


@app.post("/generate-report")
def generate_report_api(data: ReportRequest):
    with NamedTemporaryFile(suffix=".docx", delete=False) as handle:
        output_path = handle.name

    payload = data.model_dump() if hasattr(data, "model_dump") else data.dict()
    generate_report(payload, output_path, data.university)
    filename = f"{data.title or 'FYP_Report'}.docx"
    return FileResponse(
        output_path,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename=filename,
    )
