"use client";

import type { DiagramSpec } from "@/services/ai/diagramSpec";

type Props = {
  spec: DiagramSpec;
  onChange: (next: DiagramSpec) => void;
};

/** Structured (non-JSON) editor for Phase B diagram specs. */
export function FypDiagramSpecEditor({ spec, onChange }: Props) {
  if (spec.kind === "architecture") {
    return (
      <div className="space-y-2 text-[11px]">
        <div className="font-medium text-slate-600">Nodes</div>
        {spec.nodes.map((node, index) => (
          <div key={node.id || index} className="grid grid-cols-3 gap-1">
            <input
              className="border border-slate-200 rounded px-1.5 py-1"
              value={node.id}
              placeholder="id"
              onChange={(e) => {
                const nodes = [...spec.nodes];
                nodes[index] = { ...node, id: e.target.value };
                onChange({ ...spec, nodes });
              }}
            />
            <input
              className="border border-slate-200 rounded px-1.5 py-1"
              value={node.label}
              placeholder="label"
              onChange={(e) => {
                const nodes = [...spec.nodes];
                nodes[index] = { ...node, label: e.target.value };
                onChange({ ...spec, nodes });
              }}
            />
            <input
              className="border border-slate-200 rounded px-1.5 py-1"
              value={node.layer || ""}
              placeholder="layer"
              onChange={(e) => {
                const nodes = [...spec.nodes];
                nodes[index] = { ...node, layer: e.target.value };
                onChange({ ...spec, nodes });
              }}
            />
          </div>
        ))}
        <button
          type="button"
          className="text-teal-800 hover:underline"
          onClick={() =>
            onChange({
              ...spec,
              nodes: [...spec.nodes, { id: `n${spec.nodes.length + 1}`, label: "Component" }],
            })
          }
        >
          + Node
        </button>
        <div className="font-medium text-slate-600 pt-1">Edges</div>
        {spec.edges.map((edge, index) => (
          <div key={index} className="grid grid-cols-3 gap-1">
            <input
              className="border border-slate-200 rounded px-1.5 py-1"
              value={edge.from}
              placeholder="from"
              onChange={(e) => {
                const edges = [...spec.edges];
                edges[index] = { ...edge, from: e.target.value };
                onChange({ ...spec, edges });
              }}
            />
            <input
              className="border border-slate-200 rounded px-1.5 py-1"
              value={edge.to}
              placeholder="to"
              onChange={(e) => {
                const edges = [...spec.edges];
                edges[index] = { ...edge, to: e.target.value };
                onChange({ ...spec, edges });
              }}
            />
            <input
              className="border border-slate-200 rounded px-1.5 py-1"
              value={edge.label || ""}
              placeholder="label"
              onChange={(e) => {
                const edges = [...spec.edges];
                edges[index] = { ...edge, label: e.target.value };
                onChange({ ...spec, edges });
              }}
            />
          </div>
        ))}
        <button
          type="button"
          className="text-teal-800 hover:underline"
          onClick={() =>
            onChange({
              ...spec,
              edges: [...spec.edges, { from: "", to: "" }],
            })
          }
        >
          + Edge
        </button>
      </div>
    );
  }

  if (spec.kind === "erd") {
    return (
      <div className="space-y-2 text-[11px]">
        <div className="font-medium text-slate-600">Entities</div>
        {spec.entities.map((entity, index) => (
          <div key={index} className="space-y-1 border border-slate-100 rounded p-1.5">
            <input
              className="w-full border border-slate-200 rounded px-1.5 py-1"
              value={entity.name}
              placeholder="Entity name"
              onChange={(e) => {
                const entities = [...spec.entities];
                entities[index] = { ...entity, name: e.target.value };
                onChange({ ...spec, entities });
              }}
            />
            <input
              className="w-full border border-slate-200 rounded px-1.5 py-1"
              value={entity.attributes.join(", ")}
              placeholder="attributes (comma-separated)"
              onChange={(e) => {
                const entities = [...spec.entities];
                entities[index] = {
                  ...entity,
                  attributes: e.target.value
                    .split(",")
                    .map((a) => a.trim())
                    .filter(Boolean),
                };
                onChange({ ...spec, entities });
              }}
            />
          </div>
        ))}
        <button
          type="button"
          className="text-teal-800 hover:underline"
          onClick={() =>
            onChange({
              ...spec,
              entities: [...spec.entities, { name: "Entity", attributes: ["id"] }],
            })
          }
        >
          + Entity
        </button>
        <div className="font-medium text-slate-600 pt-1">Relations</div>
        {spec.relations.map((rel, index) => (
          <div key={index} className="grid grid-cols-2 gap-1">
            <input
              className="border border-slate-200 rounded px-1.5 py-1"
              value={rel.from}
              placeholder="from"
              onChange={(e) => {
                const relations = [...spec.relations];
                relations[index] = { ...rel, from: e.target.value };
                onChange({ ...spec, relations });
              }}
            />
            <input
              className="border border-slate-200 rounded px-1.5 py-1"
              value={rel.to}
              placeholder="to"
              onChange={(e) => {
                const relations = [...spec.relations];
                relations[index] = { ...rel, to: e.target.value };
                onChange({ ...spec, relations });
              }}
            />
            <input
              className="border border-slate-200 rounded px-1.5 py-1"
              value={rel.cardinality}
              placeholder="1:N"
              onChange={(e) => {
                const relations = [...spec.relations];
                relations[index] = { ...rel, cardinality: e.target.value };
                onChange({ ...spec, relations });
              }}
            />
            <input
              className="border border-slate-200 rounded px-1.5 py-1"
              value={rel.label || ""}
              placeholder="label"
              onChange={(e) => {
                const relations = [...spec.relations];
                relations[index] = { ...rel, label: e.target.value };
                onChange({ ...spec, relations });
              }}
            />
          </div>
        ))}
        <button
          type="button"
          className="text-teal-800 hover:underline"
          onClick={() =>
            onChange({
              ...spec,
              relations: [...spec.relations, { from: "", to: "", cardinality: "1:N" }],
            })
          }
        >
          + Relation
        </button>
      </div>
    );
  }

  if (spec.kind === "usecase") {
    return (
      <div className="space-y-2 text-[11px]">
        <input
          className="w-full border border-slate-200 rounded px-1.5 py-1"
          value={spec.systemName}
          placeholder="System name"
          onChange={(e) => onChange({ ...spec, systemName: e.target.value })}
        />
        <div className="font-medium text-slate-600">Actors</div>
        {spec.actors.map((actor, index) => (
          <div key={index} className="grid grid-cols-2 gap-1">
            <input
              className="border border-slate-200 rounded px-1.5 py-1"
              value={actor.id}
              placeholder="id"
              onChange={(e) => {
                const actors = [...spec.actors];
                actors[index] = { ...actor, id: e.target.value };
                onChange({ ...spec, actors });
              }}
            />
            <input
              className="border border-slate-200 rounded px-1.5 py-1"
              value={actor.label}
              placeholder="label"
              onChange={(e) => {
                const actors = [...spec.actors];
                actors[index] = { ...actor, label: e.target.value };
                onChange({ ...spec, actors });
              }}
            />
          </div>
        ))}
        <button
          type="button"
          className="text-teal-800 hover:underline"
          onClick={() =>
            onChange({
              ...spec,
              actors: [...spec.actors, { id: `a${spec.actors.length + 1}`, label: "Actor" }],
            })
          }
        >
          + Actor
        </button>
        <div className="font-medium text-slate-600 pt-1">Use cases</div>
        {spec.useCases.map((uc, index) => (
          <div key={index} className="grid grid-cols-2 gap-1">
            <input
              className="border border-slate-200 rounded px-1.5 py-1"
              value={uc.id}
              placeholder="id"
              onChange={(e) => {
                const useCases = [...spec.useCases];
                useCases[index] = { ...uc, id: e.target.value };
                onChange({ ...spec, useCases });
              }}
            />
            <input
              className="border border-slate-200 rounded px-1.5 py-1"
              value={uc.label}
              placeholder="label"
              onChange={(e) => {
                const useCases = [...spec.useCases];
                useCases[index] = { ...uc, label: e.target.value };
                onChange({ ...spec, useCases });
              }}
            />
          </div>
        ))}
        <button
          type="button"
          className="text-teal-800 hover:underline"
          onClick={() =>
            onChange({
              ...spec,
              useCases: [
                ...spec.useCases,
                { id: `u${spec.useCases.length + 1}`, label: "Use case" },
              ],
            })
          }
        >
          + Use case
        </button>
        <div className="font-medium text-slate-600 pt-1">
          Actor → use case links (AI-derived; edit only if needed)
        </div>
        {spec.links.map((link, index) => (
          <div key={index} className="grid grid-cols-2 gap-1">
            <input
              className="border border-slate-200 rounded px-1.5 py-1"
              value={link.actorId}
              placeholder="actorId"
              onChange={(e) => {
                const links = [...spec.links];
                links[index] = { ...link, actorId: e.target.value };
                onChange({ ...spec, links });
              }}
            />
            <input
              className="border border-slate-200 rounded px-1.5 py-1"
              value={link.useCaseId}
              placeholder="useCaseId"
              onChange={(e) => {
                const links = [...spec.links];
                links[index] = { ...link, useCaseId: e.target.value };
                onChange({ ...spec, links });
              }}
            />
          </div>
        ))}
        <button
          type="button"
          className="text-teal-800 hover:underline"
          onClick={() =>
            onChange({
              ...spec,
              links: [...spec.links, { actorId: "", useCaseId: "" }],
            })
          }
        >
          + Link (optional)
        </button>
      </div>
    );
  }

  // flow | activity
  return (
    <div className="space-y-2 text-[11px]">
      <div className="font-medium text-slate-600">Steps</div>
      {spec.steps.map((step, index) => (
        <div key={index} className="grid grid-cols-3 gap-1">
          <input
            className="border border-slate-200 rounded px-1.5 py-1"
            value={step.id}
            placeholder="id"
            onChange={(e) => {
              const steps = [...spec.steps];
              steps[index] = { ...step, id: e.target.value } as typeof step;
              onChange({ ...spec, steps } as DiagramSpec);
            }}
          />
          <input
            className="border border-slate-200 rounded px-1.5 py-1"
            value={step.label}
            placeholder="label"
            onChange={(e) => {
              const steps = [...spec.steps];
              steps[index] = { ...step, label: e.target.value } as typeof step;
              onChange({ ...spec, steps } as DiagramSpec);
            }}
          />
          <select
            className="border border-slate-200 rounded px-1.5 py-1 bg-white"
            value={step.type}
            onChange={(e) => {
              const steps = [...spec.steps];
              steps[index] = { ...step, type: e.target.value } as typeof step;
              onChange({ ...spec, steps } as DiagramSpec);
            }}
          >
            {spec.kind === "flow" ? (
              <>
                <option value="start">start</option>
                <option value="end">end</option>
                <option value="process">process</option>
                <option value="decision">decision</option>
              </>
            ) : (
              <>
                <option value="start">start</option>
                <option value="end">end</option>
                <option value="action">action</option>
                <option value="decision">decision</option>
              </>
            )}
          </select>
        </div>
      ))}
      <button
        type="button"
        className="text-teal-800 hover:underline"
        onClick={() =>
          onChange({
            ...spec,
            steps: [
              ...spec.steps,
              {
                id: `s${spec.steps.length + 1}`,
                label: "Step",
                type: spec.kind === "flow" ? "process" : "action",
              },
            ],
          } as DiagramSpec)
        }
      >
        + Step
      </button>
      <div className="font-medium text-slate-600 pt-1">Edges</div>
      {spec.edges.map((edge, index) => (
        <div key={index} className="grid grid-cols-3 gap-1">
          <input
            className="border border-slate-200 rounded px-1.5 py-1"
            value={edge.from}
            placeholder="from"
            onChange={(e) => {
              const edges = [...spec.edges];
              edges[index] = { ...edge, from: e.target.value };
              onChange({ ...spec, edges } as DiagramSpec);
            }}
          />
          <input
            className="border border-slate-200 rounded px-1.5 py-1"
            value={edge.to}
            placeholder="to"
            onChange={(e) => {
              const edges = [...spec.edges];
              edges[index] = { ...edge, to: e.target.value };
              onChange({ ...spec, edges } as DiagramSpec);
            }}
          />
          <input
            className="border border-slate-200 rounded px-1.5 py-1"
            value={edge.label || ""}
            placeholder="label"
            onChange={(e) => {
              const edges = [...spec.edges];
              edges[index] = { ...edge, label: e.target.value };
              onChange({ ...spec, edges } as DiagramSpec);
            }}
          />
        </div>
      ))}
      <button
        type="button"
        className="text-teal-800 hover:underline"
        onClick={() =>
          onChange({
            ...spec,
            edges: [...spec.edges, { from: "", to: "" }],
          } as DiagramSpec)
        }
      >
        + Edge
      </button>
    </div>
  );
}

