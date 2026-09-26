/**
 * Typed DiagramSpec models + parse/validate for FYP Diagrams (Phase B).
 * No Mermaid / PNG — structured data only.
 */

import type { FypDiagramKind } from "@/services/ai/fypDiagrams";

export type DiagramCardinality = "1:1" | "1:N" | "N:1" | "N:M" | "0..1:1" | "0..1:N" | "1:0..N";

export type ArchitectureNode = {
  id: string;
  label: string;
  layer?: string;
};

export type ArchitectureEdge = {
  from: string;
  to: string;
  label?: string;
};

export type ArchitectureSpec = {
  kind: "architecture";
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
};

export type ErdEntity = {
  name: string;
  attributes: string[];
};

export type ErdRelation = {
  from: string;
  to: string;
  cardinality: DiagramCardinality | string;
  label?: string;
};

export type ErdSpec = {
  kind: "erd";
  entities: ErdEntity[];
  relations: ErdRelation[];
};

export type FlowStepType = "start" | "end" | "process" | "decision";

export type FlowStep = {
  id: string;
  label: string;
  type: FlowStepType;
};

export type FlowEdge = {
  from: string;
  to: string;
  label?: string;
};

export type FlowSpec = {
  kind: "flow";
  steps: FlowStep[];
  edges: FlowEdge[];
};

export type UseCaseActor = {
  id: string;
  label: string;
};

export type UseCaseItem = {
  id: string;
  label: string;
};

export type UseCaseLink = {
  actorId: string;
  useCaseId: string;
};

export type UseCaseSpec = {
  kind: "usecase";
  systemName: string;
  actors: UseCaseActor[];
  useCases: UseCaseItem[];
  links: UseCaseLink[];
};

export type ActivityStepType = "start" | "end" | "action" | "decision";

export type ActivityStep = {
  id: string;
  label: string;
  type: ActivityStepType;
};

export type ActivityEdge = {
  from: string;
  to: string;
  label?: string;
};

export type ActivitySpec = {
  kind: "activity";
  steps: ActivityStep[];
  edges: ActivityEdge[];
};

export type DiagramSpec =
  | ArchitectureSpec
  | ErdSpec
  | FlowSpec
  | UseCaseSpec
  | ActivitySpec;

export type DiagramValidationResult =
  | { ok: true; spec: DiagramSpec }
  | { ok: false; error: string };

const CARDINALITIES = new Set([
  "1:1",
  "1:N",
  "N:1",
  "N:M",
  "0..1:1",
  "0..1:N",
  "1:0..N",
]);

function asString(value: unknown, max = 200): string {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

function stripJsonFence(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function uniqueIds(ids: string[]): boolean {
  return new Set(ids).size === ids.length;
}

function reachableFrom(
  startId: string,
  edges: Array<{ from: string; to: string }>,
  allIds: Set<string>
): Set<string> {
  const seen = new Set<string>();
  const queue = [startId];
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id) || !allIds.has(id)) continue;
    seen.add(id);
    for (const edge of edges) {
      if (edge.from === id && !seen.has(edge.to)) queue.push(edge.to);
    }
  }
  return seen;
}

