/**
 * Section guide for AI: uses the active university pack's chapter structure.
 * JUW guide text helpers keep existing export names for compatibility.
 */

import {
  resolveUniversityPack,
  type UniversityChapterDef,
} from "@/universityPacks";

/** @deprecated Prefer resolveUniversityPack(university).chapterStructure — kept for callers. */
export type JuwChapterDef = UniversityChapterDef;

/** JUW chapter structure from the university pack (was duplicated inline). */
export const JUW_CHAPTER_STRUCTURE: readonly UniversityChapterDef[] =
  resolveUniversityPack("juw").chapterStructure;

export type JuwSectionGuide = {
  chapterNumber: number | null;
  chapterName: string | null;
  sectionNumber: string | null;
  sectionName: string;
  /** Compact requirement statement derived from pack structure (not a long essay). */
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
  const [shorter, longer] = na.length <= nb.length ? [na, nb] : [nb, na];
  return longer.startsWith(`${shorter} `);
}

function findChapterDef(
  structure: readonly UniversityChapterDef[],
  chapterNumber: number | null,
  chapterTitle: string
): UniversityChapterDef | null {
  if (chapterNumber != null) {
    const byNum = structure.find((c) => c.chapter === chapterNumber);
    if (byNum) return byNum;
  }
  return structure.find((c) => titlesMatch(c.title, chapterTitle)) || null;
}

function matchCanonicalSection(
  chapter: UniversityChapterDef | null,
  sectionTitle: string
): string | null {
  if (!chapter) return null;
  if (!chapter.sections.length) return null;
  const exact = chapter.sections.find((s) => titlesMatch(s, sectionTitle));
  if (exact) return exact;
  return null;
}

function buildExpectedPurpose(params: {
  chapter: UniversityChapterDef | null;
  sectionName: string;
  canonicalSection: string | null;
  isChapterHeading: boolean;
  universityLabel: string;
}): string {
  const { chapter, sectionName, canonicalSection, isChapterHeading, universityLabel } =
    params;
  if (!chapter) {
    return `Discuss content appropriate to "${sectionName}" for a ${universityLabel} FYP report. Stay on this heading only.`;
  }

  if (isChapterHeading || !chapter.sections.length) {
    return `This is CHAPTER ${chapter.chapter} (${chapter.title}) in the ${universityLabel} FYP structure. Provide chapter-level content for ${chapter.title}; do not invent unrelated chapter topics.`;
  }

  const focus = canonicalSection || sectionName;
  const siblings = chapter.sections.filter((s) => !titlesMatch(s, focus));
  const siblingNote = siblings.length
    ? ` Other required sections in this chapter (${siblings.join(", ")}) should not be covered here.`
    : "";

  return `Under CHAPTER ${chapter.chapter} (${chapter.title}), this heading is required to discuss "${focus}" as defined by the ${universityLabel} FYP report structure.${siblingNote}`;
}

export function resolveJuwSectionGuide(params: {
  sectionTitle: string;
  sectionNumber?: string | null;
  chapterNumber?: number | null;
  chapterTitle?: string | null;
  isChapterHeading?: boolean;
  /** Optional; defaults to JUW pack (current product behavior). */
  university?: string | null;
}): JuwSectionGuide {
  const pack = resolveUniversityPack(params.university ?? "juw");
  const sectionName = String(params.sectionTitle || "").trim() || "Section";
  const chapter = findChapterDef(
    pack.chapterStructure,
    params.chapterNumber ?? null,
    params.chapterTitle || ""
  );
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
    siblingSections: [...(chapter?.sections || [])],
    expectedPurpose: buildExpectedPurpose({
      chapter,
      sectionName,
      canonicalSection: canonical,
      isChapterHeading,
      universityLabel: pack.id.toUpperCase(),
    }),
  };
}

/** Compact block for LLM prompts. */
export function formatJuwSectionGuideForPrompt(guide: JuwSectionGuide): string {
  const chapterLabel =
    guide.chapterNumber != null
      ? `CHAPTER ${guide.chapterNumber}${guide.chapterName ? ` (${guide.chapterName})` : ""}`
      : guide.chapterName || "(not a numbered chapter)";
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
