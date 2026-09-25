/**
 * Minimal project/section context for Phase P0 generate.
 * Does not persist memory or chat history.
 */

import {
  cellPlainText,
  ensureContentBlocks,
  formatHeadingLabel,
  type ContentBlock,
  type StructureItem,
} from "@/lib/structureUtils";

export type AiProjectSnapshot = {
  title?: string;
  projectTitle?: string;
  structure?: StructureItem[];
  contentMap?: Record<string, string>;
};

function findStructureItem(items: StructureItem[] | undefined, id: string): StructureItem | null {
  for (const item of items || []) {
    if (item.id === id) return item;
    const nested = findStructureItem(item.subitems, id);
    if (nested) return nested;
  }
  return null;
}

function findPathLabels(
  items: StructureItem[] | undefined,
  id: string,
  trail: string[] = []
): string[] | null {
  for (const item of items || []) {
    const next = [...trail, formatHeadingLabel(item)];
    if (item.id === id) return next;
    const nested = findPathLabels(item.subitems, id, next);
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

export function buildGenerateContext(
  project: AiProjectSnapshot,
  sectionId: string
): {
  projectTitle: string;
  sectionTitle: string;
  sectionPath: string;
  existingContent: string;
} {
  const item = findStructureItem(project.structure, sectionId);
  if (!item) {
    throw new Error("Section not found in this project.");
  }

  const contentMap = project.contentMap || {};
  const blocks = ensureContentBlocks(item, contentMap);
  const existingContent = truncate(
    blocks.map(blockPlainText).filter((part) => part.trim()).join("\n\n"),
    6000
  );

  const path = findPathLabels(project.structure, sectionId) || [formatHeadingLabel(item)];

  return {
    projectTitle: String(project.projectTitle || project.title || "FYP Report"),
    sectionTitle: formatHeadingLabel(item),
    sectionPath: path.join(" > "),
    existingContent,
  };
}
