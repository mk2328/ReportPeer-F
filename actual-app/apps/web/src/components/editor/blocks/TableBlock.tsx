"use client";

import type { Dispatch, MouseEvent, SetStateAction } from "react";
import {
    AlignLeft,
    AlignCenter,
    AlignRight,
    Bold,
    Trash2,
} from "lucide-react";
import {
    type ContentBlock,
    type TableCellAlign,
    type TableCellData,
    type TableCellRef,
    canMergeTableCells,
    canUnmergeTableCell,
    getTableCell,
    normalizeTableCell,
    setTableCell,
} from "@/lib/structureUtils";

type TableBlockData = Extract<ContentBlock, { type: "table" }>;

type Props = {
    block: TableBlockData;
    selected: boolean;
    selectedTableCells: TableCellRef[];
    setSelectedTableCells: Dispatch<SetStateAction<TableCellRef[]>>;
    setTableSelectionAnchor: Dispatch<SetStateAction<TableCellRef | null>>;
    onSelect: () => void;
    onRemove: () => void;
    onCaptionChange: (caption: string) => void;
    onUpdateTable: (
        updater: (table: TableBlockData) => TableBlockData
    ) => void;
    onSelectCell: (ref: TableCellRef, e: MouseEvent) => void;
    onApplyFormat: (patch: Partial<TableCellData>) => void;
    onToggleBold: () => void;
    onSetAlign: (align: TableCellAlign) => void;
    onMerge: () => void;
    onUnmerge: () => void;
    onRemoveColumn: (colIndex: number) => void;
    onRemoveRow: (rowIndex: number) => void;
    onAddRow: () => void;
    onAddColumn: () => void;
};

