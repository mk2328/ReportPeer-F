/**
 * Phase A unit checks for FYP Diagrams catalog + status helpers.
 * Run: npx tsx tools/verify_fyp_diagrams_phase_a.ts
 */
import assert from "node:assert/strict";
import type { ContentBlock, StructureItem } from "../src/lib/structureUtils";
import {
  FYP_DIAGRAM_CATALOG,
  countReadyFypDiagrams,
  findFypDiagramSection,
  getFypDiagramPurpose,
  getSectionFiguresWithImage,
  resolveFypDiagramStatus,
} from "../src/services/ai/fypDiagrams";

assert.equal(FYP_DIAGRAM_CATALOG.length, 5);
assert.deepEqual(
  FYP_DIAGRAM_CATALOG.map((e) => e.sectionId),
  ["ch3-1", "ch3-2", "ch3-3", "ch3-4", "ch3-5"]
);

assert.equal(resolveFypDiagramStatus({ inReportFigureCount: 0, hasLocalPreview: false }), "Missing");
assert.equal(resolveFypDiagramStatus({ inReportFigureCount: 0, hasLocalPreview: true }), "Preview");
assert.equal(resolveFypDiagramStatus({ inReportFigureCount: 1, hasLocalPreview: true }), "In report");
assert.equal(
  resolveFypDiagramStatus({ inReportFigureCount: 0, hasLocalPreview: false, needsDetails: true }),
  "Needs details"
);

assert.equal(
  countReadyFypDiagrams(["In report", "Missing", "In report", "Preview", "In report"]),
  3
);

const structure: StructureItem[] = [
  {
    id: "ch3",
    title: "CHAPTER 3 - ANALYSIS AND DESIGN",
    level: 1,
    subitems: [
      {
        id: "ch3-1",
        title: "System Architecture with Diagram",
        level: 2,
        blocks: [
          {
            id: "fig-1",
            type: "figure",
            caption: "Architecture",
            fileName: "arch.png",
            mimeType: "image/png",
            dataUrl: "data:image/png;base64,abc",
          },
        ],
      },
      {
        id: "ch3-2",
        title: "Entity Relationship Diagram",
        level: 2,
        blocks: [{ id: "p1", type: "paragraph", text: "No figure here." }],
      },
      {
        id: "ch2-extra",
        title: "Should not count",
        level: 2,
        blocks: [
          {
            id: "fig-other",
            type: "figure",
            caption: "Other chapter figure",
            fileName: "x.png",
            mimeType: "image/png",
            dataUrl: "data:image/png;base64,xyz",
          } as ContentBlock,
        ],
      },
    ],
  },
];

const arch = findFypDiagramSection(structure, FYP_DIAGRAM_CATALOG[0]);
assert.ok(arch);
assert.equal(arch!.id, "ch3-1");
assert.equal(getSectionFiguresWithImage(arch, {}).length, 1);

const erd = findFypDiagramSection(structure, FYP_DIAGRAM_CATALOG[1]);
assert.equal(getSectionFiguresWithImage(erd, {}).length, 0);

// Unrelated figure under wrong id must not count toward architecture
assert.equal(getSectionFiguresWithImage(findFypDiagramSection(structure, FYP_DIAGRAM_CATALOG[0]), {}).length, 1);

const purpose = getFypDiagramPurpose(FYP_DIAGRAM_CATALOG[0]);
assert.ok(purpose.length > 10);

console.log("verify_fyp_diagrams_phase_a: all checks passed");
