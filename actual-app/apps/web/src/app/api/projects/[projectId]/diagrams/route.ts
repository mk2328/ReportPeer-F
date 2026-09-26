import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import type { StructureItem } from "@/lib/structureUtils";
import { AiClientError, createChatCompletion } from "@/services/ai/aiClient";
import {
  EMPTY_AI_PROFILE_MESSAGE,
  isAiProfileEmpty,
  normalizeAiProfile,
} from "@/services/ai/aiProfile";
import { buildGenerateContext } from "@/services/ai/buildContext";
import {
  buildDiagramClarificationPrompt,
  buildDiagramGenerateSpecPrompt,
} from "@/services/ai/diagramPrompts";
import { parseAndValidateDiagramSpec } from "@/services/ai/diagramSpec";
import {
  type FypDiagramKind,
  FYP_DIAGRAM_CATALOG,
  findFypDiagramSection,
} from "@/services/ai/fypDiagrams";
import {
  type ClarificationAnswer,
  parseClarificationAssessment,
} from "@/services/ai/prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type DiagramAction = "clarify" | "generate";

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

function resolveKind(raw: unknown): FypDiagramKind | null {
  const kind = String(raw || "").trim().toLowerCase();
  if (
    kind === "architecture" ||
    kind === "erd" ||
    kind === "flow" ||
    kind === "usecase" ||
    kind === "activity"
  ) {
    return kind;
  }
  return null;
}

function siblingChapter3Titles(structure: StructureItem[]): string[] {
  return FYP_DIAGRAM_CATALOG.map((entry) => {
    const section = findFypDiagramSection(structure, entry);
    return section?.title || entry.canonicalSection;
  });
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
    const action = String(body?.action || "").trim() as DiagramAction;
    const kind = resolveKind(body?.kind);
    const clarificationAnswers = normalizeClarificationAnswers(body?.clarificationAnswers);
    const forceGenerate = body?.forceGenerate === true;

    if (action !== "clarify" && action !== "generate") {
      return NextResponse.json(
        { error: 'Unsupported action. Use action: "clarify" or "generate".' },
        { status: 400 }
      );
    }
    if (!kind) {
      return NextResponse.json(
        { error: "kind is required (architecture|erd|flow|usecase|activity)." },
        { status: 400 }
      );
    }

    const catalogEntry = FYP_DIAGRAM_CATALOG.find((e) => e.kind === kind);
    if (!catalogEntry) {
      return NextResponse.json({ error: "Unknown diagram kind." }, { status: 400 });
    }

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

    const structure = projectData.structure || [];
    const section =
      findFypDiagramSection(structure, catalogEntry) ||
      ({ id: catalogEntry.sectionId, title: catalogEntry.canonicalSection, level: 2 } as StructureItem);

    let context;
    try {
      context = buildGenerateContext(
        {
          title: projectData.title,
          projectTitle: projectData.projectTitle,
          structure,
          contentMap: projectData.contentMap || {},
          aiProfile: projectData.aiProfile,
        },
        section.id
      );
    } catch {
      // Section missing from structure — still allow with catalog fallback context
      const profile = normalizeAiProfile(projectData.aiProfile);
      if (isAiProfileEmpty(profile)) {
        return NextResponse.json({
          action,
          kind,
          sectionId: catalogEntry.sectionId,
          needs_clarification: false,
          question: null,
          spec: null,
          needsProfile: true,
          draft: EMPTY_AI_PROFILE_MESSAGE,
        });
      }
      return NextResponse.json(
        { error: `Diagram section "${catalogEntry.sectionId}" not found in this project.` },
        { status: 400 }
      );
    }

    if (context.profileEmpty) {
      return NextResponse.json({
        action,
        kind,
        sectionId: section.id,
        needs_clarification: false,
        question: null,
        spec: null,
        needsProfile: true,
        error: EMPTY_AI_PROFILE_MESSAGE,
      });
    }

    const siblingSections = siblingChapter3Titles(structure);
    const promptParams = {
      kind,
      projectTitle: context.projectTitle,
      sectionTitle: context.sectionTitle,
      sectionPath: context.sectionPath,
      existingContent: context.existingContent,
      aiProfileText: context.aiProfileText,
      juwSectionGuideText: context.juwSectionGuideText,
      siblingSections,
      clarificationAnswers,
    };

    const runClarify = action === "clarify" || (action === "generate" && !forceGenerate);

    if (runClarify) {
      const assessmentRaw = await createChatCompletion(
        [
          {
            role: "system",
            content:
              "You assess whether FYP diagram facts are sufficient. Prefer Project AI Profile and report context. Ask at most one short question only for genuinely missing essentials. Never invent project facts. Reply with JSON only.",
          },
          { role: "user", content: buildDiagramClarificationPrompt(promptParams) },
        ],
        { temperature: 0.1, maxTokens: 250 }
      );
      const assessment = parseClarificationAssessment(assessmentRaw);
      if (assessment.needs_clarification && assessment.question) {
        return NextResponse.json({
          action,
          kind,
          sectionId: section.id,
          needs_clarification: true,
          question: assessment.question,
          spec: null,
        });
      }
      if (action === "clarify") {
        return NextResponse.json({
          action: "clarify",
          kind,
          sectionId: section.id,
          needs_clarification: false,
          question: null,
          spec: null,
        });
      }
    }

    const specRaw = await createChatCompletion(
      [
        {
          role: "system",
          content:
            "You output DiagramSpec JSON only for academic FYP diagrams. Derive structure from Project AI Profile, report context, and clarifications. Never invent project facts. Never ask the user for use-case connections — derive links yourself.",
        },
        { role: "user", content: buildDiagramGenerateSpecPrompt(promptParams) },
      ],
      { temperature: 0.25, maxTokens: 1600 }
    );

    const validated = parseAndValidateDiagramSpec(kind, specRaw);
    if (!validated.ok) {
      return NextResponse.json(
        {
          action: "generate",
          kind,
          sectionId: section.id,
          needs_clarification: false,
          question: null,
          spec: null,
          error: validated.error,
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      action: "generate",
      kind,
      sectionId: section.id,
      needs_clarification: false,
      question: null,
      spec: validated.spec,
    });
  } catch (error) {
    if (error instanceof AiClientError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Diagram generate error:", error);
    return NextResponse.json({ error: "Failed to generate diagram spec" }, { status: 500 });
  }
}
