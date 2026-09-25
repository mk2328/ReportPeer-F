/** Hierarchical heading numbers + ordered content-block helpers for the editor. */

export type ContentListItem = {
  id: string;
  text: string;
  level: number;
};

export type ContentList = {
  id: string;
  type: "bullet" | "number";
  items: ContentListItem[];
};

export type TableCellAlign = "left" | "center" | "right";

/** Rich table cell; plain strings remain valid for backward compatibility. */
export type TableCellData = {
  text: string;
  background?: string;
  textColor?: string;
  bold?: boolean;
  align?: TableCellAlign;
  colspan?: number;
  rowspan?: number;
  /** Covered by another cell's colspan/rowspan — not shown or written as content. */
  hidden?: boolean;
};

export type ContentTable = {
  id: string;
  caption: string;
  columns: Array<string | TableCellData>;
  data: Array<Array<string | TableCellData>>;
};

export function normalizeTableCell(
  value: string | TableCellData | null | undefined
): TableCellData {
  if (value && typeof value === "object" && "text" in value) {
    const colspan = Number(value.colspan) || 1;
    const rowspan = Number(value.rowspan) || 1;
    return {
      text: String(value.text ?? ""),
      background: value.background || undefined,
      textColor: value.textColor || undefined,
      bold: typeof value.bold === "boolean" ? value.bold : undefined,
      align: value.align === "center" || value.align === "right" || value.align === "left"
        ? value.align
        : undefined,
      colspan: colspan > 1 ? colspan : undefined,
      rowspan: rowspan > 1 ? rowspan : undefined,
      hidden: Boolean(value.hidden) || undefined,
    };
  }
  return { text: String(value ?? "") };
}

export function cellPlainText(value: string | TableCellData | null | undefined): string {
  return normalizeTableCell(value).text;
}

/** Flatten formatting for storage; omit defaults. */
export function serializeTableCell(cell: TableCellData): string | TableCellData {
  const normalized = normalizeTableCell(cell);
  const hasFormat =
    Boolean(normalized.background) ||
    Boolean(normalized.textColor) ||
    typeof normalized.bold === "boolean" ||
    Boolean(normalized.align) ||
    Boolean(normalized.colspan && normalized.colspan > 1) ||
    Boolean(normalized.rowspan && normalized.rowspan > 1) ||
    Boolean(normalized.hidden);
  if (!hasFormat) return normalized.text;
  return normalized;
}

export type TableCellRef = {
  /** -1 = header row (columns[]); >= 0 = body data row */
  row: number;
  col: number;
};

export function getTableCell(
  table: Pick<ContentTable, "columns" | "data">,
  ref: TableCellRef
): TableCellData {
  if (ref.row < 0) return normalizeTableCell(table.columns[ref.col]);
  return normalizeTableCell(table.data[ref.row]?.[ref.col]);
}

export function setTableCell<T extends Pick<ContentTable, "columns" | "data">>(
  table: T,
  ref: TableCellRef,
  cell: TableCellData
): T {
  const value = serializeTableCell(cell);
  if (ref.row < 0) {
    return {
      ...table,
      columns: table.columns.map((existing, index) =>
        index === ref.col ? value : existing
      ),
    };
  }
  return {
    ...table,
    data: table.data.map((row, rowIndex) =>
      rowIndex === ref.row
        ? row.map((existing, colIndex) => (colIndex === ref.col ? value : existing))
        : row
    ),
  };
}

/** Clear merges after structural row/column edits. */
export function clearTableMerges(table: ContentTable): ContentTable {
  return {
    ...table,
    columns: table.columns.map((cell) => {
      const n = normalizeTableCell(cell);
      return serializeTableCell({ ...n, colspan: undefined, rowspan: undefined, hidden: undefined });
    }),
    data: table.data.map((row) =>
      row.map((cell) => {
        const n = normalizeTableCell(cell);
        return serializeTableCell({
          ...n,
          colspan: undefined,
          rowspan: undefined,
          hidden: undefined,
        });
      })
    ),
  };
}

function cellKey(ref: TableCellRef): string {
  return `${ref.row}:${ref.col}`;
}

