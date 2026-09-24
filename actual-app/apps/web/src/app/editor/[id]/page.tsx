'use client';

import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { useState, useEffect, useRef, type ChangeEvent } from "react";
import { useParams } from "next/navigation";
import {
    ChevronLeft, Sparkles, Loader2, ChevronRight, ChevronDown,
    PanelRightOpen, PanelRightClose, Send, Bot, Plus, FileText, Save, FileDown,
    List, ListOrdered, IndentIncrease, IndentDecrease, Trash2,
    Table2, ImagePlus
} from "lucide-react";

// --- Types ---
interface ContentListItem {
    id: string;
    text: string;
    level: number;
}

interface ContentList {
    id: string;
    type: "bullet" | "number";
    items: ContentListItem[];
}

interface ContentTable {
    id: string;
    caption: string;
    columns: string[];
    data: string[][];
}

interface ContentFigure {
    id: string;
    caption: string;
    fileName: string;
    mimeType: string;
    dataUrl: string;
}

interface StructureItem {
    id: string;
    title: string;
    level: number;
    subitems?: StructureItem[];
    lists?: ContentList[];
    tables?: ContentTable[];
    figures?: ContentFigure[];
}

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
    return { id: `li-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, text: "", level };
}

function newList(type: "bullet" | "number"): ContentList {
    return { id: `list-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type, items: [newListItem(1)] };
}

