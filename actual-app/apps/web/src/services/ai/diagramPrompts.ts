/**
 * Prompts for FYP diagram clarify + generate-spec (Phase B).
 * Output is DiagramSpec JSON only — no Mermaid, no images.
 *
 * Input policy: Project AI Profile + report/section context are primary.
 * Ask the user only for the minimum diagram-specific facts that cannot
 * be reliably derived. Never invent project facts.
 */

import type { ClarificationAnswer } from "@/services/ai/prompts";
import { formatClarificationAnswers } from "@/services/ai/prompts";
import type { FypDiagramKind } from "@/services/ai/fypDiagrams";
import { FYP_DIAGRAM_CATALOG } from "@/services/ai/fypDiagrams";

function catalogLabel(kind: FypDiagramKind): string {
  return FYP_DIAGRAM_CATALOG.find((e) => e.kind === kind)?.label || kind;
}

function schemaHint(kind: FypDiagramKind): string {
  switch (kind) {
    case "architecture":
      return `Schema:
{"kind":"architecture","nodes":[{"id":"n1","label":"...","layer":"optional"}],"edges":[{"from":"n1","to":"n2","label":"optional"}]}
Rules: ≥3 nodes, unique ids, every edge endpoint must exist, ≥1 edge.`;
    case "erd":
      return `Schema:
{"kind":"erd","entities":[{"name":"Entity","attributes":["id","..."]}],"relations":[{"from":"A","to":"B","cardinality":"1:N","label":"optional"}]}
Rules: ≥2 entities, unique names, ≥1 relation, cardinality in 1:1|1:N|N:1|N:M|0..1:1|0..1:N|1:0..N.`;
    case "flow":
      return `Schema:
{"kind":"flow","steps":[{"id":"s1","label":"...","type":"start|end|process|decision"}],"edges":[{"from":"s1","to":"s2","label":"optional"}]}
Rules: ≥1 start and ≥1 end, all steps reachable from start, ≥1 edge.`;
    case "usecase":
      return `Schema:
{"kind":"usecase","systemName":"...","actors":[{"id":"a1","label":"..."}],"useCases":[{"id":"u1","label":"..."}],"links":[{"actorId":"a1","useCaseId":"u1"}]}
Rules: ≥1 actor, ≥2 use cases, ≥1 valid link. Links are derived by you — never ask the user to list connections.`;
    case "activity":
      return `Schema:
{"kind":"activity","steps":[{"id":"s1","label":"...","type":"start|end|action|decision"}],"edges":[{"from":"s1","to":"s2","label":"optional"}]}
Rules: ≥1 start and ≥1 end, all steps reachable from start, each decision ≥2 outgoing edges.`;
  }
}

/** What the user may need to supply vs what AI must derive (clarify + generate). */
function diagramInputPolicy(kind: FypDiagramKind): string {
  switch (kind) {
    case "architecture":
      return [
        "USER INPUT (only if missing from context): high-level system components only.",
        'Example answer format: "Components: Web App, Mobile App, Backend, Database, AI Services"',
        "YOU DERIVE (from profile + report + components): relationships, request/data flow, logical layers/layout, edge labels when supported.",
        "Do NOT ask the user to define every connection or edge.",
        "Ask only if essential components cannot be identified from Project AI Profile / report content.",
        'Good question example: "What are the main system components (e.g. web app, backend, database)?"',
        "Bad: asking for every connection, API route, or deployment detail.",
      ].join("\n");
    case "erd":
      return [
        "USER INPUT (only if missing from context): essential entity names only.",
        'Example answer format: "Entities: User, Project, Report, Reference"',
        "YOU DERIVE (only when supported by context): attributes, keys, relationships, cardinality.",
        "Do NOT invent entities, attributes, or relationships not supported by profile/report/clarifications.",
        "Ask only if core entities cannot be identified from context.",
        'Good question example: "Which main data entities does the system store?"',
        "Bad: asking for a full attribute list, FK design, or every cardinality up front.",
      ].join("\n");
    case "flow":
      return [
        "USER INPUT (only if missing from context): the main end-to-end workflow steps only.",
        'Example answer format: "Workflow: Login → Create Project → Write Report → AI Assistance → Generate Report"',
        "YOU DERIVE: intermediate steps and decisions only when explicitly supported by context.",
        "Do NOT invent workflow steps or branches.",
        "Ask only if the main user/system workflow cannot be derived.",
        'Good question example: "What is the main user workflow from start to finish?"',
        "Bad: asking for every intermediate micro-step or all decision conditions.",
      ].join("\n");
    case "usecase":
      return [
        "USER INPUT (only if missing from context): Actors and Use Cases only.",
        'Example: "Actors: Student, Project Advisor" and "Use Cases: Create Report, Edit Report, Generate AI Content, Manage References, Export DOCX/PDF"',
        "NEVER ask the user for Connections, associations, includes/extends, or actor→use-case links.",
        "YOU MUST DERIVE links from actors + use cases + Project AI Profile + report context.",
        "If a specific actor–use-case relationship is genuinely unclear, ask one short question about that relationship — do not request a full connections matrix.",
        'Good question example: "Which users interact directly with the system?" or "What are the main use cases for students?"',
        "Bad: asking for actors, use cases, relationships, system boundaries, and associations all at once.",
      ].join("\n");
    case "activity":
      return [
        "USER INPUT (only if missing from context): the main activity/workflow only.",
        "YOU DERIVE: actions, sequence, decisions, branches, and end states only when supported by context.",
        "Do NOT invent activity steps or decision outcomes.",
        "Ask only if an essential activity path or decision cannot be determined.",
        'Good question example: "What is the main activity path, and which decision points matter?"',
        "Bad: asking for a complete UML activity inventory before any context is used.",
      ].join("\n");
  }
}

