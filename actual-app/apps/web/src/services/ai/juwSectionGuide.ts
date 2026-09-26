/**
 * JUW FYP chapter/section guide derived from engine templates/juw/config.json
 * (`chapter_structure`). Used to tell the AI what the selected heading should cover.
 * Not a per-subsection essay — only structure identity + a short expected focus.
 */

export type JuwChapterDef = {
  chapter: number;
  title: string;
  sections: string[];
};

/** Source of truth mirror of templates/juw/config.json → chapter_structure. */
export const JUW_CHAPTER_STRUCTURE: JuwChapterDef[] = [
  {
    chapter: 1,
    title: "Introduction",
    sections: ["Overview", "Purpose", "Stakeholders", "Benefits", "Background Study"],
  },
  {
    chapter: 2,
    title: "Requirements",
    sections: ["Functional Requirements", "Non-Functional Requirements"],
  },
  {
    chapter: 3,
    title: "Analysis and Design",
    sections: [
      "System Architecture",
      "Entity Relationship Diagram",
      "Project Flow Diagram",
      "Use Cases",
      "Activity Diagram",
      "User Interface Design",
    ],
  },
  {
    chapter: 4,
    title: "Project Plan",
    sections: [
      "Process Model",
      "User Stories",
      "Sprint Planning",
      "Sprint Sizing",
      "Timeline with Milestones",
    ],
  },
  {
    chapter: 5,
    title: "Test Plan",
    sections: ["Test Cases", "Automated Testing Tools"],
  },
  {
    chapter: 6,
    title: "Implementation Details",
    sections: [
      "Tools and Technology",
      "Data Dictionary",
      "Version Control",
      "Web APIs",
      "Website Development",
      "Mobile Application Development",
      "Deployment",
      "Website Hosting",
      "Mobile Application Deployment",
    ],
  },
  {
    chapter: 7,
    title: "Conclusion and Future Work",
    sections: [],
  },
];

export type JuwSectionGuide = {
  chapterNumber: number | null;
  chapterName: string | null;
  sectionNumber: string | null;
  sectionName: string;
  /** Compact requirement statement derived from JUW structure (not a long essay). */
  expectedPurpose: string;
  matchedCanonicalSection: string | null;
  siblingSections: string[];
};

function normalizeHeading(value: string): string {
  return String(value || "")
    .toLowerCase()
    .replace(/^chapter\s+\d+\s*[-–:]?\s*/i, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titlesMatch(a: string, b: string): boolean {
  const na = normalizeHeading(a);
  const nb = normalizeHeading(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // Allow editor elaborations such as "System Architecture with Diagram"
  // matching canonical "System Architecture", but avoid false positives like
  // "Non-Functional Requirements" vs "Functional Requirements".
  const [shorter, longer] = na.length <= nb.length ? [na, nb] : [nb, na];
  return longer.startsWith(`${shorter} `);
}

function findChapterDef(chapterNumber: number | null, chapterTitle: string): JuwChapterDef | null {
  if (chapterNumber != null) {
    const byNum = JUW_CHAPTER_STRUCTURE.find((c) => c.chapter === chapterNumber);
    if (byNum) return byNum;
  }
  return (
    JUW_CHAPTER_STRUCTURE.find((c) => titlesMatch(c.title, chapterTitle)) || null
  );
}

function matchCanonicalSection(
  chapter: JuwChapterDef | null,
  sectionTitle: string
): string | null {
  if (!chapter) return null;
  if (!chapter.sections.length) return null;
  const exact = chapter.sections.find((s) => titlesMatch(s, sectionTitle));
  if (exact) return exact;
  return null;
}

/**
 * Build a short purpose/requirement line from JUW structure membership.
 * Avoids long hardcoded essays for each subsection.
 */
function buildExpectedPurpose(params: {
  chapter: JuwChapterDef | null;
  sectionName: string;
  canonicalSection: string | null;
  isChapterHeading: boolean;
}): string {
  const { chapter, sectionName, canonicalSection, isChapterHeading } = params;
  if (!chapter) {
    return `Discuss content appropriate to "${sectionName}" for a JUW FYP report. Stay on this heading only.`;
  }

  if (isChapterHeading || !chapter.sections.length) {
    return `This is CHAPTER ${chapter.chapter} (${chapter.title}) in the JUW FYP structure. Provide chapter-level content for ${chapter.title}; do not invent unrelated chapter topics.`;
  }

  const focus = canonicalSection || sectionName;
  const siblings = chapter.sections.filter((s) => !titlesMatch(s, focus));
  const siblingNote = siblings.length
    ? ` Other required sections in this chapter (${siblings.join(", ")}) should not be covered here.`
    : "";

  return `Under CHAPTER ${chapter.chapter} (${chapter.title}), this heading is required to discuss "${focus}" as defined by the JUW FYP report structure.${siblingNote}`;
}

export function resolveJuwSectionGuide(params: {
  sectionTitle: string;
  sectionNumber?: string | null;
  chapterNumber?: number | null;
  chapterTitle?: string | null;
  isChapterHeading?: boolean;
}): JuwSectionGuide {
  const sectionName = String(params.sectionTitle || "").trim() || "Section";
  const chapter = findChapterDef(params.chapterNumber ?? null, params.chapterTitle || "");
  const isChapterHeading = Boolean(params.isChapterHeading);
  const canonical = isChapterHeading
    ? null
    : matchCanonicalSection(chapter, sectionName);

  return {
    chapterNumber: chapter?.chapter ?? params.chapterNumber ?? null,
    chapterName: chapter?.title ?? (params.chapterTitle ? String(params.chapterTitle) : null),
    sectionNumber: params.sectionNumber?.trim() || null,
    sectionName,
    matchedCanonicalSection: canonical,
    siblingSections: chapter?.sections || [],
    expectedPurpose: buildExpectedPurpose({
      chapter,
      sectionName,
      canonicalSection: canonical,
      isChapterHeading,
    }),
  };
}

/** Compact block for LLM prompts. */
export function formatJuwSectionGuideForPrompt(guide: JuwSectionGuide): string {
  const chapterLabel =
    guide.chapterNumber != null
      ? `CHAPTER ${guide.chapterNumber}${guide.chapterName ? ` (${guide.chapterName})` : ""}`
      : guide.chapterName || "(not a numbered JUW chapter)";
  const sectionLabel = guide.sectionNumber
    ? `${guide.sectionNumber} ${guide.sectionName}`
    : guide.sectionName;

  return [
    "JUW section guide (from official FYP chapter structure):",
    `Chapter: ${chapterLabel}`,
    `Section: ${sectionLabel}`,
    `Expected purpose/requirement: ${guide.expectedPurpose}`,
    "Write only what this section should discuss; stay relevant to this heading.",
  ].join("\n");
}
