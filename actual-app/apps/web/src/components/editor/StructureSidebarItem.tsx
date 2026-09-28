"use client";

import { useState } from "react";
import {
    ChevronDown,
    ChevronRight,
    FileText,
    Pencil,
    Plus,
    Trash2,
} from "lucide-react";
import {
    type StructureItem,
    formatHeadingLabel,
    isProtectedStructureId,
} from "@/lib/structureUtils";

type Props = {
    item: StructureItem;
    level?: number;
    activeItem: { id: string; title: string };
    setActiveItem: (item: { id: string; title: string }) => void;
    onAddSubItem: (id: string, parentLevel: number) => void;
    onRenameItem: (id: string) => void;
    onDeleteItem: (id: string) => void;
};

export function StructureSidebarItem({
    item,
    level = 0,
    activeItem,
    setActiveItem,
    onAddSubItem,
    onRenameItem,
    onDeleteItem,
}: Props) {
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

            {isExpanded && item.subitems?.map((sub) => (
                <StructureSidebarItem
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
}
