import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { normalizeAiProfile } from "@/services/ai/aiProfile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function findOwnedProject(projectId: string, userId: string) {
  if (!ObjectId.isValid(projectId)) return null;
  const client = await clientPromise;
  const db = client.db("reportpeer");
  return db.collection("projects").findOne({
    _id: new ObjectId(projectId),
    userId,
  });
}

export async function GET(
  _req: Request,
  { params }: { params: { projectId: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId } = params;
    console.log("Fetching Project ID:", projectId);

    const project = await findOwnedProject(projectId, userId);
    if (!project) {
      console.log("Project NOT found in DB");
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json(project);
  } catch (error) {
    console.error("Fetch Error:", error);
    return NextResponse.json({ error: "Failed to fetch project" }, { status: 500 });
  }
}

export async function PATCH(
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

    const body = await req.json().catch(() => ({}));
    const {
      structure,
      contentMap,
      references,
      aiProfile,
      diagramSpecs,
      projectTitle,
      projectAdvisor,
      department,
      submissionMonthYear,
      teamMembers,
      degree,
      faculty,
      city,
      universityName,
      internalExaminer,
      externalExaminer,
      headOfDepartment,
      approvalDate,
      title,
      universityLogo,
      internalExaminerDesignation,
      externalExaminerDesignation,
      externalExaminerOrganization,
    } = body;

    const $set: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    if (structure !== undefined) $set.structure = structure;
    if (contentMap !== undefined) $set.contentMap = contentMap;
    if (references !== undefined) $set.references = references;
    if (aiProfile !== undefined) $set.aiProfile = normalizeAiProfile(aiProfile);
    if (diagramSpecs !== undefined) $set.diagramSpecs = diagramSpecs;
    if (projectTitle !== undefined) $set.projectTitle = projectTitle;
    if (title !== undefined) $set.title = title;
    if (projectAdvisor !== undefined) $set.projectAdvisor = projectAdvisor;
    if (department !== undefined) $set.department = department;
    if (submissionMonthYear !== undefined) $set.submissionMonthYear = submissionMonthYear;
    if (teamMembers !== undefined) $set.teamMembers = teamMembers;
    if (degree !== undefined) $set.degree = degree;
    if (faculty !== undefined) $set.faculty = faculty;
    if (city !== undefined) $set.city = city;
    if (universityName !== undefined) $set.universityName = universityName;
    if (internalExaminer !== undefined) $set.internalExaminer = internalExaminer;
    if (externalExaminer !== undefined) $set.externalExaminer = externalExaminer;
    if (headOfDepartment !== undefined) $set.headOfDepartment = headOfDepartment;
    if (approvalDate !== undefined) $set.approvalDate = approvalDate;
    if (universityLogo !== undefined) $set.universityLogo = universityLogo;
    if (internalExaminerDesignation !== undefined) {
      $set.internalExaminerDesignation = internalExaminerDesignation;
    }
    if (externalExaminerDesignation !== undefined) {
      $set.externalExaminerDesignation = externalExaminerDesignation;
    }
    if (externalExaminerOrganization !== undefined) {
      $set.externalExaminerOrganization = externalExaminerOrganization;
    }

    const client = await clientPromise;
    const db = client.db("reportpeer");

    // Same ownership lookup as GET / generate (native driver + ObjectId).
    const updatedProject = await db.collection("projects").findOneAndUpdate(
      { _id: new ObjectId(projectId), userId },
      { $set },
      { returnDocument: "after" }
    );

    // Driver return shape differs by version: document | { value: document }.
    const doc =
      updatedProject &&
      typeof updatedProject === "object" &&
      "value" in (updatedProject as unknown as Record<string, unknown>)
        ? (updatedProject as unknown as { value: unknown }).value
        : updatedProject;

    if (!doc) {
      console.log("PATCH Project NOT found:", projectId, "userId:", userId);
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: doc });
  } catch (error) {
    console.error("PATCH Error:", error);
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
  }
}
