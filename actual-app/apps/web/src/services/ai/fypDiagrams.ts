/**
 * FYP Diagrams catalog (Phase A shell).
 * Maps Ch.3 Analysis & Design diagram sections to seeded structure ids.
 * Generation/LLM is deferred — this module only covers catalog + status helpers.
 */

import {
  ensureContentBlocks,
  newId,
  type ContentBlock,
  type StructureItem,
} from "@/lib/structureUtils";
import { resolveJuwSectionGuide } from "@/services/ai/juwSectionGuide";

export type FypDiagramKind =
  | "architecture"
  | "erd"
  | "flow"
  | "usecase"
  | "activity";

export type FypDiagramStatus = "Missing" | "Needs details" | "Preview" | "In report";

export type FypDiagramCatalogEntry = {
  kind: FypDiagramKind;
  label: string;
  /** Seeded structure id from project create (`ch3-1` … `ch3-5`). */
  sectionId: string;
  /** Canonical JUW section name for guide lookup. */
  canonicalSection: string;
  /** Default figure caption when inserting. */
  defaultCaption: string;
};

export const FYP_DIAGRAM_CATALOG: readonly FypDiagramCatalogEntry[] = [
  {
    kind: "architecture",
    label: "System Architecture",
    sectionId: "ch3-1",
    canonicalSection: "System Architecture",
    defaultCaption: "System architecture diagram",
  },
  {
    kind: "erd",
    label: "Entity Relationship",
    sectionId: "ch3-2",
    canonicalSection: "Entity Relationship Diagram",
    defaultCaption: "Entity relationship diagram",
  },
  {
    kind: "flow",
    label: "Project Flow",
    sectionId: "ch3-3",
    canonicalSection: "Project Flow Diagram",
    defaultCaption: "Project flow diagram",
  },
  {
    kind: "usecase",
    label: "Use Cases",
    sectionId: "ch3-4",
    canonicalSection: "Use Cases",
    defaultCaption: "Use case diagram",
  },
  {
    kind: "activity",
    label: "Activity Diagram",
    sectionId: "ch3-5",
    canonicalSection: "Activity Diagram",
    defaultCaption: "Activity diagram",
  },
] as const;

export type FypDiagramFigure = Extract<ContentBlock, { type: "figure" }>;

function findStructureItem(items: StructureItem[] | undefined, id: string): StructureItem | null {
  for (const item of items || []) {
    if (item.id === id) return item;
    const nested = findStructureItem(item.subitems, id);
    if (nested) return nested;
  }
  return null;
}

function titleMatchesCanonical(title: string, canonical: string): boolean {
  const t = String(title || "")
    .replace(/^\d+(?:\.\d+)*\s+/, "")
    .trim()
    .toLowerCase();
  const c = canonical.trim().toLowerCase();
  return t === c || t.startsWith(c);
}

/** Resolve the report section for a catalog entry (id first, then title fallback). */
export function findFypDiagramSection(
  structure: StructureItem[],
  entry: FypDiagramCatalogEntry
): StructureItem | null {
  const byId = findStructureItem(structure, entry.sectionId);
  if (byId) return byId;

  const walk = (items: StructureItem[]): StructureItem | null => {
    for (const item of items) {
      if (titleMatchesCanonical(item.title || "", entry.canonicalSection)) return item;
      const nested = walk(item.subitems || []);
      if (nested) return nested;
    }
    return null;
  };
  return walk(structure);
}

/** Figures in a section that have an actual image payload. */
export function getSectionFiguresWithImage(
  item: StructureItem | null,
  contentMap: Record<string, string>
): FypDiagramFigure[] {
  if (!item) return [];
  return ensureContentBlocks(item, contentMap).filter(
    (block): block is FypDiagramFigure =>
      block.type === "figure" && Boolean(block.dataUrl?.trim())
  );
}

export function resolveFypDiagramStatus(params: {
  inReportFigureCount: number;
  hasLocalPreview: boolean;
  needsDetails?: boolean;
}): FypDiagramStatus {
  if (params.needsDetails) return "Needs details";
  if (params.inReportFigureCount > 0) return "In report";
  if (params.hasLocalPreview) return "Preview";
  return "Missing";
}

