'use client';

import { useState, useEffect, useRef, type ChangeEvent, type KeyboardEvent } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { flushSync } from "react-dom";
import {
    Sparkles, Loader2,
    PanelRightClose, Send, Bot
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
    appendAiDraftToBlocks,
    replaceParagraphBlocksWithAiDraft,
    sectionHasParagraphContent,
    canUnmergeTableCell,
    clearTableMerges,
    deleteStructureItem,
    ensureContentBlocks,
    getTableCell,
    isProtectedStructureId,
    mergeTableCells,
    newId,
    renumberStructure,
    renameStructureItem,
    setTableCell,
    stripHeadingNumber,
    formatHeadingLabel,
    unmergeTableCell,
} from "@/lib/structureUtils";
import {
    type ReferenceEntry,
    buildCitationNumbers,
    citationToken,
    countCitations,
    emptyReference,
    insertCitationAt,
    normalizeReferences,
} from "@/lib/references";
import {
    type AiProfile,
    AI_PROFILE_FIELDS,
    EMPTY_AI_PROFILE_MESSAGE,
    emptyAiProfile,
    isAiProfileEmpty,
    normalizeAiProfile,
} from "@/services/ai/aiProfile";
import {
    type AiRefineMode,
    isUsableAiDraft,
} from "@/services/ai/prompts";
import {
    type FypDiagramKind,
    FYP_DIAGRAM_CATALOG,
    applyDiagramFigureToBlocks,
    countReadyFypDiagrams,
    findFypDiagramSection,
    getSectionFiguresWithImage,
    resolveDiagramInsertImage,
    resolveFypDiagramStatus,
} from "@/services/ai/fypDiagrams";
import {
    type DiagramSpec,
    emptyDiagramSpec,
    normalizePersistedDiagramSpecs,
    validateDiagramSpec,
} from "@/services/ai/diagramSpec";
import { EditorHeader } from "@/components/editor/EditorHeader";
import { EditorOpeningShell } from "@/components/editor/EditorOpeningShell";
import { ReportGenerateOverlay } from "@/components/editor/ReportGenerateOverlay";
import { CoverMetaPanel, type CoverMeta, type TeamMember } from "@/components/editor/CoverMetaPanel";
import { ReferencesPanel } from "@/components/editor/ReferencesPanel";
import { StructureSidebar } from "@/components/editor/StructureSidebar";
import { ContentToolbar } from "@/components/editor/ContentToolbar";
import { SectionCanvas } from "@/components/editor/SectionCanvas";
import { ParagraphBlock } from "@/components/editor/blocks/ParagraphBlock";
import { ListBlock } from "@/components/editor/blocks/ListBlock";
import { TableBlock } from "@/components/editor/blocks/TableBlock";
import { FigureBlock } from "@/components/editor/blocks/FigureBlock";

/** Lazy: keep Mermaid / diagram editors off the initial /editor/[id] bundle. */
const FypDiagramSpecEditor = dynamic(
    () =>
        import("@/components/FypDiagramSpecEditor").then((mod) => mod.FypDiagramSpecEditor),
    {
        ssr: false,
        loading: () => (
            <div className="text-[10px] text-slate-400 px-1 py-2">Loading diagram editor…</div>
        ),
    }
);

const FypDiagramPreview = dynamic(
    () => import("@/components/FypDiagramPreview").then((mod) => mod.FypDiagramPreview),
    {
        ssr: false,
        loading: () => (
            <div className="text-[10px] text-slate-400 px-3 py-6 text-center">Rendering preview…</div>
        ),
    }
);