const SHARED_ANTI_HALLUCINATION = [
  "ANTI-HALLUCINATION (critical):",
  "- Project AI Profile + existing report/section content + user clarifications are the ONLY factual sources.",
  "- NEVER invent actors, entities, attributes, components, APIs, technologies, workflows, relationships, features, or system behavior.",
  "- If a fact is unavailable: ask one short clarification question, OR omit non-essential detail.",
  "- Prefer generating from known context over asking. Ask ONLY for genuinely missing essentials.",
].join("\n");

export function buildDiagramClarificationPrompt(params: {
  kind: FypDiagramKind;
  projectTitle: string;
  sectionTitle: string;
  sectionPath: string;
  existingContent: string;
  aiProfileText: string;
  juwSectionGuideText: string;
  siblingSections: string[];
  clarificationAnswers?: ClarificationAnswer[];
}): string {
  const clarifications = formatClarificationAnswers(params.clarificationAnswers);
  return [
    "You assess whether enough factual project information exists to build a structured FYP diagram spec.",
    'Reply with JSON only: {"needs_clarification":boolean,"question":string|null}',
    "Inspect: (1) Project AI Profile, (2) existing section/report content, (3) JUW section purpose, (4) prior clarifications.",
    "Decide what is confidently known vs genuinely missing.",
    "Ask at most ONE short, specific question — only if an essential diagram fact cannot be derived.",
    "If profile + section content + clarifications are enough, set needs_clarification to false and question to null.",
    "Do not ask questionnaires. Do not ask for information the user already provided. Do not ask for details AI should derive.",
    "",
    SHARED_ANTI_HALLUCINATION,
    "",
    `Diagram type: ${catalogLabel(params.kind)} (${params.kind})`,
    "Minimum input policy for this diagram:",
    diagramInputPolicy(params.kind),
    "",
    `Project title: ${params.projectTitle || "Untitled FYP"}`,
    `Target section: ${params.sectionPath || params.sectionTitle}`,
    params.juwSectionGuideText?.trim() || "",
    `Sibling Chapter 3 sections: ${params.siblingSections.join(", ") || "(none)"}`,
    "",
    "Project AI Profile:",
    params.aiProfileText || "(empty)",
    "",
    "Existing section content:",
    params.existingContent.trim() || "(empty)",
    clarifications ? `\nUser clarifications:\n${clarifications}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildDiagramGenerateSpecPrompt(params: {
  kind: FypDiagramKind;
  projectTitle: string;
  sectionTitle: string;
  sectionPath: string;
  existingContent: string;
  aiProfileText: string;
  juwSectionGuideText: string;
  siblingSections: string[];
  clarificationAnswers?: ClarificationAnswer[];
}): string {
  const clarifications = formatClarificationAnswers(params.clarificationAnswers);
  return [
    "You create a structured DiagramSpec JSON for a JUW FYP report diagram.",
    "Output JSON only — no markdown prose, no Mermaid, no image, no code fences.",
    "Primary sources: Project AI Profile, existing section/report content, JUW section guide, user clarifications.",
    "Intelligently derive diagram structure from those sources. Do not require the user to have supplied every node/edge.",
    "Keep labels concise and academic.",
    "",
    SHARED_ANTI_HALLUCINATION,
    "",
    "Generation policy for this diagram:",
    diagramInputPolicy(params.kind),
    "",
    schemaHint(params.kind),
    "",
    `Diagram type: ${catalogLabel(params.kind)} (${params.kind})`,
    `Project title: ${params.projectTitle || "Untitled FYP"}`,
    `Target section: ${params.sectionPath || params.sectionTitle}`,
    params.juwSectionGuideText?.trim() || "",
    `Sibling Chapter 3 sections: ${params.siblingSections.join(", ") || "(none)"}`,
    "",
    "Project AI Profile:",
    params.aiProfileText || "(empty)",
    "",
    "Existing section content:",
    params.existingContent.trim() || "(empty)",
    clarifications ? `\nUser clarifications (treat as project facts):\n${clarifications}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
