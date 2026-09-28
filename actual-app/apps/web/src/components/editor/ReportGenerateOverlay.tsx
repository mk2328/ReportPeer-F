"use client";

type Phase = "working" | "success" | "error";

type Props = {
  format: "docx" | "pdf";
  status: string;
  phase: Phase;
  errorMessage?: string | null;
  onRetry?: () => void;
  onDismiss?: () => void;
};

/**
 * Full-screen generation feedback for DOCX/PDF export.
 * Indeterminate progress only — no fake percentages.
 */
export function ReportGenerateOverlay({
  format,
  status,
  phase,
  errorMessage,
  onRetry,
  onDismiss,
}: Props) {
  const label = format === "pdf" ? "PDF" : "DOCX";

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px] p-4"
      role="alertdialog"
      aria-busy={phase === "working"}
      aria-live="polite"
    >
      <div className="w-full max-w-sm rounded-2xl border border-slate-200/80 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.18)] overflow-hidden">
        {phase === "working" && (
          <div
            className="h-0.5 w-full bg-[#F2EBF1] overflow-hidden relative"
            role="progressbar"
            aria-valuetext={status}
          >
            <div className="absolute inset-y-0 w-1/3 rounded-full bg-[#6F155F] editor-load-sweep" />
          </div>
        )}

        <div className="px-6 py-7 flex flex-col items-center text-center gap-3">
          {phase === "working" && (
            <div className="h-10 w-10 rounded-full border-2 border-[#F2EBF1] border-t-[#6F155F] animate-spin" />
          )}
          {phase === "success" && (
            <div className="h-10 w-10 rounded-full bg-emerald-50 text-emerald-700 grid place-items-center text-lg font-semibold">
              ✓
            </div>
          )}
          {phase === "error" && (
            <div className="h-10 w-10 rounded-full bg-red-50 text-red-600 grid place-items-center text-lg font-semibold">
              !
            </div>
          )}

          <div className="space-y-1.5 max-w-[18rem]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6F155F]/80">
              Generate {label}
            </p>
            <p className="text-sm font-medium text-slate-800 leading-snug">{status}</p>
            {phase === "working" && (
              <p className="text-[11px] text-slate-400 leading-relaxed">
                {format === "pdf"
                  ? "Word is building your report, then converting it to PDF. This can take a minute."
                  : "Building your formatted Word document. This can take a short while."}
              </p>
            )}
            {phase === "error" && errorMessage && (
              <p className="text-[12px] text-red-600 leading-relaxed">{errorMessage}</p>
            )}
          </div>

          {phase === "error" && (
            <div className="flex items-center gap-2 pt-1">
              {onDismiss && (
                <button
                  type="button"
                  onClick={onDismiss}
                  className="text-xs font-medium text-slate-500 hover:text-slate-800 px-3 py-2 rounded-lg"
                >
                  Dismiss
                </button>
              )}
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="text-xs font-semibold bg-[#6F155F] hover:bg-[#57104b] text-white px-3.5 py-2 rounded-lg"
                >
                  Try again
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
