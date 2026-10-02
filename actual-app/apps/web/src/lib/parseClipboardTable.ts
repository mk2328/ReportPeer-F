/**
 * Convert clipboard HTML/TSV into the existing ContentTable block shape.
 * Browser paste only — does not change the table schema or generation path.
 */

import {
  type ContentTable,
  type TableCellAlign,
  type TableCellData,
  newId,
  serializeTableCell,
} from "@/lib/structureUtils";

const MAX_PASTE_COLS = 20;
const MAX_PASTE_ROWS = 50;

type ParsedCell = TableCellData;

function emptyHiddenCell(): ParsedCell {
  return { text: "", hidden: true };
}

function rgbToHex(value: string): string | undefined {
  const hex = value.trim();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) {
    if (hex.length === 4) {
      const r = hex[1];
      const g = hex[2];
      const b = hex[3];
      return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
    }
    return hex.toLowerCase();
  }
  const match = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(hex);
  if (!match) return undefined;
  const to = (n: string) => Number(n).toString(16).padStart(2, "0");
  return `#${to(match[1])}${to(match[2])}${to(match[3])}`;
}

function readStyleMap(styleAttr: string | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of String(styleAttr || "").split(";")) {
    const idx = part.indexOf(":");
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim().toLowerCase();
    const val = part.slice(idx + 1).trim();
    if (key && val) out[key] = val;
  }
  return out;
}

function parseAlign(raw: string | null | undefined): TableCellAlign | undefined {
  const value = String(raw || "")
    .trim()
    .toLowerCase();
  if (value === "left" || value === "center" || value === "right") return value;
  if (value === "middle") return "center";
  return undefined;
}

function cellTextFromElement(el: Element): string {
  const text = (el.textContent || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  return text;
}

function formattingFromElement(el: Element, asHeader: boolean): Partial<ParsedCell> {
  const style = readStyleMap(el.getAttribute("style"));
  const background =
    rgbToHex(style["background-color"] || style.background || "") ||
    rgbToHex(el.getAttribute("bgcolor") || "") ||
    undefined;
  const textColor = rgbToHex(style.color || "") || undefined;
  const align =
    parseAlign(style["text-align"]) ||
    parseAlign(el.getAttribute("align")) ||
    undefined;

  let bold: boolean | undefined = asHeader ? true : undefined;
  const weight = (style["font-weight"] || "").toLowerCase();
  if (weight === "bold" || weight === "bolder" || Number(weight) >= 600) {
    bold = true;
  } else if (weight === "normal" || weight === "400") {
    bold = asHeader ? true : false;
  }
  if (el.querySelector("b, strong")) {
    bold = true;
  }
  for (const nested of Array.from(el.querySelectorAll("[style]"))) {
    const nestedWeight = (
      readStyleMap(nested.getAttribute("style"))["font-weight"] || ""
    ).toLowerCase();
    if (
      nestedWeight === "bold" ||
      nestedWeight === "bolder" ||
      Number(nestedWeight) >= 600
    ) {
      bold = true;
      break;
    }
  }

  return {
    background,
    textColor,
    bold,
    align,
  };
}

function parseHtmlCell(el: Element, asHeader: boolean): ParsedCell {
  const colspan = Math.max(1, parseInt(el.getAttribute("colspan") || "1", 10) || 1);
  const rowspan = Math.max(1, parseInt(el.getAttribute("rowspan") || "1", 10) || 1);
  const format = formattingFromElement(el, asHeader);
  return {
    text: cellTextFromElement(el),
    ...format,
    colspan: colspan > 1 ? colspan : undefined,
    rowspan: rowspan > 1 ? rowspan : undefined,
  };
}

/** Place HTML cells onto a rectangular occupancy grid (handles colspan/rowspan). */
function expandSparseRows(sparseRows: ParsedCell[][]): ParsedCell[][] | null {
  if (sparseRows.length === 0) return null;

  const grid: Array<Array<ParsedCell | null>> = [];

  sparseRows.forEach((rowCells, rowIndex) => {
    if (!grid[rowIndex]) grid[rowIndex] = [];
    let col = 0;
    for (const cell of rowCells) {
      while (grid[rowIndex][col] != null) col += 1;
      const colspan = cell.colspan || 1;
      const rowspan = cell.rowspan || 1;
      for (let dr = 0; dr < rowspan; dr += 1) {
        const r = rowIndex + dr;
        if (!grid[r]) grid[r] = [];
        for (let dc = 0; dc < colspan; dc += 1) {
          const c = col + dc;
          if (dr === 0 && dc === 0) {
            grid[r][c] = cell;
          } else if (grid[r][c] == null) {
            grid[r][c] = emptyHiddenCell();
          }
        }
      }
      col += colspan;
    }
  });

  const width = Math.max(0, ...grid.map((row) => row.length));
  if (width < 1) return null;

  return grid.map((row) => {
    const next: ParsedCell[] = [];
    for (let c = 0; c < width; c += 1) {
      next.push(row[c] ?? { text: "" });
    }
    return next;
  });
}

function attrValue(attrs: string, name: string): string | null {
  const match = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(
    attrs
  );
  if (!match) return null;
  return match[2] ?? match[3] ?? match[4] ?? null;
}

function stripTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|div|li|tr)>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function formattingFromAttrs(attrs: string, asHeader: boolean, innerHtml: string): Partial<ParsedCell> {
  const style = readStyleMap(attrValue(attrs, "style"));
  const background =
    rgbToHex(style["background-color"] || style.background || "") ||
    rgbToHex(attrValue(attrs, "bgcolor") || "") ||
    undefined;
  const textColor = rgbToHex(style.color || "") || undefined;
  const align =
    parseAlign(style["text-align"]) || parseAlign(attrValue(attrs, "align")) || undefined;

  let bold: boolean | undefined = asHeader ? true : undefined;
  const weight = (style["font-weight"] || "").toLowerCase();
  if (weight === "bold" || weight === "bolder" || Number(weight) >= 600) bold = true;
  if (/<(b|strong)\b/i.test(innerHtml)) bold = true;
  if (/font-weight\s*:\s*(bold|bolder|[6-9]00)/i.test(innerHtml)) bold = true;

  return { background, textColor, bold, align };
}

