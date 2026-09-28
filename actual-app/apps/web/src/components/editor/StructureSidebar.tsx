"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import type { StructureItem } from "@/lib/structureUtils";
import { StructureSidebarItem } from "./StructureSidebarItem";

type Props = {
    isOpen: boolean;
    chapters: StructureItem[];
    activeItem: { id: string; title: string };
    setActiveItem: (item: { id: string; title: string }) => void;
    onToggle: (open: boolean) => void;
    onAddSubItem: (id: string, parentLevel: number) => void;
    onRenameItem: (id: string) => void;
    onDeleteItem: (id: string) => void;
};

export function StructureSidebar({
    isOpen,
    chapters,
    activeItem,
    setActiveItem,
    onToggle,
    onAddSubItem,
    onRenameItem,
    onDeleteItem,
}: Props) {
    return (
        <aside className={`${isOpen ? "w-64" : "w-12"} border-r border-slate-200/80 bg-white transition-all duration-300 shrink-0 overflow-hidden flex flex-col`}>
            {isOpen ? (
                <div className="flex-1 overflow-y-auto pt-3 min-w-[16rem]">
                    <div className="px-3 mb-3 flex items-center justify-between gap-2">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Report Structure</div>
                        <button
                            type="button"
                            title="Collapse structure"
                            onClick={() => onToggle(false)}
                            className="p-1.5 text-slate-400 hover:text-[#6F155F] hover:bg-[#F2EBF1] rounded-md transition-colors"
                        >
                            <PanelLeftClose className="h-4 w-4" />
                        </button>
                    </div>
                    {chapters.map((ch) => (
                        <StructureSidebarItem
                            key={ch.id}
                            item={ch}
                            level={ch.level || 1}
                            activeItem={activeItem}
                            setActiveItem={setActiveItem}
                            onAddSubItem={onAddSubItem}
                            onRenameItem={onRenameItem}
                            onDeleteItem={onDeleteItem}
                        />
                    ))}
                </div>
            ) : (
                <div
                    className="w-12 h-full flex flex-col items-center pt-5 cursor-pointer hover:bg-slate-50"
                    onClick={() => onToggle(true)}
                    title="Expand structure"
                >
                    <div className="bg-[#6F155F]/10 p-2 rounded-lg text-[#6F155F]">
                        <PanelLeftOpen className="h-5 w-5" />
                    </div>
                </div>
            )}
        </aside>
    );
}
