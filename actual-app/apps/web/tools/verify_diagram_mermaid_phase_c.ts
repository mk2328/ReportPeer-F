/**
 * Phase C: DiagramSpec → Mermaid source checks.
 * Run: npx tsx tools/verify_diagram_mermaid_phase_c.ts
 */
import assert from "node:assert/strict";
import { validateDiagramSpec } from "../src/services/ai/diagramSpec";
import { diagramSpecToMermaid } from "../src/services/ai/diagramMermaid";

function mermaidFor(kind: Parameters<typeof validateDiagramSpec>[0], raw: unknown): string {
  const result = validateDiagramSpec(kind, raw);
  assert.equal(result.ok, true, kind);
  return diagramSpecToMermaid(result.spec);
}

{
  const src = mermaidFor("architecture", {
    kind: "architecture",
    nodes: [
      { id: "ui", label: "Web UI", layer: "Presentation" },
      { id: "api", label: "API", layer: "Application" },
      { id: "db", label: "Database", layer: "Data" },
    ],
    edges: [
      { from: "ui", to: "api", label: "REST" },
      { from: "api", to: "db" },
    ],
  });
  assert.match(src, /^flowchart TB/m);
  assert.match(src, /subgraph/);
  assert.match(src, /ui -->|"REST"| api/);
}

{
  const src = mermaidFor("erd", {
    kind: "erd",
    entities: [
      { name: "User", attributes: ["id", "email"] },
      { name: "Order", attributes: ["id"] },
    ],
    relations: [{ from: "User", to: "Order", cardinality: "1:N", label: "places" }],
  });
  assert.match(src, /^erDiagram/m);
  assert.match(src, /USER \|\|--o\{ ORDER/);
  assert.match(src, /string id/);
}

{
  const src = mermaidFor("flow", {
    kind: "flow",
    steps: [
      { id: "s", label: "Start", type: "start" },
      { id: "d", label: "Valid?", type: "decision" },
      { id: "p", label: "Save", type: "process" },
      { id: "e", label: "End", type: "end" },
    ],
    edges: [
      { from: "s", to: "d" },
      { from: "d", to: "p", label: "yes" },
      { from: "d", to: "e", label: "no" },
      { from: "p", to: "e" },
    ],
  });
  assert.match(src, /^flowchart TD/m);
  assert.match(src, /d\{Valid\?\}/);
  assert.match(src, /s\(\[Start\]\)/);
}

{
  const src = mermaidFor("usecase", {
    kind: "usecase",
    systemName: "Campus App",
    actors: [{ id: "a1", label: "Student" }],
    useCases: [
      { id: "u1", label: "Login" },
      { id: "u2", label: "View Marks" },
    ],
    links: [
      { actorId: "a1", useCaseId: "u1" },
      { actorId: "a1", useCaseId: "u2" },
    ],
  });
  assert.match(src, /^flowchart LR/m);
  assert.match(src, /subgraph system\["Campus App"\]/);
  assert.match(src, /a1\(\(Student\)\)/);
  assert.match(src, /a1 --- u1/);
}

{
  const src = mermaidFor("activity", {
    kind: "activity",
    steps: [
      { id: "s", label: "Start", type: "start" },
      { id: "d", label: "Approved?", type: "decision" },
      { id: "a", label: "Notify", type: "action" },
      { id: "e", label: "End", type: "end" },
    ],
    edges: [
      { from: "s", to: "d" },
      { from: "d", to: "a", label: "yes" },
      { from: "d", to: "e", label: "no" },
      { from: "a", to: "e" },
    ],
  });
  assert.match(src, /^flowchart TD/m);
  assert.match(src, /d\{Approved\?\}/);
  assert.match(src, /a\[Notify\]/);
}

console.log("verify_diagram_mermaid_phase_c: all checks passed");
