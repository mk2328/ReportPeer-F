/**
 * Reference list + inline citations.
 *
 * Citations live inside existing block text as stable tokens ([[ref:<id>]]),
 * so the blocks[] model is unchanged and numbers are never stored — they are
 * derived from first-citation order in document order.
 */

import type { ContentBlock, StructureItem } from "./structureUtils";

export type ReferenceType = "book" | "journal" | "website" | "conference" | "other";

export type ReferenceEntry = {
  id: string;
  type: ReferenceType;
  authors: string;
  title: string;
  year: string;
  /** Publisher, journal, conference or site name. */
  source: string;
  /** Volume/issue/pages/edition. */
  details: string;
  url: string;
  accessed: string;
};

export const REFERENCE_TYPES: Array<{ value: ReferenceType; label: string }> = [
  { value: "book", label: "Book" },
  { value: "journal", label: "Journal" },
  { value: "website", label: "Website" },
  { value: "conference", label: "Conference Paper" },
  { value: "other", label: "Other" },
];

const CITATION_TOKEN = /\[\[ref:([A-Za-z0-9_-]+)\]\]/g;

export function newReferenceId(): string {
  return `ref-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function emptyReference(): ReferenceEntry {
  return {
    id: newReferenceId(),
    type: "book",
    authors: "",
    title: "",
    year: "",
    source: "",
    details: "",
    url: "",
    accessed: "",
  };
}

export function citationToken(referenceId: string): string {
  return `[[ref:${referenceId}]]`;
}

/**
 * Insert a citation token using JUW style: `word [n].`
 * Moves trailing sentence punctuation after the token and keeps a single space before it.
 */
export function insertCitationAt(
  text: string,
  start: number,
  end: number,
  token: string
): { text: string; caret: number } {
  let before = text.slice(0, Math.max(0, start));
  let after = text.slice(Math.max(end, start));

  // `word.|` → peel the period so it lands after the citation.
  let movedPunct = "";
  const punctMatch = before.match(/([.!?])\s*$/);
  if (punctMatch) {
    movedPunct = punctMatch[1];
    before = before.slice(0, before.length - punctMatch[0].length);
  }

  before = before.replace(/\s+$/, "");
  if (before.length > 0) before = `${before} `;

  if (movedPunct) {
    // Avoid `[[ref]].` when the period was already after the caret.
    if (after.startsWith(movedPunct)) {
      after = after.slice(movedPunct.length);
    }
    after = `${movedPunct}${after}`;
  }

  const next = `${before}${token}${after}`.replace(/ {2,}/g, " ");
  return { text: next, caret: before.length + token.length };
}

/** JUW presentation: `word [1].` never `word.[1]` or `word[1]`. */
export function normalizeCitationPresentation(text: string): string {
  let result = String(text || "");
  // Move sentence punct that sat before a citation group to after it.
  result = result.replace(/(\S)([.!?])(\[\d+\](?:,\s*\[\d+\])*)/g, "$1 $3$2");
  // Ensure a space between a word character and `[n]`.
  result = result.replace(/(\w)(\[\d+\])/g, "$1 $2");
  // Drop a duplicated period/question/exclamation after the citation.
  result = result.replace(/(\[\d+\])([.!?])\2+/g, "$1$2");
  return result.replace(/ {2,}/g, " ");
}

/** Tolerate legacy `references: string[]` documents. */
export function normalizeReferences(raw: unknown): ReferenceEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry, index) => {
    if (typeof entry === "string") {
      return { ...emptyReference(), id: `ref-legacy-${index}`, title: entry };
    }
    const value = (entry || {}) as Partial<ReferenceEntry>;
    return {
      id: String(value.id || `ref-legacy-${index}`),
      type: (REFERENCE_TYPES.some((t) => t.value === value.type)
        ? value.type
        : "other") as ReferenceType,
      authors: String(value.authors || ""),
      title: String(value.title || ""),
      year: String(value.year || ""),
      source: String(value.source || ""),
      details: String(value.details || ""),
      url: String(value.url || ""),
      accessed: String(value.accessed || ""),
    };
  });
}

function blockText(block: ContentBlock): string {
  switch (block.type) {
    case "paragraph":
      return block.text || "";
    case "list":
      return (block.items || []).map((item) => item.text || "").join("\n");
    case "table": {
      const cells = [...(block.columns || []), ...(block.data || []).flat()];
      const text = cells
        .map((cell) => (typeof cell === "string" ? cell : cell?.text || ""))
        .join("\n");
      return `${block.caption || ""}\n${text}`;
    }
    case "figure":
      return block.caption || "";
    default:
      return "";
  }
}

/** Text of every item, depth-first, in the same order the DOCX is written. */
function walkDocumentText(
  items: StructureItem[],
  contentMap: Record<string, string>,
  out: string[]
) {
  for (const item of items) {
    if (Array.isArray(item.blocks) && item.blocks.length > 0) {
      for (const block of item.blocks) out.push(blockText(block));
    } else {
      out.push(contentMap[item.id] || "");
    }
    if (item.subitems?.length) walkDocumentText(item.subitems, contentMap, out);
  }
}

/** Reference ids in first-citation order. */
export function collectCitedReferenceIds(
  structure: StructureItem[],
  contentMap: Record<string, string>
): string[] {
  const chunks: string[] = [];
  walkDocumentText(structure, contentMap, chunks);

  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const chunk of chunks) {
    for (const match of chunk.matchAll(CITATION_TOKEN)) {
      const id = match[1];
      if (seen.has(id)) continue;
      seen.add(id);
      ordered.push(id);
    }
  }
  return ordered;
}

/** Citation number per reference id; uncited references get no entry. */
export function buildCitationNumbers(
  structure: StructureItem[],
  contentMap: Record<string, string>,
  references: ReferenceEntry[]
): Map<string, number> {
  const known = new Set(references.map((reference) => reference.id));
  const numbers = new Map<string, number>();
  let next = 1;
  for (const id of collectCitedReferenceIds(structure, contentMap)) {
    if (!known.has(id)) continue;
    numbers.set(id, next);
    next += 1;
  }
  return numbers;
}

export function countCitations(
  structure: StructureItem[],
  contentMap: Record<string, string>,
  referenceId: string
): number {
  const chunks: string[] = [];
  walkDocumentText(structure, contentMap, chunks);
  const token = citationToken(referenceId);
  return chunks.reduce((total, chunk) => total + chunk.split(token).length - 1, 0);
}

/** Replace tokens with [n] for display; unknown ids collapse to nothing. */
export function resolveCitations(
  text: string,
  numbers: Map<string, number>
): string {
  const resolved = String(text || "").replace(CITATION_TOKEN, (_match, id: string) => {
    const number = numbers.get(id);
    return number ? `[${number}]` : "";
  });
  return normalizeCitationPresentation(resolved);
}

export function hasCitations(text: string): boolean {
  return CITATION_TOKEN.test(String(text || ""));
}

/** IEEE-style entry text; the [n] label is added by the renderer. */
export function formatReference(reference: ReferenceEntry): string {
  const parts: string[] = [];
  const authors = reference.authors.trim();
  const title = reference.title.trim();
  const source = reference.source.trim();
  const details = reference.details.trim();
  const year = reference.year.trim();
  const url = reference.url.trim();
  const accessed = reference.accessed.trim();

  if (authors) parts.push(authors.endsWith(".") ? authors : `${authors},`);
  if (title) parts.push(reference.type === "book" ? `${title}.` : `"${title},"`);
  if (source) parts.push(reference.type === "journal" ? `${source},` : `${source},`);
  if (details) parts.push(`${details},`);
  if (year) parts.push(`${year}.`);
  if (url) parts.push(`[Online]. Available: ${url}`);
  if (accessed) parts.push(`[Accessed: ${accessed}].`);

  const text = parts.join(" ").replace(/\s+/g, " ").trim();
  return text || title || "Untitled reference";
}