export function TableBlock({
    block,
    selected,
    selectedTableCells,
    setSelectedTableCells,
    setTableSelectionAnchor,
    onSelect,
    onRemove,
    onCaptionChange,
    onUpdateTable,
    onSelectCell,
    onApplyFormat,
    onToggleBold,
    onSetAlign,
    onMerge,
    onUnmerge,
    onRemoveColumn,
    onRemoveRow,
    onAddRow,
    onAddColumn,
}: Props) {
    const tableActive = selected && selectedTableCells.length > 0;
    const canMerge = canMergeTableCells(block, selectedTableCells);
    const canUnmerge = selectedTableCells.some((ref) =>
        canUnmergeTableCell(block, ref)
    );
    const primaryRef = selectedTableCells[0];
    const primaryCell = primaryRef
        ? getTableCell(block, primaryRef)
        : null;
    const isCellSelected = (ref: TableCellRef) =>
        selectedTableCells.some(
            (cell) => cell.row === ref.row && cell.col === ref.col
        );

    return (
        <div
            className={`-mx-3 max-w-full min-w-0 rounded-md px-3 py-2 transition-colors ${selected ? "bg-[#F2EBF1]/50" : ""}`}
            onClick={onSelect}
        >
            <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] uppercase tracking-wider text-gray-400">Table</div>
                <button type="button" title="Remove table" onClick={onRemove} className="p-1 text-gray-300 hover:text-red-500">
                    <Trash2 className="h-3.5 w-3.5" />
                </button>
            </div>
            <input
                value={block.caption}
                onFocus={onSelect}
                onChange={(e) => onCaptionChange(e.target.value)}
                className="w-full text-sm font-serif border-b border-gray-100 focus:border-[#6F155F] focus:outline-none py-1 mb-3"
                placeholder="Table caption (number is assigned automatically)"
            />
            {tableActive ? (
                <div
                    className="mb-2 flex flex-wrap items-center gap-1 rounded border border-gray-200 bg-gray-50 px-2 py-1.5"
                    onMouseDown={(e) => e.preventDefault()}
                >
                    <label className="flex items-center gap-1 text-[11px] text-gray-500" title="Cell shading">
                        Fill
                        <input
                            type="color"
                            value={primaryCell?.background || "#ffffff"}
                            onChange={(e) =>
                                onApplyFormat({
                                    background: e.target.value,
                                })
                            }
                            className="h-6 w-7 cursor-pointer rounded border border-gray-200 bg-white p-0"
                        />
                    </label>
                    <label className="flex items-center gap-1 text-[11px] text-gray-500" title="Text color">
                        Text
                        <input
                            type="color"
                            value={primaryCell?.textColor || "#000000"}
                            onChange={(e) =>
                                onApplyFormat({
                                    textColor: e.target.value,
                                })
                            }
                            className="h-6 w-7 cursor-pointer rounded border border-gray-200 bg-white p-0"
                        />
                    </label>
                    <button
                        type="button"
                        title="Bold"
                        onClick={onToggleBold}
                        className={`rounded border px-1.5 py-1 ${primaryCell?.bold ? "border-[#6F155F] text-[#6F155F] bg-white" : "border-gray-200 text-gray-600 hover:border-[#6F155F]"}`}
                    >
                        <Bold className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" title="Align left" onClick={() => onSetAlign("left")} className={`rounded border px-1.5 py-1 ${primaryCell?.align === "left" ? "border-[#6F155F] text-[#6F155F]" : "border-gray-200 text-gray-600"}`}>
                        <AlignLeft className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" title="Align center" onClick={() => onSetAlign("center")} className={`rounded border px-1.5 py-1 ${primaryCell?.align === "center" ? "border-[#6F155F] text-[#6F155F]" : "border-gray-200 text-gray-600"}`}>
                        <AlignCenter className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" title="Align right" onClick={() => onSetAlign("right")} className={`rounded border px-1.5 py-1 ${primaryCell?.align === "right" ? "border-[#6F155F] text-[#6F155F]" : "border-gray-200 text-gray-600"}`}>
                        <AlignRight className="h-3.5 w-3.5" />
                    </button>
                    <button
                        type="button"
                        title="Merge cells"
                        disabled={!canMerge}
                        onClick={onMerge}
                        className="rounded border border-gray-200 px-2 py-1 text-[11px] text-gray-600 disabled:opacity-40 hover:border-[#6F155F] hover:text-[#6F155F]"
                    >
                        Merge
                    </button>
                    <button
                        type="button"
                        title="Unmerge cells"
                        disabled={!canUnmerge}
                        onClick={onUnmerge}
                        className="rounded border border-gray-200 px-2 py-1 text-[11px] text-gray-600 disabled:opacity-40 hover:border-[#6F155F] hover:text-[#6F155F]"
                    >
                        Unmerge
                    </button>
                    <span className="text-[10px] text-gray-400 ml-1">Shift/Ctrl+click to select</span>
                </div>
            ) : null}
            <div className="w-full max-w-full min-w-0 overflow-x-auto overscroll-x-contain">
                <table className="w-full max-w-full border-collapse text-sm font-serif table-fixed">
                    <thead>
                        <tr>
                            {block.columns.map((column, colIndex) => {
                                const cell = normalizeTableCell(column);
                                if (cell.hidden) return null;
                                const ref = { row: -1, col: colIndex };
                                const selectedCell = isCellSelected(ref);
                                return (
                                    <th
                                        key={`${block.id}-col-${colIndex}`}
                                        colSpan={cell.colspan || 1}
                                        rowSpan={cell.rowspan || 1}
                                        className={`border border-gray-200 p-1 align-top min-w-0 ${selectedCell ? "ring-2 ring-inset ring-[#6F155F]" : ""}`}
                                        style={{ backgroundColor: cell.background || undefined }}
                                        onMouseDown={(e) => {
                                            if (e.button !== 0) return;
                                            e.stopPropagation();
                                            onSelectCell(ref, e);
                                        }}
                                    >
                                        <div className="flex items-center gap-1 min-w-0">
                                            <input
                                                value={cell.text}
                                                onFocus={() => {
                                                    onSelect();
                                                    setSelectedTableCells((prev) =>
                                                        prev.some((c) => c.row === ref.row && c.col === ref.col)
                                                            ? prev
                                                            : [ref]
                                                    );
                                                    setTableSelectionAnchor((prev) => prev ?? ref);
                                                }}
                                                onChange={(e) =>
                                                    onUpdateTable((current) =>
                                                        setTableCell(current, ref, {
                                                            ...getTableCell(current, ref),
                                                            text: e.target.value,
                                                        })
                                                    )
                                                }
                                                className="w-full min-w-0 focus:outline-none bg-transparent"
                                                style={{
                                                    color: cell.textColor || undefined,
                                                    fontWeight:
                                                        cell.bold === false
                                                            ? 400
                                                            : cell.bold
                                                              ? 700
                                                              : 600,
                                                    textAlign: cell.align || "center",
                                                }}
                                                placeholder={`Column ${colIndex + 1}`}
                                            />
                                            <button
                                                type="button"
                                                title="Remove column"
                                                onMouseDown={(e) => e.stopPropagation()}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onRemoveColumn(colIndex);
                                                }}
                                                className="text-gray-300 hover:text-red-500 shrink-0"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    </th>
                                );
                            })}
                            <th className="w-8 p-0 border-0" aria-hidden />
                        </tr>
                    </thead>
                    <tbody>
                        {block.data.map((row, rowIndex) => (
                            <tr key={`${block.id}-row-${rowIndex}`}>
                                {row.map((rawCell, colIndex) => {
                                    const cell = normalizeTableCell(rawCell);
                                    if (cell.hidden) return null;
                                    const ref = { row: rowIndex, col: colIndex };
                                    const selectedCell = isCellSelected(ref);
                                    return (
                                        <td
                                            key={`${block.id}-cell-${rowIndex}-${colIndex}`}
                                            colSpan={cell.colspan || 1}
                                            rowSpan={cell.rowspan || 1}
                                            className={`border border-gray-200 p-1 align-top min-w-0 ${selectedCell ? "ring-2 ring-inset ring-[#6F155F]" : ""}`}
                                            style={{ backgroundColor: cell.background || undefined }}
                                            onMouseDown={(e) => {
                                                if (e.button !== 0) return;
                                                e.stopPropagation();
                                                onSelectCell(ref, e);
                                            }}
                                        >
                                            <input
                                                value={cell.text}
                                                onFocus={() => {
                                                    onSelect();
                                                    setSelectedTableCells((prev) =>
                                                        prev.some((c) => c.row === ref.row && c.col === ref.col)
                                                            ? prev
                                                            : [ref]
                                                    );
                                                    setTableSelectionAnchor((prev) => prev ?? ref);
                                                }}
                                                onChange={(e) =>
                                                    onUpdateTable((current) =>
                                                        setTableCell(current, ref, {
                                                            ...getTableCell(current, ref),
                                                            text: e.target.value,
                                                        })
                                                    )
                                                }
                                                className="w-full min-w-0 focus:outline-none bg-transparent"
                                                style={{
                                                    color: cell.textColor || undefined,
                                                    fontWeight:
                                                        cell.bold === false
                                                            ? 400
                                                            : cell.bold
                                                              ? 700
                                                              : undefined,
                                                    textAlign: cell.align || "left",
                                                }}
                                                placeholder="Cell"
                                            />
                                        </td>
                                    );
                                })}
                                <td className="p-1 w-8 align-middle">
                                    <button
                                        type="button"
                                        title="Remove row"
                                        onClick={() => onRemoveRow(rowIndex)}
                                        className="text-gray-300 hover:text-red-500"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="flex gap-2 mt-3">
                <button type="button" onClick={onAddRow} className="text-[11px] border border-gray-200 rounded px-2 py-1 hover:border-[#6F155F] hover:text-[#6F155F]">
                    Add row
                </button>
                <button type="button" onClick={onAddColumn} className="text-[11px] border border-gray-200 rounded px-2 py-1 hover:border-[#6F155F] hover:text-[#6F155F]">
                    Add column
                </button>
            </div>
        </div>
    );
}
