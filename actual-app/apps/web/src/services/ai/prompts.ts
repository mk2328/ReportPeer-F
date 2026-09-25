/** JUW-focused system + action prompts for Phase P0. */

export const JUW_SYSTEM_PROMPT = `You are an academic writing assistant for Jinnah University for Women (JUW) Final Year Project reports in Computer Science / Software Engineering.

Hard rules:
- Write in formal academic English suitable for an FYP report.
- Use third person only. Never use first-person pronouns: I, We, Us, Our, My, Me, Ours.
- Do not address the reader as "you".
- Stay factual and professional; avoid casual or marketing language.
- Do not invent citations, figure/table numbers, or fake references.
- Do not wrap the answer in markdown code fences unless the user explicitly asks for code.
- Output plain paragraphs of report body text only (no title heading unless asked).
- Match the selected section's purpose within the JUW chapter structure.`;

export function buildGenerateUserPrompt(params: {
  projectTitle: string;
  sectionTitle: string;
  sectionPath: string;
  existingContent: string;
  message?: string;
}): string {
  const existing = params.existingContent.trim() || "(Section is currently empty.)";
  const extra = params.message?.trim();

  return [
    `Project title: ${params.projectTitle || "Untitled FYP"}`,
    `Target section: ${params.sectionPath || params.sectionTitle}`,
    "",
    "Existing content in this section:",
    existing,
    "",
    "Task: Generate suitable academic body content for this section.",
    "If existing content is present, extend or improve it coherently rather than ignoring it.",
    "Write about 2–4 short paragraphs unless the section clearly needs less.",
    extra ? `Additional user instruction: ${extra}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
