"use client";

type Props = {
  /** Real stage message — not a fake percentage. */
  status?: string;
  /** Show structure sidebar skeleton (default true). */
  showSidebar?: boolean;
};

/**
 * Lightweight editor chrome + indeterminate progress for Dashboard → Editor.
 * Used by route loading.tsx and while the first project fetch is in flight.
 */
export function EditorOpeningShell({
  status = "Opening your project…",
  showSidebar = true,
}: Props) {
  return (
    <div className="h-screen flex flex-col bg-[#F4F2F5] overflow-hidden">
      <header className="h-14 border-b border-slate-200/80 bg-white px-3 sm:px-4 flex items-center justify-between gap-2 shrink-0 shadow-[0_1px_0_rgba(15,23,42,0.03)]">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="h-5 w-5 rounded bg-slate-100 animate-pulse shrink-0" />
          <div className="h-4 w-16 rounded bg-slate-100 animate-pulse" />
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-7 w-16 rounded-md bg-slate-100 animate-pulse hidden sm:block" />
          <div className="h-7 w-14 rounded-md bg-slate-100 animate-pulse" />
          <div className="h-7 w-16 rounded-lg bg-[#F2EBF1] animate-pulse" />
        </div>
      </header>

      <div
        className="h-0.5 w-full bg-[#F2EBF1] overflow-hidden shrink-0 relative"
        role="progressbar"
        aria-valuetext={status}
        aria-busy="true"
      >
        <div className="absolute inset-y-0 w-1/3 rounded-full bg-[#6F155F] editor-load-sweep" />
      </div>

      <div className="flex-1 flex min-h-0 overflow-hidden">
        {showSidebar && (
          <aside className="w-12 md:w-64 border-r border-slate-200/80 bg-white shrink-0 overflow-hidden">
            <div className="hidden md:flex flex-col gap-2 px-3 pt-4">
              <div className="h-2.5 w-24 rounded bg-slate-100 animate-pulse mb-2" />
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="h-8 rounded-md bg-slate-50 animate-pulse"
                  style={{ width: `${70 + (i % 3) * 10}%` }}
                />
              ))}
            </div>
          </aside>
        )}

        <main className="flex-1 min-h-0 bg-[#F4F2F5] overflow-hidden px-3 sm:px-5 py-4 sm:py-5 flex justify-center items-start">
          <div className="max-w-7xl w-full bg-white min-h-[calc(100vh-5.5rem)] border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_28px_rgba(15,23,42,0.06)] rounded-xl flex flex-col items-center justify-center gap-4 px-6 py-20">
            <div className="h-9 w-9 rounded-full border-2 border-[#F2EBF1] border-t-[#6F155F] animate-spin" />
            <div className="text-center space-y-1.5 max-w-xs">
              <p className="text-sm font-medium text-slate-800">{status}</p>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Your report editor is coming up — this usually only takes a moment.
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
