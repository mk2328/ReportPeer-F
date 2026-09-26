/**
 * Deterministic DiagramSpec → Mermaid source (Phase C).
 * No LLM. Invalid/empty specs should not be passed here — validate first.
 */

import type { DiagramSpec, DiagramCardinality } from "@/services/ai/diagramSpec";

function sanitizeId(raw: string, fallback: string): string {
  const cleaned = String(raw || "")
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!cleaned) return fallback;
  if (/^[0-9]/.test(cleaned)) return `n_${cleaned}`;
  return cleaned.slice(0, 48);
}

function escapeLabel(raw: string): string {
  return String(raw || "")
    .replace(/"/g, "'")
    .replace(/[\[\]{}|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function cardinalityArrow(cardinality: string): string {
  const c = String(cardinality || "").trim() as DiagramCardinality | string;
  switch (c) {
    case "1:1":
      return "||--||";
    case "1:N":
      return "||--o{";
    case "N:1":
      return "}o--||";
    case "N:M":
      return "}o--o{";
    case "0..1:1":
      return "|o--||";
    case "0..1:N":
      return "|o--o{";
    case "1:0..N":
      return "||--o{";
    default:
      return "||--o{";
  }
}

function architectureToMermaid(spec: Extract<DiagramSpec, { kind: "architecture" }>): string {
  const layers = new Map<string, typeof spec.nodes>();
  for (const node of spec.nodes) {
    const layer = escapeLabel(node.layer || "Components") || "Components";
    const list = layers.get(layer) || [];
    list.push(node);
    layers.set(layer, list);
  }
  const lines = ["flowchart TB"];
  let i = 0;
  for (const [layer, nodes] of layers) {
    const subId = sanitizeId(`layer_${layer}`, `layer_${i++}`);
    lines.push(`  subgraph ${subId}["${escapeLabel(layer)}"]`);
    for (const node of nodes) {
      const id = sanitizeId(node.id, "node");
      lines.push(`    ${id}["${escapeLabel(node.label)}"]`);
    }
    lines.push("  end");
  }
  for (const edge of spec.edges) {
    const from = sanitizeId(edge.from, "from");
    const to = sanitizeId(edge.to, "to");
    const label = escapeLabel(edge.label || "");
    if (label) lines.push(`  ${from} -->|"${label}"| ${to}`);
    else lines.push(`  ${from} --> ${to}`);
  }
  return lines.join("\n");
}

function erdToMermaid(spec: Extract<DiagramSpec, { kind: "erd" }>): string {
  const lines = ["erDiagram"];
  for (const rel of spec.relations) {
    const from = sanitizeId(rel.from, "EntityA").toUpperCase();
    const to = sanitizeId(rel.to, "EntityB").toUpperCase();
    const arrow = cardinalityArrow(rel.cardinality);
    const label = escapeLabel(rel.label || "rel") || "rel";
    lines.push(`  ${from} ${arrow} ${to} : "${label}"`);
  }
  for (const entity of spec.entities) {
    const name = sanitizeId(entity.name, "Entity").toUpperCase();
    lines.push(`  ${name} {`);
    const attrs = entity.attributes.length ? entity.attributes : ["id"];
    for (const attr of attrs.slice(0, 12)) {
      const safe = escapeLabel(attr).replace(/\s+/g, "_") || "field";
      lines.push(`    string ${safe}`);
    }
    lines.push("  }");
  }
  return lines.join("\n");
}

function flowLikeToMermaid(
  spec: Extract<DiagramSpec, { kind: "flow" | "activity" }>
): string {
  const lines = ["flowchart TD"];
  for (const step of spec.steps) {
    const id = sanitizeId(step.id, "step");
    const label = escapeLabel(step.label) || id;
    if (step.type === "start" || step.type === "end") {
      lines.push(`  ${id}([${label}])`);
    } else if (step.type === "decision") {
      lines.push(`  ${id}{${label}}`);
    } else {
      lines.push(`  ${id}[${label}]`);
    }
  }
  for (const edge of spec.edges) {
    const from = sanitizeId(edge.from, "from");
    const to = sanitizeId(edge.to, "to");
    const label = escapeLabel(edge.label || "");
    if (label) lines.push(`  ${from} -->|"${label}"| ${to}`);
    else lines.push(`  ${from} --> ${to}`);
  }
  return lines.join("\n");
}

function useCaseToMermaid(spec: Extract<DiagramSpec, { kind: "usecase" }>): string {
  const system = escapeLabel(spec.systemName || "System") || "System";
  const lines = ["flowchart LR"];
  for (const actor of spec.actors) {
    const id = sanitizeId(actor.id, "actor");
    lines.push(`  ${id}((${escapeLabel(actor.label) || id}))`);
  }
  lines.push(`  subgraph system["${system}"]`);
  for (const uc of spec.useCases) {
    const id = sanitizeId(uc.id, "uc");
    lines.push(`    ${id}([${escapeLabel(uc.label) || id}])`);
  }
  lines.push("  end");
  for (const link of spec.links) {
    const actorId = sanitizeId(link.actorId, "actor");
    const ucId = sanitizeId(link.useCaseId, "uc");
    lines.push(`  ${actorId} --- ${ucId}`);
  }
  return lines.join("\n");
}

/** Convert a validated DiagramSpec into Mermaid source. */
export function diagramSpecToMermaid(spec: DiagramSpec): string {
  switch (spec.kind) {
    case "architecture":
      return architectureToMermaid(spec);
    case "erd":
      return erdToMermaid(spec);
    case "flow":
    case "activity":
      return flowLikeToMermaid(spec);
    case "usecase":
      return useCaseToMermaid(spec);
    default:
      return "flowchart TD\n  empty[Unsupported diagram]";
  }
}

/** Convert SVG markup to a PNG data URL via canvas (browser-only). */
export async function svgMarkupToPngDataUrl(svgMarkup: string): Promise<string> {
  let svg = String(svgMarkup || "").trim();
  if (!svg) throw new Error("Empty SVG for export.");
  if (!svg.includes("xmlns=")) {
    svg = svg.replace(/<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  // Data URL is more reliable than blob URLs for Mermaid SVG (fonts / foreignObject).
  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load SVG for export."));
    image.src = dataUrl;
  });
  const width = Math.max(img.naturalWidth || 800, 320);
  const height = Math.max(img.naturalHeight || 480, 240);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable for diagram export.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL("image/png");
}