/** DOM-free fallback for tests and unusual environments; handles flat tables. */
function parseHtmlTableRowsLite(html: string): ParsedCell[][] | null {
  const trimmed = String(html || "").trim();
  if (!trimmed || !/<table[\s>]/i.test(trimmed)) return null;
  const tableMatch = /<table\b[^>]*>([\s\S]*?)<\/table>/i.exec(trimmed);
  if (!tableMatch) return null;

  const sparse: ParsedCell[][] = [];
  const rowRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRe.exec(tableMatch[1]))) {
    const rowHtml = rowMatch[1];
    const cells: ParsedCell[] = [];
    const cellRe = /<(td|th)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRe.exec(rowHtml))) {
      const tag = cellMatch[1].toLowerCase();
      const attrs = cellMatch[2] || "";
      const inner = cellMatch[3] || "";
      const asHeader = tag === "th";
      const colspan = Math.max(1, parseInt(attrValue(attrs, "colspan") || "1", 10) || 1);
      const rowspan = Math.max(1, parseInt(attrValue(attrs, "rowspan") || "1", 10) || 1);
      const format = formattingFromAttrs(attrs, asHeader, inner);
      cells.push({
        text: stripTags(inner),
        ...format,
        colspan: colspan > 1 ? colspan : undefined,
        rowspan: rowspan > 1 ? rowspan : undefined,
      });
    }
    if (cells.length) sparse.push(cells);
  }
  return expandSparseRows(sparse);
}

