"use client";

import type { KeyboardEvent } from "react";
import { IndentDecrease, IndentIncrease, Trash2 } from "lucide-react";
import type { ContentBlock, ContentListItem } from "@/lib/structureUtils";

const MAX_LIST_LEVEL = 4;

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

type ListBlockData = Extract<ContentBlock, { type: "list" }>;

type Props = {
    block: ListBlockData;
    selected: boolean;
    onSelect: () => void;
    onRemove: () => void;
    onItemFocus: () => void;
    onItemChange: (itemId: string, patch: Partial<ContentListItem>) => void;
    onItemKeyDown: (
        e: KeyboardEvent<HTMLInputElement>,
        listId: string,
        itemIndex: number,
        item: ContentListItem
    ) => void;
    onChangeLevel: (itemIndex: number, delta: number) => void;
    onRemoveItem: (itemId: string) => void;
};

export function ListBlock({
    block,
    selected,
    onSelect,
    onRemove,
    onItemFocus,
    onItemChange,
    onItemKeyDown,
    onChangeLevel,
    onRemoveItem,
}: Props) {
    const numberLabels = block.listType === "number" ? listNumberLabels(block.items) : [];

    return (
        <div
            className={`-mx-3 space-y-1.5 rounded-md px-3 py-2 transition-colors ${selected ? "bg-[#F2EBF1]/50" : ""}`}
            onClick={onSelect}
        >
            <div className="flex items-center justify-between">
                <div className="text-[10px] uppercase tracking-wider text-gray-400">
                    {block.listType === "number" ? "Numbered list" : "Bullet list"}
                </div>
                <button type="button" title="Remove list" onClick={onRemove} className="p-1 text-gray-300 hover:text-red-500">
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
                        onFocus={onItemFocus}
                        onChange={(e) => onItemChange(item.id, { text: e.target.value })}
                        onKeyDown={(e) => onItemKeyDown(e, block.id, itemIndex, item)}
                        className="flex-1 text-sm font-serif border-b border-gray-100 focus:border-[#6F155F] focus:outline-none py-1"
                        placeholder="List item"
                    />
                    <button type="button" title="Decrease level" onClick={() => onChangeLevel(itemIndex, -1)} className="p-1 text-gray-400 hover:text-[#6F155F]">
                        <IndentDecrease className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" title="Increase level" onClick={() => onChangeLevel(itemIndex, 1)} className="p-1 text-gray-400 hover:text-[#6F155F]">
                        <IndentIncrease className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" title="Remove item" onClick={() => onRemoveItem(item.id)} className="p-1 text-gray-300 hover:text-red-500">
                        <Trash2 className="h-3.5 w-3.5" />
                    </button>
                </div>
            ))}
        </div>
    );
}
