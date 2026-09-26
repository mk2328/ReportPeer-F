/**
 * Phase B tests: DiagramSpec validation + parse.
 * Run: npx tsx tools/verify_diagram_spec_phase_b.ts
 */
import assert from "node:assert/strict";
import {
  emptyDiagramSpec,
  parseAndValidateDiagramSpec,
  validateDiagramSpec,
} from "../src/services/ai/diagramSpec";

// Architecture
{
  const bad = validateDiagramSpec("architecture", {
    kind: "architecture",
    nodes: [
      { id: "a", label: "A" },
      { id: "b", label: "B" },
    ],
    edges: [{ from: "a", to: "b" }],
  });
  assert.equal(bad.ok, false);

  const orphan = validateDiagramSpec("architecture", {
    kind: "architecture",
    nodes: [
      { id: "a", label: "A" },
      { id: "b", label: "B" },
      { id: "c", label: "C" },
    ],
    edges: [{ from: "a", to: "missing" }],
  });
  assert.equal(orphan.ok, false);

  const ok = validateDiagramSpec("architecture", {
    kind: "architecture",
    nodes: [
      { id: "client", label: "Client App", layer: "Presentation" },
      { id: "api", label: "API", layer: "Application" },
      { id: "db", label: "Database", layer: "Data" },
    ],
    edges: [
      { from: "client", to: "api", label: "HTTPS" },
      { from: "api", to: "db" },
    ],
  });
  assert.equal(ok.ok, true);
}

// ERD
{
  const bad = validateDiagramSpec("erd", {
    kind: "erd",
    entities: [{ name: "User", attributes: ["id"] }],
    relations: [],
  });
  assert.equal(bad.ok, false);

  const badCard = validateDiagramSpec("erd", {
    kind: "erd",
    entities: [
      { name: "User", attributes: ["id"] },
      { name: "Order", attributes: ["id"] },
    ],
    relations: [{ from: "User", to: "Order", cardinality: "many" }],
  });
  assert.equal(badCard.ok, false);

  const ok = validateDiagramSpec("erd", {
    kind: "erd",
    entities: [
      { name: "User", attributes: ["id", "email"] },
      { name: "Order", attributes: ["id", "total"] },
    ],
    relations: [{ from: "User", to: "Order", cardinality: "1:N" }],
  });
  assert.equal(ok.ok, true);
}

// Flow reachability
{
  const bad = validateDiagramSpec("flow", {
    kind: "flow",
    steps: [
      { id: "s", label: "Start", type: "start" },
      { id: "e", label: "End", type: "end" },
      { id: "x", label: "Orphan", type: "process" },
    ],
    edges: [{ from: "s", to: "e" }],
  });
  assert.equal(bad.ok, false);

  const ok = validateDiagramSpec("flow", {
    kind: "flow",
    steps: [
      { id: "s", label: "Start", type: "start" },
      { id: "p", label: "Process", type: "process" },
      { id: "e", label: "End", type: "end" },
    ],
    edges: [
      { from: "s", to: "p" },
      { from: "p", to: "e" },
    ],
  });
  assert.equal(ok.ok, true);
}

// Use case
{
  const bad = validateDiagramSpec("usecase", {
    kind: "usecase",
    systemName: "App",
    actors: [{ id: "a1", label: "Student" }],
    useCases: [{ id: "u1", label: "Login" }],
    links: [{ actorId: "a1", useCaseId: "u1" }],
  });
  assert.equal(bad.ok, false);

  const ok = validateDiagramSpec("usecase", {
    kind: "usecase",
    systemName: "Campus App",
    actors: [{ id: "a1", label: "Student" }],
    useCases: [
      { id: "u1", label: "Login" },
      { id: "u2", label: "View Attendance" },
    ],
    links: [
      { actorId: "a1", useCaseId: "u1" },
      { actorId: "a1", useCaseId: "u2" },
    ],
  });
  assert.equal(ok.ok, true);
}

// Activity decision outs
{
  const bad = validateDiagramSpec("activity", {
    kind: "activity",
    steps: [
      { id: "s", label: "Start", type: "start" },
      { id: "d", label: "Check?", type: "decision" },
      { id: "e", label: "End", type: "end" },
    ],
    edges: [
      { from: "s", to: "d" },
      { from: "d", to: "e" },
    ],
  });
  assert.equal(bad.ok, false);

  const ok = validateDiagramSpec("activity", {
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
  assert.equal(ok.ok, true);
}

// Parse fences
{
  const raw = '```json\n{"kind":"architecture","nodes":[{"id":"a","label":"A"},{"id":"b","label":"B"},{"id":"c","label":"C"}],"edges":[{"from":"a","to":"b"}]}\n```';
  const parsed = parseAndValidateDiagramSpec("architecture", raw);
  assert.equal(parsed.ok, true);
}

assert.equal(emptyDiagramSpec("erd").kind, "erd");

console.log("verify_diagram_spec_phase_b: all checks passed");