/** True if selection is a filled rectangle of visible, unmerged cells. */
export function canMergeTableCells(
  table: Pick<ContentTable, "columns" | "data">,
  refs: TableCellRef[]
): boolean {
  if (refs.length < 2) return false;
  const unique = Array.from(new Map(refs.map((ref) => [cellKey(ref), ref])).values());
  if (unique.length < 2) return false;

  const rows = unique.map((ref) => ref.row);
  const cols = unique.map((ref) => ref.col);
  const minRow = Math.min(...rows);
  const maxRow = Math.max(...rows);
  const minCol = Math.min(...cols);
  const maxCol = Math.max(...cols);

  // Keep header and body merges separate (matches editor HTML structure).
  const headerOnly = maxRow < 0;
  const bodyOnly = minRow >= 0;
  if (!headerOnly && !bodyOnly) return false;

  const expected = (maxRow - minRow + 1) * (maxCol - minCol + 1);
  if (unique.length !== expected) return false;

  for (let row = minRow; row <= maxRow; row += 1) {
    for (let col = minCol; col <= maxCol; col += 1) {
      const cell = getTableCell(table, { row, col });
      if (cell.hidden) return false;
      if ((cell.colspan || 1) > 1 || (cell.rowspan || 1) > 1) return false;
      if (row < 0) {
        if (row !== -1 || col < 0 || col >= table.columns.length) return false;
      } else if (row >= table.data.length || col < 0 || col >= (table.data[row]?.length || 0)) {
        return false;
      }
    }
  }
  return true;
}

export function mergeTableCells(
  table: ContentTable,
  refs: TableCellRef[]
): ContentTable | null {
  if (!canMergeTableCells(table, refs)) return null;
  const unique = Array.from(new Map(refs.map((ref) => [cellKey(ref), ref])).values());
  const rows = unique.map((ref) => ref.row);
  const cols = unique.map((ref) => ref.col);
  const minRow = Math.min(...rows);
  const maxRow = Math.max(...rows);
  const minCol = Math.min(...cols);
  const maxCol = Math.max(...cols);
  const colspan = maxCol - minCol + 1;
  const rowspan = maxRow - minRow + 1;

  const texts: string[] = [];
  for (let row = minRow; row <= maxRow; row += 1) {
    for (let col = minCol; col <= maxCol; col += 1) {
      const text = getTableCell(table, { row, col }).text.trim();
      if (text) texts.push(text);
    }
  }

  const anchor = getTableCell(table, { row: minRow, col: minCol });
  let next: ContentTable = {
    ...table,
    columns: [...table.columns],
    data: table.data.map((row) => [...row]),
  };

  for (let row = minRow; row <= maxRow; row += 1) {
    for (let col = minCol; col <= maxCol; col += 1) {
      if (row === minRow && col === minCol) {
        next = setTableCell(next, { row, col }, {
          ...anchor,
          text: texts.join(" ") || anchor.text,
          colspan: colspan > 1 ? colspan : undefined,
          rowspan: rowspan > 1 ? rowspan : undefined,
          hidden: undefined,
        });
      } else {
        next = setTableCell(next, { row, col }, {
          text: "",
          hidden: true,
        });
      }
    }
  }
  return next;
}

export function canUnmergeTableCell(
  table: Pick<ContentTable, "columns" | "data">,
  ref: TableCellRef
): boolean {
  const cell = getTableCell(table, ref);
  if (cell.hidden) return false;
  return (cell.colspan || 1) > 1 || (cell.rowspan || 1) > 1;
}

export function unmergeTableCell(
  table: ContentTable,
  ref: TableCellRef
): ContentTable | null {
  if (!canUnmergeTableCell(table, ref)) return null;
  const cell = getTableCell(table, ref);
  const colspan = cell.colspan || 1;
  const rowspan = cell.rowspan || 1;
  let next = setTableCell(table, ref, {
    ...cell,
    colspan: undefined,
    rowspan: undefined,
    hidden: undefined,
  });
  for (let row = ref.row; row < ref.row + rowspan; row += 1) {
    for (let col = ref.col; col < ref.col + colspan; col += 1) {
      if (row === ref.row && col === ref.col) continue;
      const covered = getTableCell(next, { row, col });
      if (covered.hidden) {
        next = setTableCell(next, { row, col }, { text: "" });
      }
    }
  }
  return next;
}

export type ContentFigure = {
  id: string;
  caption: string;
  fileName: string;
  mimeType: string;
  dataUrl: string;
  /** Percent of JUW max figure width (40–100). Default 100. */
  widthPercent?: number;
  /** Image alignment; default center (JUW). */
  align?: "left" | "center" | "right";
};

