import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import Report from "@/models/Report";
import { AiClientError, createChatCompletion } from "@/services/ai/aiClient";
import { EMPTY_AI_PROFILE_MESSAGE } from "@/services/ai/aiProfile";
import { buildGenerateContext } from "@/services/ai/buildContext";
import { JUW_SYSTEM_PROMPT, buildGenerateUserPrompt } from "@/services/ai/prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type AiAction = "generate";

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
    if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
      return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "").trim() as AiAction;
    const sectionId = String(body?.sectionId || "").trim();
    const message =
      typeof body?.message === "string" ? body.message.slice(0, 2000) : undefined;

    if (action !== "generate") {
      return NextResponse.json(
        { error: "Unsupported action. Phase P0 only supports action: \"generate\"." },
        { status: 400 }
      );
    }
    if (!sectionId) {
      return NextResponse.json({ error: "sectionId is required." }, { status: 400 });
    }

    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGODB_URI!);
    }

    const project = await Report.findOne({ _id: projectId, userId }).lean();
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    let context;
    try {
      context = buildGenerateContext(
        {
          title: (project as any).title,
          projectTitle: (project as any).projectTitle,
          structure: (project as any).structure || [],
          contentMap: (project as any).contentMap || {},
          aiProfile: (project as any).aiProfile,
        },
        sectionId
      );
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Invalid section." },
        { status: 400 }
      );
    }

    // Completely empty profile → do not call the LLM or invent project facts.
    if (context.profileEmpty) {
      return NextResponse.json({
        action: "generate",
        sectionId,
        sectionTitle: context.sectionTitle,
        draft: EMPTY_AI_PROFILE_MESSAGE,
        needsProfile: true,
      });
    }

    const draft = await createChatCompletion(
      [
        { role: "system", content: JUW_SYSTEM_PROMPT },
        {
          role: "user",
          content: buildGenerateUserPrompt({
            projectTitle: context.projectTitle,
            sectionTitle: context.sectionTitle,
            sectionPath: context.sectionPath,
            existingContent: context.existingContent,
            aiProfileText: context.aiProfileText,
            message,
          }),
        },
      ],
      { temperature: 0.4, maxTokens: 1200 }
    );

    return NextResponse.json({
      action: "generate",
      sectionId,
      sectionTitle: context.sectionTitle,
      draft,
    });
  } catch (error) {
    if (error instanceof AiClientError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("AI generate error:", error);
    return NextResponse.json({ error: "Failed to generate AI draft" }, { status: 500 });
  }
}
