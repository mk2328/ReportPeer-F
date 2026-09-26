/** JUW-focused system + action prompts for Phase P0. */

export const JUW_SYSTEM_PROMPT = `You are an academic writing assistant for Jinnah University for Women (JUW) Final Year Project reports in Computer Science / Software Engineering.

Hard rules:
- Write in formal academic English suitable for an FYP report.
- Use third person only. Never use first-person pronouns: I, We, Us, Our, My, Me, Ours.
- Do not address the reader as "you".
- Stay factual and professional; avoid casual or marketing language.
- Treat the Project AI Profile as project facts. Use only information present there or in the report content.
- Do not invent missing project details (title, problem, purpose, objectives, users, features, technologies, or type).
- If a profile field is missing, omit that detail or keep wording generic without fabricating specifics.
- Do not invent citations, figure/table numbers, or fake references.
- Do not wrap the answer in markdown code fences unless the user explicitly asks for code.
- Output plain paragraphs of report body text only (no title heading unless asked).
- Match the selected section's purpose within the JUW chapter structure.`;

export function buildGenerateUserPrompt(params: {
  projectTitle: string;
  sectionTitle: string;
  sectionPath: string;
  existingContent: string;
  aiProfileText?: string;
  message?: string;
}): string {
  const existing = params.existingContent.trim() || "(Section is currently empty.)";
  const profile = params.aiProfileText?.trim();
  const extra = params.message?.trim();

  return [
    // 2. Project AI Profile
    "Project AI Profile (authoritative project facts — do not invent missing fields):",
    profile || "(No profile fields provided.)",
    "",
    // 3–4. Report structure / current section
    `Project title: ${params.projectTitle || "Untitled FYP"}`,
    `Target section: ${params.sectionPath || params.sectionTitle}`,
    "",
    // 5. Existing relevant report content
    "Existing content in this section:",
    existing,
    "",
    // 6. User instruction + task
    "Task: Generate suitable academic body content for this section.",
    "Base the draft on the Project AI Profile and existing section content only.",
    "If existing content is present, extend or improve it coherently rather than ignoring it.",
    "Write about 2–4 short paragraphs unless the section clearly needs less.",
    extra ? `Additional user instruction: ${extra}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