function newId(prefix: string) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
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
    onAddSubItem
}: {
    item: StructureItem,
    level?: number,
    activeItem: { id: string, title: string },
    setActiveItem: (item: { id: string, title: string }) => void,
    onAddSubItem: (id: string, currentLevel: number) => void
}) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const hasChildren = item.subitems && item.subitems.length > 0;

    return (
        <div>
            <div className="flex items-center group py-0.5" style={{ paddingLeft: `${level * 12 + 12}px` }}>
                <button
                    onClick={() => {
                        if (hasChildren) setIsExpanded(!isExpanded);
                        setActiveItem({ id: item.id, title: item.title });
                    }}
                    className={`flex-1 text-left px-2 py-1 text-[11px] rounded flex items-center gap-1 
                    ${activeItem.id === item.id ? 'bg-[#F2EBF1] text-[#6F155F]' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                    <div className="w-3 flex items-center justify-center">
                        {hasChildren && (isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />)}
                    </div>
                    <FileText className="h-3 w-3" />
                    {item.title}
                </button>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onAddSubItem(item.id, level);
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
    const [contentMap, setContentMap] = useState<Record<string, string>>({});
    const [coverMeta, setCoverMeta] = useState<CoverMeta>(defaultCoverMeta);
    const [showCoverMeta, setShowCoverMeta] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const imageInputRef = useRef<HTMLInputElement>(null);

    // --- 1. Load Data ---
    useEffect(() => {
        if (!id) return;
        const fetchData = async () => {
            try {
                const res = await fetch(`/api/projects/${id}`);
                if (!res.ok) throw new Error("Failed to fetch");
                const data = await res.json();
                setChapters(data.structure || []);
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
                if (data.structure?.length > 0) {
                    setActiveItem({ id: data.structure[0].id, title: data.structure[0].title });
                }
            } catch (err) {
                console.error("Error loading project:", err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [id]);

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


    // --- 3. Sidebar Add Logic ---
    const handleAddSubItem = async (parentId: string, parentLevel: number) => {
        const title = prompt("Enter new section title:");
        if (!title) return;

        const newItem: StructureItem = {
            id: Date.now().toString(),
            title,
            level: parentLevel + 1,
            subitems: [],
            lists: [],
            tables: [],
            figures: []
        };

        const addItemRecursive = (items: StructureItem[]): StructureItem[] => {
            return items.map(item => {
                if (item.id === parentId) {
                    return { ...item, subitems: [...(item.subitems || []), newItem] };
                }
                if (item.subitems) {
                    return { ...item, subitems: addItemRecursive(item.subitems) };
                }
                return item;
            });
        };

        // 1. Local State Update
        const updatedChapters = addItemRecursive(chapters);
        setChapters(updatedChapters);

        // 2. Database Sync (Call PATCH route)
        setIsSaving(true);
        try {
            const response = await fetch(`/api/projects/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contentMap: { ...contentMap, [newItem.id]: "" }, // Naya entry contentMap mein bhi daalein
                    structure: updatedChapters
                }),
            });

            if (!response.ok) throw new Error("Failed to save to DB");
            console.log("Structure persisted in MongoDB");
        } catch (err) {
            console.error("Save failed", err);
        } finally {
            setIsSaving(false);
        }
    };

    const activeItemData = findStructureItem(chapters, activeItem.id);
    const activeLists = activeItemData?.lists || [];
    const activeTables = activeItemData?.tables || [];
    const activeFigures = activeItemData?.figures || [];

    const updateActiveLists = (lists: ContentList[]) => {
        setChapters((prev) =>
            updateStructureItem(prev, activeItem.id, (item) => ({ ...item, lists }))
        );
    };

    const startOrExtendList = (type: "bullet" | "number") => {
        const lists = [...activeLists];
        const last = lists[lists.length - 1];
        if (last && last.type === type) {
            lists[lists.length - 1] = { ...last, items: [...last.items, newListItem(1)] };
        } else {
            lists.push(newList(type));
        }
        updateActiveLists(lists);
    };

    const updateListItem = (listId: string, itemId: string, patch: Partial<ContentListItem>) => {
        updateActiveLists(
            activeLists.map((list) =>
                list.id !== listId
                    ? list
                    : {
                        ...list,
                        items: list.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
                    }
            )
        );
    };

    const changeListLevel = (listId: string, itemIndex: number, delta: number) => {
        const list = activeLists.find((entry) => entry.id === listId);
        if (!list) return;
        const item = list.items[itemIndex];
        if (!item) return;
        const previousLevel = itemIndex === 0 ? 1 : list.items[itemIndex - 1].level;
        const nextLevel = Math.max(1, Math.min(MAX_LIST_LEVEL, item.level + delta));
        const clamped = itemIndex === 0 ? 1 : Math.min(nextLevel, previousLevel + 1);
        updateListItem(listId, item.id, { level: clamped });
    };

    const removeListItem = (listId: string, itemId: string) => {
        updateActiveLists(
            activeLists
                .map((list) =>
                    list.id !== listId
                        ? list
                        : { ...list, items: list.items.filter((item) => item.id !== itemId) }
                )
                .filter((list) => list.items.length > 0)
        );
    };

    const patchActiveItem = (patch: Partial<StructureItem>) => {
        setChapters((prev) =>
            updateStructureItem(prev, activeItem.id, (item) => ({ ...item, ...patch }))
        );
    };

    const addTable = () => {
        const colsRaw = window.prompt("Number of columns", "3");
        if (colsRaw === null) return;
        const rowsRaw = window.prompt("Number of rows (including header)", "3");
        if (rowsRaw === null) return;
        const cols = Math.max(1, Math.min(12, parseInt(colsRaw, 10) || 3));
        const rows = Math.max(2, Math.min(30, parseInt(rowsRaw, 10) || 3));
        patchActiveItem({ tables: [...activeTables, newTable(rows, cols)] });
    };

    const updateTable = (tableId: string, updater: (table: ContentTable) => ContentTable) => {
        patchActiveItem({
            tables: activeTables.map((table) => (table.id === tableId ? updater(table) : table)),
        });
    };

    const removeTable = (tableId: string) => {
        patchActiveItem({ tables: activeTables.filter((table) => table.id !== tableId) });
    };

    const addTableRow = (table: ContentTable) => {
        updateTable(table.id, (current) => ({
            ...current,
            data: [...current.data, emptyRow(current.columns.length)],
        }));
    };

    const addTableColumn = (table: ContentTable) => {
        updateTable(table.id, (current) => ({
            ...current,
            columns: [...current.columns, `Column ${current.columns.length + 1}`],
            data: current.data.map((row) => [...row, ""]),
        }));
    };

    const removeTableRow = (table: ContentTable, rowIndex: number) => {
        if (table.data.length <= 1) return;
        updateTable(table.id, (current) => ({
            ...current,
            data: current.data.filter((_, index) => index !== rowIndex),
        }));
    };

    const removeTableColumn = (table: ContentTable, colIndex: number) => {
        if (table.columns.length <= 1) return;
        updateTable(table.id, (current) => ({
            ...current,
            columns: current.columns.filter((_, index) => index !== colIndex),
            data: current.data.map((row) => row.filter((_, index) => index !== colIndex)),
        }));
    };

    const handleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = typeof reader.result === "string" ? reader.result : "";
            if (!dataUrl) return;
            patchActiveItem({
                figures: [
                    ...activeFigures,
                    {
                        id: newId("fig"),
                        caption: "",
                        fileName: file.name,
                        mimeType: file.type || "image/png",
                        dataUrl,
                    },
                ],
            });
        };
        reader.readAsDataURL(file);
    };

    const updateFigure = (figureId: string, patch: Partial<ContentFigure>) => {
        patchActiveItem({
            figures: activeFigures.map((figure) =>
                figure.id === figureId ? { ...figure, ...patch } : figure
            ),
        });
    };

    const removeFigure = (figureId: string) => {
        patchActiveItem({ figures: activeFigures.filter((figure) => figure.id !== figureId) });
    };

    if (isLoading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-[#6F155F]" /></div>;

    return (
        <div className="h-screen flex flex-col bg-background overflow-hidden">
            <header className="h-14 border-b border-gray-100 bg-white px-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard" className="text-gray-400 hover:text-[#6F155F]"><ChevronLeft className="h-5 w-5" /></Link>
                    <h1 className="text-sm font-medium text-slate-800">Editor</h1>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowCoverMeta((open) => !open)}
                        className="text-xs flex items-center gap-1 text-slate-500 hover:text-[#6F155F]"
                        type="button"
                    >
                        <FileText className="h-3 w-3" />
                        {showCoverMeta ? "Hide Cover Details" : "Title & Approval"}
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving || isGenerating}
                        className="text-xs flex items-center gap-1 text-slate-500 hover:text-[#6F155F] disabled:opacity-50"
                    >
                        {isSaving ? "Saving..." : <><Save className="h-3 w-3" /> Save</>}
                    </button>
                    <button
                        onClick={handleGenerate}
                        disabled={isSaving || isGenerating}
                        className="text-xs flex items-center gap-1.5 rounded-md bg-[#6F155F] hover:bg-[#57104b] text-white px-3 py-1.5 font-medium disabled:opacity-50"
                    >
                        {isGenerating ? (
                            <><Loader2 className="h-3 w-3 animate-spin" /> Generating...</>
                        ) : (
                            <><FileDown className="h-3 w-3" /> Generate Report</>
                        )}
                    </button>
                    <button onClick={() => setIsAiSidebarOpen(!isAiSidebarOpen)} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-all">
                        {isAiSidebarOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
                    </button>
                    <UserButton />
                </div>
            </header>

            <div className="flex-1 flex min-h-0 overflow-hidden">
                <aside className="w-64 border-r border-gray-100 bg-white overflow-y-auto pt-2">
                    <div className="px-4 mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Report Structure</div>
                    {chapters.map(ch => (
                        <SidebarItem
                            key={ch.id}
                            item={ch}
                            level={ch.level || 1}
                            activeItem={activeItem}
                            setActiveItem={setActiveItem}
                            onAddSubItem={handleAddSubItem}
                        />
                    ))}
                </aside>

                <main className="flex-1 bg-slate-50/30 overflow-y-auto p-12 flex justify-center min-w-0">
                    <div className="max-w-2xl w-full min-w-0 bg-white min-h-[800px] border border-gray-200 shadow-sm rounded-xl p-12 overflow-x-hidden">
                        {showCoverMeta && (
                            <div className="mb-8 border border-gray-200 rounded-lg p-4 bg-slate-50/80 space-y-3">
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
                        <h2 className="text-3xl font-serif text-slate-900 mb-6">{activeItem.title}</h2>
                        <textarea
                            value={contentMap[activeItem.id] || ""}
                            onChange={(e) => setContentMap(prev => ({ ...prev, [activeItem.id]: e.target.value }))}
                            className="w-full min-h-[220px] resize-none font-serif text-base leading-relaxed focus:outline-none"
                            placeholder="Start writing..."
                        />
                        <div className="mt-8 border-t border-gray-100 pt-4 min-w-0 max-w-full">
                            <div className="flex items-center gap-2 mb-3 flex-wrap">
                                <button
                                    type="button"
                                    onClick={() => startOrExtendList("bullet")}
                                    className="text-xs flex items-center gap-1.5 border border-gray-200 hover:border-[#6F155F] hover:text-[#6F155F] rounded-md px-2.5 py-1.5"
                                >
                                    <List className="h-3.5 w-3.5" /> Bullet List
                                </button>
                                <button
                                    type="button"
                                    onClick={() => startOrExtendList("number")}
                                    className="text-xs flex items-center gap-1.5 border border-gray-200 hover:border-[#6F155F] hover:text-[#6F155F] rounded-md px-2.5 py-1.5"
                                >
                                    <ListOrdered className="h-3.5 w-3.5" /> Numbered List
                                </button>
                                <button
                                    type="button"
                                    onClick={addTable}
                                    className="text-xs flex items-center gap-1.5 border border-gray-200 hover:border-[#6F155F] hover:text-[#6F155F] rounded-md px-2.5 py-1.5"
                                >
                                    <Table2 className="h-3.5 w-3.5" /> Add Table
                                </button>
                                <button
                                    type="button"
                                    onClick={() => imageInputRef.current?.click()}
                                    className="text-xs flex items-center gap-1.5 border border-gray-200 hover:border-[#6F155F] hover:text-[#6F155F] rounded-md px-2.5 py-1.5"
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
                            </div>
                            <p className="text-[11px] text-slate-400 mb-4">
                                Table and figure numbers are assigned automatically when the report is generated. Enter captions only.
                            </p>
                            {activeLists.map((list) => (
                                <div key={list.id} className="mb-4 space-y-1.5">
                                    <div className="text-[10px] uppercase tracking-wider text-gray-400">
                                        {list.type === "number" ? "Numbered list" : "Bullet list"}
                                    </div>
                                    {list.items.map((item, itemIndex) => {
                                        const numberLabels = list.type === "number" ? listNumberLabels(list.items) : [];
                                        return (
                                        <div
                                            key={item.id}
                                            className="flex items-center gap-1"
                                            style={{ paddingLeft: `${(item.level - 1) * 20}px` }}
                                        >
                                            <span className="w-10 shrink-0 text-[11px] text-slate-400">
                                                {list.type === "number"
                                                    ? numberLabels[itemIndex]
                                                    : item.level === 1 ? "•" : item.level === 2 ? "o" : "▪"}
                                            </span>
                                            <input
                                                value={item.text}
                                                onChange={(e) => updateListItem(list.id, item.id, { text: e.target.value })}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") {
                                                        e.preventDefault();
                                                        const lists = activeLists.map((entry) =>
                                                            entry.id !== list.id
                                                                ? entry
                                                                : {
                                                                    ...entry,
                                                                    items: [
                                                                        ...entry.items.slice(0, itemIndex + 1),
                                                                        newListItem(item.level),
                                                                        ...entry.items.slice(itemIndex + 1),
                                                                    ],
                                                                }
                                                        );
                                                        updateActiveLists(lists);
                                                    }
                                                }}
                                                className="flex-1 text-sm font-serif border-b border-gray-100 focus:border-[#6F155F] focus:outline-none py-1"
                                                placeholder="List item"
                                            />
                                            <button type="button" title="Decrease level" onClick={() => changeListLevel(list.id, itemIndex, -1)} className="p-1 text-gray-400 hover:text-[#6F155F]">
                                                <IndentDecrease className="h-3.5 w-3.5" />
                                            </button>
                                            <button type="button" title="Increase level" onClick={() => changeListLevel(list.id, itemIndex, 1)} className="p-1 text-gray-400 hover:text-[#6F155F]">
                                                <IndentIncrease className="h-3.5 w-3.5" />
                                            </button>
                                            <button type="button" title="Remove item" onClick={() => removeListItem(list.id, item.id)} className="p-1 text-gray-300 hover:text-red-500">
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                        );
                                    })}
                                </div>
                            ))}
                            {activeTables.map((table) => (
                                <div key={table.id} className="mb-6 rounded-lg border border-gray-200 p-3 max-w-full min-w-0 overflow-hidden">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="text-[10px] uppercase tracking-wider text-gray-400">Table</div>
                                        <button type="button" title="Remove table" onClick={() => removeTable(table.id)} className="p-1 text-gray-300 hover:text-red-500">
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                    <input
                                        value={table.caption}
                                        onChange={(e) => updateTable(table.id, (current) => ({ ...current, caption: e.target.value }))}
                                        className="w-full text-sm font-serif border-b border-gray-100 focus:border-[#6F155F] focus:outline-none py-1 mb-3"
                                        placeholder="Table caption (number is assigned automatically)"
                                    />
                                    <div className="overflow-x-auto max-w-full">
                                        <table className="w-full min-w-full border-collapse text-sm font-serif table-fixed">
                                            <thead>
                                                <tr>
                                                    {table.columns.map((column, colIndex) => (
                                                        <th key={`${table.id}-col-${colIndex}`} className="border border-gray-200 p-1 align-top">
                                                            <div className="flex items-center gap-1 min-w-0">
                                                                <input
                                                                    value={column}
                                                                    onChange={(e) => updateTable(table.id, (current) => ({
                                                                        ...current,
                                                                        columns: current.columns.map((value, index) =>
                                                                            index === colIndex ? e.target.value : value
                                                                        ),
                                                                    }))}
                                                                    className="w-full min-w-0 text-center font-semibold focus:outline-none"
                                                                    placeholder={`Column ${colIndex + 1}`}
                                                                />
                                                                <button
                                                                    type="button"
                                                                    title="Remove column"
                                                                    onClick={() => removeTableColumn(table, colIndex)}
                                                                    className="text-gray-300 hover:text-red-500 shrink-0"
                                                                >
                                                                    ×
                                                                </button>
                                                            </div>
                                                        </th>
                                                    ))}
                                                    <th className="w-8 p-0 border-0" aria-hidden />
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {table.data.map((row, rowIndex) => (
                                                    <tr key={`${table.id}-row-${rowIndex}`}>
                                                        {row.map((cell, colIndex) => (
                                                            <td key={`${table.id}-cell-${rowIndex}-${colIndex}`} className="border border-gray-200 p-1 align-top">
                                                                <input
                                                                    value={cell}
                                                                    onChange={(e) => updateTable(table.id, (current) => ({
                                                                        ...current,
                                                                        data: current.data.map((currentRow, currentRowIndex) =>
                                                                            currentRowIndex === rowIndex
                                                                                ? currentRow.map((value, currentColIndex) =>
                                                                                    currentColIndex === colIndex ? e.target.value : value
                                                                                )
                                                                                : currentRow
                                                                        ),
                                                                    }))}
                                                                    className="w-full min-w-0 focus:outline-none"
                                                                    placeholder="Cell"
                                                                />
                                                            </td>
                                                        ))}
                                                        <td className="p-1 w-8 align-middle">
                                                            <button
                                                                type="button"
                                                                title="Remove row"
                                                                onClick={() => removeTableRow(table, rowIndex)}
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
                                        <button type="button" onClick={() => addTableRow(table)} className="text-[11px] border border-gray-200 rounded px-2 py-1 hover:border-[#6F155F] hover:text-[#6F155F]">
                                            Add row
                                        </button>
                                        <button type="button" onClick={() => addTableColumn(table)} className="text-[11px] border border-gray-200 rounded px-2 py-1 hover:border-[#6F155F] hover:text-[#6F155F]">
                                            Add column
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {activeFigures.map((figure) => (
                                <div key={figure.id} className="mb-6 rounded-lg border border-gray-200 p-3">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="text-[10px] uppercase tracking-wider text-gray-400">Figure</div>
                                        <button type="button" title="Remove figure" onClick={() => removeFigure(figure.id)} className="p-1 text-gray-300 hover:text-red-500">
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                    {figure.dataUrl ? (
                                        <img
                                            src={figure.dataUrl}
                                            alt={figure.caption || figure.fileName}
                                            className="max-h-48 mx-auto mb-3 rounded border border-gray-100 object-contain"
                                        />
                                    ) : null}
                                    <div className="text-[11px] text-slate-400 mb-2">{figure.fileName}</div>
                                    <input
                                        value={figure.caption}
                                        onChange={(e) => updateFigure(figure.id, { caption: e.target.value })}
                                        className="w-full text-sm font-serif border-b border-gray-100 focus:border-[#6F155F] focus:outline-none py-1"
                                        placeholder="Figure caption (number is assigned automatically)"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </main>

                <aside className={`${isAiSidebarOpen ? 'w-80' : 'w-12'} border-l border-gray-100 bg-white transition-all duration-300 shrink-0 overflow-hidden flex flex-col`}>
                    {isAiSidebarOpen ? (
                        <div className="w-80 h-full flex flex-col">
                            <div className="p-4 border-b border-gray-100 text-[#6F155F] font-semibold text-sm flex items-center justify-between">
                                <div className="flex items-center gap-2"><Sparkles className="h-4 w-4" /> Academic AI Copilot</div>
                                <button onClick={() => setIsAiSidebarOpen(false)}><PanelRightClose className="h-4 w-4 text-gray-400" /></button>
                            </div>
                            <div className="flex-1 p-4 overflow-y-auto bg-slate-50/50 space-y-4">
                                <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm text-xs text-slate-600">How can I help you improve your content?</div>
                                <div className="grid grid-cols-1 gap-2">
                                    {["Refine Grammar", "Check Academic Tone", "Expand Details"].map((prompt) => (
                                        <button key={prompt} className="text-left text-xs bg-white border border-gray-200 hover:text-[#6F155F] p-2 rounded-md">{prompt}</button>
                                    ))}
                                </div>
                            </div>
                            <div className="p-3 border-t border-gray-100 bg-white">
                                <div className="relative">
                                    <input className="w-full text-xs border border-gray-200 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-[#6F155F]" placeholder="Ask anything..." />
                                    <button className="absolute right-2 top-2 text-[#6F155F]"><Send className="h-4 w-4" /></button>
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