import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import type { StructureItem } from "@/lib/structureUtils";
import { AiClientError, createChatCompletion } from "@/services/ai/aiClient";
import { EMPTY_AI_PROFILE_MESSAGE } from "@/services/ai/aiProfile";
import { buildGenerateContext } from "@/services/ai/buildContext";
import {
  type AiRefineMode,
  type ClarificationAnswer,
  AI_REFINE_MODE_INSTRUCTIONS,
  JUW_SYSTEM_PROMPT,
  buildClarificationCheckPrompt,
  buildGenerateUserPrompt,
  buildImproveExpandUserPrompt,
  isUsableAiDraft,
  parseClarificationAssessment,
} from "@/services/ai/prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type AiAction = "generate" | "improve";

function normalizeClarificationAnswers(raw: unknown): ClarificationAnswer[] {
  if (!Array.isArray(raw)) return [];
  const out: ClarificationAnswer[] = [];
  for (const entry of raw.slice(0, 8)) {
    if (!entry || typeof entry !== "object") continue;
    const question = String((entry as ClarificationAnswer).question || "").trim().slice(0, 500);
    const answer = String((entry as ClarificationAnswer).answer || "").trim().slice(0, 2000);
    if (question && answer) out.push({ question, answer });
  }
  return out;
}

function resolveRefineMode(raw: unknown): AiRefineMode {
  const mode = String(raw || "improve").trim().toLowerCase();
  if (
    mode === "grammar" ||
    mode === "tone" ||
    mode === "refine" ||
    mode === "improve" ||
    mode === "humanize"
  ) {
    return mode;
  }
  return "improve";
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
    if (!projectId || !ObjectId.isValid(projectId)) {
      return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "").trim() as AiAction;
    const sectionId = String(body?.sectionId || "").trim();
    const message =
      typeof body?.message === "string" ? body.message.slice(0, 2000) : undefined;
    const clarificationAnswers = normalizeClarificationAnswers(body?.clarificationAnswers);
    const forceGenerate = body?.forceGenerate === true;
    const sourceText =
      typeof body?.sourceText === "string" ? body.sourceText.slice(0, 12000) : "";
    const refineMode = resolveRefineMode(body?.mode);

    if (action !== "generate" && action !== "improve") {
      return NextResponse.json(
        { error: 'Unsupported action. Use action: "generate" or "improve".' },
        { status: 400 }
      );
    }
    if (!sectionId) {
      return NextResponse.json({ error: "sectionId is required." }, { status: 400 });
    }

    // Same ownership lookup as project GET/PATCH (native driver).
    const client = await clientPromise;
    const db = client.db("reportpeer");
    const project = await db.collection("projects").findOne({
      _id: new ObjectId(projectId),
      userId,
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const projectData = project as {
      title?: string;
      projectTitle?: string;
      structure?: StructureItem[];
      contentMap?: Record<string, string>;
      aiProfile?: unknown;
    };

    let context;
    try {
      context = buildGenerateContext(
        {
          title: projectData.title,
          projectTitle: projectData.projectTitle,
          structure: projectData.structure || [],
          contentMap: projectData.contentMap || {},
          aiProfile: projectData.aiProfile,
        },
        sectionId
      );
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Invalid section." },
        { status: 400 }
      );
    }

    if (context.profileEmpty) {
      return NextResponse.json({
        action,
        sectionId,
        sectionTitle: context.sectionTitle,
        needs_clarification: false,
        question: null,
        draft: EMPTY_AI_PROFILE_MESSAGE,
        needsProfile: true,
      });
    }

    if (action === "improve") {
      const textToImprove = sourceText.trim() || context.existingContent.trim();
      if (!textToImprove) {
        return NextResponse.json(
          {
            error:
              "No content to improve. Generate a draft first, or add text in the selected section.",
          },
          { status: 400 }
        );
      }

      const modeInstruction = AI_REFINE_MODE_INSTRUCTIONS[refineMode];
      const combinedMessage = [modeInstruction, message].filter(Boolean).join("\n");

      const draft = await createChatCompletion(
        [
          { role: "system", content: JUW_SYSTEM_PROMPT },
          {
            role: "user",
            content: buildImproveExpandUserPrompt({
              projectTitle: context.projectTitle,
              sectionTitle: context.sectionTitle,
              sectionPath: context.sectionPath,
              existingContent: context.existingContent,
              sourceText: textToImprove,
              aiProfileText: context.aiProfileText,
              juwSectionGuideText: context.juwSectionGuideText,
              message: combinedMessage,
            }),
          },
        ],
        { temperature: refineMode === "grammar" ? 0.2 : 0.35, maxTokens: 1400 }
      );

      if (!isUsableAiDraft(draft, EMPTY_AI_PROFILE_MESSAGE)) {
        return NextResponse.json(
          { error: "AI returned an unusable draft. Please try again." },
          { status: 502 }
        );
      }

      return NextResponse.json({
        action: "improve",
        mode: refineMode,
        sectionId,
        sectionTitle: context.sectionTitle,
        needs_clarification: false,
        question: null,
        draft,
      });
    }

    const promptParams = {
      projectTitle: context.projectTitle,
      sectionTitle: context.sectionTitle,
      sectionPath: context.sectionPath,
      existingContent: context.existingContent,
      aiProfileText: context.aiProfileText,
      juwSectionGuideText: context.juwSectionGuideText,
      clarificationAnswers,
      message,
    };

    if (!forceGenerate) {
      const assessmentRaw = await createChatCompletion(
        [
          {
            role: "system",
            content:
              "You assess factual completeness for academic FYP drafting. Reply with JSON only.",
          },
          { role: "user", content: buildClarificationCheckPrompt(promptParams) },
        ],
        { temperature: 0.1, maxTokens: 250 }
      );
      const assessment = parseClarificationAssessment(assessmentRaw);
      if (assessment.needs_clarification && assessment.question) {
        return NextResponse.json({
          action: "generate",
          sectionId,
          sectionTitle: context.sectionTitle,
          needs_clarification: true,
          question: assessment.question,
          draft: null,
        });
      }
    }

    const draft = await createChatCompletion(
      [
        { role: "system", content: JUW_SYSTEM_PROMPT },
        { role: "user", content: buildGenerateUserPrompt(promptParams) },
      ],
      { temperature: 0.4, maxTokens: 1200 }
    );

    if (!isUsableAiDraft(draft, EMPTY_AI_PROFILE_MESSAGE)) {
      return NextResponse.json(
        { error: "AI returned an unusable draft. Please try again." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      action: "generate",
      sectionId,
      sectionTitle: context.sectionTitle,
      needs_clarification: false,
      question: null,
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
