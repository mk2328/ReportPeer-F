import { EditorOpeningShell } from "@/components/editor/EditorOpeningShell";

/** Shown immediately on Dashboard → /editor/[id] while the route chunk compiles/loads. */
export default function EditorRouteLoading() {
  return <EditorOpeningShell status="Opening your project…" />;
}