export function countReadyFypDiagrams(
  statuses: Iterable<FypDiagramStatus>
): number {
  let n = 0;
  for (const status of statuses) {
    if (status === "In report") n += 1;
  }
  return n;
}

/** Short purpose line for the diagram workspace (from existing JUW guide). */
export function getFypDiagramPurpose(entry: FypDiagramCatalogEntry): string {
  const guide = resolveJuwSectionGuide({
    sectionTitle: entry.canonicalSection,
    chapterNumber: 3,
    chapterTitle: "Analysis and Design",
    isChapterHeading: false,
  });
  return guide.expectedPurpose || `Required diagram for ${entry.canonicalSection}.`;
}

export function primaryActionLabel(status: FypDiagramStatus): string {
  switch (status) {
    case "Missing":
      return "Upload";
    case "Preview":
      return "Insert";
    case "Needs details":
      return "Details";
    case "In report":
      return "Manage";
    default:
      return "Open";
  }
}

/** Image payload for inserting a diagram as a normal figure block (Phase D). */
export type DiagramInsertImage = {
  dataUrl: string;
  fileName: string;
  mimeType: string;
};

/**
 * Prefer the currently rendered Mermaid PNG; fall back to SVG data URL, then upload.
 * Does not invent images — returns null when no usable source exists.
 */
export function resolveDiagramInsertImage(params: {
  kind: FypDiagramKind;
  renderedPngDataUrl?: string | null;
  renderedSvg?: string | null;
  uploadPreview?: { dataUrl: string; fileName: string; mimeType: string } | null;
}): DiagramInsertImage | null {
  const rendered = String(params.renderedPngDataUrl || "").trim();
  if (rendered.startsWith("data:image/")) {
    return {
      dataUrl: rendered,
      fileName: `${params.kind}.png`,
      mimeType: "image/png",
    };
  }

  const svg = String(params.renderedSvg || "").trim();
  if (svg.includes("<svg")) {
    const withNs = svg.includes("xmlns=")
      ? svg
      : svg.replace(/<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"');
    return {
      dataUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(withNs)}`,
      fileName: `${params.kind}.svg`,
      mimeType: "image/svg+xml",
    };
  }

  const upload = params.uploadPreview;
  const uploadUrl = String(upload?.dataUrl || "").trim();
  if (uploadUrl.startsWith("data:")) {
    return {
      dataUrl: uploadUrl,
      fileName: upload?.fileName?.trim() || `${params.kind}.png`,
      mimeType: upload?.mimeType?.trim() || "image/png",
    };
  }
  return null;
}

/**
 * Insert a new figure into the mapped section, or replace the existing diagram figure
 * (first figure with an image, or a specific id). Preserves caption / width / align on replace.
 */
export function applyDiagramFigureToBlocks(params: {
  blocks: ContentBlock[];
  image: DiagramInsertImage;
  defaultCaption: string;
  existingFigureId?: string | null;
  createId?: () => string;
}): { blocks: ContentBlock[]; mode: "insert" | "replace"; figureId: string } {
  const blocks = params.blocks || [];
  const existingId = params.existingFigureId || null;

  const byId =
    existingId != null
      ? blocks.find(
          (block): block is FypDiagramFigure =>
            block.type === "figure" && block.id === existingId
        )
      : undefined;

  const firstWithImage = blocks.find(
    (block): block is FypDiagramFigure =>
      block.type === "figure" && Boolean(block.dataUrl?.trim())
  );

  const target = byId || firstWithImage;
  if (target) {
    const next = blocks.map((block) =>
      block.type === "figure" && block.id === target.id
        ? {
            ...block,
            dataUrl: params.image.dataUrl,
            fileName: params.image.fileName,
            mimeType: params.image.mimeType,
          }
        : block
    );
    return { blocks: next, mode: "replace", figureId: target.id };
  }

  const figureId = (params.createId || (() => newId("fig")))();
  const newFigure: FypDiagramFigure = {
    id: figureId,
    type: "figure",
    caption: params.defaultCaption,
    fileName: params.image.fileName,
    mimeType: params.image.mimeType,
    dataUrl: params.image.dataUrl,
    widthPercent: 100,
    align: "center",
  };
  return { blocks: [...blocks, newFigure], mode: "insert", figureId };
}