export type ContentBlock =
  | { id: string; type: "paragraph"; text: string }
  | { id: string; type: "list"; listType: "bullet" | "number"; items: ContentListItem[] }
  | {
      id: string;
      type: "table";
      caption: string;
      columns: Array<string | TableCellData>;
      data: Array<Array<string | TableCellData>>;
    }
  | {
      id: string;
      type: "figure";
      caption: string;
      fileName: string;
      mimeType: string;
      dataUrl: string;
      widthPercent?: number;
      align?: "left" | "center" | "right";
    };

export type StructureItem = {
  id: string;
  title: string;
  level: number;
  /** Hierarchical number from tree position (e.g. "1.2.1"). Not stored in title. */
  number?: string;
  subitems?: StructureItem[];
  lists?: ContentList[];
  tables?: ContentTable[];
  figures?: ContentFigure[];
  /** Ordered mixed content; preferred over separate lists/tables/figures + contentMap. */
  blocks?: ContentBlock[];
};

/** Seed / system section ids that must not be deleted. */
const PROTECTED_ID_RE =
  /^(abstract|lof|lot|ack|refs|appa|appb|ch\d+(?:-\d+)*)$/i;

export function isProtectedStructureId(id: string): boolean {
  return PROTECTED_ID_RE.test(String(id || "").trim());
}

export function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function stripHeadingNumber(title: string): string {
  return String(title || "")
    .replace(/^\d+(?:\.\d+)*\.?\s+/, "")
    .trim();
}

/** Display label: "1.1 Purpose" — number and title are separate in data. */
export function formatHeadingLabel(item: StructureItem): string {
  const title = String(item.title || "").trim();
  const number = String(item.number || "").trim();
  if (number) return `${number} ${title}`.trim();
  return title;
}

export function chapterNumberFromItem(item: StructureItem): number | null {
  const title = String(item.title || "").trim();
  const titleMatch = /^CHAPTER\s+(\d+)\b/i.exec(title);
  if (titleMatch) return parseInt(titleMatch[1], 10);
  const idMatch = /^ch(\d+)$/i.exec(String(item.id || "").trim());
  if (idMatch) return parseInt(idMatch[1], 10);
  return null;
}

/**
 * Assign hierarchical numbers from chapter structure (2.3, 2.3.1, …).
 * Titles stay clean (no embedded numbers); `number` holds the value.
 * Chapter / front-matter / appendix titles are left unchanged.
 */
export function renumberStructure(items: StructureItem[]): StructureItem[] {
  return items.map((item) => {
    const chapterNum = chapterNumberFromItem(item);
    if (chapterNum != null) {
      return {
        ...item,
        number: undefined,
        title: String(item.title || "").trim(),
        subitems: renumberChildren(item.subitems || [], [chapterNum]),
      };
    }
    const cleanTitle = stripHeadingNumber(item.title) || item.title;
    return {
      ...item,
      title: cleanTitle,
      number: undefined,
      subitems: renumberStructure(item.subitems || []),
    };
  });
}

function renumberChildren(items: StructureItem[], prefix: number[]): StructureItem[] {
  return items.map((item, index) => {
    const numbers = [...prefix, index + 1];
    const base = stripHeadingNumber(item.title) || "Section";
    return {
      ...item,
      title: base,
      number: numbers.join("."),
      level: numbers.length + 1,
      subitems: renumberChildren(item.subitems || [], numbers),
    };
  });
}

export function collectStructureIds(items: StructureItem[]): string[] {
  const ids: string[] = [];
  const walk = (nodes: StructureItem[]) => {
    for (const node of nodes) {
      ids.push(node.id);
      if (node.subitems?.length) walk(node.subitems);
    }
  };
  walk(items);
  return ids;
}

export function deleteStructureItem(
  items: StructureItem[],
  id: string
): { items: StructureItem[]; removedIds: string[] } {
  const removedIds: string[] = [];

  const walk = (nodes: StructureItem[]): StructureItem[] => {
    const next: StructureItem[] = [];
    for (const node of nodes) {
      if (node.id === id) {
        removedIds.push(...collectStructureIds([node]));
        continue;
      }
      const subitems = node.subitems?.length ? walk(node.subitems) : node.subitems;
      next.push(subitems === node.subitems ? node : { ...node, subitems });
    }
    return next;
  };

  return { items: renumberStructure(walk(items)), removedIds };
}

