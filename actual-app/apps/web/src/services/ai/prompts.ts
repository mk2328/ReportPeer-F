/** JUW-focused system + action prompts for Phase P0.
 * Writing rules align with engine templates/juw/config.json
 * (`third_person_only`, `forbidden_words`: I/We/Us/Our).
 */

/** Compact JUW academic writing layer applied to every generate call. */
export const JUW_ACADEMIC_WRITING_RULES = `JUW Academic Writing Rules:
- Use formal academic English suitable for a JUW Final Year Project report.
- Write in third person only.
- Avoid first-person pronouns: I, We, Us, Our, My (also avoid Me, Ours).
- Do not invent project facts, features, technologies, results, statistics, or references.
- Use the Project AI Profile and existing report content as the only factual sources.
- If important information is missing, do not guess or fill gaps with fabricated details.
- Keep content directly relevant to the selected heading.
- Avoid generic filler and unnecessary repetition.
- Maintain clear academic paragraph flow.
- Do not fabricate citations or reference details.
- Do not invent figure/table numbers.
- Do not address the reader as "you".
- Output plain report body paragraphs only (no markdown code fences unless code is explicitly requested; no title heading unless asked).`;

/** Applied only when the target section is Abstract. */
export const ABSTRACT_GENERATION_RULES = `Abstract-specific rules:
- Give a concise academic overview of the project.
- Cover problem/background, project purpose, proposed solution/approach, key functionality, and outcome only when those facts are available in the Project AI Profile, existing report content, or user clarifications.
- Use only information from the Project AI Profile, existing report content, and user clarifications.
- Never invent results, statistics, technologies, features, or claims.
- Keep the abstract within approximately one page (typically a few short paragraphs; do not pad to fill a page).
- Write continuous academic prose only — no subheadings, bullet points, or numbered lists.
- Avoid repeating the project title unnecessarily; mention it at most once if needed for clarity.`;

export const JUW_SYSTEM_PROMPT = `You are an academic writing assistant for Jinnah University for Women (JUW) Final Year Project reports in Computer Science / Software Engineering.

${JUW_ACADEMIC_WRITING_RULES}

Additional guidance:
- Match the selected section's purpose within the JUW chapter structure.
- Prefer precise, evidence-based wording drawn from the provided profile and section content.
- When the target section is Abstract, also follow the Abstract-specific rules provided in the user message.
- Treat short user clarifications in this interaction as additional project facts.`;

export type ClarificationAnswer = {
  question: string;
  answer: string;
};

export type ClarificationAssessment = {
  needs_clarification: boolean;
  question: string | null;
};

/** True when the selected heading is the report Abstract (not e.g. "Abstract Design"). */
export function isAbstractSection(sectionTitle: string, sectionPath?: string): boolean {
  const candidates = [sectionTitle, sectionPath?.split(">").pop()?.trim() || ""]
    .map((s) => s.replace(/^\d+(\.\d+)*\s+/, "").trim().toLowerCase())
    .filter(Boolean);
  return candidates.some((s) => s === "abstract");
}

export function formatClarificationAnswers(answers: ClarificationAnswer[] | undefined): string {
  if (!answers?.length) return "";
  return answers
    .filter((a) => a.question?.trim() && a.answer?.trim())
    .map((a, i) => `Q${i + 1}: ${a.question.trim()}\nA${i + 1}: ${a.answer.trim()}`)
    .join("\n\n");
}