function validateArchitecture(raw: Record<string, unknown>): DiagramValidationResult {
  const nodesRaw = Array.isArray(raw.nodes) ? raw.nodes : [];
  const edgesRaw = Array.isArray(raw.edges) ? raw.edges : [];
  const nodes: ArchitectureNode[] = [];
  for (const entry of nodesRaw.slice(0, 40)) {
    if (!entry || typeof entry !== "object") continue;
    const id = asString((entry as ArchitectureNode).id, 64);
    const label = asString((entry as ArchitectureNode).label, 120);
    if (!id || !label) continue;
    const layer = asString((entry as ArchitectureNode).layer, 80) || undefined;
    nodes.push(layer ? { id, label, layer } : { id, label });
  }
  if (nodes.length < 3) {
    return { ok: false, error: "Architecture requires at least 3 components/nodes." };
  }
  if (!uniqueIds(nodes.map((n) => n.id))) {
    return { ok: false, error: "Architecture node ids must be unique." };
  }
  const idSet = new Set(nodes.map((n) => n.id));
  const edges: ArchitectureEdge[] = [];
  for (const entry of edgesRaw.slice(0, 80)) {
    if (!entry || typeof entry !== "object") continue;
    const from = asString((entry as ArchitectureEdge).from, 64);
    const to = asString((entry as ArchitectureEdge).to, 64);
    if (!from || !to) continue;
    if (!idSet.has(from) || !idSet.has(to)) {
      return {
        ok: false,
        error: `Architecture edge references unknown node (${from} → ${to}).`,
      };
    }
    const label = asString((entry as ArchitectureEdge).label, 80) || undefined;
    edges.push(label ? { from, to, label } : { from, to });
  }
  if (edges.length === 0) {
    return { ok: false, error: "Architecture requires at least one valid edge." };
  }
  return { ok: true, spec: { kind: "architecture", nodes, edges } };
}

function validateErd(raw: Record<string, unknown>): DiagramValidationResult {
  const entitiesRaw = Array.isArray(raw.entities) ? raw.entities : [];
  const relationsRaw = Array.isArray(raw.relations) ? raw.relations : [];
  const entities: ErdEntity[] = [];
  for (const entry of entitiesRaw.slice(0, 30)) {
    if (!entry || typeof entry !== "object") continue;
    const name = asString((entry as ErdEntity).name, 80);
    if (!name) continue;
    const attrsRaw = Array.isArray((entry as ErdEntity).attributes)
      ? (entry as ErdEntity).attributes
      : [];
    const attributes = attrsRaw
      .map((a) => asString(a, 80))
      .filter(Boolean)
      .slice(0, 24);
    entities.push({ name, attributes });
  }
  if (entities.length < 2) {
    return { ok: false, error: "ERD requires at least 2 entities." };
  }
  const names = new Set(entities.map((e) => e.name.toLowerCase()));
  if (names.size !== entities.length) {
    return { ok: false, error: "ERD entity names must be unique." };
  }
  const relations: ErdRelation[] = [];
  for (const entry of relationsRaw.slice(0, 40)) {
    if (!entry || typeof entry !== "object") continue;
    const from = asString((entry as ErdRelation).from, 80);
    const to = asString((entry as ErdRelation).to, 80);
    const cardinality = asString((entry as ErdRelation).cardinality, 24);
    if (!from || !to || !cardinality) continue;
    if (!names.has(from.toLowerCase()) || !names.has(to.toLowerCase())) {
      return {
        ok: false,
        error: `ERD relation references unknown entity (${from} → ${to}).`,
      };
    }
    if (!CARDINALITIES.has(cardinality)) {
      return {
        ok: false,
        error: `Invalid ERD cardinality "${cardinality}". Use 1:1, 1:N, N:1, N:M, 0..1:1, 0..1:N, or 1:0..N.`,
      };
    }
    const label = asString((entry as ErdRelation).label, 80) || undefined;
    relations.push(label ? { from, to, cardinality, label } : { from, to, cardinality });
  }
  if (relations.length === 0) {
    return { ok: false, error: "ERD requires at least one relation." };
  }
  return { ok: true, spec: { kind: "erd", entities, relations } };
}

