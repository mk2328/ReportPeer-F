'use client';

import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { useState, useEffect, useRef, type ChangeEvent, type KeyboardEvent } from "react";
import { useParams } from "next/navigation";
import {
    ChevronLeft, Sparkles, Loader2, ChevronRight, ChevronDown,
    PanelRightOpen, PanelRightClose, PanelLeftOpen, PanelLeftClose, Send, Bot, Plus, FileText, Save, FileDown,
    List, ListOrdered, IndentIncrease, IndentDecrease, Trash2,
    Table2, ImagePlus, Pencil, Bold, AlignLeft, AlignCenter, AlignRight
} from "lucide-react";
import {
    type ContentBlock,
    type ContentListItem,
    type ContentTable,
    type StructureItem,
    type TableCellAlign,
    type TableCellData,
    type TableCellRef,
    applyBlocksToItem,
    canMergeTableCells,
    canUnmergeTableCell,
    clearTableMerges,
    deleteStructureItem,
    ensureContentBlocks,
    getTableCell,
    isProtectedStructureId,
    mergeTableCells,
    newId,
    normalizeTableCell,
    renumberStructure,
    renameStructureItem,
    setTableCell,
    stripHeadingNumber,
    formatHeadingLabel,
    unmergeTableCell,
} from "@/lib/structureUtils";

interface TeamMember {
    name: string;
    enrollment: string;
    seatNumber: string;
}

interface CoverMeta {
    projectTitle: string;
    projectAdvisor: string;
    submissionMonth: string;
    submissionYear: string;
    internalExaminer: string;
    internalExaminerDesignation: string;
    externalExaminer: string;
    externalExaminerDesignation: string;
    externalExaminerOrganization: string;
    headOfDepartment: string;
    teamMembers: TeamMember[];
    universityLogo: {
        dataUrl: string;
        fileName: string;
        mimeType: string;
    } | null;
}

const emptyTeamMember = (): TeamMember => ({
    name: "",
    enrollment: "",
    seatNumber: "",
});

const defaultCoverMeta = (): CoverMeta => ({
    projectTitle: "",
    projectAdvisor: "",
    submissionMonth: "",
    submissionYear: "",
    internalExaminer: "",
    internalExaminerDesignation: "",
    externalExaminer: "",
    externalExaminerDesignation: "",
    externalExaminerOrganization: "",
    headOfDepartment: "",
    teamMembers: [emptyTeamMember()],
    universityLogo: null,
});

function formatSubmissionMonthYear(month: string, year: string) {
    const m = month.trim();
    const y = year.trim();
    if (m && y) return `${m} ${y}`;
    return m || y || "";
}

function parseSubmissionMonthYear(value: string | undefined) {
    const raw = (value || "").trim();
    if (!raw) return { month: "", year: "" };
    const parts = raw.split(/\s+/);
    if (parts.length >= 2) {
        return { month: parts.slice(0, -1).join(" "), year: parts[parts.length - 1] };
    }
    if (/^\d{4}$/.test(raw)) return { month: "", year: raw };
    return { month: raw, year: "" };
}

const MAX_LIST_LEVEL = 4;

function findStructureItem(items: StructureItem[], id: string): StructureItem | null {
    for (const item of items) {
        if (item.id === id) return item;
        const nested = findStructureItem(item.subitems || [], id);
        if (nested) return nested;
    }
    return null;
}

function updateStructureItem(
    items: StructureItem[],
    id: string,
    updater: (item: StructureItem) => StructureItem
): StructureItem[] {
    return items.map((item) => {
        if (item.id === id) return updater(item);
        if (item.subitems?.length) {
            return { ...item, subitems: updateStructureItem(item.subitems, id, updater) };
        }
        return item;
    });
}

function newListItem(level = 1): ContentListItem {
    return { id: newId("li"), text: "", level };
}

function emptyRow(count: number) {
    return Array.from({ length: count }, () => "");
}

function newTable(rows = 3, cols = 3): ContentTable {
    return {
        id: newId("tbl"),
        caption: "",
        columns: Array.from({ length: cols }, (_, index) => `Column ${index + 1}`),
        data: Array.from({ length: Math.max(rows - 1, 1) }, () => emptyRow(cols)),
    };
}

/** Keep paragraph textareas the height of their text so they read as document flow. */
function autoGrowTextarea(el: HTMLTextAreaElement | null) {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
}

function listNumberLabels(items: ContentListItem[]): string[] {
    const counters = [0, 0, 0, 0];
    let previous = 1;
    return items.map((item, index) => {
        let level = Math.max(1, Math.min(item.level || 1, MAX_LIST_LEVEL));
        level = index === 0 ? 1 : Math.min(level, previous + 1);
        counters[level - 1] += 1;
        for (let i = level; i < MAX_LIST_LEVEL; i += 1) counters[i] = 0;
        previous = level;
        const label = counters.slice(0, level).join(".");
        return level === 1 ? `${label}.` : label;
    });
}

