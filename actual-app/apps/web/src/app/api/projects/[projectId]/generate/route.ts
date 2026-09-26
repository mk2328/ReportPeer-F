import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import {
  generateProjectDocx,
  ReportExportFormat,
  ReportGenerationError,
} from "@/services/reportGeneration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

async function resolveExportFormat(req: Request): Promise<ReportExportFormat> {
  const url = new URL(req.url);
  const queryFormat = url.searchParams.get("format") || url.searchParams.get("type");
  if (queryFormat === "pdf") return "pdf";
  if (queryFormat === "docx") return "docx";

  try {
    const body = await req.json();
    if (body && (body.format === "pdf" || body.type === "pdf")) return "pdf";
    if (body && (body.format === "docx" || body.type === "docx")) return "docx";
  } catch {
    // Empty / non-JSON body → default DOCX (backward compatible).
  }
  return "docx";
}

export async function POST(
  req: Request,
  { params }: { params: { projectId: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId } = params;
    if (!ObjectId.isValid(projectId)) {
      return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
    }

    const format = await resolveExportFormat(req);

    const client = await clientPromise;
    const db = client.db("reportpeer");
    const project = await db.collection("projects").findOne({
      _id: new ObjectId(projectId),
      userId,
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const generated = await generateProjectDocx(
      {
        title: project.title || project.projectTitle || "FYP Report",
        university: project.university || "JUW",
        structure: project.structure || [],
        contentMap: project.contentMap || {},
        references: Array.isArray(project.references) ? project.references : [],
        projectTitle: project.projectTitle || project.title,
        projectAdvisor: project.projectAdvisor,
        department: project.department,
        submissionMonthYear: project.submissionMonthYear,
        teamMembers: project.teamMembers || [],
        universityLogo: project.universityLogo,
        meta: {
          projectTitle: project.projectTitle || project.title,
          projectAdvisor: project.projectAdvisor,
          supervisor: project.projectAdvisor,
          department: project.department,
          submissionMonthYear: project.submissionMonthYear,
          approvalDate: project.approvalDate || project.submissionMonthYear,
          teamMembers: project.teamMembers || [],
          students: project.teamMembers || [],
          universityName: project.universityName,
          faculty: project.faculty,
          city: project.city,
          degree: project.degree,
          internalExaminer: project.internalExaminer,
          externalExaminer: project.externalExaminer,
          headOfDepartment: project.headOfDepartment,
          internalExaminerDesignation: (project as any).internalExaminerDesignation,
          externalExaminerDesignation: (project as any).externalExaminerDesignation,
          externalExaminerOrganization: (project as any).externalExaminerOrganization,
          universityLogo: project.universityLogo,
          logoDataUrl: project.universityLogo?.dataUrl,
        },
      },
      { format }
    );

    return new NextResponse(new Uint8Array(generated.buffer), {
      status: 200,
      headers: {
        "Content-Type": generated.contentType,
        "Content-Disposition": `attachment; filename="${generated.filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof ReportGenerationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Report generation error:", error);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}
