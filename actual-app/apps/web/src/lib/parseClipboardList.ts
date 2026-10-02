/**
 * Convert clipboard HTML/plain lists into the existing list ContentBlock shape.
 * Does not change the list schema or generation path.
 */

import { type ContentBlock, type ContentListItem, newId } from "@/lib/structureUtils";

const MAX_LIST_LEVEL = 4;
const MAX_LIST_ITEMS = 100;

export type ClipboardListBlock = Extract<ContentBlock, { type: "list" }>;

type ParsedItem = { text: string; level: number };

function clampLevel(level: number): number {
  return Math.max(1, Math.min(MAX_LIST_LEVEL, Math.floor(level) || 1));
}

function cleanItemText(raw: string): string {
  return String(raw || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(html: string): string {
  return cleanItemText(
    html
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<\/(p|div)>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
  );
}

function listTypeFromTag(tag: string): "bullet" | "number" {
  return tag.toLowerCase() === "ol" ? "number" : "bullet";
}

/** Walk a root UL/OL element; nested lists become higher item.level. */
function walkListElement(
  listEl: Element,
  level: number,
  items: ParsedItem[],
  inheritedType: "bullet" | "number"
): "bullet" | "number" {
  let listType = inheritedType;
  const tag = listEl.tagName.toLowerCase();
  if (tag === "ul" || tag === "ol") {
    listType = listTypeFromTag(tag);
  }

  for (const child of Array.from(listEl.children)) {
    const childTag = child.tagName.toLowerCase();
    if (childTag === "li") {
      const nestedLists = Array.from(child.children).filter((el) => {
        const t = el.tagName.toLowerCase();
        return t === "ul" || t === "ol";
      });
      const clone = child.cloneNode(true) as Element;
      for (const nested of Array.from(clone.children)) {
        const t = nested.tagName.toLowerCase();
        if (t === "ul" || t === "ol") nested.remove();
      }
      const text = cleanItemText(clone.textContent || "");
      if (text) {
        items.push({ text, level: clampLevel(level) });
      }
      for (const nested of nestedLists) {
        walkListElement(nested, level + 1, items, listTypeFromTag(nested.tagName));
      }
    } else if (childTag === "ul" || childTag === "ol") {
      walkListElement(child, level + 1, items, listTypeFromTag(childTag));
    }
  }
  return listType;
}

function parseHtmlListsDom(html: string): { listType: "bullet" | "number"; items: ParsedItem[] } | null {
  if (typeof DOMParser === "undefined") return null;
  const trimmed = String(html || "").trim();
  if (!trimmed || !/<(ul|ol)\b/i.test(trimmed)) return null;

  try {
    const doc = new DOMParser().parseFromString(trimmed, "text/html");
    const roots = Array.from(doc.body.querySelectorAll(":scope > ul, :scope > ol"));
    const lists =
      roots.length > 0
        ? roots
        : Array.from(doc.body.querySelectorAll("ul, ol")).filter((el) => {
            // Prefer outermost lists (not nested inside another ul/ol).
            const parent = el.parentElement;
            if (!parent) return true;
            const pTag = parent.tagName.toLowerCase();
            return pTag !== "ul" && pTag !== "ol" && pTag !== "li";
          });

    if (lists.length === 0) return null;

    const items: ParsedItem[] = [];
    let listType: "bullet" | "number" = "bullet";
    for (const list of lists) {
      listType = walkListElement(list, 1, items, listTypeFromTag(list.tagName));
    }
    if (items.length === 0) return null;
    // If multiple top-level lists mix types, keep the first root's type.
    listType = listTypeFromTag(lists[0].tagName);
    return { listType, items };
  } catch {
    return null;
  }
}

function findNextList(
  html: string,
  from = 0
): { tag: "ul" | "ol"; start: number; end: number; inner: string } | null {
  const openRe = /<(ul|ol)\b[^>]*>/i;
  const slice = html.slice(from);
  const open = openRe.exec(slice);
  if (!open) return null;
  const tag = open[1].toLowerCase() as "ul" | "ol";
  const absStart = from + open.index;
  const afterOpen = absStart + open[0].length;
  const openToken = new RegExp(`<${tag}\\b`, "gi");
  const closeToken = new RegExp(`</${tag}>`, "gi");
  let depth = 1;
  let cursor = afterOpen;
  while (depth > 0 && cursor < html.length) {
    openToken.lastIndex = cursor;
    closeToken.lastIndex = cursor;
    const nextOpen = openToken.exec(html);
    const nextClose = closeToken.exec(html);
    if (!nextClose) return null;
    if (nextOpen && nextOpen.index < nextClose.index) {
      depth += 1;
      cursor = nextOpen.index + nextOpen[0].length;
    } else {
      depth -= 1;
      cursor = nextClose.index + nextClose[0].length;
      if (depth === 0) {
        return {
          tag,
          start: absStart,
          end: cursor,
          inner: html.slice(afterOpen, nextClose.index),
        };
      }
    }
  }
  return null;
}

function findTopLevelListItems(listInner: string): string[] {
  const items: string[] = [];
  const liOpen = /<li\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = liOpen.exec(listInner))) {
    const afterOpen = match.index + match[0].length;
    let depth = 1;
    let cursor = afterOpen;
    while (depth > 0 && cursor < listInner.length) {
      const nextOpen = listInner.slice(cursor).search(/<li\b/i);
      const nextClose = listInner.slice(cursor).search(/<\/li>/i);
      if (nextClose < 0) break;
      const openAt = nextOpen < 0 ? Infinity : cursor + nextOpen;
      const closeAt = cursor + nextClose;
      if (openAt < closeAt) {
        depth += 1;
        cursor = openAt + 3;
      } else {
        depth -= 1;
        cursor = closeAt + 5;
        if (depth === 0) {
          items.push(listInner.slice(afterOpen, closeAt));
          liOpen.lastIndex = cursor;
          break;
        }
      }
    }
  }
  return items;
}

