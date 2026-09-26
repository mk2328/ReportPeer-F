/**
 * Minimal project/section context for Phase P0 generate.
 * Does not persist memory or chat history.
 */

import {
  cellPlainText,
  chapterNumberFromItem,
  ensureContentBlocks,
  formatHeadingLabel,
  stripHeadingNumber,
  type ContentBlock,
  type StructureItem,
} from "@/lib/structureUtils";
import {
  type AiProfile,
  formatAiProfileForPrompt,
  isAiProfileEmpty,
  normalizeAiProfile,
} from "@/services/ai/aiProfile";
import {
  type JuwSectionGuide,
  formatJuwSectionGuideForPrompt,
  resolveJuwSectionGuide,
} from "@/services/ai/juwSectionGuide";

export type AiProjectSnapshot = {
  title?: string;
  projectTitle?: string;
  structure?: StructureItem[];
  contentMap?: Record<string, string>;
  aiProfile?: unknown;
};

function findStructureItem(items: StructureItem[] | undefined, id: string): StructureItem | null {
  for (const item of items || []) {
    if (item.id === id) return item;
    const nested = findStructureItem(item.subitems, id);
    if (nested) return nested;
  }
  return null;
}

function findPathItems(
  items: StructureItem[] | undefined,
  id: string,
  trail: StructureItem[] = []
): StructureItem[] | null {
  for (const item of items || []) {
    const next = [...trail, item];
    if (item.id === id) return next;
    const nested = findPathItems(item.subitems, id, next);
    if (nested) return nested;
  }
  return null;
}

function blockPlainText(block: ContentBlock): string {
  if (block.type === "paragraph") return block.text || "";
  if (block.type === "list") {
    return (block.items || [])
      .map((entry) => (typeof entry === "string" ? entry : entry?.text || ""))
      .filter(Boolean)
      .join("\n");
  }
  if (block.type === "table") {
    const cells = [
      ...(block.columns || []).map((c) => cellPlainText(c)),
      ...(block.data || []).flat().map((c) => cellPlainText(c)),
    ];
    return [block.caption, ...cells].filter(Boolean).join(" | ");
  }
  if (block.type === "figure") return block.caption || "";
  return "";
}

/** Truncate long section text so P0 prompts stay small. */
function truncate(text: string, maxChars: number): string {
  const cleaned = text.replace(/\s+\n/g, "\n").trim();
  if (cleaned.length <= maxChars) return cleaned;
  return `${cleaned.slice(0, maxChars).trim()}…\n(truncated)`;
}

function buildGuideForItem(item: StructureItem, path: StructureItem[]): JuwSectionGuide {
  const chapterItem =
    path.find((node) => chapterNumberFromItem(node) != null) ||
    (chapterNumberFromItem(item) != null ? item : null);
  const chapterNumber = chapterItem ? chapterNumberFromItem(chapterItem) : null;
  const chapterTitle = chapterItem
    ? stripHeadingNumber(String(chapterItem.title || ""))
        .replace(/^CHAPTER\s+\d+\s*[-–:]?\s*/i, "")
        .trim() || String(chapterItem.title || "")
    : null;
  const isChapterHeading = chapterNumberFromItem(item) != null;

  return resolveJuwSectionGuide({
    sectionTitle: stripHeadingNumber(String(item.title || "")) || "Section",
    sectionNumber: isChapterHeading ? null : item.number || null,
    chapterNumber,
    chapterTitle,
    isChapterHeading,
  });
}

export function buildGenerateContext(
  project: AiProjectSnapshot,
  sectionId: string
): {
  projectTitle: string;
  sectionTitle: string;
  sectionPath: string;
  existingContent: string;
  aiProfile: AiProfile;
  aiProfileText: string;
  profileEmpty: boolean;
  juwSectionGuide: JuwSectionGuide;
  juwSectionGuideText: string;
} {
  const item = findStructureItem(project.structure, sectionId);
  if (!item) {
    throw new Error("Section not found in this project.");
  }

  const aiProfile = normalizeAiProfile(project.aiProfile);
  const contentMap = project.contentMap || {};
  const blocks = ensureContentBlocks(item, contentMap);
  const existingContent = truncate(
    blocks.map(blockPlainText).filter((part) => part.trim()).join("\n\n"),
    6000
  );

  const path = findPathItems(project.structure, sectionId) || [item];
  const juwSectionGuide = buildGuideForItem(item, path);
  const coverTitle = String(project.projectTitle || project.title || "").trim();

  return {
    projectTitle: aiProfile.projectTitle.trim() || coverTitle || "FYP Report",
    sectionTitle: formatHeadingLabel(item),
    sectionPath: path.map((node) => formatHeadingLabel(node)).join(" > "),
    existingContent,
    aiProfile,
    aiProfileText: formatAiProfileForPrompt(aiProfile),
    profileEmpty: isAiProfileEmpty(aiProfile),
    juwSectionGuide,
    juwSectionGuideText: formatJuwSectionGuideForPrompt(juwSectionGuide),
  };
}
