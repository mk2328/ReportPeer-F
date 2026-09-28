"use client";

import type { Dispatch, SetStateAction } from "react";
import { Pencil, Trash2 } from "lucide-react";
import {
    type ReferenceEntry,
    type ReferenceType,
    REFERENCE_TYPES,
    formatReference,
} from "@/lib/references";

type Props = {
    references: ReferenceEntry[];
    referenceDraft: ReferenceEntry | null;
    citationNumbers: Map<string, number>;
    setReferenceDraft: Dispatch<SetStateAction<ReferenceEntry | null>>;
    onAddReference: () => void;
    onCite: (reference: ReferenceEntry) => void;
    onDelete: (reference: ReferenceEntry) => void;
    onSaveDraft: () => void;
};

export function ReferencesPanel({
    references,
    referenceDraft,
    citationNumbers,
    setReferenceDraft,
    onAddReference,
    onCite,
    onDelete,
    onSaveDraft,
}: Props) {
    return (
        <div className="mx-6 sm:mx-8 mt-6 mb-4 border border-slate-200 rounded-lg p-4 bg-slate-50/90 space-y-3">
            <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-800">References &amp; Citations</h3>
                <button
                    type="button"
                    onClick={onAddReference}
                    className="text-[11px] border border-gray-200 bg-white rounded px-2 py-1 hover:border-[#6F155F] hover:text-[#6F155F]"
                >
                    Add reference
                </button>
            </div>
            <p className="text-xs text-slate-500">
                Numbers are assigned automatically by first citation order. Place the caret in a
                paragraph, then use Cite. Only cited references appear in the final References section.
            </p>

            {references.length === 0 ? (
                <p className="text-xs text-slate-400">No references yet.</p>
            ) : (
                <ul className="space-y-2">
                    {references.map((reference) => {
                        const number = citationNumbers.get(reference.id);
                        return (
                            <li
                                key={reference.id}
                                className="flex items-start gap-2 rounded border border-gray-200 bg-white px-2.5 py-2"
                            >
                                <span
                                    className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium ${number ? "bg-[#F2EBF1] text-[#6F155F]" : "bg-slate-100 text-slate-400"}`}
                                    title={number ? `Cited as [${number}]` : "Not cited yet"}
                                >
                                    {number ? `[${number}]` : "—"}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <div className="text-xs font-serif text-slate-700 break-words">
                                        {formatReference(reference)}
                                    </div>
                                    <div className="text-[10px] uppercase tracking-wider text-slate-400 mt-0.5">
                                        {REFERENCE_TYPES.find((t) => t.value === reference.type)?.label || "Other"}
                                    </div>
                                </div>
                                <div className="flex shrink-0 items-center gap-1">
                                    <button
                                        type="button"
                                        title="Insert citation at caret"
                                        onClick={() => onCite(reference)}
                                        className="text-[11px] border border-gray-200 rounded px-2 py-1 hover:border-[#6F155F] hover:text-[#6F155F]"
                                    >
                                        Cite
                                    </button>
                                    <button
                                        type="button"
                                        title="Edit reference"
                                        onClick={() => setReferenceDraft({ ...reference })}
                                        className="p-1 text-gray-400 hover:text-[#6F155F]"
                                    >
                                        <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        title="Delete reference"
                                        onClick={() => onDelete(reference)}
                                        className="p-1 text-gray-300 hover:text-red-500"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}

            {referenceDraft && (
                <div className="rounded border border-[#6F155F]/30 bg-white p-3 space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <label className="block text-xs text-slate-600">
                            Type
                            <select
                                className="mt-1 w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm bg-white"
                                value={referenceDraft.type}
                                onChange={(e) =>
                                    setReferenceDraft((draft) =>
                                        draft ? { ...draft, type: e.target.value as ReferenceType } : draft
                                    )
                                }
                            >
                                {REFERENCE_TYPES.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="block text-xs text-slate-600">
                            Year
                            <input
                                className="mt-1 w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm"
                                value={referenceDraft.year}
                                onChange={(e) =>
                                    setReferenceDraft((draft) => (draft ? { ...draft, year: e.target.value } : draft))
                                }
                                placeholder="e.g. 2024"
                            />
                        </label>
                        <label className="block text-xs text-slate-600 sm:col-span-2">
                            Authors
                            <input
                                className="mt-1 w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm"
                                value={referenceDraft.authors}
                                onChange={(e) =>
                                    setReferenceDraft((draft) => (draft ? { ...draft, authors: e.target.value } : draft))
                                }
                                placeholder="A. Khan, B. Ahmed"
                            />
                        </label>
                        <label className="block text-xs text-slate-600 sm:col-span-2">
                            Title
                            <input
                                className="mt-1 w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm"
                                value={referenceDraft.title}
                                onChange={(e) =>
                                    setReferenceDraft((draft) => (draft ? { ...draft, title: e.target.value } : draft))
                                }
                            />
                        </label>
                        <label className="block text-xs text-slate-600">
                            Publisher / Journal / Site
                            <input
                                className="mt-1 w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm"
                                value={referenceDraft.source}
                                onChange={(e) =>
                                    setReferenceDraft((draft) => (draft ? { ...draft, source: e.target.value } : draft))
                                }
                            />
                        </label>
                        <label className="block text-xs text-slate-600">
                            Volume / Pages / Edition
                            <input
                                className="mt-1 w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm"
                                value={referenceDraft.details}
                                onChange={(e) =>
                                    setReferenceDraft((draft) => (draft ? { ...draft, details: e.target.value } : draft))
                                }
                                placeholder="vol. 12, no. 3, pp. 45-52"
                            />
                        </label>
                        <label className="block text-xs text-slate-600">
                            URL
                            <input
                                className="mt-1 w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm"
                                value={referenceDraft.url}
                                onChange={(e) =>
                                    setReferenceDraft((draft) => (draft ? { ...draft, url: e.target.value } : draft))
                                }
                            />
                        </label>
                        <label className="block text-xs text-slate-600">
                            Accessed on
                            <input
                                className="mt-1 w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm"
                                value={referenceDraft.accessed}
                                onChange={(e) =>
                                    setReferenceDraft((draft) => (draft ? { ...draft, accessed: e.target.value } : draft))
                                }
                                placeholder="12-Sep-2026"
                            />
                        </label>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onSaveDraft}
                            className="text-xs rounded-md bg-[#6F155F] hover:bg-[#57104b] text-white px-3 py-1.5 font-medium"
                        >
                            Save reference
                        </button>
                        <button
                            type="button"
                            onClick={() => setReferenceDraft(null)}
                            className="text-xs text-slate-500 hover:text-[#6F155F] px-2 py-1.5"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