/** Parse a compact JSON assessment from the model (tolerates markdown fences). */
export function parseClarificationAssessment(raw: string): ClarificationAssessment {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned) as {
      needs_clarification?: unknown;
      question?: unknown;
      status?: unknown;
    };
    const needs =
      parsed.needs_clarification === true ||
      String(parsed.status || "").toLowerCase() === "needs_clarification";
    const question =
      typeof parsed.question === "string" && parsed.question.trim()
        ? parsed.question.trim()
        : null;
    if (needs && question) {
      return { needs_clarification: true, question };
    }
    return { needs_clarification: false, question: null };
  } catch {
    // If model returned plain text question only, treat as clarification.
    const plain = cleaned.replace(/^["']|["']$/g, "").trim();
    if (
      plain.length > 20 &&
      plain.includes("?") &&
      !plain.toLowerCase().includes('"needs_clarification": false')
    ) {
      return { needs_clarification: true, question: plain.slice(0, 500) };
    }
    return { needs_clarification: false, question: null };
  }
}

export function buildClarificationCheckPrompt(params: {
  projectTitle: string;
  sectionTitle: string;
  sectionPath: string;
  existingContent: string;
  aiProfileText?: string;
  juwSectionGuideText?: string;
  clarificationAnswers?: ClarificationAnswer[];
  message?: string;
}): string {
  const existing = params.existingContent.trim() || "(Section is currently empty.)";
  const profile = params.aiProfileText?.trim() || "(No profile fields provided.)";
  const clarifications = formatClarificationAnswers(params.clarificationAnswers);
  const forAbstract = isAbstractSection(params.sectionTitle, params.sectionPath);

  return [
    "You are checking whether there is enough factual information to write accurate academic content.",
    "Do NOT write the section content.",
    "Do NOT invent missing facts.",
    "",
    "Decide if one critical fact is missing for THIS section only.",
    "Ask at most ONE short clarification question — never a questionnaire.",
    "Do not ask for information already present in the Project AI Profile, existing report content, or previous user answers below.",
    "If the available facts are enough for a solid draft (even if some optional details are missing), return needs_clarification false.",
    forAbstract
      ? "For Abstract: if problem, purpose, approach/features are known but the actual project outcome/status is unknown, ask one short question about the outcome (implemented/tested vs proposed)."
      : "Only ask if a fact is truly required to avoid guessing for this heading.",
    "",
    "Return ONLY valid JSON with this shape:",
    '{"needs_clarification":false,"question":null}',
    "or",
    '{"needs_clarification":true,"question":"Your one short question?"}',
    "",
    `Project title: ${params.projectTitle || "Untitled FYP"}`,
    `Target section: ${params.sectionPath || params.sectionTitle}`,
    params.juwSectionGuideText?.trim() || "",
    "",
    "Project AI Profile:",
    profile,
    "",
    "Existing content in this section:",
    existing,
    clarifications
      ? `\nPrevious user answers in this AI interaction:\n${clarifications}`
      : "",
    params.message?.trim()
      ? `\nAdditional user instruction: ${params.message.trim()}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildGenerateUserPrompt(params: {
  projectTitle: string;
  sectionTitle: string;
  sectionPath: string;
  existingContent: string;
  aiProfileText?: string;
  juwSectionGuideText?: string;
  clarificationAnswers?: ClarificationAnswer[];
  message?: string;
}): string {
  const existing = params.existingContent.trim() || "(Section is currently empty.)";
  const profile = params.aiProfileText?.trim();
  const extra = params.message?.trim();
  const clarifications = formatClarificationAnswers(params.clarificationAnswers);
  const forAbstract = isAbstractSection(params.sectionTitle, params.sectionPath);

  const taskLines = forAbstract
    ? [
        ABSTRACT_GENERATION_RULES,
        "",
        "Task: Generate the Abstract section as continuous academic prose.",
        "Base the draft on the Project AI Profile, existing section content, and user clarifications only.",
        "Include problem/background, purpose, approach, key functionality, and outcome only when those facts are available; omit any that are still missing rather than inventing them.",
        "If existing content is present, refine it into a coherent abstract rather than ignoring it.",
        "Do not add citations, statistics, results, technologies, features, or claims that are not in the profile, existing content, or clarifications.",
      ]
    : [
        "Task: Generate suitable academic body content for this section.",
        "Use the JUW section guide to determine what this heading must discuss.",
        "Base the draft on the Project AI Profile, existing section content, and user clarifications only.",
        "Stay strictly relevant to the target section heading and its expected purpose.",
        "If existing content is present, extend or improve it coherently rather than ignoring it.",
        "Write about 2–4 short paragraphs unless the section clearly needs less.",
        "Do not add citations, statistics, results, or technologies that are not in the profile, existing content, or clarifications.",
      ];

  return [
    JUW_ACADEMIC_WRITING_RULES,
    "",
    "Project AI Profile (authoritative project facts — do not invent missing fields):",
    profile || "(No profile fields provided.)",
    "",
    `Project title: ${params.projectTitle || "Untitled FYP"}`,
    `Target section: ${params.sectionPath || params.sectionTitle}`,
    params.juwSectionGuideText?.trim() || "",
    "",
    "Existing content in this section:",
    existing,
    clarifications
      ? `\nUser clarifications for this generation (treat as project facts):\n${clarifications}`
      : "",
    "",
    ...taskLines,
    extra ? `Additional user instruction: ${extra}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Improve/expand existing draft or section text — no clarification loop. */
export function buildImproveExpandUserPrompt(params: {
  projectTitle: string;
  sectionTitle: string;
  sectionPath: string;
  existingContent: string;
  sourceText: string;
  aiProfileText?: string;
  juwSectionGuideText?: string;
  message?: string;
}): string {
  const profile = params.aiProfileText?.trim() || "(No profile fields provided.)";
  const source = params.sourceText.trim();
  const sectionExisting = params.existingContent.trim() || "(Section body is currently empty.)";
  const extra = params.message?.trim();

  return [
    JUW_ACADEMIC_WRITING_RULES,
    "",
    "Project AI Profile (authoritative project facts — do not invent missing fields):",
    profile,
    "",
    `Project title: ${params.projectTitle || "Untitled FYP"}`,
    `Target section: ${params.sectionPath || params.sectionTitle}`,
    params.juwSectionGuideText?.trim() || "",
    "",
    "Current section body in the report (context only):",
    sectionExisting,
    "",
    "Text to improve/expand:",
    source,
    "",
    "Task: Improve and, where useful, expand the text above.",
    "Preserve the original meaning and all project facts already stated.",
    "Improve academic clarity, grammar, flow, and useful detail.",
    "Expand only where it adds substance for this section; do not add generic filler.",
    "Do not invent project facts, results, technologies, statistics, or citations.",
    "Stay relevant to the JUW section guide and target heading.",
    "Maintain third-person formal academic prose.",
    "Output only the improved continuous body text (no subheadings or bullet lists unless the source already uses them).",
    extra ? `Additional user instruction: ${extra}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Focused refine modes for existing text (grammar / tone / general refine / humanize). */
export const AI_REFINE_MODE_INSTRUCTIONS = {
  improve:
    "Improve and, where useful, expand the text. Preserve meaning and all stated project facts.",
  grammar:
    "Correct grammar, spelling, and punctuation only. Do not add new ideas, facts, or claims. Preserve meaning and third-person academic tone.",
  tone:
    "Rewrite in formal third-person academic tone suitable for an FYP report. Preserve all project facts and meaning. Do not invent details.",
  refine:
    "Refine clarity, flow, and academic precision. Preserve meaning and all stated project facts. Do not invent details or add filler.",
  humanize:
    "Rewrite so the prose sounds natural and human, not robotic or formulaic. Preserve all facts, meaning, technical details, and academic accuracy. Keep formal third-person academic English. Do not invent project information, results, technologies, statistics, or citations. Do not add filler or change the section purpose.",
} as const;

export type AiRefineMode = keyof typeof AI_REFINE_MODE_INSTRUCTIONS;

/** Client/server guard for usable AI drafts. */
export function isUsableAiDraft(draft: string | null | undefined, emptyProfileMessage?: string): boolean {
  const text = String(draft || "").trim();
  if (!text) return false;
  if (emptyProfileMessage && text === emptyProfileMessage) return false;
  if (text.length < 12) return false;
  return true;
}
