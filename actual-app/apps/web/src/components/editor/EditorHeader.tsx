"use client";

import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import {
    ChevronLeft,
    FileText,
    Save,
    FileDown,
    Loader2,
    PanelRightOpen,
    PanelRightClose,
    Quote,
} from "lucide-react";

type Props = {
    showCoverMeta: boolean;
    showReferences: boolean;
    isAiSidebarOpen: boolean;
    isSaving: boolean;
    isGenerating: boolean;
    generatingFormat: "docx" | "pdf" | null;
    /** Disable save/generate/toggles while project is still loading. */
    actionsDisabled?: boolean;
    onToggleCoverMeta: () => void;
    onToggleReferences: () => void;
    onSave: () => void;
    onGenerate: (format: "docx" | "pdf") => void;
    onToggleAiSidebar: () => void;
};

export function EditorHeader({
    showCoverMeta,
    showReferences,
    isAiSidebarOpen,
    isSaving,
    isGenerating,
    generatingFormat,
    actionsDisabled = false,
    onToggleCoverMeta,
    onToggleReferences,
    onSave,
    onGenerate,
    onToggleAiSidebar,
}: Props) {
    return (
        <header className="h-14 border-b border-slate-200/80 bg-white px-3 sm:px-4 flex items-center justify-between gap-2 shrink-0 shadow-[0_1px_0_rgba(15,23,42,0.03)]">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink-0">
                <Link href="/dashboard" className="text-slate-400 hover:text-[#6F155F] transition-colors shrink-0" title="Back to dashboard">
                    <ChevronLeft className="h-5 w-5" />
                </Link>
                <h1 className="text-sm font-semibold tracking-tight text-slate-800 truncate">Editor</h1>
            </div>
            <div className="flex items-center gap-1 sm:gap-1.5 min-w-0 overflow-x-auto no-scrollbar justify-end">
                <button
                    onClick={onToggleCoverMeta}
                    disabled={actionsDisabled}
                    className={`text-xs flex items-center gap-1.5 px-2 py-1.5 rounded-md transition-colors shrink-0 disabled:opacity-50 ${
                        showCoverMeta
                            ? "text-[#6F155F] bg-[#F2EBF1]"
                            : "text-slate-500 hover:text-[#6F155F] hover:bg-slate-50"
                    }`}
                    type="button"
                    title="Title page and approval fields"
                >
                    <FileText className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Title &amp; Approval</span>
                </button>
                <button
                    onClick={onToggleReferences}
                    disabled={actionsDisabled}
                    className={`text-xs flex items-center gap-1.5 px-2 py-1.5 rounded-md transition-colors shrink-0 disabled:opacity-50 ${
                        showReferences
                            ? "text-[#6F155F] bg-[#F2EBF1]"
                            : "text-slate-500 hover:text-[#6F155F] hover:bg-slate-50"
                    }`}
                    type="button"
                    title="References"
                >
                    <Quote className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">References</span>
                </button>
                <button
                    onClick={onSave}
                    disabled={actionsDisabled || isSaving || isGenerating}
                    className="text-xs flex items-center gap-1.5 text-slate-500 hover:text-[#6F155F] px-2 py-1.5 rounded-md hover:bg-slate-50 transition-colors disabled:opacity-50 shrink-0"
                    title="Save project"
                >
                    {isSaving ? "Saving…" : <><Save className="h-3.5 w-3.5" /><span className="hidden md:inline">Save</span></>}
                </button>
                <button
                    onClick={() => onGenerate("docx")}
                    disabled={actionsDisabled || isSaving || isGenerating}
                    className="text-xs flex items-center gap-1.5 rounded-lg bg-[#6F155F] hover:bg-[#57104b] text-white px-2.5 sm:px-3 py-1.5 font-medium shadow-sm disabled:opacity-50 transition-colors shrink-0"
                    title="Generate DOCX"
                >
                    {isGenerating && generatingFormat === "docx" ? (
                        <><Loader2 className="h-3.5 w-3.5 animate-spin" /><span className="hidden sm:inline">DOCX…</span></>
                    ) : (
                        <><FileDown className="h-3.5 w-3.5" /><span className="hidden sm:inline">DOCX</span></>
                    )}
                </button>
                <button
                    onClick={() => onGenerate("pdf")}
                    disabled={actionsDisabled || isSaving || isGenerating}
                    className="text-xs flex items-center gap-1.5 rounded-lg border border-[#6F155F] bg-white hover:bg-[#F2EBF1] text-[#6F155F] px-2.5 sm:px-3 py-1.5 font-medium shadow-sm disabled:opacity-50 transition-colors shrink-0"
                    title="Generate PDF"
                >
                    {isGenerating && generatingFormat === "pdf" ? (
                        <><Loader2 className="h-3.5 w-3.5 animate-spin" /><span className="hidden sm:inline">PDF…</span></>
                    ) : (
                        <><FileText className="h-3.5 w-3.5" /><span className="hidden sm:inline">PDF</span></>
                    )}
                </button>
                <button
                    onClick={onToggleAiSidebar}
                    disabled={actionsDisabled}
                    className={`p-2 rounded-lg transition-colors shrink-0 disabled:opacity-50 ${
                        isAiSidebarOpen
                            ? "text-[#6F155F] bg-[#F2EBF1]"
                            : "text-slate-500 hover:text-[#6F155F] hover:bg-slate-50"
                    }`}
                    title={isAiSidebarOpen ? "Hide Copilot" : "Show Copilot"}
                >
                    {isAiSidebarOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
                </button>
                <div className="shrink-0 pl-0.5">
                    <UserButton />
                </div>
            </div>
        </header>
    );
}
