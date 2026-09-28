"use client";

import {
    AlignLeft,
    AlignCenter,
    AlignRight,
    Trash2,
} from "lucide-react";
import type { ContentBlock } from "@/lib/structureUtils";

type FigureBlockData = Extract<ContentBlock, { type: "figure" }>;

type Props = {
    block: FigureBlockData;
    selected: boolean;
    onSelect: () => void;
    onRemove: () => void;
    onReplaceClick: () => void;
    onUpdate: (patch: Partial<Pick<FigureBlockData, "caption" | "widthPercent" | "align">>) => void;
};

export function FigureBlock({
    block,
    selected,
    onSelect,
    onRemove,
    onReplaceClick,
    onUpdate,
}: Props) {
    return (
        <div
            className={`-mx-3 rounded-md px-3 py-2 transition-colors ${selected ? "bg-[#F2EBF1]/50" : ""}`}
            onClick={onSelect}
        >
            <div className="flex items-center justify-between mb-2 gap-2">
                <div className="text-[10px] uppercase tracking-wider text-gray-400">Figure</div>
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        title="Replace image"
                        onClick={(e) => {
                            e.stopPropagation();
                            onReplaceClick();
                        }}
                        className="text-[11px] border border-gray-200 rounded px-2 py-1 hover:border-[#6F155F] hover:text-[#6F155F]"
                    >
                        Replace
                    </button>
                    <button
                        type="button"
                        title="Remove figure"
                        onClick={onRemove}
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
                            onUpdate({
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
                        onClick={() => onUpdate({ align: "left" })}
                        className={`rounded border px-1.5 py-1 ${(block.align || "center") === "left" ? "border-[#6F155F] text-[#6F155F] bg-white" : "border-gray-200 text-gray-600"}`}
                    >
                        <AlignLeft className="h-3.5 w-3.5" />
                    </button>
                    <button
                        type="button"
                        title="Align center"
                        onClick={() => onUpdate({ align: "center" })}
                        className={`rounded border px-1.5 py-1 ${(block.align || "center") === "center" ? "border-[#6F155F] text-[#6F155F] bg-white" : "border-gray-200 text-gray-600"}`}
                    >
                        <AlignCenter className="h-3.5 w-3.5" />
                    </button>
                    <button
                        type="button"
                        title="Align right"
                        onClick={() => onUpdate({ align: "right" })}
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
                    onFocus={onSelect}
                    onChange={(e) =>
                        onUpdate({ caption: e.target.value })
                    }
                    className="w-full text-sm font-serif border-b border-gray-100 focus:border-[#6F155F] focus:outline-none py-1"
                    placeholder="Caption text (number assigned automatically)"
                />
            </div>
        </div>
    );
}
