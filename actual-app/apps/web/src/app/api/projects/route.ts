import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import clientPromise from "@/lib/mongodb";

export async function GET() {
  try {
    const { userId } = auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const client = await clientPromise; // Clean await without brackets
    const db = client.db("reportpeer");

    const projects = await db.collection("projects").find({ userId }).sort({ updatedAt: -1 }).toArray();
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

    // 1. Yahan Initial Structure Define Karein
    const initialStructure = [
      { id: "abstract", title: "Abstract", level: 1 },
      { id: "lof", title: "List of Figures", level: 1 },
      { id: "lot", title: "List of Tables", level: 1 },
      { id: "ack", title: "Acknowledgement", level: 1 },
      {
        id: "ch1",
        title: "CHAPTER 1 - INTRODUCTION",
        level: 1,
        subitems: [
          { id: "ch1-1", title: "Overview", level: 2 },
          { id: "ch1-2", title: "Purpose", level: 2 },
          { id: "ch1-3", title: "Stakeholders", level: 2 },
          { id: "ch1-4", title: "Benefits", level: 2 },
          { id: "ch1-5", title: "Background Study", level: 2 }
        ]
      },
      {
        id: "ch2",
        title: "CHAPTER 2 - REQUIREMENTS",
        level: 1,
        subitems: [
          { id: "ch2-1", title: "Functional Requirements", level: 2 },
          { id: "ch2-2", title: "Non-Functional Requirements", level: 2 }
        ]
      },
      {
        id: "ch3",
        title: "CHAPTER 3 - ANALYSIS AND DESIGN",
        level: 1,
        subitems: [
          { id: "ch3-1", title: "System Architecture with Diagram", level: 2 },
          { id: "ch3-2", title: "Entity Relationship Diagram", level: 2 },
          { id: "ch3-3", title: "Project Flow Diagram", level: 2 },
          { id: "ch3-4", title: "Use Cases", level: 2 },
          { id: "ch3-5", title: "Activity Diagram", level: 2 },
          { id: "ch3-6", title: "User Interface Design", level: 2 }
        ]
      },
      {
        id: "ch4",
        title: "CHAPTER 4 - PROJECT PLAN",
        level: 1,
        subitems: [
          {
            id: "ch4-1",
            title: "Process Model (Agile)",
            level: 2,
            subitems: [
              { id: "ch4-1-1", title: "User Stories", level: 3 },
              { id: "ch4-1-2", title: "Sprints Planning", level: 3 },
              { id: "ch4-1-3", title: "Sprints Sizing", level: 3 }
            ]
          },
          { id: "ch4-2", title: "Timeline with Milestones", level: 2 }
        ]
      },
      {
        id: "ch5",
        title: "CHAPTER 5 - TEST PLAN",
        level: 1,
        subitems: [
          { id: "ch5-1", title: "Test Cases", level: 2 },
          { id: "ch5-2", title: "Automated Testing Tools", level: 2 }
        ]
      },
      {
        id: "ch6",
        title: "CHAPTER 6 - IMPLEMENTATION DETAILS",
        level: 1,
        subitems: [
          { id: "ch6-1", title: "Tools and Technology", level: 2 },
          { id: "ch6-2", title: "Data Dictionary", level: 2 },
          { id: "ch6-3", title: "Version Control", level: 2 },
          { id: "ch6-4", title: "Web APIs / Web Services", level: 2 },
          { id: "ch6-5", title: "Website Development", level: 2 },
          { id: "ch6-6", title: "Mobile Application Development", level: 2 },
          {
            id: "ch6-7",
            title: "Deployment",
            level: 2,
            subitems: [
              { id: "ch6-7-1", title: "Website Hosting", level: 3 },
              { id: "ch6-7-2", title: "Mobile Application Deployment", level: 3 }
            ]
          }
        ]
      },
      { id: "ch7", title: "CHAPTER 7 - CONCLUSION AND FUTURE WORK", level: 1 },
      { id: "refs", title: "REFERENCES", level: 1 },
      { id: "appa", title: "APPENDIX A - SCREENSHOTS", level: 1 },
      { id: "appb", title: "APPENDIX B - ABBREVIATION", level: 1 }
    ];

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
      contentMap: {}
    };

    const result = await db.collection("projects").insertOne(newProject);
    return NextResponse.json({ success: true, projectId: result.insertedId }, { status: 201 });
  } catch (error) {
    console.error("Database Insert Error:", error);
    const message = error instanceof Error ? error.message : "Failed to create project";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}