export function renameStructureItem(
  items: StructureItem[],
  id: string,
  newTitle: string
): StructureItem[] {
  const base = stripHeadingNumber(newTitle) || newTitle.trim();
  if (!base) return items;

  const walk = (nodes: StructureItem[]): StructureItem[] =>
    nodes.map((node) => {
      if (node.id === id) {
        const chapterNum = chapterNumberFromItem(node);
        // Keep CHAPTER N - TITLE form for chapters; numbered children get renumbered after.
        if (chapterNum != null && /^CHAPTER\s+\d+/i.test(node.title)) {
          const rest = base.replace(/^CHAPTER\s+\d+\s*[-–—:]?\s*/i, "").trim();
          return {
            ...node,
            title: rest ? `CHAPTER ${chapterNum} - ${rest}` : `CHAPTER ${chapterNum}`,
          };
        }
        return { ...node, title: base };
      }
      if (!node.subitems?.length) return node;
      return { ...node, subitems: walk(node.subitems) };
    });

  return renumberStructure(walk(items));
}

export function findParentId(items: StructureItem[], childId: string): string | null {
  for (const item of items) {
    for (const child of item.subitems || []) {
      if (child.id === childId) return item.id;
      const nested = findParentId(item.subitems || [], childId);
      if (nested) return nested;
    }
  }
  return null;
}

/** Build ordered blocks from legacy contentMap + lists/tables/figures. */
export function ensureContentBlocks(
  item: StructureItem,
  contentMap: Record<string, string>
): ContentBlock[] {
  if (Array.isArray(item.blocks) && item.blocks.length > 0) {
    return item.blocks;
  }

  const blocks: ContentBlock[] = [];
  const text = contentMap[item.id] || "";
  const hasAssets =
    (item.lists && item.lists.length > 0) ||
    (item.tables && item.tables.length > 0) ||
    (item.figures && item.figures.length > 0);

  if (text.trim() || !hasAssets) {
    // Ids must be derived, not random: this runs on every render for legacy
    // items, and unstable ids remount the inputs and drop selection/focus.
    const paragraphs = text.split(/\n{2,}/);
    const kept = paragraphs.filter((part, index) => part.trim() || index === 0);
    for (const [index, paragraph] of (kept.length ? kept : [""]).entries()) {
      blocks.push({ id: `${item.id}-p-${index}`, type: "paragraph", text: paragraph });
    }
  }
  for (const [index, list] of (item.lists || []).entries()) {
    blocks.push({
      id: list.id || `${item.id}-list-${index}`,
      type: "list",
      listType: list.type,
      items: list.items || [],
    });
  }
  for (const [index, table] of (item.tables || []).entries()) {
    blocks.push({
      id: table.id || `${item.id}-tbl-${index}`,
      type: "table",
      caption: table.caption || "",
      columns: table.columns || [],
      data: table.data || [],
    });
  }
  for (const [index, figure] of (item.figures || []).entries()) {
    blocks.push({
      id: figure.id || `${item.id}-fig-${index}`,
      type: "figure",
      caption: figure.caption || "",
      fileName: figure.fileName || "image",
      mimeType: figure.mimeType || "image/png",
      dataUrl: figure.dataUrl || "",
      widthPercent: figure.widthPercent,
      align: figure.align,
    });
  }
  return blocks;
}

/** Keep legacy arrays + contentMap in sync when blocks change. */
export function applyBlocksToItem(
  item: StructureItem,
  blocks: ContentBlock[]
): { item: StructureItem; contentText: string } {
  const lists: ContentList[] = [];
  const tables: ContentTable[] = [];
  const figures: ContentFigure[] = [];
  const paragraphTexts: string[] = [];

  for (const block of blocks) {
    if (block.type === "paragraph") {
      paragraphTexts.push(block.text || "");
    } else if (block.type === "list") {
      lists.push({
        id: block.id,
        type: block.listType,
        items: block.items,
      });
    } else if (block.type === "table") {
      tables.push({
        id: block.id,
        caption: block.caption,
        columns: block.columns,
        data: block.data,
      });
    } else if (block.type === "figure") {
      figures.push({
        id: block.id,
        caption: block.caption,
        fileName: block.fileName,
        mimeType: block.mimeType,
        dataUrl: block.dataUrl,
        widthPercent: block.widthPercent,
        align: block.align,
      });
    }
  }

  const contentText = paragraphTexts.join("\n\n");
  return {
    item: {
      ...item,
      blocks,
      lists,
      tables,
      figures,
    },
    contentText,
  };
}
