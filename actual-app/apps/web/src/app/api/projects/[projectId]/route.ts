import { NextResponse } from 'next/server';
import { auth } from "@clerk/nextjs/server";
import Report from '@/models/Report'; // Aapka Mongoose model
import mongoose from 'mongoose';
import { normalizeAiProfile } from '@/services/ai/aiProfile';

export async function GET(req: Request, { params }: { params: { projectId: string } }) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId } = params;
    console.log("Fetching Project ID:", projectId);

    // Database connect karein agar connected nahi hai
    if (mongoose.connection.readyState !== 1) {
       await mongoose.connect(process.env.MONGODB_URI!);
    }

    // Mongoose model use karein, raw collection nahi
    const project = await Report.findOne({ _id: projectId, userId });

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

export async function PATCH(req: Request, { params }: { params: { projectId: string } }) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId } = params;
    const body = await req.json();
    const { structure, contentMap, references, aiProfile, projectTitle, projectAdvisor, department, submissionMonthYear, teamMembers, degree, faculty, city, universityName, internalExaminer, externalExaminer, headOfDepartment, approvalDate, title, universityLogo, internalExaminerDesignation, externalExaminerDesignation, externalExaminerOrganization } = body;

    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGODB_URI!);
    }

    const $set: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    if (structure !== undefined) $set.structure = structure;
    if (contentMap !== undefined) $set.contentMap = contentMap;
    if (references !== undefined) $set.references = references;
    if (aiProfile !== undefined) $set.aiProfile = normalizeAiProfile(aiProfile);
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
    if (internalExaminerDesignation !== undefined) $set.internalExaminerDesignation = internalExaminerDesignation;
    if (externalExaminerDesignation !== undefined) $set.externalExaminerDesignation = externalExaminerDesignation;
    if (externalExaminerOrganization !== undefined) $set.externalExaminerOrganization = externalExaminerOrganization;

    // Poora tree structure aur contentMap update karein
    const updatedProject = await Report.findOneAndUpdate(
      { _id: projectId, userId },
      { $set },
      { new: true }
    );

    if (!updatedProject) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: updatedProject });
  } catch (error) {
    console.error("PATCH Error:", error);
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
  }
}