function walkListHtml(
  listInner: string,
  level: number,
  items: ParsedItem[]
): void {
  for (const liHtml of findTopLevelListItems(listInner)) {
    const nestedBlocks: Array<{ tag: "ul" | "ol"; inner: string }> = [];
    let rest = liHtml;
    let guard = 0;
    while (guard++ < 50) {
      const nested = findNextList(rest, 0);
      if (!nested) break;
      nestedBlocks.push({ tag: nested.tag, inner: nested.inner });
      rest = rest.slice(0, nested.start) + rest.slice(nested.end);
    }
    const text = stripTags(rest);
    if (text) items.push({ text, level: clampLevel(level) });
    for (const nested of nestedBlocks) {
      walkListHtml(nested.inner, level + 1, items);
    }
  }
}

/** DOM-free fallback for UL/OL markup (including one level of nesting). */
function parseHtmlListsLite(html: string): { listType: "bullet" | "number"; items: ParsedItem[] } | null {
  const trimmed = String(html || "").trim();
  if (!trimmed || !/<(ul|ol)\b/i.test(trimmed)) return null;

  const items: ParsedItem[] = [];
  let listType: "bullet" | "number" = "bullet";
  let foundRoot = false;
  let cursor = 0;
  let guard = 0;
  while (guard++ < 30) {
    const block = findNextList(trimmed, cursor);
    if (!block) break;
    // Skip lists nested inside previously consumed markup by only accepting
    // roots that are not preceded by an unclosed <li> in a simple way: we
    // consume outer lists left-to-right; nested finds start after previous end.
    if (!foundRoot) {
      listType = listTypeFromTag(block.tag);
      foundRoot = true;
    }
    walkListHtml(block.inner, 1, items);
    cursor = block.end;
  }

  if (items.length === 0) return null;
  return { listType, items };
}

/**
 * Word often pastes bullets as MsoListParagraph with mso-list:… levelN …
 * Only accept when 2+ such paragraphs exist so normal prose is unaffected.
 */
function parseWordMsoList(html: string): { listType: "bullet" | "number"; items: ParsedItem[] } | null {
  const trimmed = String(html || "").trim();
  if (!trimmed || !/mso-list\s*:/i.test(trimmed)) return null;

  const paraRe = /<p\b([^>]*)>([\s\S]*?)<\/p>/gi;
  const items: ParsedItem[] = [];
  let listType: "bullet" | "number" = "bullet";
  let match: RegExpExecArray | null;

  while ((match = paraRe.exec(trimmed))) {
    const attrs = match[1] || "";
    const inner = match[2] || "";
    if (!/mso-list\s*:/i.test(attrs) && !/MsoListParagraph/i.test(attrs)) continue;

    const levelMatch = /mso-list\s*:[^;'"]*level(\d+)/i.exec(attrs);
    const level = clampLevel(levelMatch ? Number(levelMatch[1]) : 1);
    // Strip Word list marker spans (often Wingdings / Ignorable).
    const withoutMarker = inner
      .replace(/<!--\[if[^\]]*\]>[\s\S]*?<!\[endif\]-->/gi, " ")
      .replace(/<span[^>]*mso-list\s*:\s*Ignore[^>]*>[\s\S]*?<\/span>/gi, " ");
    const text = stripTags(withoutMarker);
    if (!text) continue;
    items.push({ text, level });

    if (/mso-list\s*:[^;'"]*lfo/i.test(attrs) && /\d+\./.test(stripTags(inner).slice(0, 6))) {
      // Heuristic: leading "1." style often means numbered; keep bullet default otherwise.
    }
  }

  if (items.length < 2) return null;

  // Prefer numbered when most items start with digit markers in the raw mso ignore span.
  const numberedHints = (trimmed.match(/mso-list\s*:\s*Ignore[^>]*>\s*\d+[\.\)]/gi) || []).length;
  if (numberedHints >= 2) listType = "number";

  return { listType, items };
}