function validateFlowLike(
  kind: "flow" | "activity",
  raw: Record<string, unknown>
): DiagramValidationResult {
  const stepsRaw = Array.isArray(raw.steps) ? raw.steps : [];
  const edgesRaw = Array.isArray(raw.edges) ? raw.edges : [];
  const allowed =
    kind === "flow"
      ? new Set(["start", "end", "process", "decision"])
      : new Set(["start", "end", "action", "decision"]);

  const steps: Array<{ id: string; label: string; type: string }> = [];
  for (const entry of stepsRaw.slice(0, 50)) {
    if (!entry || typeof entry !== "object") continue;
    const id = asString((entry as FlowStep).id, 64);
    const label = asString((entry as FlowStep).label, 120);
    const type = asString((entry as FlowStep).type, 24).toLowerCase();
    if (!id || !label || !allowed.has(type)) continue;
    steps.push({ id, label, type });
  }
  if (!uniqueIds(steps.map((s) => s.id))) {
    return { ok: false, error: `${kind} step ids must be unique.` };
  }
  const starts = steps.filter((s) => s.type === "start");
  const ends = steps.filter((s) => s.type === "end");
  if (starts.length < 1 || ends.length < 1) {
    return { ok: false, error: `${kind} requires at least one start and one end step.` };
  }

  const idSet = new Set(steps.map((s) => s.id));
  const edges: FlowEdge[] = [];
  for (const entry of edgesRaw.slice(0, 80)) {
    if (!entry || typeof entry !== "object") continue;
    const from = asString((entry as FlowEdge).from, 64);
    const to = asString((entry as FlowEdge).to, 64);
    if (!from || !to) continue;
    if (!idSet.has(from) || !idSet.has(to)) {
      return {
        ok: false,
        error: `${kind} edge references unknown step (${from} → ${to}).`,
      };
    }
    const label = asString((entry as FlowEdge).label, 80) || undefined;
    edges.push(label ? { from, to, label } : { from, to });
  }
  if (edges.length === 0) {
    return { ok: false, error: `${kind} requires at least one edge.` };
  }

  const reachable = reachableFrom(starts[0].id, edges, idSet);
  for (const step of steps) {
    if (!reachable.has(step.id)) {
      return {
        ok: false,
        error: `${kind} step "${step.id}" is not reachable from start.`,
      };
    }
  }

  if (kind === "activity") {
    for (const step of steps.filter((s) => s.type === "decision")) {
      const outs = edges.filter((e) => e.from === step.id);
      if (outs.length < 2) {
        return {
          ok: false,
          error: `Activity decision "${step.id}" must have at least 2 outgoing paths.`,
        };
      }
    }
  }

  if (kind === "flow") {
    return {
      ok: true,
      spec: {
        kind: "flow",
        steps: steps as FlowStep[],
        edges,
      },
    };
  }
  return {
    ok: true,
    spec: {
      kind: "activity",
      steps: steps as ActivityStep[],
      edges,
    },
  };
}

function validateUseCase(raw: Record<string, unknown>): DiagramValidationResult {
  const systemName = asString(raw.systemName, 120) || "System";
  const actorsRaw = Array.isArray(raw.actors) ? raw.actors : [];
  const useCasesRaw = Array.isArray(raw.useCases) ? raw.useCases : [];
  const linksRaw = Array.isArray(raw.links) ? raw.links : [];

  const actors: UseCaseActor[] = [];
  for (const entry of actorsRaw.slice(0, 20)) {
    if (!entry || typeof entry !== "object") continue;
    const id = asString((entry as UseCaseActor).id, 64);
    const label = asString((entry as UseCaseActor).label, 80);
    if (!id || !label) continue;
    actors.push({ id, label });
  }
  const useCases: UseCaseItem[] = [];
  for (const entry of useCasesRaw.slice(0, 30)) {
    if (!entry || typeof entry !== "object") continue;
    const id = asString((entry as UseCaseItem).id, 64);
    const label = asString((entry as UseCaseItem).label, 120);
    if (!id || !label) continue;
    useCases.push({ id, label });
  }
  if (actors.length < 1) {
    return { ok: false, error: "Use case diagram requires at least 1 actor." };
  }
  if (useCases.length < 2) {
    return { ok: false, error: "Use case diagram requires at least 2 use cases." };
  }
  if (!uniqueIds(actors.map((a) => a.id)) || !uniqueIds(useCases.map((u) => u.id))) {
    return { ok: false, error: "Use case actor and use-case ids must be unique." };
  }
  const actorIds = new Set(actors.map((a) => a.id));
  const useCaseIds = new Set(useCases.map((u) => u.id));
  const links: UseCaseLink[] = [];
  for (const entry of linksRaw.slice(0, 60)) {
    if (!entry || typeof entry !== "object") continue;
    const actorId = asString((entry as UseCaseLink).actorId, 64);
    const useCaseId = asString((entry as UseCaseLink).useCaseId, 64);
    if (!actorId || !useCaseId) continue;
    if (!actorIds.has(actorId) || !useCaseIds.has(useCaseId)) {
      return {
        ok: false,
        error: `Use case link references unknown actor/use case (${actorId} → ${useCaseId}).`,
      };
    }
    links.push({ actorId, useCaseId });
  }
  if (links.length === 0) {
    return { ok: false, error: "Use case diagram requires at least one actor–use case link." };
  }
  return {
    ok: true,
    spec: { kind: "usecase", systemName, actors, useCases, links },
  };
}