function parseHtmlTableRows(html: string): ParsedCell[][] | null {
  const trimmed = String(html || "").trim();
  if (!trimmed || !/<table[\s>]/i.test(trimmed)) return null;

  if (typeof DOMParser !== "undefined") {
    try {
      const doc = new DOMParser().parseFromString(trimmed, "text/html");
      const table = doc.querySelector("table");
      if (table) {
        const sparse: ParsedCell[][] = [];
        const rows = Array.from(table.querySelectorAll("tr"));
        for (const tr of rows) {
          const cells = Array.from(tr.children).filter((child) => {
            const tag = child.tagName.toLowerCase();
            return tag === "td" || tag === "th";
          });
          if (cells.length === 0) continue;
          sparse.push(
            cells.map((cell) =>
              parseHtmlCell(cell, cell.tagName.toLowerCase() === "th")
            )
          );
        }
        const expanded = expandSparseRows(sparse);
        if (expanded) return expanded;
      }
    } catch {
      // Fall through to the lite parser.
    }
  }

  return parseHtmlTableRowsLite(trimmed);
}

/**
 * Detect a rectangular tab-separated paste (Excel / Sheets / Word plain fallback).
 * Requires tabs and at least two rows so normal multi-line prose is not treated as a table.
 */
export function parseTsvTableRows(plainText: string): ParsedCell[][] | null {
  const raw = String(plainText || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (!raw.includes("\t")) return null;

  const lines = raw
    .split("\n")
    .map((line) => line.replace(/\n$/, ""))
    .filter((line, index, arr) => !(index === arr.length - 1 && line === ""));

  if (lines.length < 2) return null;

  const rows = lines.map((line) => line.split("\t").map((cell) => cell.replace(/\u00a0/g, " ")));
  const width = Math.max(...rows.map((row) => row.length));
  if (width < 2) return null;

  const nonEmpty = rows.filter((row) => row.some((cell) => cell.trim() !== ""));
  if (nonEmpty.length < 2) return null;

  // Reject prose that happens to contain a single tab somewhere.
  const tabbedLines = rows.filter((row) => row.length >= 2).length;
  if (tabbedLines < 2) return null;

  return rows.map((row) => {
    const padded = [...row];
    while (padded.length < width) padded.push("");
    return padded.slice(0, width).map((text) => ({ text }));
  });
}

function clampGrid(rows: ParsedCell[][]): ParsedCell[][] {
  const limitedRows = rows.slice(0, MAX_PASTE_ROWS);
  return limitedRows.map((row) => row.slice(0, MAX_PASTE_COLS));
}

function hasVisibleContent(rows: ParsedCell[][]): boolean {
  return rows.some((row) =>
    row.some((cell) => !cell.hidden && String(cell.text || "").trim() !== "")
  );
}

/** First row → columns[]; remaining rows → data[]. Ensures at least one body row. */
export function buildContentTableFromRows(rows: ParsedCell[][]): ContentTable | null {
  const grid = clampGrid(rows).filter((row) => row.length > 0);
  if (grid.length === 0 || !hasVisibleContent(grid)) return null;

  const width = Math.max(...grid.map((row) => row.length));
  if (width < 1) return null;

  const normalizeRow = (row: ParsedCell[]): Array<string | TableCellData> => {
    const next = [...row];
    while (next.length < width) next.push({ text: "" });
    return next.slice(0, width).map((cell) => serializeTableCell(cell));
  };

  const columns = normalizeRow(grid[0]);
  const bodySource =
    grid.length > 1
      ? grid.slice(1)
      : [Array.from({ length: width }, () => ({ text: "" }))];
  const data = bodySource.map((row) => normalizeRow(row));

  return {
    id: newId("tbl"),
    caption: "",
    columns,
    data,
  };
}

/**
 * Prefer HTML `<table>`; fall back to TSV plain text.
 * Returns null when the clipboard is not a table so callers can keep default paste.
 */
export function parseClipboardTable(
  html: string,
  plainText: string
): ContentTable | null {
  const fromHtml = parseHtmlTableRows(html);
  if (fromHtml) {
    const table = buildContentTableFromRows(fromHtml);
    if (table) return table;
  }

  const fromTsv = parseTsvTableRows(plainText);
  if (fromTsv) {
    return buildContentTableFromRows(fromTsv);
  }

  return null;
}