/**
 * Plain-text fallback: 2+ lines starting with bullet/number markers.
 * Conservative so normal multi-line paste is never hijacked.
 */
export function parsePlainTextList(plainText: string): { listType: "bullet" | "number"; items: ParsedItem[] } | null {
  const raw = String(plainText || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = raw
    .split("\n")
    .map((line) => line.replace(/\t/g, " "))
    .filter((line, index, arr) => !(index === arr.length - 1 && line === ""));

  if (lines.length < 2) return null;

  const bulletRe = /^(\s*)([•●○▪◦\-*\u2013\u2014])\s+(.+)$/;
  const numberRe = /^(\s*)(\d+[\.\)]|[a-zA-Z][\.\)])\s+(.+)$/;

  const parsed: Array<{ text: string; indent: number; kind: "bullet" | "number" }> = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const bullet = bulletRe.exec(line);
    if (bullet) {
      parsed.push({
        text: cleanItemText(bullet[3]),
        indent: bullet[1].length,
        kind: "bullet",
      });
      continue;
    }
    const numbered = numberRe.exec(line);
    if (numbered) {
      parsed.push({
        text: cleanItemText(numbered[3]),
        indent: numbered[1].length,
        kind: "number",
      });
      continue;
    }
    // Non-matching line → not a clean list paste.
    return null;
  }

  if (parsed.length < 2) return null;
  if (parsed.some((item) => !item.text)) return null;

  const bulletCount = parsed.filter((item) => item.kind === "bullet").length;
  const listType: "bullet" | "number" = bulletCount >= parsed.length / 2 ? "bullet" : "number";

  const indents = [...new Set(parsed.map((item) => item.indent))].sort((a, b) => a - b);
  const items = parsed.map((item) => ({
    text: item.text,
    level: clampLevel(indents.indexOf(item.indent) + 1),
  }));

  return { listType, items };
}

function toListBlock(
  listType: "bullet" | "number",
  items: ParsedItem[]
): ClipboardListBlock | null {
  const trimmed = items
    .map((item) => ({ text: cleanItemText(item.text), level: clampLevel(item.level) }))
    .filter((item) => item.text)
    .slice(0, MAX_LIST_ITEMS);
  if (trimmed.length === 0) return null;

  // First item must be level 1 (matches ListBlock numbering rules).
  if (trimmed[0].level !== 1) {
    const delta = trimmed[0].level - 1;
    for (const item of trimmed) {
      item.level = clampLevel(item.level - delta);
    }
  }

  const contentItems: ContentListItem[] = trimmed.map((item) => ({
    id: newId("li"),
    text: item.text,
    level: item.level,
  }));

  return {
    id: newId("list"),
    type: "list",
    listType,
    items: contentItems,
  };
}

/**
 * Prefer HTML UL/OL, then Word mso-list paragraphs, then plain bullet/number lines.
 * Returns null when clipboard is not a list so default paste remains unchanged.
 */
export function parseClipboardList(
  html: string,
  plainText: string
): ClipboardListBlock | null {
  const fromDom = parseHtmlListsDom(html);
  if (fromDom) {
    const block = toListBlock(fromDom.listType, fromDom.items);
    if (block) return block;
  }

  const fromLite = parseHtmlListsLite(html);
  if (fromLite) {
    const block = toListBlock(fromLite.listType, fromLite.items);
    if (block) return block;
  }

  const fromWord = parseWordMsoList(html);
  if (fromWord) {
    const block = toListBlock(fromWord.listType, fromWord.items);
    if (block) return block;
  }

  const fromPlain = parsePlainTextList(plainText);
  if (fromPlain) {
    return toListBlock(fromPlain.listType, fromPlain.items);
  }

  return null;
}
