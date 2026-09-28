"use client";

import type { ReactNode } from "react";

type Props = {
    coverPanel?: ReactNode;
    referencesPanel?: ReactNode;
    toolbar: ReactNode;
    children: ReactNode;
};

export function SectionCanvas({
    coverPanel,
    referencesPanel,
    toolbar,
    children,
}: Props) {
    return (
        <main className="flex-1 min-h-0 bg-[#F4F2F5] overflow-y-auto px-3 sm:px-5 py-4 sm:py-5 flex justify-center items-start min-w-0">
            <div className="max-w-7xl w-full min-w-0 bg-white min-h-[calc(100vh-5.5rem)] border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_28px_rgba(15,23,42,0.06)] rounded-xl">
                {coverPanel}
                {referencesPanel}
                <div className="min-w-0 max-w-full">
                    {toolbar}
                    <div className="px-5 sm:px-8 pt-4 pb-10 sm:pb-12 min-w-0">
                        <div className="space-y-6 min-w-0">
                            {children}
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
