"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { DiagramSpec } from "@/services/ai/diagramSpec";
import { validateDiagramSpec } from "@/services/ai/diagramSpec";
import { diagramSpecToMermaid, svgMarkupToPngDataUrl } from "@/services/ai/diagramMermaid";

type Props = {
  spec: DiagramSpec;
  /** Bump to force a remount/re-render from the same spec. */
  renderKey?: number;
  onRendered?: (payload: { svg: string; pngDataUrl: string | null }) => void;
  onError?: (message: string) => void;
};

/**
 * Renders a validated DiagramSpec via Mermaid (client-only).
 * Invalid specs are never rendered.
 *
 * Callbacks are read via refs so parent inline handlers do not retrigger Mermaid.
 */
export function FypDiagramPreview({ spec, renderKey = 0, onRendered, onError }: Props) {
  const reactId = useId().replace(/:/g, "");
  const [svg, setSvg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const onRenderedRef = useRef(onRendered);
  const onErrorRef = useRef(onError);
  onRenderedRef.current = onRendered;
  onErrorRef.current = onError;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSvg(null);

    const validated = validateDiagramSpec(spec.kind, spec);
    if (!validated.ok) {
      setLoading(false);
      setError(validated.error);
      onErrorRef.current?.(validated.error);
      return;
    }

    const source = diagramSpecToMermaid(validated.spec);
    const renderId = `fyp-diagram-${reactId}-${renderKey}`;

    (async () => {
      try {
        const mermaidModule = await import("mermaid");
        const mermaid = mermaidModule.default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "neutral",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        });
        const { svg: rendered } = await mermaid.render(renderId, source);
        if (cancelled) return;
        setSvg(rendered);
        setLoading(false);
        // Unlock Insert immediately via SVG; upgrade to PNG when conversion succeeds.
        onRenderedRef.current?.({ svg: rendered, pngDataUrl: null });
        try {
          const pngDataUrl = await svgMarkupToPngDataUrl(rendered);
          if (!cancelled) onRenderedRef.current?.({ svg: rendered, pngDataUrl });
        } catch {
          // Keep SVG-only export — Insert still available via SVG fallback.
        }      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "Failed to render diagram preview.";
        setError(message);
        setLoading(false);
        onErrorRef.current?.(message);
      }
    })();

    return () => {
      cancelled = true;
    };
    // Intentionally exclude onRendered/onError — identity changes must not re-render Mermaid.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- callbacks via refs
  }, [spec, renderKey, reactId]);

  if (loading) {
    return (
      <div className="text-[10px] text-slate-400 px-3 py-6 text-center w-full">
        Rendering diagram…
      </div>
    );
  }
  if (error) {
    return (
      <div className="text-[10px] text-red-600 px-3 py-4 text-center w-full">{error}</div>
    );
  }
  if (!svg) return null;

  return (
    <div
      className="w-full max-h-44 overflow-auto flex items-center justify-center p-1 [&_svg]:max-w-full [&_svg]:h-auto"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
