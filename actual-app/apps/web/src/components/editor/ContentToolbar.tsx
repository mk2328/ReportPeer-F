"use client";

import type { ChangeEvent, Ref } from "react";
import {
    FileText,
    List,
    ListOrdered,
    Table2,
    ImagePlus,
} from "lucide-react";

type Props = {
    title: string;
    imageInputRef: Ref<HTMLInputElement>;
    replaceFigureInputRef: Ref<HTMLInputElement>;
    onAddParagraph: () => void;
    onStartBulletList: () => void;
    onStartNumberList: () => void;
    onAddTable: () => void;
    onAddFigureClick: () => void;
    onImageUpload: (event: ChangeEvent<HTMLInputElement>) => void;
    onReplaceFigure: (event: ChangeEvent<HTMLInputElement>) => void;
};

export function ContentToolbar({
    title,
    imageInputRef,
    replaceFigureInputRef,
    onAddParagraph,
    onStartBulletList,
    onStartNumberList,
    onAddTable,
    onAddFigureClick,
    onImageUpload,
    onReplaceFigure,
}: Props) {
    return (
        <div className="sticky top-0 z-20 bg-white rounded-t-xl shadow-[0_2px_8px_rgba(15,23,42,0.06)]">
            <div className="px-3 sm:px-5 lg:px-8 py-2 flex items-center gap-1.5 sm:gap-2 flex-wrap bg-[#6F155F] border-b border-[#57104b] rounded-t-xl">
                <button
                    type="button"
                    onClick={onAddParagraph}
                    className="text-xs flex items-center gap-1.5 border border-white/35 bg-white text-[#6F155F] hover:bg-[#F2EBF1] rounded-md px-2 sm:px-2.5 py-1.5 font-medium shadow-sm transition-colors"
                >
                    <FileText className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Paragraph</span>
                </button>
                <button
                    type="button"
                    onClick={onStartBulletList}
                    className="text-xs flex items-center gap-1.5 border border-white/35 bg-white text-[#6F155F] hover:bg-[#F2EBF1] rounded-md px-2 sm:px-2.5 py-1.5 font-medium shadow-sm transition-colors"
                    title="Bullet list"
                >
                    <List className="h-3.5 w-3.5" />
                    <span className="hidden md:inline">Bullet List</span>
                </button>
                <button
                    type="button"
                    onClick={onStartNumberList}
                    className="text-xs flex items-center gap-1.5 border border-white/35 bg-white text-[#6F155F] hover:bg-[#F2EBF1] rounded-md px-2 sm:px-2.5 py-1.5 font-medium shadow-sm transition-colors"
                    title="Numbered list"
                >
                    <ListOrdered className="h-3.5 w-3.5" />
                    <span className="hidden md:inline">Numbered List</span>
                </button>
                <button
                    type="button"
                    onClick={onAddTable}
                    className="text-xs flex items-center gap-1.5 border border-white/35 bg-white text-[#6F155F] hover:bg-[#F2EBF1] rounded-md px-2 sm:px-2.5 py-1.5 font-medium shadow-sm transition-colors"
                    title="Add table"
                >
                    <Table2 className="h-3.5 w-3.5" />
                    <span className="hidden md:inline">Add Table</span>
                </button>
                <button
                    type="button"
                    onClick={onAddFigureClick}
                    className="text-xs flex items-center gap-1.5 border border-white/35 bg-white text-[#6F155F] hover:bg-[#F2EBF1] rounded-md px-2 sm:px-2.5 py-1.5 font-medium shadow-sm transition-colors"
                    title="Add image or figure"
                >
                    <ImagePlus className="h-3.5 w-3.5" />
                    <span className="hidden md:inline">Add Figure</span>
                </button>
                <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={onImageUpload}
                />
                <input
                    ref={replaceFigureInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={onReplaceFigure}
                />
            </div>
            <h2 className="text-[1.75rem] leading-snug font-serif text-slate-900 px-5 sm:px-8 pt-4 pb-3.5 border-b border-slate-100">{title}</h2>
        </div>
    );
}