// --- 4. Sidebar Item Component ---
const SidebarItem = ({
    item,
    level = 0,
    activeItem,
    setActiveItem,
    onAddSubItem,
    onRenameItem,
    onDeleteItem,
}: {
    item: StructureItem,
    level?: number,
    activeItem: { id: string, title: string },
    setActiveItem: (item: { id: string, title: string }) => void,
    onAddSubItem: (id: string, parentLevel: number) => void,
    onRenameItem: (id: string) => void,
    onDeleteItem: (id: string) => void,
}) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const hasChildren = item.subitems && item.subitems.length > 0;
    const protectedItem = isProtectedStructureId(item.id);

    return (
        <div>
            <div className="flex items-center group py-0.5" style={{ paddingLeft: `${level * 12 + 12}px` }}>
                <button
                    onClick={() => {
                        if (hasChildren) setIsExpanded(!isExpanded);
                        setActiveItem({ id: item.id, title: formatHeadingLabel(item) });
                    }}
                    className={`flex-1 text-left px-2 py-1.5 text-[11px] rounded-md flex items-center gap-1 min-w-0 transition-colors
                    ${activeItem.id === item.id ? "bg-[#F2EBF1] text-[#6F155F] font-medium border-l-2 border-[#6F155F]" : "text-slate-600 hover:bg-slate-50 border-l-2 border-transparent"}`}
                >
                    <div className="w-3 flex items-center justify-center shrink-0">
                        {hasChildren && (isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />)}
                    </div>
                    <FileText className="h-3 w-3 shrink-0" />
                    <span className="truncate">{formatHeadingLabel(item)}</span>
                </button>
                <button
                    type="button"
                    title="Rename"
                    onClick={(e) => {
                        e.stopPropagation();
                        onRenameItem(item.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[#F2EBF1] rounded text-[#6F155F]"
                >
                    <Pencil className="h-3 w-3" />
                </button>
                {!protectedItem && (
                    <button
                        type="button"
                        title="Delete"
                        onClick={(e) => {
                            e.stopPropagation();
                            onDeleteItem(item.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded text-red-500"
                    >
                        <Trash2 className="h-3 w-3" />
                    </button>
                )}
                <button
                    type="button"
                    title="Add subheading"
                    onClick={(e) => {
                        e.stopPropagation();
                        onAddSubItem(item.id, item.level || level + 1);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[#F2EBF1] rounded text-[#6F155F]"
                >
                    <Plus className="h-3 w-3" />
                </button>
            </div>

            {isExpanded && item.subitems?.map(sub => (
                <SidebarItem
                    key={sub.id}
                    item={sub}
                    level={level + 1}
                    activeItem={activeItem}
                    setActiveItem={setActiveItem}
                    onAddSubItem={onAddSubItem}
                    onRenameItem={onRenameItem}
                    onDeleteItem={onDeleteItem}
                />
            ))}
        </div>
    );
};

export default function EditorPage() {
    const params = useParams();
    const id = params.id as string;

    const [chapters, setChapters] = useState<StructureItem[]>([]);
    const [activeItem, setActiveItem] = useState<{ id: string, title: string }>({ id: "", title: "Loading..." });
    const [isAiSidebarOpen, setIsAiSidebarOpen] = useState(true);
    const [isStructureSidebarOpen, setIsStructureSidebarOpen] = useState(true);
    const [contentMap, setContentMap] = useState<Record<string, string>>({});
    const [coverMeta, setCoverMeta] = useState<CoverMeta>(defaultCoverMeta);
    const [showCoverMeta, setShowCoverMeta] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
    const [pendingFocusId, setPendingFocusId] = useState<string | null>(null);
    const [selectedTableCells, setSelectedTableCells] = useState<TableCellRef[]>([]);
    const [tableSelectionAnchor, setTableSelectionAnchor] = useState<TableCellRef | null>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const replaceFigureInputRef = useRef<HTMLInputElement>(null);
    const [replacingFigureId, setReplacingFigureId] = useState<string | null>(null);

    // --- 1. Load Data ---
    useEffect(() => {
        if (!id) return;
        const fetchData = async () => {
            try {
                const res = await fetch(`/api/projects/${id}`);
                if (!res.ok) throw new Error("Failed to fetch");
                const data = await res.json();
                const numbered = renumberStructure(data.structure || []);
                setChapters(numbered);
                setContentMap(data.contentMap || {});
                setCoverMeta({
                    ...defaultCoverMeta(),
                    projectTitle: data.projectTitle || data.title || "",
                    projectAdvisor: data.projectAdvisor || "",
                    ...(() => {
                        const parsed = parseSubmissionMonthYear(data.submissionMonthYear);
                        return { submissionMonth: parsed.month, submissionYear: parsed.year };
                    })(),
                    internalExaminer: data.internalExaminer || "",
                    internalExaminerDesignation: data.internalExaminerDesignation || "",
                    externalExaminer: data.externalExaminer || "",
                    externalExaminerDesignation: data.externalExaminerDesignation || "",
                    externalExaminerOrganization: data.externalExaminerOrganization || "",
                    headOfDepartment: data.headOfDepartment || "",
                    teamMembers:
                        Array.isArray(data.teamMembers) && data.teamMembers.length > 0
                            ? data.teamMembers.slice(0, 4).map((m: TeamMember) => ({
                                name: m.name || "",
                                enrollment: m.enrollment || "",
                                seatNumber: m.seatNumber || "",
                            }))
                            : [emptyTeamMember()],
                    universityLogo: data.universityLogo?.dataUrl
                        ? {
                            dataUrl: data.universityLogo.dataUrl,
                            fileName: data.universityLogo.fileName || "logo",
                            mimeType: data.universityLogo.mimeType || "image/png",
                        }
                        : null,
                });
                if (numbered.length > 0) {
                    setActiveItem({
                        id: numbered[0].id,
                        title: formatHeadingLabel(numbered[0]),
                    });
                }
            } catch (err) {
                console.error("Error loading project:", err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [id]);

    useEffect(() => {
        const item = findStructureItem(chapters, activeItem.id);
        const blocks = item ? ensureContentBlocks(item, contentMap) : [];
        setActiveBlockId(blocks[0]?.id ?? null);
        setSelectedTableCells([]);
        setTableSelectionAnchor(null);
        // Reset insert focus when switching sections.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeItem.id]);

    useEffect(() => {
        if (!pendingFocusId) return;
        const el = document.querySelector(
            `[data-focus-id="${pendingFocusId}"]`
        ) as HTMLInputElement | HTMLTextAreaElement | null;
        if (el) {
            el.focus();
            if ("setSelectionRange" in el && typeof el.value === "string") {
                const len = el.value.length;
                try {
                    el.setSelectionRange(len, len);
                } catch {
                    /* ignore */
                }
            }
            setPendingFocusId(null);
        }
    }, [pendingFocusId, chapters, contentMap]);

    // --- 2. Save Logic ---
    const persistProject = async () => {
        const submissionMonthYear = formatSubmissionMonthYear(
            coverMeta.submissionMonth,
            coverMeta.submissionYear
        );
        const response = await fetch(`/api/projects/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contentMap,
                structure: chapters,
                title: coverMeta.projectTitle || undefined,
                projectTitle: coverMeta.projectTitle,
                projectAdvisor: coverMeta.projectAdvisor,
                submissionMonthYear,
                approvalDate: submissionMonthYear,
                internalExaminer: coverMeta.internalExaminer,
                internalExaminerDesignation: coverMeta.internalExaminerDesignation,
                externalExaminer: coverMeta.externalExaminer,
                externalExaminerDesignation: coverMeta.externalExaminerDesignation,
                externalExaminerOrganization: coverMeta.externalExaminerOrganization,
                headOfDepartment: coverMeta.headOfDepartment,
                teamMembers: coverMeta.teamMembers
                    .filter((m) => m.name.trim() || m.seatNumber.trim() || m.enrollment.trim())
                    .slice(0, 4),
                universityLogo: coverMeta.universityLogo,
            }),
        });
        if (!response.ok) {
            throw new Error("Failed to save project");
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await persistProject();
        } catch (err) {
            console.error("Save failed", err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            await persistProject();
            const response = await fetch(`/api/projects/${id}/generate`, {
                method: "POST",
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || "Failed to generate report");
            }

            const blob = await response.blob();
            const downloadUrl = URL.createObjectURL(blob);
            const link = document.createElement("a");
            const header = response.headers.get("Content-Disposition") || "";
            const match = header.match(/filename="([^"]+)"/);
            link.href = downloadUrl;
            link.download = match?.[1] || "FYP_Report.docx";
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(downloadUrl);
        } catch (err) {
            console.error("Generate failed", err);
            alert(err instanceof Error ? err.message : "Failed to generate report");
        } finally {
            setIsGenerating(false);
        }
    };


    // --- 3. Sidebar structure: add / rename / delete ---
    const persistStructure = async (
        updatedChapters: StructureItem[],
        nextContentMap: Record<string, string>
    ) => {
        setChapters(updatedChapters);
        setContentMap(nextContentMap);
        setIsSaving(true);
        try {
            const response = await fetch(`/api/projects/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contentMap: nextContentMap,
                    structure: updatedChapters,
                }),
            });
            if (!response.ok) throw new Error("Failed to save to DB");
        } catch (err) {
            console.error("Save failed", err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddSubItem = async (parentId: string, parentLevel: number) => {
        const title = prompt("Enter new section title (number is assigned automatically):");
        if (!title) return;
        const baseTitle = stripHeadingNumber(title) || title.trim();
        if (!baseTitle) return;

        const newItem: StructureItem = {
            id: newId("sec"),
            title: baseTitle,
            level: parentLevel + 1,
            subitems: [],
            lists: [],
            tables: [],
            figures: [],
            blocks: [{ id: newId("p"), type: "paragraph", text: "" }],
        };

        const addItemRecursive = (items: StructureItem[]): StructureItem[] =>
            items.map((item) => {
                if (item.id === parentId) {
                    return { ...item, subitems: [...(item.subitems || []), newItem] };
                }
                if (item.subitems) {
                    return { ...item, subitems: addItemRecursive(item.subitems) };
                }
                return item;
            });

        const updatedChapters = renumberStructure(addItemRecursive(chapters));
        const numberedNew = findStructureItem(updatedChapters, newItem.id);
        await persistStructure(updatedChapters, { ...contentMap, [newItem.id]: "" });
        if (numberedNew) {
            setActiveItem({ id: numberedNew.id, title: formatHeadingLabel(numberedNew) });
        }
    };

    const handleRenameItem = async (itemId: string) => {
        const current = findStructureItem(chapters, itemId);
        if (!current) return;
        const next = prompt(
            "Rename heading:",
            stripHeadingNumber(current.title) || current.title
        );
        if (next === null) return;
        const trimmed = next.trim();
        if (!trimmed) return;
        const updatedChapters = renameStructureItem(chapters, itemId, trimmed);
        const renamed = findStructureItem(updatedChapters, itemId);
        await persistStructure(updatedChapters, contentMap);
        if (renamed && activeItem.id === itemId) {
            setActiveItem({ id: renamed.id, title: formatHeadingLabel(renamed) });
        }
    };

    const handleDeleteItem = async (itemId: string) => {
        if (isProtectedStructureId(itemId)) {
            alert("This required section cannot be deleted.");
            return;
        }
        const current = findStructureItem(chapters, itemId);
        if (!current) return;
        if (!confirm(`Delete "${current.title}" and its subheadings/content?`)) return;

        const { items: updatedChapters, removedIds } = deleteStructureItem(chapters, itemId);
        const nextContentMap = { ...contentMap };
        for (const removedId of removedIds) {
            delete nextContentMap[removedId];
        }
        await persistStructure(updatedChapters, nextContentMap);
        if (removedIds.includes(activeItem.id)) {
            const fallback = updatedChapters[0];
            setActiveItem(
                fallback
                    ? { id: fallback.id, title: formatHeadingLabel(fallback) }
                    : { id: "", title: "Select a section" }
            );
        } else {
            const stillActive = findStructureItem(updatedChapters, activeItem.id);
            if (stillActive) {
                setActiveItem({ id: stillActive.id, title: formatHeadingLabel(stillActive) });
            }
        }
    };

    const activeItemData = findStructureItem(chapters, activeItem.id);
    const activeBlocks: ContentBlock[] = activeItemData
        ? ensureContentBlocks(activeItemData, contentMap)
        : [];

    const commitBlocks = (blocks: ContentBlock[]) => {
        if (!activeItemData) return;
        const { item, contentText } = applyBlocksToItem(activeItemData, blocks);
        setChapters((prev) => updateStructureItem(prev, activeItem.id, () => item));
        setContentMap((prev) => ({ ...prev, [activeItem.id]: contentText }));
    };

    const insertBlockAfter = (block: ContentBlock, afterId?: string | null) => {
        const blocks = [...activeBlocks];
        const anchor = afterId || activeBlockId;
        let index = anchor ? blocks.findIndex((entry) => entry.id === anchor) : -1;
        if (index < 0) index = blocks.length - 1;
        blocks.splice(index + 1, 0, block);
        commitBlocks(blocks);
        setActiveBlockId(block.id);
    };

    const updateBlock = (blockId: string, updater: (block: ContentBlock) => ContentBlock) => {
        commitBlocks(
            activeBlocks.map((block) => (block.id === blockId ? updater(block) : block))
        );
    };

    const removeBlock = (blockId: string) => {
        const next = activeBlocks.filter((block) => block.id !== blockId);
        if (next.length === 0) {
            next.push({ id: newId("p"), type: "paragraph", text: "" });
        }
        commitBlocks(next);
        if (activeBlockId === blockId) {
            setActiveBlockId(next[0]?.id ?? null);
        }
        setSelectedTableCells([]);
        setTableSelectionAnchor(null);
    };

    const startOrExtendList = (type: "bullet" | "number") => {
        const anchor = activeBlockId
            ? activeBlocks.find((block) => block.id === activeBlockId)
            : null;
        if (anchor?.type === "list" && anchor.listType === type) {
            const nextItem = newListItem(1);
            updateBlock(anchor.id, (block) => {
                if (block.type !== "list") return block;
                return { ...block, items: [...block.items, nextItem] };
            });
            setPendingFocusId(nextItem.id);
            return;
        }
        const firstItem = newListItem(1);
        const listId = newId("list");
        insertBlockAfter({
            id: listId,
            type: "list",
            listType: type,
            items: [firstItem],
        });
        setPendingFocusId(firstItem.id);
    };

    const updateListItem = (listId: string, itemId: string, patch: Partial<ContentListItem>) => {
        updateBlock(listId, (block) => {
            if (block.type !== "list") return block;
            return {
                ...block,
                items: block.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
            };
        });
    };

    const exitListAtItem = (listId: string, itemIndex: number) => {
        const block = activeBlocks.find((entry) => entry.id === listId);
        if (!block || block.type !== "list") return;

        const remaining = block.items.filter((_, index) => index !== itemIndex);
        const paragraph = { id: newId("p"), type: "paragraph" as const, text: "" };
        const blocks = [...activeBlocks];
        const listIndex = blocks.findIndex((entry) => entry.id === listId);
        if (listIndex < 0) return;

        if (remaining.length === 0) {
            blocks.splice(listIndex, 1, paragraph);
        } else {
            blocks[listIndex] = { ...block, items: remaining };
            blocks.splice(listIndex + 1, 0, paragraph);
        }
        commitBlocks(blocks);
        setActiveBlockId(paragraph.id);
        setPendingFocusId(paragraph.id);
    };

    const handleListItemKeyDown = (
        e: KeyboardEvent<HTMLInputElement>,
        listId: string,
        itemIndex: number,
        item: ContentListItem
    ) => {
        if (e.key !== "Enter") return;
        e.preventDefault();

        // Empty bullet + Enter → leave the list and continue with a paragraph.
        if (!item.text.trim()) {
            exitListAtItem(listId, itemIndex);
            return;
        }

        const nextItem = newListItem(item.level);
        updateBlock(listId, (current) => {
            if (current.type !== "list") return current;
            return {
                ...current,
                items: [
                    ...current.items.slice(0, itemIndex + 1),
                    nextItem,
                    ...current.items.slice(itemIndex + 1),
                ],
            };
        });
        setActiveBlockId(listId);
        setPendingFocusId(nextItem.id);
    };

    const changeListLevel = (listId: string, itemIndex: number, delta: number) => {
        const block = activeBlocks.find((entry) => entry.id === listId);
        if (!block || block.type !== "list") return;
        const item = block.items[itemIndex];
        if (!item) return;
        const previousLevel = itemIndex === 0 ? 1 : block.items[itemIndex - 1].level;
        const nextLevel = Math.max(1, Math.min(MAX_LIST_LEVEL, item.level + delta));
        const clamped = itemIndex === 0 ? 1 : Math.min(nextLevel, previousLevel + 1);
        updateListItem(listId, item.id, { level: clamped });
    };

    const removeListItem = (listId: string, itemId: string) => {
        const block = activeBlocks.find((entry) => entry.id === listId);
        if (!block || block.type !== "list") return;
        const items = block.items.filter((item) => item.id !== itemId);
        if (items.length === 0) {
            removeBlock(listId);
            return;
        }
        updateBlock(listId, (current) =>
            current.type === "list" ? { ...current, items } : current
        );
    };

    const addTable = () => {
        const colsRaw = window.prompt("Number of columns", "3");
        if (colsRaw === null) return;
        const rowsRaw = window.prompt("Number of rows (including header)", "3");
        if (rowsRaw === null) return;
        const cols = Math.max(1, Math.min(12, parseInt(colsRaw, 10) || 3));
        const rows = Math.max(2, Math.min(30, parseInt(rowsRaw, 10) || 3));
        const table = newTable(rows, cols);
        insertBlockAfter({
            id: table.id,
            type: "table",
            caption: table.caption,
            columns: table.columns,
            data: table.data,
        });
    };

    const updateTableBlock = (tableId: string, updater: (table: Extract<ContentBlock, { type: "table" }>) => Extract<ContentBlock, { type: "table" }>) => {
        updateBlock(tableId, (block) => {
            if (block.type !== "table") return block;
            return updater(block);
        });
    };

    const selectTableCell = (
        tableId: string,
        ref: TableCellRef,
        event: { shiftKey?: boolean; metaKey?: boolean; ctrlKey?: boolean }
    ) => {
        setActiveBlockId(tableId);
        if (event.shiftKey && tableSelectionAnchor) {
            const minRow = Math.min(tableSelectionAnchor.row, ref.row);
            const maxRow = Math.max(tableSelectionAnchor.row, ref.row);
            const minCol = Math.min(tableSelectionAnchor.col, ref.col);
            const maxCol = Math.max(tableSelectionAnchor.col, ref.col);
            // Header/body mixes are not mergeable; keep selection within one region.
            const headerOnly = maxRow < 0;
            const bodyOnly = minRow >= 0;
            if (!headerOnly && !bodyOnly) {
                setSelectedTableCells([ref]);
                setTableSelectionAnchor(ref);
                return;
            }
            const next: TableCellRef[] = [];
            for (let row = minRow; row <= maxRow; row += 1) {
                for (let col = minCol; col <= maxCol; col += 1) {
                    next.push({ row, col });
                }
            }
            setSelectedTableCells(next);
            return;
        }
        if (event.metaKey || event.ctrlKey) {
            setSelectedTableCells((current) => {
                const exists = current.some((cell) => cell.row === ref.row && cell.col === ref.col);
                if (exists) {
                    return current.filter((cell) => !(cell.row === ref.row && cell.col === ref.col));
                }
                return [...current, ref];
            });
            setTableSelectionAnchor(ref);
            return;
        }
        setSelectedTableCells([ref]);
        setTableSelectionAnchor(ref);
    };

    const applyFormatToSelectedCells = (
        table: Extract<ContentBlock, { type: "table" }>,
        patch: Partial<TableCellData>
    ) => {
        if (!selectedTableCells.length) return;
        updateTableBlock(table.id, (current) => {
            let next = current;
            for (const ref of selectedTableCells) {
                const existing = getTableCell(next, ref);
                if (existing.hidden) continue;
                next = setTableCell(next, ref, { ...existing, ...patch });
            }
            return next;
        });
    };

    const toggleBoldSelected = (table: Extract<ContentBlock, { type: "table" }>) => {
        if (!selectedTableCells.length) return;
        const first = selectedTableCells.find((ref) => !getTableCell(table, ref).hidden);
        if (!first) return;
        const nextBold = !Boolean(getTableCell(table, first).bold);
        applyFormatToSelectedCells(table, { bold: nextBold });
    };

    const setAlignSelected = (table: Extract<ContentBlock, { type: "table" }>, align: TableCellAlign) => {
        applyFormatToSelectedCells(table, { align });
    };

    const mergeSelectedCells = (table: Extract<ContentBlock, { type: "table" }>) => {
        const merged = mergeTableCells(table, selectedTableCells);
        if (!merged) return;
        updateTableBlock(table.id, (current) => ({
            ...current,
            columns: merged.columns,
            data: merged.data,
        }));
        const rows = selectedTableCells.map((ref) => ref.row);
        const cols = selectedTableCells.map((ref) => ref.col);
        const anchor = { row: Math.min(...rows), col: Math.min(...cols) };
        setSelectedTableCells([anchor]);
        setTableSelectionAnchor(anchor);
    };

    const unmergeSelectedCell = (table: Extract<ContentBlock, { type: "table" }>) => {
        const target =
            selectedTableCells.find((ref) => canUnmergeTableCell(table, ref)) ||
            selectedTableCells[0];
        if (!target) return;
        const next = unmergeTableCell(table, target);
        if (!next) return;
        updateTableBlock(table.id, (current) => ({
            ...current,
            columns: next.columns,
            data: next.data,
        }));
    };

    const addTableRow = (table: Extract<ContentBlock, { type: "table" }>) => {
        updateTableBlock(table.id, (current) =>
            clearTableMerges({
                ...current,
                data: [...current.data, emptyRow(current.columns.length)],
            })
        );
        setSelectedTableCells([]);
    };

    const addTableColumn = (table: Extract<ContentBlock, { type: "table" }>) => {
        updateTableBlock(table.id, (current) =>
            clearTableMerges({
                ...current,
                columns: [...current.columns, `Column ${current.columns.length + 1}`],
                data: current.data.map((row) => [...row, ""]),
            })
        );
        setSelectedTableCells([]);
    };

    const removeTableRow = (table: Extract<ContentBlock, { type: "table" }>, rowIndex: number) => {
        if (table.data.length <= 1) return;
        updateTableBlock(table.id, (current) =>
            clearTableMerges({
                ...current,
                data: current.data.filter((_, index) => index !== rowIndex),
            })
        );
        setSelectedTableCells([]);
    };

    const removeTableColumn = (table: Extract<ContentBlock, { type: "table" }>, colIndex: number) => {
        if (table.columns.length <= 1) return;
        updateTableBlock(table.id, (current) =>
            clearTableMerges({
                ...current,
                columns: current.columns.filter((_, index) => index !== colIndex),
                data: current.data.map((row) => row.filter((_, index) => index !== colIndex)),
            })
        );
        setSelectedTableCells([]);
    };

    const handleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = typeof reader.result === "string" ? reader.result : "";
            if (!dataUrl) return;
            insertBlockAfter({
                id: newId("fig"),
                type: "figure",
                caption: "",
                fileName: file.name,
                mimeType: file.type || "image/png",
                dataUrl,
                widthPercent: 100,
                align: "center",
            });
        };
        reader.readAsDataURL(file);
    };

    const handleReplaceFigure = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        const figureId = replacingFigureId;
        event.target.value = "";
        setReplacingFigureId(null);
        if (!file || !figureId) return;
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = typeof reader.result === "string" ? reader.result : "";
            if (!dataUrl) return;
            updateBlock(figureId, (current) =>
                current.type === "figure"
                    ? {
                          ...current,
                          dataUrl,
                          fileName: file.name,
                          mimeType: file.type || "image/png",
                      }
                    : current
            );
        };
        reader.readAsDataURL(file);
    };

    const updateFigureBlock = (
        figureId: string,
        patch: Partial<Extract<ContentBlock, { type: "figure" }>>
    ) => {
        updateBlock(figureId, (current) =>
            current.type === "figure" ? { ...current, ...patch } : current
        );
    };

    const addParagraphBlock = () => {
        insertBlockAfter({ id: newId("p"), type: "paragraph", text: "" });
    };

    if (isLoading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-[#6F155F]" /></div>;

    return (
        <div className="h-screen flex flex-col bg-[#F4F2F5] overflow-hidden">
            <header className="h-14 border-b border-slate-200/80 bg-white px-4 flex items-center justify-between shrink-0 shadow-[0_1px_0_rgba(15,23,42,0.03)]">
                <div className="flex items-center gap-3">
                    <Link href="/dashboard" className="text-slate-400 hover:text-[#6F155F] transition-colors"><ChevronLeft className="h-5 w-5" /></Link>
                    <h1 className="text-sm font-semibold tracking-tight text-slate-800">Editor</h1>
                </div>
                <div className="flex items-center gap-2.5">
                    <button
                        onClick={() => setShowCoverMeta((open) => !open)}
                        className="text-xs flex items-center gap-1.5 text-slate-500 hover:text-[#6F155F] px-2 py-1.5 rounded-md hover:bg-slate-50 transition-colors"
                        type="button"
                    >
                        <FileText className="h-3.5 w-3.5" />
                        {showCoverMeta ? "Hide Cover Details" : "Title & Approval"}
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving || isGenerating}
                        className="text-xs flex items-center gap-1.5 text-slate-500 hover:text-[#6F155F] px-2 py-1.5 rounded-md hover:bg-slate-50 transition-colors disabled:opacity-50"
                    >
                        {isSaving ? "Saving..." : <><Save className="h-3.5 w-3.5" /> Save</>}
                    </button>
                    <button
                        onClick={handleGenerate}
                        disabled={isSaving || isGenerating}
                        className="text-xs flex items-center gap-1.5 rounded-lg bg-[#6F155F] hover:bg-[#57104b] text-white px-3.5 py-1.5 font-medium shadow-sm disabled:opacity-50 transition-colors"
                    >
                        {isGenerating ? (
                            <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating...</>
                        ) : (
                            <><FileDown className="h-3.5 w-3.5" /> Generate Report</>
                        )}
                    </button>
                    <button onClick={() => setIsAiSidebarOpen(!isAiSidebarOpen)} className="p-2 text-slate-500 hover:text-[#6F155F] hover:bg-slate-50 rounded-lg transition-colors" title={isAiSidebarOpen ? "Collapse AI" : "Expand AI"}>
                        {isAiSidebarOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
                    </button>
                    <UserButton />
                </div>
            </header>

            <div className="flex-1 flex min-h-0 overflow-hidden">
                <aside className={`${isStructureSidebarOpen ? "w-64" : "w-12"} border-r border-slate-200/80 bg-white transition-all duration-300 shrink-0 overflow-hidden flex flex-col`}>
                    {isStructureSidebarOpen ? (
                        <div className="flex-1 overflow-y-auto pt-3 min-w-[16rem]">
                            <div className="px-3 mb-3 flex items-center justify-between gap-2">
                                <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Report Structure</div>
                                <button
                                    type="button"
                                    title="Collapse structure"
                                    onClick={() => setIsStructureSidebarOpen(false)}
                                    className="p-1.5 text-slate-400 hover:text-[#6F155F] hover:bg-[#F2EBF1] rounded-md transition-colors"
                                >
                                    <PanelLeftClose className="h-4 w-4" />
                                </button>
                            </div>
                            {chapters.map(ch => (
                                <SidebarItem
                                    key={ch.id}
                                    item={ch}
                                    level={ch.level || 1}
                                    activeItem={activeItem}
                                    setActiveItem={setActiveItem}
                                    onAddSubItem={handleAddSubItem}
                                    onRenameItem={handleRenameItem}
                                    onDeleteItem={handleDeleteItem}
                                />
                            ))}
                        </div>
                    ) : (
                        <div
                            className="w-12 h-full flex flex-col items-center pt-5 cursor-pointer hover:bg-slate-50"
                            onClick={() => setIsStructureSidebarOpen(true)}
                            title="Expand structure"
                        >
                            <div className="bg-[#6F155F]/10 p-2 rounded-lg text-[#6F155F]">
                                <PanelLeftOpen className="h-5 w-5" />
                            </div>
                        </div>
                    )}
                </aside>

                <main className="flex-1 min-h-0 bg-[#F4F2F5] overflow-y-auto px-3 sm:px-5 py-4 sm:py-5 flex justify-center items-start min-w-0">
                    <div className="max-w-7xl w-full min-w-0 bg-white min-h-[calc(100vh-5.5rem)] border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_28px_rgba(15,23,42,0.06)] rounded-xl">
                        {showCoverMeta && (
                            <div className="mx-6 sm:mx-8 mt-6 mb-4 border border-slate-200 rounded-lg p-4 bg-slate-50/90 space-y-3">
                                <h3 className="text-sm font-semibold text-slate-800">Title Page &amp; Project Approval</h3>
                                <p className="text-xs text-slate-500">
                                    Formatting is fixed by ReportPeer. Edit only the project-specific fields below.
                                </p>
                                <div className="space-y-2">
                                    <span className="text-xs font-medium text-slate-700">University Logo</span>
                                    <p className="text-[11px] text-slate-500">
                                        Uploaded logo is placed automatically at the template position and size. Leave empty to keep the reserved logo space.
                                    </p>
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <label className="text-xs border border-gray-200 hover:border-[#6F155F] hover:text-[#6F155F] rounded-md px-2.5 py-1.5 cursor-pointer">
                                            Upload logo
                                            <input
                                                type="file"
                                                accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                                                className="hidden"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    e.target.value = "";
                                                    if (!file) return;
                                                    const reader = new FileReader();
                                                    reader.onload = () => {
                                                        const dataUrl = typeof reader.result === "string" ? reader.result : "";
                                                        if (!dataUrl) return;
                                                        setCoverMeta((m) => ({
                                                            ...m,
                                                            universityLogo: {
                                                                dataUrl,
                                                                fileName: file.name,
                                                                mimeType: file.type || "image/png",
                                                            },
                                                        }));
                                                    };
                                                    reader.readAsDataURL(file);
                                                }}
                                            />
                                        </label>
                                        {coverMeta.universityLogo && (
                                            <>
                                                <img
                                                    src={coverMeta.universityLogo.dataUrl}
                                                    alt="University logo preview"
                                                    className="h-12 w-12 object-contain border border-gray-200 rounded bg-white"
                                                />
                                                <button
                                                    type="button"
                                                    className="text-xs text-red-600"
                                                    onClick={() => setCoverMeta((m) => ({ ...m, universityLogo: null }))}
                                                >
                                                    Remove
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <label className="block text-xs text-slate-600">
                                    Project Title
                                    <input
                                        className="mt-1 w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm"
                                        value={coverMeta.projectTitle}
                                        onChange={(e) => setCoverMeta((m) => ({ ...m, projectTitle: e.target.value }))}
                                    />
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <label className="block text-xs text-slate-600">
                                        Submission Month
                                        <input
                                            className="mt-1 w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm"
                                            value={coverMeta.submissionMonth}
                                            onChange={(e) => setCoverMeta((m) => ({ ...m, submissionMonth: e.target.value }))}
                                            placeholder="e.g. September"
                                        />
                                    </label>
                                    <label className="block text-xs text-slate-600">
                                        Submission Year
                                        <input
                                            className="mt-1 w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm"
                                            value={coverMeta.submissionYear}
                                            onChange={(e) => setCoverMeta((m) => ({ ...m, submissionYear: e.target.value }))}
                                            placeholder="e.g. 2026"
                                        />
                                    </label>
                                </div>
                                <label className="block text-xs text-slate-600">
                                    Project Advisor
                                    <input
                                        className="mt-1 w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm"
                                        value={coverMeta.projectAdvisor}
                                        onChange={(e) => setCoverMeta((m) => ({ ...m, projectAdvisor: e.target.value }))}
                                    />
                                </label>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-medium text-slate-700">Students (up to 4)</span>
                                        <button
                                            type="button"
                                            className="text-xs text-[#6F155F] disabled:opacity-40"
                                            disabled={coverMeta.teamMembers.length >= 4}
                                            onClick={() =>
                                                setCoverMeta((m) => ({
                                                    ...m,
                                                    teamMembers: m.teamMembers.length >= 4
                                                        ? m.teamMembers
                                                        : [...m.teamMembers, emptyTeamMember()],
                                                }))
                                            }
                                        >
                                            + Add student
                                        </button>
                                    </div>
                                    {coverMeta.teamMembers.map((member, index) => (
                                        <div key={index} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                            <input
                                                className="border border-gray-200 rounded-md px-2 py-1.5 text-sm"
                                                placeholder="Name"
                                                value={member.name}
                                                onChange={(e) =>
                                                    setCoverMeta((m) => {
                                                        const teamMembers = [...m.teamMembers];
                                                        teamMembers[index] = { ...teamMembers[index], name: e.target.value };
                                                        return { ...m, teamMembers };
                                                    })
                                                }
                                            />
                                            <input
                                                className="border border-gray-200 rounded-md px-2 py-1.5 text-sm"
                                                placeholder="Enrolment"
                                                value={member.enrollment}
                                                onChange={(e) =>
                                                    setCoverMeta((m) => {
                                                        const teamMembers = [...m.teamMembers];
                                                        teamMembers[index] = { ...teamMembers[index], enrollment: e.target.value };
                                                        return { ...m, teamMembers };
                                                    })
                                                }
                                            />
                                            <input
                                                className="border border-gray-200 rounded-md px-2 py-1.5 text-sm"
                                                placeholder="Seat Number"
                                                value={member.seatNumber}
                                                onChange={(e) =>
                                                    setCoverMeta((m) => {
                                                        const teamMembers = [...m.teamMembers];
                                                        teamMembers[index] = { ...teamMembers[index], seatNumber: e.target.value };
                                                        return { ...m, teamMembers };
                                                    })
                                                }
                                            />
                                        </div>
                                    ))}
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <label className="block text-xs text-slate-600">
                                        Internal Advisor Name
                                        <input
                                            className="mt-1 w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm"
                                            value={coverMeta.internalExaminer}
                                            onChange={(e) => setCoverMeta((m) => ({ ...m, internalExaminer: e.target.value }))}
                                        />
                                    </label>
                                    <label className="block text-xs text-slate-600">
                                        Internal Advisor Designation
                                        <input
                                            className="mt-1 w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm"
                                            value={coverMeta.internalExaminerDesignation}
                                            onChange={(e) => setCoverMeta((m) => ({ ...m, internalExaminerDesignation: e.target.value }))}
                                        />
                                    </label>
                                    <label className="block text-xs text-slate-600">
                                        External Advisor Name
                                        <input
                                            className="mt-1 w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm"
                                            value={coverMeta.externalExaminer}
                                            onChange={(e) => setCoverMeta((m) => ({ ...m, externalExaminer: e.target.value }))}
                                        />
                                    </label>
                                    <label className="block text-xs text-slate-600">
                                        External Advisor Designation
                                        <input
                                            className="mt-1 w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm"
                                            value={coverMeta.externalExaminerDesignation}
                                            onChange={(e) => setCoverMeta((m) => ({ ...m, externalExaminerDesignation: e.target.value }))}
                                        />
                                    </label>
                                    <label className="block text-xs text-slate-600 sm:col-span-2">
                                        External Advisor Organization
                                        <input
                                            className="mt-1 w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm"
                                            value={coverMeta.externalExaminerOrganization}
                                            onChange={(e) => setCoverMeta((m) => ({ ...m, externalExaminerOrganization: e.target.value }))}
                                        />
                                    </label>
                                    <label className="block text-xs text-slate-600 sm:col-span-2">
                                        Head of Department
                                        <input
                                            className="mt-1 w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm"
                                            value={coverMeta.headOfDepartment}
                                            onChange={(e) => setCoverMeta((m) => ({ ...m, headOfDepartment: e.target.value }))}
                                        />
                                    </label>
                                </div>
                            </div>
                        )}
                        <div className="min-w-0 max-w-full">
                            <div className="sticky top-0 z-20 bg-white rounded-t-xl shadow-[0_2px_8px_rgba(15,23,42,0.06)]">
                                <div className="px-5 sm:px-8 py-2.5 flex items-center gap-2 flex-wrap bg-[#6F155F] border-b border-[#57104b] rounded-t-xl">
                                    <button
                                        type="button"
                                        onClick={addParagraphBlock}
                                        className="text-xs flex items-center gap-1.5 border border-white/35 bg-white text-[#6F155F] hover:bg-[#F2EBF1] rounded-md px-2.5 py-1.5 font-medium shadow-sm transition-colors"
                                    >
                                        <FileText className="h-3.5 w-3.5" /> Paragraph
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => startOrExtendList("bullet")}
                                        className="text-xs flex items-center gap-1.5 border border-white/35 bg-white text-[#6F155F] hover:bg-[#F2EBF1] rounded-md px-2.5 py-1.5 font-medium shadow-sm transition-colors"
                                    >
                                        <List className="h-3.5 w-3.5" /> Bullet List
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => startOrExtendList("number")}
                                        className="text-xs flex items-center gap-1.5 border border-white/35 bg-white text-[#6F155F] hover:bg-[#F2EBF1] rounded-md px-2.5 py-1.5 font-medium shadow-sm transition-colors"
                                    >
                                        <ListOrdered className="h-3.5 w-3.5" /> Numbered List
                                    </button>
                                    <button
                                        type="button"
                                        onClick={addTable}
                                        className="text-xs flex items-center gap-1.5 border border-white/35 bg-white text-[#6F155F] hover:bg-[#F2EBF1] rounded-md px-2.5 py-1.5 font-medium shadow-sm transition-colors"
                                    >
                                        <Table2 className="h-3.5 w-3.5" /> Add Table
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => imageInputRef.current?.click()}
                                        className="text-xs flex items-center gap-1.5 border border-white/35 bg-white text-[#6F155F] hover:bg-[#F2EBF1] rounded-md px-2.5 py-1.5 font-medium shadow-sm transition-colors"
                                    >
                                        <ImagePlus className="h-3.5 w-3.5" /> Add Image/Figure
                                    </button>
                                    <input
                                        ref={imageInputRef}
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleImageUpload}
                                    />
                                    <input
                                        ref={replaceFigureInputRef}
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleReplaceFigure}
                                    />
                                </div>
                                <h2 className="text-[1.75rem] leading-snug font-serif text-slate-900 px-5 sm:px-8 pt-4 pb-3.5 border-b border-slate-100">{activeItem.title}</h2>
                            </div>
                            <div className="px-5 sm:px-8 pt-4 pb-10 sm:pb-12 min-w-0">
                            <p className="text-[11px] text-slate-400 mb-5 leading-relaxed">
                                Insert at the selected block. Table/figure numbers are assigned on generate. Order is preserved in the DOCX.
                            </p>
                            <div className="space-y-6 min-w-0">
                                {activeBlocks.map((block) => {
                                    const selected = activeBlockId === block.id;
                                    if (block.type === "paragraph") {
                                        return (
                                            <div
                                                key={block.id}
                                                className={`group relative -mx-3 rounded-md px-3 py-1 transition-colors ${selected ? "bg-[#F2EBF1]/50" : "hover:bg-slate-50"}`}
                                                onClick={() => setActiveBlockId(block.id)}
                                            >
                                                <textarea
                                                    ref={(el) => {
                                                        autoGrowTextarea(el);
                                                    }}
                                                    data-focus-id={block.id}
                                                    value={block.text}
                                                    rows={1}
                                                    onFocus={() => setActiveBlockId(block.id)}
                                                    onChange={(e) => {
                                                        autoGrowTextarea(e.currentTarget);
                                                        updateBlock(block.id, (current) =>
                                                            current.type === "paragraph"
                                                                ? { ...current, text: e.target.value }
                                                                : current
                                                        );
                                                    }}
                                                    className="w-full resize-none overflow-hidden bg-transparent font-serif text-[15px] leading-[1.9] text-justify text-slate-800 placeholder:text-slate-300 focus:outline-none"
                                                    placeholder="Start writing..."
                                                />
                                                <button
                                                    type="button"
                                                    title="Delete this paragraph"
                                                    onClick={() => removeBlock(block.id)}
                                                    className={`absolute top-0.5 right-0 p-1 text-gray-300 transition-opacity hover:text-red-500 group-hover:opacity-100 ${selected ? "opacity-100" : "opacity-0"}`}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        );
                                    }
                                    if (block.type === "list") {
                                        const numberLabels =
                                            block.listType === "number" ? listNumberLabels(block.items) : [];
                                        return (
                                            <div
                                                key={block.id}
                                                className={`-mx-3 space-y-1.5 rounded-md px-3 py-2 transition-colors ${selected ? "bg-[#F2EBF1]/50" : ""}`}
                                                onClick={() => setActiveBlockId(block.id)}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="text-[10px] uppercase tracking-wider text-gray-400">
                                                        {block.listType === "number" ? "Numbered list" : "Bullet list"}
                                                    </div>
                                                    <button type="button" title="Remove list" onClick={() => removeBlock(block.id)} className="p-1 text-gray-300 hover:text-red-500">
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                                {block.items.map((item, itemIndex) => (
                                                    <div
                                                        key={item.id}
                                                        className="flex items-center gap-1"
                                                        style={{ paddingLeft: `${(item.level - 1) * 20}px` }}
                                                    >
                                                        <span className="w-10 shrink-0 text-[11px] text-slate-400">
                                                            {block.listType === "number"
                                                                ? numberLabels[itemIndex]
                                                                : item.level === 1 ? "•" : item.level === 2 ? "o" : "▪"}
                                                        </span>
                                                        <input
                                                            data-focus-id={item.id}
                                                            value={item.text}
                                                            onFocus={() => setActiveBlockId(block.id)}
                                                            onChange={(e) => updateListItem(block.id, item.id, { text: e.target.value })}
                                                            onKeyDown={(e) => handleListItemKeyDown(e, block.id, itemIndex, item)}
                                                            className="flex-1 text-sm font-serif border-b border-gray-100 focus:border-[#6F155F] focus:outline-none py-1"
                                                            placeholder="List item"
                                                        />
                                                        <button type="button" title="Decrease level" onClick={() => changeListLevel(block.id, itemIndex, -1)} className="p-1 text-gray-400 hover:text-[#6F155F]">
                                                            <IndentDecrease className="h-3.5 w-3.5" />
                                                        </button>
                                                        <button type="button" title="Increase level" onClick={() => changeListLevel(block.id, itemIndex, 1)} className="p-1 text-gray-400 hover:text-[#6F155F]">
                                                            <IndentIncrease className="h-3.5 w-3.5" />
                                                        </button>
                                                        <button type="button" title="Remove item" onClick={() => removeListItem(block.id, item.id)} className="p-1 text-gray-300 hover:text-red-500">
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    }
                                    if (block.type === "table") {
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
                                                key={block.id}
                                                className={`-mx-3 max-w-full min-w-0 rounded-md px-3 py-2 transition-colors ${selected ? "bg-[#F2EBF1]/50" : ""}`}
                                                onClick={() => setActiveBlockId(block.id)}
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="text-[10px] uppercase tracking-wider text-gray-400">Table</div>
                                                    <button type="button" title="Remove table" onClick={() => removeBlock(block.id)} className="p-1 text-gray-300 hover:text-red-500">
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                                <input
                                                    value={block.caption}
                                                    onFocus={() => setActiveBlockId(block.id)}
                                                    onChange={(e) => updateTableBlock(block.id, (current) => ({ ...current, caption: e.target.value }))}
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
                                                                    applyFormatToSelectedCells(block, {
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
                                                                    applyFormatToSelectedCells(block, {
                                                                        textColor: e.target.value,
                                                                    })
                                                                }
                                                                className="h-6 w-7 cursor-pointer rounded border border-gray-200 bg-white p-0"
                                                            />
                                                        </label>
                                                        <button
                                                            type="button"
                                                            title="Bold"
                                                            onClick={() => toggleBoldSelected(block)}
                                                            className={`rounded border px-1.5 py-1 ${primaryCell?.bold ? "border-[#6F155F] text-[#6F155F] bg-white" : "border-gray-200 text-gray-600 hover:border-[#6F155F]"}`}
                                                        >
                                                            <Bold className="h-3.5 w-3.5" />
                                                        </button>
                                                        <button type="button" title="Align left" onClick={() => setAlignSelected(block, "left")} className={`rounded border px-1.5 py-1 ${primaryCell?.align === "left" ? "border-[#6F155F] text-[#6F155F]" : "border-gray-200 text-gray-600"}`}>
                                                            <AlignLeft className="h-3.5 w-3.5" />
                                                        </button>
                                                        <button type="button" title="Align center" onClick={() => setAlignSelected(block, "center")} className={`rounded border px-1.5 py-1 ${primaryCell?.align === "center" ? "border-[#6F155F] text-[#6F155F]" : "border-gray-200 text-gray-600"}`}>
                                                            <AlignCenter className="h-3.5 w-3.5" />
                                                        </button>
                                                        <button type="button" title="Align right" onClick={() => setAlignSelected(block, "right")} className={`rounded border px-1.5 py-1 ${primaryCell?.align === "right" ? "border-[#6F155F] text-[#6F155F]" : "border-gray-200 text-gray-600"}`}>
                                                            <AlignRight className="h-3.5 w-3.5" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            title="Merge cells"
                                                            disabled={!canMerge}
                                                            onClick={() => mergeSelectedCells(block)}
                                                            className="rounded border border-gray-200 px-2 py-1 text-[11px] text-gray-600 disabled:opacity-40 hover:border-[#6F155F] hover:text-[#6F155F]"
                                                        >
                                                            Merge
                                                        </button>
                                                        <button
                                                            type="button"
                                                            title="Unmerge cells"
                                                            disabled={!canUnmerge}
                                                            onClick={() => unmergeSelectedCell(block)}
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
                                                                                selectTableCell(block.id, ref, e);
                                                                            }}
                                                                        >
                                                                            <div className="flex items-center gap-1 min-w-0">
                                                                                <input
                                                                                    value={cell.text}
                                                                                    onFocus={() => {
                                                                                        setActiveBlockId(block.id);
                                                                                        setSelectedTableCells((prev) =>
                                                                                            prev.some((c) => c.row === ref.row && c.col === ref.col)
                                                                                                ? prev
                                                                                                : [ref]
                                                                                        );
                                                                                        setTableSelectionAnchor((prev) => prev ?? ref);
                                                                                    }}
                                                                                    onChange={(e) =>
                                                                                        updateTableBlock(block.id, (current) =>
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
                                                                                        removeTableColumn(block, colIndex);
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
                                                                                    selectTableCell(block.id, ref, e);
                                                                                }}
                                                                            >
                                                                                <input
                                                                                    value={cell.text}
                                                                                    onFocus={() => {
                                                                                        setActiveBlockId(block.id);
                                                                                        setSelectedTableCells((prev) =>
                                                                                            prev.some((c) => c.row === ref.row && c.col === ref.col)
                                                                                                ? prev
                                                                                                : [ref]
                                                                                        );
                                                                                        setTableSelectionAnchor((prev) => prev ?? ref);
                                                                                    }}
                                                                                    onChange={(e) =>
                                                                                        updateTableBlock(block.id, (current) =>
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
                                                                            onClick={() => removeTableRow(block, rowIndex)}
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
                                                    <button type="button" onClick={() => addTableRow(block)} className="text-[11px] border border-gray-200 rounded px-2 py-1 hover:border-[#6F155F] hover:text-[#6F155F]">
                                                        Add row
                                                    </button>
                                                    <button type="button" onClick={() => addTableColumn(block)} className="text-[11px] border border-gray-200 rounded px-2 py-1 hover:border-[#6F155F] hover:text-[#6F155F]">
                                                        Add column
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    }
                                    return (
                                        <div
                                            key={block.id}
                                            className={`-mx-3 rounded-md px-3 py-2 transition-colors ${selected ? "bg-[#F2EBF1]/50" : ""}`}
                                            onClick={() => setActiveBlockId(block.id)}
                                        >
                                            <div className="flex items-center justify-between mb-2 gap-2">
                                                <div className="text-[10px] uppercase tracking-wider text-gray-400">Figure</div>
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        type="button"
                                                        title="Replace image"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setReplacingFigureId(block.id);
                                                            replaceFigureInputRef.current?.click();
                                                        }}
                                                        className="text-[11px] border border-gray-200 rounded px-2 py-1 hover:border-[#6F155F] hover:text-[#6F155F]"
                                                    >
                                                        Replace
                                                    </button>
                                                    <button
                                                        type="button"
                                                        title="Remove figure"
                                                        onClick={() => removeBlock(block.id)}
                                                        className="p-1 text-gray-300 hover:text-red-500"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                            {block.dataUrl ? (
                                                <div
                                                    className={`mb-3 flex ${
                                                        (block.align || "center") === "left"
                                                            ? "justify-start"
                                                            : (block.align || "center") === "right"
                                                              ? "justify-end"
                                                              : "justify-center"
                                                    }`}
                                                >
                                                    <img
                                                        src={block.dataUrl}
                                                        alt={block.caption || block.fileName}
                                                        className="rounded border border-gray-100 object-contain"
                                                        style={{
                                                            width: `${Math.max(40, Math.min(100, block.widthPercent || 100))}%`,
                                                            maxWidth: "100%",
                                                            height: "auto",
                                                        }}
                                                    />
                                                </div>
                                            ) : (
                                                <div className="mb-3 text-xs text-slate-400 border border-dashed border-gray-200 rounded p-6 text-center">
                                                    No image — use Replace to upload one.
                                                </div>
                                            )}
                                            <div className="mb-3 flex flex-wrap items-center gap-2 rounded border border-gray-100 bg-gray-50 px-2 py-1.5">
                                                <label className="flex items-center gap-2 text-[11px] text-gray-500 min-w-[160px] flex-1">
                                                    Size
                                                    <input
                                                        type="range"
                                                        min={40}
                                                        max={100}
                                                        step={5}
                                                        value={Math.max(40, Math.min(100, block.widthPercent || 100))}
                                                        onChange={(e) =>
                                                            updateFigureBlock(block.id, {
                                                                widthPercent: Number(e.target.value),
                                                            })
                                                        }
                                                        className="flex-1 accent-[#6F155F]"
                                                    />
                                                    <span className="w-10 text-right tabular-nums">{Math.max(40, Math.min(100, block.widthPercent || 100))}%</span>
                                                </label>
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        type="button"
                                                        title="Align left"
                                                        onClick={() => updateFigureBlock(block.id, { align: "left" })}
                                                        className={`rounded border px-1.5 py-1 ${(block.align || "center") === "left" ? "border-[#6F155F] text-[#6F155F] bg-white" : "border-gray-200 text-gray-600"}`}
                                                    >
                                                        <AlignLeft className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        title="Align center"
                                                        onClick={() => updateFigureBlock(block.id, { align: "center" })}
                                                        className={`rounded border px-1.5 py-1 ${(block.align || "center") === "center" ? "border-[#6F155F] text-[#6F155F] bg-white" : "border-gray-200 text-gray-600"}`}
                                                    >
                                                        <AlignCenter className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        title="Align right"
                                                        onClick={() => updateFigureBlock(block.id, { align: "right" })}
                                                        className={`rounded border px-1.5 py-1 ${(block.align || "center") === "right" ? "border-[#6F155F] text-[#6F155F] bg-white" : "border-gray-200 text-gray-600"}`}
                                                    >
                                                        <AlignRight className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="text-[11px] text-slate-400 mb-1 truncate">{block.fileName}</div>
                                            <div className="flex items-baseline gap-1.5">
                                                <span className="text-sm font-serif text-slate-500 shrink-0">Figure #.#:</span>
                                                <input
                                                    value={block.caption}
                                                    onFocus={() => setActiveBlockId(block.id)}
                                                    onChange={(e) =>
                                                        updateFigureBlock(block.id, { caption: e.target.value })
                                                    }
                                                    className="w-full text-sm font-serif border-b border-gray-100 focus:border-[#6F155F] focus:outline-none py-1"
                                                    placeholder="Caption text (number assigned automatically)"
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            </div>
                        </div>
                    </div>
                </main>

                <aside className={`${isAiSidebarOpen ? "w-72" : "w-12"} border-l border-slate-200/80 bg-white transition-all duration-300 shrink-0 overflow-hidden flex flex-col`}>
                    {isAiSidebarOpen ? (
                        <div className="w-72 h-full flex flex-col">
                            <div className="px-4 py-3.5 border-b border-slate-200/80 text-[#6F155F] font-semibold text-sm flex items-center justify-between bg-white">
                                <div className="flex items-center gap-2"><Sparkles className="h-4 w-4" /> Academic AI Copilot</div>
                                <button type="button" onClick={() => setIsAiSidebarOpen(false)} className="p-1.5 text-slate-400 hover:text-[#6F155F] hover:bg-[#F2EBF1] rounded-md transition-colors"><PanelRightClose className="h-4 w-4" /></button>
                            </div>
                            <div className="flex-1 p-4 overflow-y-auto bg-[#F8F6F9] space-y-4">
                                <div className="bg-white p-3.5 rounded-lg border border-slate-200/80 shadow-sm text-xs text-slate-600 leading-relaxed">How can I help you improve your content?</div>
                                <div className="grid grid-cols-1 gap-2">
                                    {["Refine Grammar", "Check Academic Tone", "Expand Details"].map((prompt) => (
                                        <button key={prompt} type="button" className="text-left text-xs bg-white border border-slate-200 hover:border-[#6F155F]/40 hover:text-[#6F155F] p-2.5 rounded-md transition-colors">{prompt}</button>
                                    ))}
                                </div>
                            </div>
                            <div className="p-3 border-t border-slate-200/80 bg-white">
                                <div className="relative">
                                    <input className="w-full text-xs border border-slate-200 rounded-lg p-2.5 pr-9 focus:outline-none focus:ring-1 focus:ring-[#6F155F]/40 focus:border-[#6F155F]/40" placeholder="Ask anything..." />
                                    <button type="button" className="absolute right-2.5 top-2.5 text-[#6F155F]"><Send className="h-4 w-4" /></button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="w-12 h-full flex flex-col items-center pt-5 cursor-pointer hover:bg-slate-50" onClick={() => setIsAiSidebarOpen(true)}>
                            <div className="bg-[#6F155F]/10 p-2 rounded-lg text-[#6F155F]"><Bot className="h-5 w-5" /></div>
                        </div>
                    )}
                </aside>
            </div>
        </div>
    );
}