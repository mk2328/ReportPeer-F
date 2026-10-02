"use client";

import type { ClipboardEvent, MutableRefObject } from "react";
import { Trash2 } from "lucide-react";
import type { ContentBlock, ContentTable } from "@/lib/structureUtils";
import { parseClipboardTable } from "@/lib/parseClipboardTable";
import { resolveCitations } from "@/lib/references";

function autoGrowTextarea(el: HTMLTextAreaElement | null) {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
}

type ParagraphBlockData = Extract<ContentBlock, { type: "paragraph" }>;

type Props = {
    block: ParagraphBlockData;
    selected: boolean;
    citationNumbers: Map<string, number>;
    paragraphCaretRef: MutableRefObject<{ blockId: string; start: number; end: number } | null>;
    onSelect: () => void;
    onChangeText: (text: string) => void;
    onRemove: () => void;
    /** When clipboard contains a table, insert it via the existing table flow. */
    onPasteTable?: (table: ContentTable) => void;
};

export function ParagraphBlock({
    block,
    selected,
    citationNumbers,
    paragraphCaretRef,
    onSelect,
    onChangeText,
    onRemove,
    onPasteTable,
}: Props) {
    const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
        if (!onPasteTable) return;
        const html = e.clipboardData.getData("text/html");
        const plain = e.clipboardData.getData("text/plain");
        const table = parseClipboardTable(html, plain);
        if (!table) return;
        e.preventDefault();
        onPasteTable(table);
    };

    return (
        <div
            className={`group relative -mx-3 rounded-md px-3 py-1 transition-colors ${selected ? "bg-[#F2EBF1]/50" : "hover:bg-slate-50"}`}
            onClick={onSelect}
        >
            <textarea
                ref={(el) => {
                    autoGrowTextarea(el);
                }}
                data-focus-id={block.id}
                value={block.text}
                rows={1}
                onFocus={onSelect}
                onSelect={(e) => {
                    const el = e.currentTarget;
                    paragraphCaretRef.current = {
                        blockId: block.id,
                        start: el.selectionStart,
                        end: el.selectionEnd,
                    };
                }}
                onChange={(e) => {
                    autoGrowTextarea(e.currentTarget);
                    paragraphCaretRef.current = {
                        blockId: block.id,
                        start: e.currentTarget.selectionStart,
                        end: e.currentTarget.selectionEnd,
                    };
                    onChangeText(e.target.value);
                }}
                onPaste={handlePaste}
                className="w-full resize-none overflow-hidden bg-transparent font-serif text-[15px] leading-[1.9] text-justify text-slate-800 placeholder:text-slate-300 focus:outline-none"
                placeholder="Start writing..."
            />
            <button
                type="button"
                title="Delete this paragraph"
                onClick={onRemove}
                className={`absolute top-0.5 right-0 p-1 text-gray-300 transition-opacity hover:text-red-500 group-hover:opacity-100 ${selected ? "opacity-100" : "opacity-0"}`}
            >
                <Trash2 className="h-3.5 w-3.5" />
            </button>
            {selected && block.text.includes("[[ref:") && (
                <p className="mt-1 border-l-2 border-[#6F155F]/30 pl-2 text-[11px] leading-relaxed text-slate-400">
                    Preview: {resolveCitations(block.text, citationNumbers)}
                </p>
            )}
        </div>
    );
}