/** Validate a loosely typed object into a DiagramSpec for the expected kind. */
export function validateDiagramSpec(
  kind: FypDiagramKind,
  raw: unknown
): DiagramValidationResult {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "Diagram spec must be a JSON object." };
  }
  const obj = raw as Record<string, unknown>;
  const declared = asString(obj.kind, 32).toLowerCase() || kind;
  if (declared && declared !== kind) {
    return {
      ok: false,
      error: `Spec kind "${declared}" does not match requested diagram "${kind}".`,
    };
  }

  switch (kind) {
    case "architecture":
      return validateArchitecture(obj);
    case "erd":
      return validateErd(obj);
    case "flow":
      return validateFlowLike("flow", obj);
    case "activity":
      return validateFlowLike("activity", obj);
    case "usecase":
      return validateUseCase(obj);
    default:
      return { ok: false, error: "Unsupported diagram kind." };
  }
}

/** Parse LLM output (JSON only, optional fences) and validate. */
export function parseAndValidateDiagramSpec(
  kind: FypDiagramKind,
  rawText: string
): DiagramValidationResult {
  const cleaned = stripJsonFence(rawText);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Try to extract first {...} block
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        parsed = JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        return { ok: false, error: "AI returned unparseable diagram JSON." };
      }
    } else {
      return { ok: false, error: "AI returned unparseable diagram JSON." };
    }
  }
  return validateDiagramSpec(kind, parsed);
}

export function emptyDiagramSpec(kind: FypDiagramKind): DiagramSpec {
  switch (kind) {
    case "architecture":
      return { kind, nodes: [], edges: [] };
    case "erd":
      return { kind, entities: [], relations: [] };
    case "flow":
      return { kind, steps: [], edges: [] };
    case "usecase":
      return { kind, systemName: "", actors: [], useCases: [], links: [] };
    case "activity":
      return { kind, steps: [], edges: [] };
  }
}

const FYP_DIAGRAM_KINDS: readonly FypDiagramKind[] = [
  "architecture",
  "erd",
  "flow",
  "usecase",
  "activity",
];

/**
 * Hydrate persisted project.diagramSpecs — keep only valid entries.
 * Invalid / unknown kinds are dropped (never crash the editor).
 */
export function normalizePersistedDiagramSpecs(
  raw: unknown
): Partial<Record<FypDiagramKind, DiagramSpec>> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Partial<Record<FypDiagramKind, DiagramSpec>> = {};
  const record = raw as Record<string, unknown>;
  for (const kind of FYP_DIAGRAM_KINDS) {
    if (!(kind in record)) continue;
    const validated = validateDiagramSpec(kind, record[kind]);
    if (validated.ok) out[kind] = validated.spec;
  }
  return out;
}