/** Compact read-only summary of a validated spec. */
export function FypDiagramSpecSummary({ spec }: { spec: DiagramSpec }) {
  if (spec.kind === "architecture") {
    return (
      <div className="text-[11px] text-slate-700 space-y-1">
        <div className="font-medium text-slate-800">Architecture spec</div>
        <div>{spec.nodes.length} nodes · {spec.edges.length} edges</div>
        <ul className="list-disc pl-4 space-y-0.5">
          {spec.nodes.slice(0, 8).map((n) => (
            <li key={n.id}>
              {n.label}
              {n.layer ? ` (${n.layer})` : ""}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (spec.kind === "erd") {
    return (
      <div className="text-[11px] text-slate-700 space-y-1">
        <div className="font-medium text-slate-800">ERD spec</div>
        <div>{spec.entities.length} entities · {spec.relations.length} relations</div>
        <ul className="list-disc pl-4 space-y-0.5">
          {spec.entities.slice(0, 8).map((e) => (
            <li key={e.name}>
              {e.name}
              {e.attributes.length ? ` — ${e.attributes.slice(0, 4).join(", ")}` : ""}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (spec.kind === "usecase") {
    return (
      <div className="text-[11px] text-slate-700 space-y-1">
        <div className="font-medium text-slate-800">Use case spec</div>
        <div>{spec.systemName || "System"}</div>
        <div>
          {spec.actors.length} actors · {spec.useCases.length} use cases · {spec.links.length} links
        </div>
      </div>
    );
  }
  return (
    <div className="text-[11px] text-slate-700 space-y-1">
      <div className="font-medium text-slate-800">
        {spec.kind === "flow" ? "Flow" : "Activity"} spec
      </div>
      <div>
        {spec.steps.length} steps · {spec.edges.length} edges
      </div>
      <ul className="list-disc pl-4 space-y-0.5">
        {spec.steps.slice(0, 8).map((s) => (
          <li key={s.id}>
            [{s.type}] {s.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
