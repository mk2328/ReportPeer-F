import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import clientPromise from "@/lib/mongodb";
import { resolveUniversityPack } from "@/universityPacks";

export async function GET() {
  try {
    const { userId } = auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const client = await clientPromise; // Clean await without brackets
    const db = client.db("reportpeer");

    const projects = await db
      .collection("projects")
      .find(
        { userId },
        {
          projection: {
            title: 1,
            university: 1,
            status: 1,
            updatedAt: 1,
          },
        }
      )
      .sort({ updatedAt: -1 })
      .toArray();
    return NextResponse.json(projects, { status: 200 });
  } catch (error) {
    console.error("Database Fetch Error:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch projects";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { title, university } = body;

    if (!title || !university) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const pack = resolveUniversityPack(university);
    const initialStructure = pack.editorSeedStructure;

    const client = await clientPromise;
    const db = client.db("reportpeer");

    const newProject = {
      userId,
      title,
      university,
      projectTitle: title,
      projectAdvisor: "",
      submissionMonthYear: "",
      department: "Department of Computer Science and Software Engineering",
      degree: "Bachelor of Science in Computer Science and Software Engineering",
      faculty: "Faculty of Science",
      city: "Karachi, Pakistan",
      teamMembers: [],
      status: "In progress",
      createdAt: new Date(),
      updatedAt: new Date(),
      structure: initialStructure,
      contentMap: {},
    };

    const result = await db.collection("projects").insertOne(newProject);
    return NextResponse.json({ success: true, projectId: result.insertedId }, { status: 201 });
  } catch (error) {
    console.error("Database Insert Error:", error);
    const message = error instanceof Error ? error.message : "Failed to create project";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