function getSectionParagraphText(blocks: ContentBlock[]): string {
    return blocks
        .filter((block): block is Extract<ContentBlock, { type: "paragraph" }> => block.type === "paragraph")
        .map((block) => (block.text || "").trim())
        .filter(Boolean)
        .join("\n\n");
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

export default function EditorPage() {
    const params = useParams();
    const id = params.id as string;

    const [chapters, setChapters] = useState<StructureItem[]>([]);
    const [activeItem, setActiveItem] = useState<{ id: string, title: string }>({ id: "", title: "Loading..." });
    const [isAiSidebarOpen, setIsAiSidebarOpen] = useState(false);
    const [aiDraft, setAiDraft] = useState("");
    const [aiDraftSectionId, setAiDraftSectionId] = useState<string | null>(null);
    const [aiInsertNotice, setAiInsertNotice] = useState<string | null>(null);
    const [aiError, setAiError] = useState<string | null>(null);
    const [isAiGenerating, setIsAiGenerating] = useState(false);
    const [aiMessage, setAiMessage] = useState("");
    const [aiClarificationQuestion, setAiClarificationQuestion] = useState<string | null>(null);
    const [aiClarificationAnswers, setAiClarificationAnswers] = useState<
        Array<{ question: string; answer: string }>
    >([]);
    const [aiProfile, setAiProfile] = useState<AiProfile>(() => emptyAiProfile());
    const [aiProfileDraft, setAiProfileDraft] = useState<AiProfile>(() => emptyAiProfile());
    const [isEditingAiProfile, setIsEditingAiProfile] = useState(false);
    const [isSavingAiProfile, setIsSavingAiProfile] = useState(false);
    const [isProjectContextOpen, setIsProjectContextOpen] = useState(false);
    const [isFypDiagramsOpen, setIsFypDiagramsOpen] = useState(false);
    const [selectedDiagramKind, setSelectedDiagramKind] = useState<FypDiagramKind | null>(null);
    const [diagramPreviews, setDiagramPreviews] = useState<
        Partial<Record<FypDiagramKind, { dataUrl: string; fileName: string; mimeType: string }>>
    >({});
    const [diagramSpecs, setDiagramSpecs] = useState<Partial<Record<FypDiagramKind, DiagramSpec>>>({});
    const [diagramClarifications, setDiagramClarifications] = useState<
        Partial<Record<FypDiagramKind, { question: string; answers: Array<{ question: string; answer: string }> }>>
    >({});
    const [diagramClarifyInput, setDiagramClarifyInput] = useState("");
    const [diagramSpecError, setDiagramSpecError] = useState<string | null>(null);
    const [isDiagramWorking, setIsDiagramWorking] = useState(false);
    const [isEditingDiagramSpec, setIsEditingDiagramSpec] = useState(false);
    const [diagramSpecDraft, setDiagramSpecDraft] = useState<DiagramSpec | null>(null);
    const [diagramRenderKey, setDiagramRenderKey] = useState(0);
    const [diagramRenderExport, setDiagramRenderExport] = useState<{
        kind: FypDiagramKind;
        pngDataUrl: string | null;
        svg: string;
    } | null>(null);
    const [diagramNotice, setDiagramNotice] = useState<string | null>(null);
    const diagramUploadInputRef = useRef<HTMLInputElement>(null);
    const diagramReplaceInputRef = useRef<HTMLInputElement>(null);
    const [isStructureSidebarOpen, setIsStructureSidebarOpen] = useState(false);
    const [contentMap, setContentMap] = useState<Record<string, string>>({});
    const [coverMeta, setCoverMeta] = useState<CoverMeta>(defaultCoverMeta);
    const [showCoverMeta, setShowCoverMeta] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [loadStatus, setLoadStatus] = useState("Opening your project…");
    const [isSaving, setIsSaving] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatingFormat, setGeneratingFormat] = useState<"docx" | "pdf" | null>(null);
    const [generateStatus, setGenerateStatus] = useState("Preparing your report…");
    const [generatePhase, setGeneratePhase] = useState<"working" | "success" | "error">("working");
    const [generateError, setGenerateError] = useState<string | null>(null);
    const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
    const [pendingFocusId, setPendingFocusId] = useState<string | null>(null);
    const [selectedTableCells, setSelectedTableCells] = useState<TableCellRef[]>([]);
    const [tableSelectionAnchor, setTableSelectionAnchor] = useState<TableCellRef | null>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const replaceFigureInputRef = useRef<HTMLInputElement>(null);
    const [replacingFigureId, setReplacingFigureId] = useState<string | null>(null);
    const [references, setReferences] = useState<ReferenceEntry[]>([]);
    const [showReferences, setShowReferences] = useState(false);
    const [referenceDraft, setReferenceDraft] = useState<ReferenceEntry | null>(null);
    /** Caret in the last focused paragraph, so citations insert where the user was typing. */
    const paragraphCaretRef = useRef<{ blockId: string; start: number; end: number } | null>(null);

    // --- 1. Load Data: critical lite path → interactive, then background full hydrate ---
    useEffect(() => {
        if (!id) return;

        const controller = new AbortController();
        let active = true;
        let idleTimer: ReturnType<typeof setTimeout> | null = null;
        let idleHandle: number | null = null;

        const applyCoreProjectData = (data: Record<string, unknown>) => {
            const numbered = renumberStructure(
                (Array.isArray(data.structure) ? data.structure : []) as StructureItem[]
            );
            setChapters(numbered);
            setContentMap(
                data.contentMap && typeof data.contentMap === "object"
                    ? (data.contentMap as Record<string, string>)
                    : {}
            );
            const logo = data.universityLogo as
                | { dataUrl?: string; fileName?: string; mimeType?: string }
                | undefined;
            setCoverMeta({
                ...defaultCoverMeta(),
                projectTitle: String(data.projectTitle || data.title || ""),
                projectAdvisor: String(data.projectAdvisor || ""),
                ...(() => {
                    const parsed = parseSubmissionMonthYear(
                        typeof data.submissionMonthYear === "string"
                            ? data.submissionMonthYear
                            : undefined
                    );
                    return { submissionMonth: parsed.month, submissionYear: parsed.year };
                })(),
                internalExaminer: String(data.internalExaminer || ""),
                internalExaminerDesignation: String(data.internalExaminerDesignation || ""),
                externalExaminer: String(data.externalExaminer || ""),
                externalExaminerDesignation: String(data.externalExaminerDesignation || ""),
                externalExaminerOrganization: String(data.externalExaminerOrganization || ""),
                headOfDepartment: String(data.headOfDepartment || ""),
                teamMembers:
                    Array.isArray(data.teamMembers) && data.teamMembers.length > 0
                        ? data.teamMembers.slice(0, 4).map((m: TeamMember) => ({
                              name: m.name || "",
                              enrollment: m.enrollment || "",
                              seatNumber: m.seatNumber || "",
                          }))
                        : [emptyTeamMember()],
                universityLogo: logo?.dataUrl
                    ? {
                          dataUrl: logo.dataUrl,
                          fileName: logo.fileName || "logo",
                          mimeType: logo.mimeType || "image/png",
                      }
                    : null,
            });
            if (numbered.length > 0) {
                setActiveItem((prev) => {
                    if (prev.id && findStructureItem(numbered, prev.id)) {
                        return prev;
                    }
                    return {
                        id: numbered[0].id,
                        title: formatHeadingLabel(numbered[0]),
                    };
                });
            }
        };

        const applyDeferredProjectData = (data: Record<string, unknown>) => {
            setReferences(normalizeReferences(data.references));
            const loadedProfile = normalizeAiProfile(data.aiProfile);
            setAiProfile(loadedProfile);
            setAiProfileDraft(loadedProfile);
            setIsEditingAiProfile(false);
            setDiagramSpecs(normalizePersistedDiagramSpecs(data.diagramSpecs));
            // Restore figure/logo binaries + any structure edits from server.
            applyCoreProjectData(data);
        };

        const hydrateFullInBackground = () => {
            void (async () => {
                try {
                    const fullRes = await fetch(`/api/projects/${id}`, {
                        signal: controller.signal,
                    });
                    if (!fullRes.ok || !active) return;
                    const fullData = await fullRes.json();
                    if (!active) return;
                    applyDeferredProjectData(fullData);
                } catch (err) {
                    if (err instanceof DOMException && err.name === "AbortError") return;
                    if (err instanceof Error && err.name === "AbortError") return;
                    console.error("Background project hydrate failed:", err);
                }
            })();
        };

        const scheduleBackgroundHydrate = () => {
            const run = () => {
                if (!active) return;
                hydrateFullInBackground();
            };
            if (typeof window !== "undefined" && "requestIdleCallback" in window) {
                idleHandle = window.requestIdleCallback(run, { timeout: 2500 });
            } else {
                idleTimer = setTimeout(run, 0);
            }
        };

        const fetchData = async () => {
            setIsLoading(true);
            setLoadStatus("Opening your project…");
            try {
                setLoadStatus("Loading report structure…");
                const liteRes = await fetch(`/api/projects/${id}?lite=1`, {
                    signal: controller.signal,
                });
                if (!liteRes.ok) throw new Error("Failed to fetch");
                setLoadStatus("Preparing editor…");
                const liteData = await liteRes.json();
                if (!active) return;
                applyCoreProjectData(liteData);
                setLoadStatus("Almost ready…");
                // Open desktop sidebars only after core data is ready (avoid blocking first paint).
                if (typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches) {
                    setIsStructureSidebarOpen(true);
                    setIsAiSidebarOpen(true);
                }
                setIsLoading(false);
                // Media / refs / AI / diagrams — do not block interactivity.
                scheduleBackgroundHydrate();
            } catch (err) {
                if (err instanceof DOMException && err.name === "AbortError") return;
                if (err instanceof Error && err.name === "AbortError") return;
                console.error("Error loading project:", err);
                if (active) {
                    setLoadStatus("Could not load project");
                    setIsLoading(false);
                }
            }
        };

        void fetchData();
        return () => {
            active = false;
            controller.abort();
            if (idleTimer) clearTimeout(idleTimer);
            if (idleHandle != null && typeof window !== "undefined" && "cancelIdleCallback" in window) {
                window.cancelIdleCallback(idleHandle);
            }
        };
    }, [id]);

    // Desktop sidebar defaults are applied after lite load (see fetch effect above).

    useEffect(() => {
        const item = findStructureItem(chapters, activeItem.id);
        const blocks = item ? ensureContentBlocks(item, contentMap) : [];
        setActiveBlockId(blocks[0]?.id ?? null);
        setSelectedTableCells([]);
        setTableSelectionAnchor(null);
        // Reset short-lived AI clarification state when switching sections.
        setAiClarificationQuestion(null);
        setAiClarificationAnswers([]);
        setAiInsertNotice(null);
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
    const persistProject = async (overrides?: {
        diagramSpecs?: Partial<Record<FypDiagramKind, DiagramSpec>>;
    }) => {
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
                references,
                aiProfile,
                diagramSpecs: overrides?.diagramSpecs ?? diagramSpecs,
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

    const beginEditAiProfile = () => {
        const draft = normalizeAiProfile(aiProfile);
        if (!draft.projectTitle.trim() && coverMeta.projectTitle.trim()) {
            draft.projectTitle = coverMeta.projectTitle.trim();
        }
        setAiProfileDraft(draft);
        setIsEditingAiProfile(true);
        setIsProjectContextOpen(true);
        setAiError(null);
    };

    const cancelEditAiProfile = () => {
        setAiProfileDraft(normalizeAiProfile(aiProfile));
        setIsEditingAiProfile(false);
    };

    const handleSaveAiProfile = async () => {
        const next = normalizeAiProfile(aiProfileDraft);
        setIsSavingAiProfile(true);
        setAiError(null);
        try {
            const response = await fetch(`/api/projects/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ aiProfile: next }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(
                    typeof data.error === "string" ? data.error : "Failed to save Project AI Profile"
                );
            }
            // Prefer server-normalized profile when present.
            const saved = normalizeAiProfile(data?.data?.aiProfile ?? next);
            setAiProfile(saved);
            setAiProfileDraft(saved);
            setIsEditingAiProfile(false);
        } catch (err) {
            console.error("AI profile save failed", err);
            setAiError(err instanceof Error ? err.message : "Failed to save Project AI Profile");
        } finally {
            setIsSavingAiProfile(false);
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

    const handleGenerate = async (format: "docx" | "pdf" = "docx") => {
        if (isGenerating) return;

        flushSync(() => {
            setIsGenerating(true);
            setGeneratingFormat(format);
            setGeneratePhase("working");
            setGenerateError(null);
            setGenerateStatus("Preparing your report…");
        });

        let convertTimer: ReturnType<typeof setTimeout> | null = null;
        let finalizeHintTimer: ReturnType<typeof setTimeout> | null = null;

        try {
            await persistProject();
            setGenerateStatus("Building Word document…");

            // Soft stage for Word COM PDF export — no real backend progress available.
            if (format === "pdf") {
                convertTimer = setTimeout(() => {
                    setGenerateStatus("Converting to PDF…");
                }, 4500);
                finalizeHintTimer = setTimeout(() => {
                    setGenerateStatus((prev) =>
                        prev === "Converting to PDF…" ? "Finalizing your report…" : prev
                    );
                }, 14000);
            }

            const response = await fetch(`/api/projects/${id}/generate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ format }),
            });

            if (convertTimer) clearTimeout(convertTimer);
            if (finalizeHintTimer) clearTimeout(finalizeHintTimer);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(
                    typeof errorData.error === "string"
                        ? errorData.error
                        : format === "pdf"
                          ? "Failed to generate PDF"
                          : "Failed to generate DOCX"
                );
            }

            setGenerateStatus("Finalizing your report…");
            const blob = await response.blob();
            const downloadUrl = URL.createObjectURL(blob);
            const link = document.createElement("a");
            const header = response.headers.get("Content-Disposition") || "";
            const match = header.match(/filename="([^"]+)"/);
            link.href = downloadUrl;
            link.download =
                match?.[1] || (format === "pdf" ? "FYP_Report.pdf" : "FYP_Report.docx");
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(downloadUrl);

            setGenerateStatus(format === "pdf" ? "PDF is ready!" : "DOCX is ready!");
            setGeneratePhase("success");
            await new Promise((resolve) => setTimeout(resolve, 900));
            setIsGenerating(false);
            setGeneratingFormat(null);
        } catch (err) {
            if (convertTimer) clearTimeout(convertTimer);
            if (finalizeHintTimer) clearTimeout(finalizeHintTimer);
            console.error("Generate failed", err);
            const message =
                err instanceof Error ? err.message : "Failed to generate report";
            setGenerateError(message);
            setGenerateStatus(
                format === "pdf" ? "PDF generation failed" : "DOCX generation failed"
            );
            setGeneratePhase("error");
            setIsGenerating(false);
        }
    };

    const dismissGenerateOverlay = () => {
        setGeneratingFormat(null);
        setGeneratePhase("working");
        setGenerateError(null);
    };

    /** Phase P0: request a draft for the active section; do not insert into the report yet. */
    const handleAiGenerate = async () => {
        if (!id || !activeItem.id) {
            setAiError("Select a report section first.");
            return;
        }
        const typed = aiMessage.trim();
        if (aiClarificationQuestion && !typed) {
            setAiError("Please answer the clarification question first.");
            return;
        }
        setIsAiGenerating(true);
        setAiError(null);
        setAiInsertNotice(null);
        try {
            let nextAnswers = aiClarificationAnswers;
            let forceGenerate = false;
            let instruction: string | undefined = typed || undefined;

            // If a clarification question is pending and the user typed a reply, record it.
            if (aiClarificationQuestion && typed) {
                nextAnswers = [
                    ...aiClarificationAnswers,
                    { question: aiClarificationQuestion, answer: typed },
                ];
                setAiClarificationAnswers(nextAnswers);
                setAiClarificationQuestion(null);
                setAiMessage("");
                forceGenerate = true;
                instruction = undefined;
            }

            // Persist latest content so the API reads current section text from Mongo.
            await persistProject();
            const response = await fetch(`/api/projects/${id}/ai`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "generate",
                    sectionId: activeItem.id,
                    message: instruction,
                    clarificationAnswers: nextAnswers,
                    forceGenerate,
                }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data.error || "Failed to generate AI draft");
            }

            if (data.needs_clarification && typeof data.question === "string" && data.question.trim()) {
                setAiClarificationQuestion(data.question.trim());
                setAiDraft("");
                setAiDraftSectionId(null);
                setAiInsertNotice(null);
                return;
            }

            const draft = typeof data.draft === "string" ? data.draft : "";
            if (data.needsProfile) {
                setAiClarificationQuestion(null);
                setAiDraft(draft || EMPTY_AI_PROFILE_MESSAGE);
                setAiDraftSectionId(activeItem.id);
                setAiInsertNotice(null);
                return;
            }
            // Allow the empty-profile guidance message through; reject other unusable drafts.
            if (!isUsableAiDraft(draft, EMPTY_AI_PROFILE_MESSAGE)) {
                throw new Error("AI returned an unusable draft. Please try again.");
            }

            setAiClarificationQuestion(null);
            setAiDraft(draft);
            setAiDraftSectionId(activeItem.id);
            setAiInsertNotice(null);
            if (instruction) setAiMessage("");
        } catch (err) {
            console.error("AI generate failed", err);
            setAiDraft("");
            setAiDraftSectionId(null);
            setAiError(err instanceof Error ? err.message : "Failed to generate AI draft");
        } finally {
            setIsAiGenerating(false);
        }
    };

    /** Improve / grammar / tone / refine: prefer current draft, else active section paragraphs. */
    const handleAiImprove = async (
        mode: AiRefineMode = "improve",
        instructionOverride?: string
    ) => {
        if (!id || !activeItem.id) {
            setAiError("Select a report section first.");
            return;
        }
        if (aiClarificationQuestion) {
            setAiError("Finish the clarification answer before refining content.");
            return;
        }

        const activeItemForImprove = findStructureItem(chapters, activeItem.id);
        const sectionBlocks = activeItemForImprove
            ? ensureContentBlocks(activeItemForImprove, contentMap)
            : [];
        const sectionParagraphs = getSectionParagraphText(sectionBlocks);
        const draftForSameSection =
            aiDraft.trim() &&
            (aiDraftSectionId === activeItem.id || !aiDraftSectionId)
                ? aiDraft.trim()
                : "";
        const sourceText = draftForSameSection || sectionParagraphs;

        if (!sourceText) {
            setAiError(
                "Generate a draft first, or add paragraph text in the selected section, then refine."
            );
            return;
        }

        const instruction =
            instructionOverride !== undefined
                ? instructionOverride.trim()
                : aiMessage.trim();

        setIsAiGenerating(true);
        setAiError(null);
        setAiInsertNotice(null);
        try {
            await persistProject();
            const response = await fetch(`/api/projects/${id}/ai`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "improve",
                    mode,
                    sectionId: activeItem.id,
                    sourceText,
                    message: instruction || undefined,
                }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data.error || "Failed to refine content");
            }
            const draft = typeof data.draft === "string" ? data.draft : "";
            if (data.needsProfile) {
                setAiDraft(draft || EMPTY_AI_PROFILE_MESSAGE);
                setAiDraftSectionId(activeItem.id);
                setAiInsertNotice(null);
                return;
            }
            if (!isUsableAiDraft(draft, EMPTY_AI_PROFILE_MESSAGE)) {
                throw new Error("AI returned an unusable draft. Please try again.");
            }
            setAiDraft(draft);
            setAiDraftSectionId(activeItem.id);
            setAiInsertNotice(null);
            if (instructionOverride === undefined && aiMessage.trim()) setAiMessage("");
        } catch (err) {
            console.error("AI improve failed", err);
            setAiError(err instanceof Error ? err.message : "Failed to refine content");
        } finally {
            setIsAiGenerating(false);
        }
    };

    /** Append draft preview into the target section without overwriting existing content. */
    const handleAiInsert = () => {
        const draft = aiDraft.trim();
        if (!draft) {
            setAiError("No draft to insert. Generate content first.");
            return;
        }
        if (draft === EMPTY_AI_PROFILE_MESSAGE || !isUsableAiDraft(draft, EMPTY_AI_PROFILE_MESSAGE)) {
            setAiError(
                draft === EMPTY_AI_PROFILE_MESSAGE
                    ? "Complete your Project AI Profile before inserting content."
                    : "Draft is not valid to insert. Generate again."
            );
            return;
        }
        if (aiClarificationQuestion) {
            setAiError("Answer the clarification question before inserting.");
            return;
        }

        const sectionId = aiDraftSectionId;
        if (!sectionId) {
            setAiError("Draft has no target section. Generate again for the selected heading.");
            return;
        }
        const item = findStructureItem(chapters, sectionId);
        if (!item) {
            setAiError("Target section not found.");
            return;
        }

        const currentBlocks = ensureContentBlocks(item, contentMap);
        const nextBlocks = appendAiDraftToBlocks(currentBlocks, draft);
        const { item: nextItem, contentText } = applyBlocksToItem(item, nextBlocks);

        setChapters((prev) => updateStructureItem(prev, sectionId, () => nextItem));
        setContentMap((prev) => ({ ...prev, [sectionId]: contentText }));

        const inserted = nextBlocks.find(
            (block) =>
                block.type === "paragraph" &&
                draft.split(/\n{2,}/).some((part) => part.trim() && block.text.includes(part.trim().slice(0, 40)))
        );
        if (inserted) {
            setActiveBlockId(inserted.id);
            setPendingFocusId(inserted.id);
        }

        setActiveItem({ id: sectionId, title: formatHeadingLabel(nextItem) });
        setAiError(null);
        setAiInsertNotice(
            `Appended into ${formatHeadingLabel(nextItem)}. Existing paragraphs, lists, tables, and figures were kept.`
        );
    };

    /**
     * Replace paragraph text in the draft's target section only.
     * Lists, tables, and figures are preserved. Explicit user action — never silent.
     */
    const handleAiReplace = () => {
        const draft = aiDraft.trim();
        if (!draft) {
            setAiError("No draft to apply. Generate or refine content first.");
            return;
        }
        if (draft === EMPTY_AI_PROFILE_MESSAGE || !isUsableAiDraft(draft, EMPTY_AI_PROFILE_MESSAGE)) {
            setAiError(
                draft === EMPTY_AI_PROFILE_MESSAGE
                    ? "Complete your Project AI Profile before replacing content."
                    : "Draft is not valid to apply. Generate again."
            );
            return;
        }
        if (aiClarificationQuestion) {
            setAiError("Answer the clarification question before replacing.");
            return;
        }

        const sectionId = aiDraftSectionId;
        if (!sectionId) {
            setAiError("Draft has no target section. Generate again for the selected heading.");
            return;
        }
        const item = findStructureItem(chapters, sectionId);
        if (!item) {
            setAiError("Target section not found.");
            return;
        }

        const currentBlocks = ensureContentBlocks(item, contentMap);
        const nextBlocks = replaceParagraphBlocksWithAiDraft(currentBlocks, draft);
        const { item: nextItem, contentText } = applyBlocksToItem(item, nextBlocks);

        setChapters((prev) => updateStructureItem(prev, sectionId, () => nextItem));
        setContentMap((prev) => ({ ...prev, [sectionId]: contentText }));

        const firstPara = nextBlocks.find((block) => block.type === "paragraph");
        if (firstPara) {
            setActiveBlockId(firstPara.id);
            setPendingFocusId(firstPara.id);
        }

        setActiveItem({ id: sectionId, title: formatHeadingLabel(nextItem) });
        setAiError(null);
        setAiInsertNotice(
            `Replaced paragraphs in ${formatHeadingLabel(nextItem)}. Lists, tables, and figures were preserved.`
        );
    };

    const handleAiCancelDraft = () => {
        setAiDraft("");
        setAiDraftSectionId(null);
        setAiInsertNotice(null);
        setAiError(null);
        setAiClarificationQuestion(null);
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
    const aiProfileComplete = !isAiProfileEmpty(aiProfile);
    const aiProfileSummaryTitle =
        aiProfile.projectTitle.trim() ||
        coverMeta.projectTitle.trim() ||
        "Untitled project";
    const canRunAiRefine =
        Boolean(activeItem.id) &&
        !isAiGenerating &&
        !isSaving &&
        !isSavingAiProfile &&
        !aiClarificationQuestion &&
        Boolean(
            (aiDraft.trim() &&
                (aiDraftSectionId === activeItem.id || !aiDraftSectionId)) ||
                sectionHasParagraphContent(activeBlocks)
        );
    const aiDraftTargetLabel = aiDraftSectionId
        ? (() => {
              const target = findStructureItem(chapters, aiDraftSectionId);
              return target ? formatHeadingLabel(target) : "Section";
          })()
        : null;

    const fypDiagramRows = FYP_DIAGRAM_CATALOG.map((entry) => {
        const section = findFypDiagramSection(chapters, entry);
        const figures = getSectionFiguresWithImage(section, contentMap);
        const localPreview = diagramPreviews[entry.kind];
        const hasSpec = Boolean(diagramSpecs[entry.kind]);
        const needsDetails = Boolean(diagramClarifications[entry.kind]?.question);
        const status = resolveFypDiagramStatus({
            inReportFigureCount: figures.length,
            hasLocalPreview: Boolean(localPreview?.dataUrl) || hasSpec,
            needsDetails,
        });
        return { entry, section, figures, localPreview, status, hasSpec };
    });
    const fypDiagramsReadyCount = countReadyFypDiagrams(fypDiagramRows.map((row) => row.status));
    const selectedDiagramRow =
        selectedDiagramKind != null
            ? fypDiagramRows.find((row) => row.entry.kind === selectedDiagramKind) || null
            : null;
    const selectedDiagramDisplay =
        selectedDiagramRow?.localPreview?.dataUrl ||
        selectedDiagramRow?.figures[0]?.dataUrl ||
        null;
    const selectedDiagramFileName =
        selectedDiagramRow?.localPreview?.fileName ||
        selectedDiagramRow?.figures[0]?.fileName ||
        "diagram.png";

    const commitBlocksToSection = (sectionId: string, blocks: ContentBlock[]) => {
        const item = findStructureItem(chapters, sectionId);
        if (!item) {
            setAiError("Diagram target section not found in this report.");
            return null;
        }
        const { item: nextItem, contentText } = applyBlocksToItem(item, blocks);
        setChapters((prev) => updateStructureItem(prev, sectionId, () => nextItem));
        setContentMap((prev) => ({ ...prev, [sectionId]: contentText }));
        setActiveItem({ id: sectionId, title: formatHeadingLabel(nextItem) });
        return nextItem;
    };

    const resolveSelectedDiagramImage = () => {
        if (!selectedDiagramKind || !selectedDiagramRow) return null;
        const rendered =
            diagramRenderExport?.kind === selectedDiagramKind ? diagramRenderExport : null;
        return resolveDiagramInsertImage({
            kind: selectedDiagramKind,
            renderedPngDataUrl: rendered?.pngDataUrl || null,
            renderedSvg: rendered?.svg || null,
            uploadPreview: selectedDiagramRow.localPreview || null,
        });
    };

    const handleDiagramUploadFile = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file || !selectedDiagramKind) return;
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = typeof reader.result === "string" ? reader.result : "";
            if (!dataUrl) return;
            setDiagramPreviews((prev) => ({
                ...prev,
                [selectedDiagramKind]: {
                    dataUrl,
                    fileName: file.name,
                    mimeType: file.type || "image/png",
                },
            }));
            setDiagramRenderExport(null);
            setAiError(null);
            setDiagramNotice(null);
            setDiagramSpecError(null);
        };
        reader.readAsDataURL(file);
    };

    const handleDiagramInsert = () => {
        if (!selectedDiagramRow) return;
        const section = selectedDiagramRow.section;
        if (!section) {
            setDiagramSpecError(
                `Section ${selectedDiagramRow.entry.sectionId} not found. Re-open or recreate the project.`
            );
            return;
        }
        const image = resolveSelectedDiagramImage();
        if (!image) {
            setDiagramSpecError(
                "Render or upload a diagram image before inserting into the report."
            );
            return;
        }
        const currentBlocks = ensureContentBlocks(section, contentMap);
        const existingFigure = selectedDiagramRow.figures[0];
        const applied = applyDiagramFigureToBlocks({
            blocks: currentBlocks,
            image,
            defaultCaption: selectedDiagramRow.entry.defaultCaption,
            existingFigureId: existingFigure?.id || null,
        });
        commitBlocksToSection(section.id, applied.blocks);
        setDiagramPreviews((prev) => {
            const next = { ...prev };
            delete next[selectedDiagramRow.entry.kind];
            return next;
        });
        setAiError(null);
        setDiagramSpecError(null);
        setDiagramNotice(
            applied.mode === "replace"
                ? `Replaced ${selectedDiagramRow.entry.label} in ${formatHeadingLabel(section)}.`
                : `Inserted ${selectedDiagramRow.entry.label} into ${formatHeadingLabel(section)}.`
        );
    };

    const handleDiagramReplaceFigure = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file || !selectedDiagramRow?.section) return;
        const targetFigure = selectedDiagramRow.figures[0];
        if (!targetFigure) {
            setDiagramSpecError("No figure in this section to replace. Insert first.");
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = typeof reader.result === "string" ? reader.result : "";
            if (!dataUrl) return;
            const section = selectedDiagramRow.section!;
            const applied = applyDiagramFigureToBlocks({
                blocks: ensureContentBlocks(section, contentMap),
                image: {
                    dataUrl,
                    fileName: file.name,
                    mimeType: file.type || "image/png",
                },
                defaultCaption: selectedDiagramRow.entry.defaultCaption,
                existingFigureId: targetFigure.id,
            });
            commitBlocksToSection(section.id, applied.blocks);
            setDiagramPreviews((prev) => {
                const next = { ...prev };
                delete next[selectedDiagramRow.entry.kind];
                return next;
            });
            setAiError(null);
            setDiagramSpecError(null);
            setDiagramNotice(`Replaced figure in ${selectedDiagramRow.entry.label}.`);
        };
        reader.readAsDataURL(file);
    };

    const handleDiagramDelete = () => {
        if (!selectedDiagramRow?.section) return;
        const targetFigure = selectedDiagramRow.figures[0];
        const section = selectedDiagramRow.section;
        if (targetFigure) {
            const blocks = ensureContentBlocks(section, contentMap).filter(
                (block) => !(block.type === "figure" && block.id === targetFigure.id)
            );
            const next =
                blocks.length > 0
                    ? blocks
                    : [{ id: newId("p"), type: "paragraph" as const, text: "" }];
            commitBlocksToSection(section.id, next);
        }
        setDiagramPreviews((prev) => {
            const next = { ...prev };
            delete next[selectedDiagramRow.entry.kind];
            return next;
        });
        setAiError(null);
        setDiagramSpecError(null);
        setDiagramNotice(
            targetFigure
                ? `Deleted ${selectedDiagramRow.entry.label} figure from the report.`
                : "Cleared diagram preview."
        );
    };

    const handleDiagramDownload = () => {
        const kind = selectedDiagramKind;
        const rendered =
            kind && diagramRenderExport?.kind === kind ? diagramRenderExport : null;
        const dataUrl =
            rendered?.pngDataUrl ||
            selectedDiagramRow?.localPreview?.dataUrl ||
            selectedDiagramRow?.figures[0]?.dataUrl ||
            null;
        if (!dataUrl && rendered?.svg) {
            const blob = new Blob([rendered.svg], { type: "image/svg+xml;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `${selectedDiagramRow?.entry.kind || "diagram"}.svg`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
            return;
        }
        if (!dataUrl) {
            setAiError("Nothing to download yet. Generate a spec or upload an image first.");
            return;
        }
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download =
            rendered?.pngDataUrl
                ? `${selectedDiagramRow?.entry.kind || "diagram"}.png`
                : selectedDiagramFileName || "diagram.png";
        document.body.appendChild(link);
        link.click();
        link.remove();
    };

    const handleDiagramRegeneratePreview = () => {
        if (!selectedDiagramKind || !diagramSpecs[selectedDiagramKind]) {
            setDiagramSpecError("Generate or edit a valid specification first.");
            return;
        }
        const validated = validateDiagramSpec(
            selectedDiagramKind,
            diagramSpecs[selectedDiagramKind]!
        );
        if (!validated.ok) {
            setDiagramSpecError(validated.error);
            return;
        }
        setDiagramSpecError(null);
        setDiagramRenderKey((k) => k + 1);
    };

    const handleDiagramGenerate = async (opts?: { force?: boolean }) => {
        if (!id || !selectedDiagramKind || !selectedDiagramRow) {
            setAiError("Select a diagram first.");
            return;
        }
        const kind = selectedDiagramKind;
        const pending = diagramClarifications[kind];
        if (pending?.question && !diagramClarifyInput.trim() && !opts?.force) {
            setDiagramSpecError("Answer the clarification question first.");
            return;
        }

        setIsDiagramWorking(true);
        setDiagramSpecError(null);
        setAiError(null);
        try {
            let answers = pending?.answers || [];
            let forceGenerate = Boolean(opts?.force);
            if (pending?.question && diagramClarifyInput.trim()) {
                answers = [
                    ...answers,
                    { question: pending.question, answer: diagramClarifyInput.trim() },
                ];
                forceGenerate = true;
                setDiagramClarifyInput("");
            }

            await persistProject();
            const response = await fetch(`/api/projects/${id}/diagrams`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "generate",
                    kind,
                    clarificationAnswers: answers,
                    forceGenerate,
                }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(
                    typeof data.error === "string" ? data.error : "Failed to generate diagram spec"
                );
            }
            if (data.needsProfile) {
                setDiagramSpecError(
                    typeof data.error === "string"
                        ? data.error
                        : "Complete your Project AI Profile first."
                );
                return;
            }
            if (data.needs_clarification && typeof data.question === "string" && data.question.trim()) {
                setDiagramClarifications((prev) => ({
                    ...prev,
                    [kind]: { question: data.question.trim(), answers },
                }));
                setDiagramSpecs((prev) => {
                    const next = { ...prev };
                    delete next[kind];
                    return next;
                });
                setIsEditingDiagramSpec(false);
                setDiagramSpecDraft(null);
                return;
            }

            if (!data.spec) {
                throw new Error("AI returned no diagram specification.");
            }
            const validated = validateDiagramSpec(kind, data.spec);
            if (!validated.ok) {
                setDiagramSpecError(validated.error);
                return;
            }
            const nextSpecs = { ...diagramSpecs, [kind]: validated.spec };
            setDiagramSpecs(nextSpecs);
            setDiagramClarifications((prev) => {
                const next = { ...prev };
                delete next[kind];
                return next;
            });
            setIsEditingDiagramSpec(false);
            setDiagramSpecDraft(null);
            setDiagramRenderKey((k) => k + 1);
            setDiagramNotice(`${selectedDiagramRow.entry.label} specification ready.`);
            try {
                await persistProject({ diagramSpecs: nextSpecs });
            } catch (persistErr) {
                console.error("Failed to persist diagram spec", persistErr);
                setDiagramSpecError(
                    "Specification generated but could not be saved. Use Save to persist the project."
                );
            }
        } catch (err) {
            console.error("Diagram generate failed", err);
            setDiagramSpecError(err instanceof Error ? err.message : "Failed to generate diagram spec");
        } finally {
            setIsDiagramWorking(false);
        }
    };

    const beginEditDiagramSpec = () => {
        if (!selectedDiagramKind) return;
        const existing = diagramSpecs[selectedDiagramKind];
        setDiagramSpecDraft(existing ? structuredClone(existing) : emptyDiagramSpec(selectedDiagramKind));
        setIsEditingDiagramSpec(true);
        setDiagramSpecError(null);
        setDiagramNotice(null);
    };

    const saveEditedDiagramSpec = async () => {
        if (!selectedDiagramKind || !diagramSpecDraft) return;
        const validated = validateDiagramSpec(selectedDiagramKind, diagramSpecDraft);
        if (!validated.ok) {
            setDiagramSpecError(validated.error);
            return;
        }
        const nextSpecs = { ...diagramSpecs, [selectedDiagramKind]: validated.spec };
        setDiagramSpecs(nextSpecs);
        setIsEditingDiagramSpec(false);
        setDiagramSpecDraft(null);
        setDiagramSpecError(null);
        setDiagramRenderKey((k) => k + 1);
        setDiagramClarifications((prev) => {
            const next = { ...prev };
            delete next[selectedDiagramKind];
            return next;
        });
        setDiagramNotice("Specification updated — preview refreshed.");
        try {
            await persistProject({ diagramSpecs: nextSpecs });
        } catch (persistErr) {
            console.error("Failed to persist edited diagram spec", persistErr);
            setDiagramSpecError(
                "Specification updated locally but could not be saved. Use Save to persist the project."
            );
        }
    };

    const openDiagramRow = (kind: FypDiagramKind) => {
        setSelectedDiagramKind(kind);
        setIsFypDiagramsOpen(true);
        setAiError(null);
        setDiagramSpecError(null);
        setDiagramClarifyInput("");
        setIsEditingDiagramSpec(false);
        setDiagramSpecDraft(null);
        setDiagramRenderExport(null);
        setDiagramNotice(null);
    };

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

    // --- References + citations ---
    const citationNumbers = buildCitationNumbers(chapters, contentMap, references);

    const saveReferenceDraft = () => {
        if (!referenceDraft) return;
        if (!referenceDraft.title.trim() && !referenceDraft.authors.trim()) {
            alert("Add at least a title or an author before saving the reference.");
            return;
        }
        setReferences((current) =>
            current.some((entry) => entry.id === referenceDraft.id)
                ? current.map((entry) => (entry.id === referenceDraft.id ? referenceDraft : entry))
                : [...current, referenceDraft]
        );
        setReferenceDraft(null);
    };

    const deleteReference = (reference: ReferenceEntry) => {
        const uses = countCitations(chapters, contentMap, reference.id);
        if (uses > 0) {
            const label = uses === 1 ? "1 place" : `${uses} places`;
            const confirmed = window.confirm(
                `"${reference.title || "This reference"}" is cited in ${label}.\n\n` +
                    "Deleting it will remove those citations from the report and renumber the rest. Continue?"
            );
            if (!confirmed) return;
        }
        setReferences((current) => current.filter((entry) => entry.id !== reference.id));
        if (uses > 0) removeCitationTokens(reference.id);
        if (referenceDraft?.id === reference.id) setReferenceDraft(null);
    };

    /** Strip a deleted reference's tokens from every block in every section. */
    const removeCitationTokens = (referenceId: string) => {
        const token = citationToken(referenceId);
        const strip = (text: string) => text.split(token).join("");
        const walk = (items: StructureItem[]): StructureItem[] =>
            items.map((item) => ({
                ...item,
                blocks: item.blocks?.map((block) => {
                    if (block.type === "paragraph") return { ...block, text: strip(block.text) };
                    if (block.type === "list") {
                        return {
                            ...block,
                            items: block.items.map((entry) => ({ ...entry, text: strip(entry.text) })),
                        };
                    }
                    if (block.type === "figure") return { ...block, caption: strip(block.caption) };
                    if (block.type === "table") {
                        return {
                            ...block,
                            caption: strip(block.caption),
                            columns: block.columns.map((cell) =>
                                typeof cell === "string" ? strip(cell) : { ...cell, text: strip(cell.text) }
                            ),
                            data: block.data.map((row) =>
                                row.map((cell) =>
                                    typeof cell === "string" ? strip(cell) : { ...cell, text: strip(cell.text) }
                                )
                            ),
                        };
                    }
                    return block;
                }),
                subitems: item.subitems?.length ? walk(item.subitems) : item.subitems,
            }));

        setChapters((prev) => walk(prev));
        setContentMap((prev) => {
            const next: Record<string, string> = {};
            for (const [key, value] of Object.entries(prev)) next[key] = strip(value);
            return next;
        });
    };

    const insertCitation = (reference: ReferenceEntry) => {
        const caret = paragraphCaretRef.current;
        const target =
            (caret && activeBlocks.find((block) => block.id === caret.blockId && block.type === "paragraph")) ||
            activeBlocks.find((block) => block.id === activeBlockId && block.type === "paragraph") ||
            [...activeBlocks].reverse().find((block) => block.type === "paragraph");
        if (!target || target.type !== "paragraph") {
            alert("Select a paragraph first, then insert the citation.");
            return;
        }
        const token = citationToken(reference.id);
        const usingCaret = caret?.blockId === target.id;
        const start = usingCaret ? caret!.start : target.text.length;
        const end = usingCaret ? caret!.end : target.text.length;
        const inserted = insertCitationAt(target.text, start, end, token);
        updateBlock(target.id, (current) =>
            current.type === "paragraph" ? { ...current, text: inserted.text } : current
        );
        setActiveBlockId(target.id);
        paragraphCaretRef.current = {
            blockId: target.id,
            start: inserted.caret,
            end: inserted.caret,
        };
    };

    if (isLoading) {
        return <EditorOpeningShell status={loadStatus} />;
    }

    return (
        <div className="h-screen flex flex-col bg-[#F4F2F5] overflow-hidden">
            {generatingFormat && (
                <ReportGenerateOverlay
                    format={generatingFormat}
                    status={generateStatus}
                    phase={generatePhase}
                    errorMessage={generateError}
                    onDismiss={dismissGenerateOverlay}
                    onRetry={() => void handleGenerate(generatingFormat)}
                />
            )}
            <EditorHeader
                showCoverMeta={showCoverMeta}
                showReferences={showReferences}
                isAiSidebarOpen={isAiSidebarOpen}
                isSaving={isSaving}
                isGenerating={isGenerating || Boolean(generatingFormat)}
                generatingFormat={generatingFormat}
                onToggleCoverMeta={() => setShowCoverMeta((open) => !open)}
                onToggleReferences={() => setShowReferences((open) => !open)}
                onSave={handleSave}
                onGenerate={handleGenerate}
                onToggleAiSidebar={() => setIsAiSidebarOpen(!isAiSidebarOpen)}
            />

            <div className="flex-1 flex min-h-0 overflow-hidden">
                <StructureSidebar
                    isOpen={isStructureSidebarOpen}
                    chapters={chapters}
                    activeItem={activeItem}
                    setActiveItem={setActiveItem}
                    onToggle={setIsStructureSidebarOpen}
                    onAddSubItem={handleAddSubItem}
                    onRenameItem={handleRenameItem}
                    onDeleteItem={handleDeleteItem}
                />

                <SectionCanvas
                    coverPanel={
                        showCoverMeta ? (
                            <CoverMetaPanel
                                coverMeta={coverMeta}
                                setCoverMeta={setCoverMeta}
                                onAddTeamMember={() =>
                                    setCoverMeta((m) => ({
                                        ...m,
                                        teamMembers:
                                            m.teamMembers.length >= 4
                                                ? m.teamMembers
                                                : [...m.teamMembers, emptyTeamMember()],
                                    }))
                                }
                            />
                        ) : null
                    }
                    referencesPanel={
                        showReferences ? (
                            <ReferencesPanel
                                references={references}
                                referenceDraft={referenceDraft}
                                citationNumbers={citationNumbers}
                                setReferenceDraft={setReferenceDraft}
                                onAddReference={() => setReferenceDraft(emptyReference())}
                                onCite={insertCitation}
                                onDelete={deleteReference}
                                onSaveDraft={saveReferenceDraft}
                            />
                        ) : null
                    }
                    toolbar={
                        <ContentToolbar
                            title={activeItem.title}
                            imageInputRef={imageInputRef}
                            replaceFigureInputRef={replaceFigureInputRef}
                            onAddParagraph={addParagraphBlock}
                            onStartBulletList={() => startOrExtendList("bullet")}
                            onStartNumberList={() => startOrExtendList("number")}
                            onAddTable={addTable}
                            onAddFigureClick={() => imageInputRef.current?.click()}
                            onImageUpload={handleImageUpload}
                            onReplaceFigure={handleReplaceFigure}
                        />
                    }
                >
                    {activeBlocks.map((block) => {
                        const selected = activeBlockId === block.id;
                        if (block.type === "paragraph") {
                            return (
                                <ParagraphBlock
                                    key={block.id}
                                    block={block}
                                    selected={selected}
                                    citationNumbers={citationNumbers}
                                    paragraphCaretRef={paragraphCaretRef}
                                    onSelect={() => setActiveBlockId(block.id)}
                                    onChangeText={(text) =>
                                        updateBlock(block.id, (current) =>
                                            current.type === "paragraph"
                                                ? { ...current, text }
                                                : current
                                        )
                                    }
                                    onRemove={() => removeBlock(block.id)}
                                    onPasteTable={(table) =>
                                        insertBlockAfter(
                                            {
                                                id: table.id,
                                                type: "table",
                                                caption: table.caption,
                                                columns: table.columns,
                                                data: table.data,
                                            },
                                            block.id
                                        )
                                    }
                                />
                            );
                        }
                        if (block.type === "list") {
                            return (
                                <ListBlock
                                    key={block.id}
                                    block={block}
                                    selected={selected}
                                    onSelect={() => setActiveBlockId(block.id)}
                                    onRemove={() => removeBlock(block.id)}
                                    onItemFocus={() => setActiveBlockId(block.id)}
                                    onItemChange={(itemId, patch) =>
                                        updateListItem(block.id, itemId, patch)
                                    }
                                    onItemKeyDown={handleListItemKeyDown}
                                    onChangeLevel={(itemIndex, delta) =>
                                        changeListLevel(block.id, itemIndex, delta)
                                    }
                                    onRemoveItem={(itemId) => removeListItem(block.id, itemId)}
                                />
                            );
                        }
                        if (block.type === "table") {
                            return (
                                <TableBlock
                                    key={block.id}
                                    block={block}
                                    selected={selected}
                                    selectedTableCells={selectedTableCells}
                                    setSelectedTableCells={setSelectedTableCells}
                                    setTableSelectionAnchor={setTableSelectionAnchor}
                                    onSelect={() => setActiveBlockId(block.id)}
                                    onRemove={() => removeBlock(block.id)}
                                    onCaptionChange={(caption) =>
                                        updateTableBlock(block.id, (current) => ({
                                            ...current,
                                            caption,
                                        }))
                                    }
                                    onUpdateTable={(updater) =>
                                        updateTableBlock(block.id, updater)
                                    }
                                    onSelectCell={(ref, e) =>
                                        selectTableCell(block.id, ref, e)
                                    }
                                    onApplyFormat={(patch) =>
                                        applyFormatToSelectedCells(block, patch)
                                    }
                                    onToggleBold={() => toggleBoldSelected(block)}
                                    onSetAlign={(align) => setAlignSelected(block, align)}
                                    onMerge={() => mergeSelectedCells(block)}
                                    onUnmerge={() => unmergeSelectedCell(block)}
                                    onRemoveColumn={(colIndex) =>
                                        removeTableColumn(block, colIndex)
                                    }
                                    onRemoveRow={(rowIndex) => removeTableRow(block, rowIndex)}
                                    onAddRow={() => addTableRow(block)}
                                    onAddColumn={() => addTableColumn(block)}
                                />
                            );
                        }
                        return (
                            <FigureBlock
                                key={block.id}
                                block={block}
                                selected={selected}
                                onSelect={() => setActiveBlockId(block.id)}
                                onRemove={() => removeBlock(block.id)}
                                onReplaceClick={() => {
                                    setReplacingFigureId(block.id);
                                    replaceFigureInputRef.current?.click();
                                }}
                                onUpdate={(patch) => updateFigureBlock(block.id, patch)}
                            />
                        );
                    })}
                </SectionCanvas>

                {isAiSidebarOpen && (
                    <button
                        type="button"
                        aria-label="Close Copilot"
                        className="md:hidden fixed inset-0 z-30 bg-slate-900/30"
                        onClick={() => setIsAiSidebarOpen(false)}
                    />
                )}
                <aside className={`${isAiSidebarOpen ? "w-80 max-md:fixed max-md:inset-y-0 max-md:right-0 max-md:z-40 max-md:shadow-xl" : "w-12"} border-l border-slate-200/80 bg-white transition-all duration-300 shrink-0 overflow-hidden flex flex-col`}>
                    {isAiSidebarOpen ? (
                        <div className="w-80 h-full flex flex-col">
                            <div className="px-3 py-2.5 border-b border-slate-200/80 bg-white shrink-0">
                                <div className="flex items-center justify-between gap-2 text-[#6F155F] font-semibold text-sm">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                        <Sparkles className="h-4 w-4 shrink-0" />
                                        <span className="truncate">Academic AI Copilot</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setIsAiSidebarOpen(false)}
                                        className="p-1.5 text-slate-400 hover:text-[#6F155F] hover:bg-[#F2EBF1] rounded-md transition-colors shrink-0"
                                    >
                                        <PanelRightClose className="h-4 w-4" />
                                    </button>
                                </div>
                                <p className="mt-1 text-[10px] text-slate-500 truncate" title={activeItem.title || "Select a heading"}>
                                    Target:{" "}
                                    <span className="font-medium text-slate-700">
                                        {activeItem.title || "Select a heading"}
                                    </span>
                                </p>
                            </div>
                            <div className="flex-1 p-3 overflow-y-auto bg-[#F8F6F9] space-y-2.5">
                                <div className="rounded-lg border border-slate-200/80 bg-white overflow-hidden">
                                    <button
                                        type="button"
                                        onClick={() => setIsProjectContextOpen((open) => !open)}
                                        className="w-full flex items-start gap-2 px-2.5 py-2 text-left hover:bg-[#F2EBF1]/60 transition-colors"
                                        aria-expanded={isProjectContextOpen || isEditingAiProfile}
                                    >
                                        <div className="min-w-0 flex-1">
                                            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">
                                                Project Context
                                            </div>
                                            {!(isProjectContextOpen || isEditingAiProfile) && (
                                                <div className="mt-0.5 space-y-0.5">
                                                    <div className="text-[11px] text-slate-700 truncate font-medium">
                                                        {aiProfileSummaryTitle}
                                                    </div>
                                                    <div
                                                        className={`text-[10px] font-medium ${
                                                            aiProfileComplete ? "text-emerald-700" : "text-amber-700"
                                                        }`}
                                                    >
                                                        {aiProfileComplete
                                                            ? "Profile complete ✓"
                                                            : "Profile incomplete"}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </button>
                                    {(isProjectContextOpen || isEditingAiProfile) && (
                                        <div className="border-t border-slate-200/80 p-2.5 space-y-2 bg-[#F8F6F9]/50">
                                            <div className="flex items-center justify-between gap-2">
                                                <div
                                                    className={`text-[10px] font-medium ${
                                                        aiProfileComplete ? "text-emerald-700" : "text-amber-700"
                                                    }`}
                                                >
                                                    {aiProfileComplete
                                                        ? "Profile complete ✓"
                                                        : "Profile incomplete"}
                                                </div>
                                                {!isEditingAiProfile && (
                                                    <button
                                                        type="button"
                                                        onClick={beginEditAiProfile}
                                                        className="text-[11px] text-[#6F155F] hover:underline"
                                                    >
                                                        {isAiProfileEmpty(aiProfile) ? "Set up" : "Edit"}
                                                    </button>
                                                )}
                                            </div>
                                            {isEditingAiProfile ? (
                                                <div className="space-y-2">
                                                    {AI_PROFILE_FIELDS.map((field) => (
                                                        <label key={field.key} className="block space-y-1">
                                                            <span className="text-[11px] font-medium text-slate-600">
                                                                {field.label}
                                                            </span>
                                                            {field.rows && field.rows > 1 ? (
                                                                <textarea
                                                                    rows={field.rows}
                                                                    value={aiProfileDraft[field.key]}
                                                                    onChange={(e) =>
                                                                        setAiProfileDraft((prev) => ({
                                                                            ...prev,
                                                                            [field.key]: e.target.value,
                                                                        }))
                                                                    }
                                                                    placeholder={field.placeholder}
                                                                    className="w-full text-xs border border-slate-200 rounded-md p-2 focus:outline-none focus:ring-1 focus:ring-[#6F155F]/40 focus:border-[#6F155F]/40 resize-y min-h-[2.5rem] bg-white"
                                                                />
                                                            ) : (
                                                                <input
                                                                    type="text"
                                                                    value={aiProfileDraft[field.key]}
                                                                    onChange={(e) =>
                                                                        setAiProfileDraft((prev) => ({
                                                                            ...prev,
                                                                            [field.key]: e.target.value,
                                                                        }))
                                                                    }
                                                                    placeholder={field.placeholder}
                                                                    className="w-full text-xs border border-slate-200 rounded-md p-2 focus:outline-none focus:ring-1 focus:ring-[#6F155F]/40 focus:border-[#6F155F]/40 bg-white"
                                                                />
                                                            )}
                                                        </label>
                                                    ))}
                                                    <div className="flex gap-2 pt-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => void handleSaveAiProfile()}
                                                            disabled={isSavingAiProfile}
                                                            className="flex-1 text-xs bg-[#6F155F] text-white px-2.5 py-2 rounded-md hover:bg-[#5a114d] disabled:opacity-50"
                                                        >
                                                            {isSavingAiProfile ? "Saving…" : "Save Profile"}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={cancelEditAiProfile}
                                                            disabled={isSavingAiProfile}
                                                            className="text-xs border border-slate-200 px-2.5 py-2 rounded-md text-slate-600 hover:bg-white disabled:opacity-50 bg-white"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : isAiProfileEmpty(aiProfile) ? (
                                                <p className="text-[11px] text-slate-500 leading-relaxed">
                                                    No profile yet. Add project facts so the AI stays accurate.
                                                </p>
                                            ) : (
                                                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                                                    {AI_PROFILE_FIELDS.filter((f) => aiProfile[f.key].trim()).map((field) => (
                                                        <div key={field.key} className="text-[11px] text-slate-600">
                                                            <span className="font-medium text-slate-700">{field.label}: </span>
                                                            <span className="whitespace-pre-wrap">
                                                                {aiProfile[field.key].length > 120
                                                                    ? `${aiProfile[field.key].slice(0, 120).trim()}…`
                                                                    : aiProfile[field.key]}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="rounded-lg border border-slate-200/80 bg-white p-2 space-y-1.5">
                                    <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium px-0.5">
                                        AI Actions
                                    </div>
                                    <div className="grid grid-cols-2 gap-1">
                                        <button
                                            type="button"
                                            onClick={handleAiGenerate}
                                            disabled={isAiGenerating || isSaving || isSavingAiProfile || !activeItem.id}
                                            className="col-span-2 text-[11px] font-medium bg-[#6F155F] text-white hover:bg-[#5a114d] px-2 py-1.5 rounded-md transition-colors disabled:opacity-50"
                                        >
                                            {isAiGenerating
                                                ? aiClarificationQuestion
                                                    ? "Checking…"
                                                    : "Generating…"
                                                : aiClarificationQuestion
                                                  ? "Answer below to continue"
                                                  : "Generate"}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => void handleAiImprove("improve")}
                                            disabled={!canRunAiRefine}
                                            className="text-[11px] bg-slate-50/80 border border-slate-200 hover:border-[#6F155F]/40 hover:text-[#6F155F] hover:bg-white px-2 py-1.5 rounded-md transition-colors disabled:opacity-45"
                                            title="Improve current draft or section text"
                                        >
                                            Improve
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                void handleAiImprove(
                                                    "improve",
                                                    "Expand with more detail and depth while preserving all stated facts."
                                                )
                                            }
                                            disabled={!canRunAiRefine}
                                            className="text-[11px] bg-slate-50/80 border border-slate-200 hover:border-[#6F155F]/40 hover:text-[#6F155F] hover:bg-white px-2 py-1.5 rounded-md transition-colors disabled:opacity-45"
                                            title="Expand current draft or section text"
                                        >
                                            Expand
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => void handleAiImprove("grammar")}
                                            disabled={!canRunAiRefine}
                                            className="text-[11px] bg-slate-50/80 border border-slate-200 hover:border-[#6F155F]/40 hover:text-[#6F155F] hover:bg-white px-2 py-1.5 rounded-md transition-colors disabled:opacity-45"
                                        >
                                            Grammar
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => void handleAiImprove("tone")}
                                            disabled={!canRunAiRefine}
                                            className="text-[11px] bg-slate-50/80 border border-slate-200 hover:border-[#6F155F]/40 hover:text-[#6F155F] hover:bg-white px-2 py-1.5 rounded-md transition-colors disabled:opacity-45"
                                        >
                                            Academic Tone
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => void handleAiImprove("refine")}
                                            disabled={!canRunAiRefine}
                                            className="text-[11px] bg-slate-50/80 border border-slate-200 hover:border-[#6F155F]/40 hover:text-[#6F155F] hover:bg-white px-1.5 py-1.5 rounded-md transition-colors disabled:opacity-45"
                                        >
                                            Refine
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => void handleAiImprove("humanize")}
                                            disabled={!canRunAiRefine}
                                            title="Make writing sound natural while preserving facts and academic tone"
                                            className="text-[11px] bg-slate-50/80 border border-slate-200 hover:border-[#6F155F]/40 hover:text-[#6F155F] hover:bg-white px-1.5 py-1.5 rounded-md transition-colors disabled:opacity-45"
                                        >
                                            Humanize
                                        </button>                                    </div>
                                </div>

                                {/* FYP Diagrams — slate/teal workspace (separate from writing tools) */}
                                <div className="rounded-lg border border-teal-700/25 bg-gradient-to-b from-slate-50 to-teal-50/40 overflow-hidden">
                                    <button
                                        type="button"
                                        onClick={() => setIsFypDiagramsOpen((open) => !open)}
                                        className="w-full flex items-center justify-between gap-2 px-2.5 py-2 text-left hover:bg-teal-50/60 transition-colors"
                                        aria-expanded={isFypDiagramsOpen}
                                    >
                                        <div className="text-[11px] font-semibold text-teal-900 truncate">
                                            FYP Diagrams · {fypDiagramsReadyCount} of 5 ready
                                        </div>
                                        <span className="text-[10px] text-teal-800/60 shrink-0">
                                            {isFypDiagramsOpen ? "Hide" : "Show"}
                                        </span>
                                    </button>

                                    {isFypDiagramsOpen && (
                                        <div className="border-t border-teal-700/15 px-2 pb-2.5 pt-2 space-y-2">
                                            <div className="space-y-0.5">
                                                {fypDiagramRows.map((row) => {
                                                    const selected = selectedDiagramKind === row.entry.kind;
                                                    const statusClass =
                                                        row.status === "In report"
                                                            ? "bg-emerald-100 text-emerald-800"
                                                            : row.status === "Preview"
                                                              ? "bg-sky-100 text-sky-800"
                                                              : row.status === "Needs details"
                                                                ? "bg-amber-100 text-amber-800"
                                                                : "bg-slate-200/80 text-slate-600";
                                                    return (
                                                        <button
                                                            key={row.entry.kind}
                                                            type="button"
                                                            onClick={() => openDiagramRow(row.entry.kind)}
                                                            className={`w-full rounded-md px-2 py-1.5 flex items-center gap-2 text-left transition-colors ${
                                                                selected
                                                                    ? "bg-white border border-teal-600/35 shadow-sm"
                                                                    : "border border-transparent hover:bg-white/80"
                                                            }`}
                                                        >
                                                            <span className="min-w-0 flex-1 text-[11px] font-medium text-slate-800 truncate">
                                                                {row.entry.label}
                                                            </span>
                                                            <span
                                                                className={`shrink-0 text-[9px] font-medium px-1.5 py-0.5 rounded ${statusClass}`}
                                                            >
                                                                {row.status}
                                                            </span>
                                                        </button>
                                                    );
                                                })}
                                            </div>

                                            {selectedDiagramRow && (() => {
                                                const kind = selectedDiagramRow.entry.kind;
                                                const clarifying = Boolean(diagramClarifications[kind]?.question);
                                                const hasSpec = Boolean(diagramSpecs[kind]);
                                                const insertImage = resolveSelectedDiagramImage();
                                                const canInsert =
                                                    Boolean(insertImage?.dataUrl) && Boolean(selectedDiagramRow.section);
                                                const insertLabel =
                                                    selectedDiagramRow.figures.length > 0 ? "Replace in report" : "Insert";
                                                const hasPreviewVisual =
                                                    (hasSpec && !isEditingDiagramSpec) ||
                                                    Boolean(selectedDiagramDisplay) ||
                                                    Boolean(
                                                        diagramRenderExport?.kind === kind &&
                                                            (diagramRenderExport.pngDataUrl || diagramRenderExport.svg)
                                                    );

                                                return (
                                                    <div className="rounded-md border border-teal-700/20 bg-white p-2 space-y-2">
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div className="min-w-0">
                                                                <div className="text-[11px] font-semibold text-teal-900 truncate">
                                                                    {selectedDiagramRow.entry.label}
                                                                </div>
                                                                <div className="text-[10px] text-slate-500 truncate">
                                                                    {selectedDiagramRow.section
                                                                        ? formatHeadingLabel(selectedDiagramRow.section)
                                                                        : selectedDiagramRow.entry.sectionId}
                                                                </div>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => setSelectedDiagramKind(null)}
                                                                className="text-[10px] text-slate-400 hover:text-slate-600"
                                                            >
                                                                Close
                                                            </button>
                                                        </div>

                                                        {diagramNotice && (
                                                            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-[11px] text-emerald-700">
                                                                {diagramNotice}
                                                            </div>
                                                        )}

                                                        {diagramSpecError && (
                                                            <div className="rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-[11px] text-red-600">
                                                                {diagramSpecError}
                                                            </div>
                                                        )}

                                                        {clarifying ? (
                                                            <div className="space-y-1.5">
                                                                <div className="text-[11px] text-slate-700 whitespace-pre-wrap">
                                                                    {diagramClarifications[kind]!.question}
                                                                </div>
                                                                <input
                                                                    className="w-full text-[11px] border border-amber-200 rounded-md px-2 py-1.5 bg-amber-50/50"
                                                                    placeholder="Short answer…"
                                                                    value={diagramClarifyInput}
                                                                    onChange={(e) => setDiagramClarifyInput(e.target.value)}
                                                                    disabled={isDiagramWorking}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === "Enter" && !e.shiftKey) {
                                                                            e.preventDefault();
                                                                            void handleDiagramGenerate();
                                                                        }
                                                                    }}
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => void handleDiagramGenerate()}
                                                                    disabled={
                                                                        isDiagramWorking ||
                                                                        isSaving ||
                                                                        !diagramClarifyInput.trim()
                                                                    }
                                                                    className="w-full text-[11px] font-medium bg-teal-800 text-white hover:bg-teal-900 py-2 rounded-md disabled:opacity-40"
                                                                >
                                                                    {isDiagramWorking ? "Working…" : "Continue"}
                                                                </button>
                                                            </div>
                                                        ) : isEditingDiagramSpec && diagramSpecDraft ? (
                                                            <div className="space-y-2">
                                                                <div className="max-h-52 overflow-y-auto pr-0.5">
                                                                    <FypDiagramSpecEditor
                                                                        spec={diagramSpecDraft}
                                                                        onChange={setDiagramSpecDraft}
                                                                    />
                                                                </div>
                                                                <div className="flex gap-1">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => void saveEditedDiagramSpec()}
                                                                        className="flex-1 text-[11px] font-medium bg-teal-800 text-white py-2 rounded-md"
                                                                    >
                                                                        Save spec
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setIsEditingDiagramSpec(false);
                                                                            setDiagramSpecDraft(null);
                                                                            setDiagramSpecError(null);
                                                                        }}
                                                                        className="text-[11px] border border-slate-200 px-3 py-2 rounded-md"
                                                                    >
                                                                        Cancel
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <div className="rounded-md bg-slate-50/90 min-h-[6.5rem] flex items-center justify-center overflow-hidden">
                                                                    {hasSpec ? (
                                                                        <FypDiagramPreview
                                                                            key={`${kind}-${diagramRenderKey}`}
                                                                            spec={diagramSpecs[kind]!}
                                                                            renderKey={diagramRenderKey}
                                                                            onRendered={({ svg, pngDataUrl }) => {
                                                                                setDiagramRenderExport((prev) => {
                                                                                    if (
                                                                                        prev?.kind === kind &&
                                                                                        prev.svg === svg &&
                                                                                        prev.pngDataUrl === pngDataUrl
                                                                                    ) {
                                                                                        return prev;
                                                                                    }
                                                                                    return { kind, svg, pngDataUrl };
                                                                                });
                                                                            }}
                                                                            onError={(message) => setDiagramSpecError(message)}
                                                                        />
                                                                    ) : selectedDiagramDisplay ? (
                                                                        // eslint-disable-next-line @next/next/no-img-element
                                                                        <img
                                                                            src={selectedDiagramDisplay}
                                                                            alt={`${selectedDiagramRow.entry.label} preview`}
                                                                            className="max-h-36 max-w-full object-contain"
                                                                        />
                                                                    ) : (
                                                                        <span className="text-[10px] text-slate-400 px-3 text-center">
                                                                            Generate or upload to preview
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                {canInsert && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={handleDiagramInsert}
                                                                        className="w-full text-[11px] font-semibold bg-teal-800 text-white hover:bg-teal-900 py-2 rounded-md"
                                                                    >
                                                                        {insertLabel}
                                                                    </button>
                                                                )}

                                                                <div className="flex flex-wrap gap-x-2 gap-y-1 text-[10px]">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => void handleDiagramGenerate()}
                                                                        disabled={isDiagramWorking || isSaving || isSavingAiProfile}
                                                                        className="text-teal-800 hover:underline disabled:opacity-40"
                                                                    >
                                                                        {isDiagramWorking ? "Working…" : hasSpec ? "Regenerate spec" : "Generate"}
                                                                    </button>
                                                                    {hasSpec && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={handleDiagramRegeneratePreview}
                                                                            disabled={isDiagramWorking}
                                                                            className="text-teal-800 hover:underline disabled:opacity-40"
                                                                        >
                                                                            Refresh preview
                                                                        </button>
                                                                    )}
                                                                    <button
                                                                        type="button"
                                                                        onClick={beginEditDiagramSpec}
                                                                        disabled={isDiagramWorking}
                                                                        className="text-slate-600 hover:underline disabled:opacity-40"
                                                                    >
                                                                        Edit spec
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => diagramUploadInputRef.current?.click()}
                                                                        className="text-slate-600 hover:underline"
                                                                    >
                                                                        Upload
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={handleDiagramDownload}
                                                                        disabled={!hasPreviewVisual && !selectedDiagramDisplay}
                                                                        className="text-slate-600 hover:underline disabled:opacity-40"
                                                                    >
                                                                        Download
                                                                    </button>
                                                                    {selectedDiagramRow.figures.length > 0 && (
                                                                        <>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => diagramReplaceInputRef.current?.click()}
                                                                                className="text-amber-800 hover:underline"
                                                                            >
                                                                                Replace file
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={handleDiagramDelete}
                                                                                className="text-red-700 hover:underline"
                                                                            >
                                                                                Delete
                                                                            </button>
                                                                        </>
                                                                    )}
                                                                    {!canInsert && selectedDiagramRow.localPreview && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={handleDiagramDelete}
                                                                            className="text-red-700 hover:underline"
                                                                        >
                                                                            Clear upload
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                );
                                            })()}

                                            <input
                                                ref={diagramUploadInputRef}
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={handleDiagramUploadFile}
                                            />
                                            <input
                                                ref={diagramReplaceInputRef}
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={handleDiagramReplaceFigure}
                                            />
                                        </div>
                                    )}
                                </div>

                                {aiError && (
                                    <div className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] text-red-600">
                                        {aiError}
                                    </div>
                                )}
                                {aiClarificationQuestion && (
                                    <div className="rounded-lg border border-amber-200/90 bg-amber-50/90 px-2.5 py-2 space-y-1">
                                        <div className="text-[10px] uppercase tracking-wider text-amber-700/80 font-medium">
                                            Needs a detail
                                        </div>
                                        <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                                            {aiClarificationQuestion}
                                        </div>
                                    </div>
                                )}
                                {aiDraft ? (
                                    <div className="rounded-lg border-2 border-[#6F155F]/25 bg-[#F2EBF1] p-2.5 space-y-2 shadow-sm">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="text-[10px] uppercase tracking-wider text-[#6F155F] font-semibold">
                                                AI Draft
                                            </div>
                                            {aiDraftTargetLabel && (
                                                <div
                                                    className="text-[10px] text-slate-600 truncate max-w-[9rem]"
                                                    title={aiDraftTargetLabel}
                                                >
                                                    {aiDraftTargetLabel}
                                                </div>
                                            )}
                                        </div>
                                        <div className="bg-white/90 p-2.5 rounded-md border border-[#6F155F]/10 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto">
                                            {aiDraft}
                                        </div>
                                        {aiInsertNotice && (
                                            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-[11px] text-emerald-700">
                                                {aiInsertNotice}
                                            </div>
                                        )}
                                        <div className="grid grid-cols-2 gap-1.5">
                                            <button
                                                type="button"
                                                onClick={handleAiInsert}
                                                disabled={
                                                    isAiGenerating ||
                                                    isSaving ||
                                                    isSavingAiProfile ||
                                                    !aiDraftSectionId ||
                                                    !isUsableAiDraft(aiDraft, EMPTY_AI_PROFILE_MESSAGE) ||
                                                    Boolean(aiClarificationQuestion)
                                                }
                                                className="text-xs bg-[#6F155F] text-white hover:bg-[#5a114d] py-2 rounded-md transition-colors disabled:opacity-50"
                                                title="Append draft without removing existing content"
                                            >
                                                Insert
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleAiReplace}
                                                disabled={
                                                    isAiGenerating ||
                                                    isSaving ||
                                                    isSavingAiProfile ||
                                                    !aiDraftSectionId ||
                                                    !isUsableAiDraft(aiDraft, EMPTY_AI_PROFILE_MESSAGE) ||
                                                    Boolean(aiClarificationQuestion)
                                                }
                                                className="text-xs border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 py-2 rounded-md transition-colors disabled:opacity-50"
                                                title="Replace paragraph text only; lists, tables, and figures stay"
                                            >
                                                Replace
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => void handleAiGenerate()}
                                                disabled={
                                                    isAiGenerating ||
                                                    isSaving ||
                                                    isSavingAiProfile ||
                                                    !activeItem.id ||
                                                    Boolean(aiClarificationQuestion)
                                                }
                                                className="text-xs border border-slate-200 bg-white hover:border-[#6F155F]/40 hover:text-[#6F155F] py-2 rounded-md transition-colors disabled:opacity-50"
                                            >
                                                Regenerate
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleAiCancelDraft}
                                                disabled={isAiGenerating}
                                                className="text-xs border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 py-2 rounded-md transition-colors disabled:opacity-50"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                            <div className="p-2 border-t border-slate-200/80 bg-white shrink-0">
                                <div className="relative">
                                    <input
                                        className="w-full text-xs border border-slate-200 rounded-md py-2 pl-2.5 pr-8 focus:outline-none focus:ring-1 focus:ring-[#6F155F]/40 focus:border-[#6F155F]/40"
                                        placeholder={
                                            aiClarificationQuestion
                                                ? "Answer the question…"
                                                : "Optional instruction…"
                                        }
                                        value={aiMessage}
                                        onChange={(e) => setAiMessage(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" && !e.shiftKey) {
                                                e.preventDefault();
                                                void handleAiGenerate();
                                            }
                                        }}
                                        disabled={isAiGenerating}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => void handleAiGenerate()}
                                        disabled={
                                            isAiGenerating ||
                                            !activeItem.id ||
                                            (Boolean(aiClarificationQuestion) && !aiMessage.trim())
                                        }
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[#6F155F] disabled:opacity-40"
                                        title={aiClarificationQuestion ? "Send answer" : "Generate"}
                                    >
                                        {isAiGenerating ? (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                            <Send className="h-3.5 w-3.5" />
                                        )}
                                    </button>
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
