/**
 * Persistent Project AI Profile — facts the Copilot uses before generating text.
 * Optional on legacy projects (missing aiProfile is treated as empty).
 */

export type AiProfile = {
  projectTitle: string;
  problemStatement: string;
  purpose: string;
  objectives: string;
  targetUsers: string;
  mainFeatures: string;
  technologies: string;
  projectType: string;
  additionalContext: string;
};

export const EMPTY_AI_PROFILE_MESSAGE =
  "Please complete your Project AI Profile first so I can generate content based on your actual project.";

export const AI_PROFILE_FIELDS: Array<{
  key: keyof AiProfile;
  label: string;
  placeholder: string;
  rows?: number;
}> = [
  {
    key: "projectTitle",
    label: "Project Title",
    placeholder: "e.g. Intelligent Campus Attendance System",
  },
  {
    key: "problemStatement",
    label: "Problem Statement",
    placeholder: "e.g. Manual attendance is slow and error-prone.",
    rows: 3,
  },
  {
    key: "purpose",
    label: "Purpose",
    placeholder: "e.g. Automate attendance using QR codes and a web portal.",
    rows: 2,
  },
  {
    key: "objectives",
    label: "Objectives",
    placeholder: "e.g. 1) Record attendance accurately 2) Provide admin reports",
    rows: 3,
  },
  {
    key: "targetUsers",
    label: "Target Users",
    placeholder: "e.g. Students, faculty, and department admins",
  },
  {
    key: "mainFeatures",
    label: "Main Features",
    placeholder: "e.g. QR check-in, dashboards, exportable reports",
    rows: 2,
  },
  {
    key: "technologies",
    label: "Technologies Used",
    placeholder: "e.g. Next.js, MongoDB, Python, mobile app",
  },
  {
    key: "projectType",
    label: "Project Type",
    placeholder: "e.g. Web application / Mobile + Web FYP",
  },
  {
    key: "additionalContext",
    label: "Additional Context",
    placeholder: "Anything else the AI should know (constraints, scope, domain).",
    rows: 3,
  },
];

export function emptyAiProfile(): AiProfile {
  return {
    projectTitle: "",
    problemStatement: "",
    purpose: "",
    objectives: "",
    targetUsers: "",
    mainFeatures: "",
    technologies: "",
    projectType: "",
    additionalContext: "",
  };
}

/** Tolerate missing/partial legacy documents. */
export function normalizeAiProfile(raw: unknown): AiProfile {
  const base = emptyAiProfile();
  if (!raw || typeof raw !== "object") return base;
  const value = raw as Partial<Record<keyof AiProfile, unknown>>;
  (Object.keys(base) as Array<keyof AiProfile>).forEach((key) => {
    base[key] = String(value[key] ?? "").trim();
  });
  return base;
}

export function isAiProfileEmpty(profile: AiProfile | null | undefined): boolean {
  const normalized = normalizeAiProfile(profile);
  return (Object.keys(normalized) as Array<keyof AiProfile>).every(
    (key) => !normalized[key].trim()
  );
}

/** Compact profile block for the LLM prompt (filled fields only). */
export function formatAiProfileForPrompt(profile: AiProfile): string {
  const normalized = normalizeAiProfile(profile);
  const lines: string[] = [];
  for (const field of AI_PROFILE_FIELDS) {
    const text = normalized[field.key].trim();
    if (!text) continue;
    lines.push(`${field.label}: ${text}`);
  }
  return lines.join("\n");
}
