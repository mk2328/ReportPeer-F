/**
 * Phase D: insert/replace rendered diagrams as figure ContentBlocks.
 * Run: npx tsx tools/verify_diagram_insert_phase_d.ts
 */
import assert from "node:assert/strict";
import type { ContentBlock } from "../src/lib/structureUtils";
import {
  FYP_DIAGRAM_CATALOG,
  applyDiagramFigureToBlocks,
  resolveDiagramInsertImage,
  resolveFypDiagramStatus,
} from "../src/services/ai/fypDiagrams";
import { normalizePersistedDiagramSpecs } from "../src/services/ai/diagramSpec";

assert.deepEqual(
  FYP_DIAGRAM_CATALOG.map((e) => [e.kind, e.sectionId]),
  [
    ["architecture", "ch3-1"],
    ["erd", "ch3-2"],
    ["flow", "ch3-3"],
    ["usecase", "ch3-4"],
    ["activity", "ch3-5"],
  ]
);

{
  const fromRender = resolveDiagramInsertImage({
    kind: "architecture",
    renderedPngDataUrl: "data:image/png;base64,AAA",
    uploadPreview: {
      dataUrl: "data:image/png;base64,UPLOAD",
      fileName: "upload.png",
      mimeType: "image/png",
    },
  });
  assert.ok(fromRender);
  assert.equal(fromRender!.dataUrl, "data:image/png;base64,AAA");
  assert.equal(fromRender!.fileName, "architecture.png");
  assert.equal(fromRender!.mimeType, "image/png");
}

{
  // SVG-only render (PNG conversion failed) must still unlock Insert.
  const fromSvg = resolveDiagramInsertImage({
    kind: "flow",
    renderedPngDataUrl: null,
    renderedSvg: '<svg width="10" height="10"><rect width="10" height="10"/></svg>',
    uploadPreview: null,
  });
  assert.ok(fromSvg);
  assert.equal(fromSvg!.mimeType, "image/svg+xml");
  assert.ok(fromSvg!.dataUrl.startsWith("data:image/svg+xml"));
  assert.equal(fromSvg!.fileName, "flow.svg");
}

{
  const fromUpload = resolveDiagramInsertImage({
    kind: "erd",
    renderedPngDataUrl: null,
    uploadPreview: {
      dataUrl: "data:image/jpeg;base64,BBB",
      fileName: "hand.erd.jpg",
      mimeType: "image/jpeg",
    },
  });
  assert.ok(fromUpload);
  assert.equal(fromUpload!.dataUrl, "data:image/jpeg;base64,BBB");
  assert.equal(fromUpload!.fileName, "hand.erd.jpg");
  assert.equal(fromUpload!.mimeType, "image/jpeg");
}

{
  const missing = resolveDiagramInsertImage({
    kind: "flow",
    renderedPngDataUrl: "not-a-data-url",
    uploadPreview: null,
  });
  assert.equal(missing, null);
}

const paragraph: ContentBlock = { id: "p1", type: "paragraph", text: "Intro" };
const otherFigure: ContentBlock = {
  id: "fig-other",
  type: "figure",
  caption: "Unrelated screenshot",
  fileName: "other.png",
  mimeType: "image/png",
  dataUrl: "data:image/png;base64,OTHER",
  widthPercent: 80,
  align: "left",
};

{
  const inserted = applyDiagramFigureToBlocks({
    blocks: [paragraph],
    image: {
      dataUrl: "data:image/png;base64,NEW",
      fileName: "architecture.png",
      mimeType: "image/png",
    },
    defaultCaption: "System architecture diagram",
    createId: () => "fig-arch",
  });
  assert.equal(inserted.mode, "insert");
  assert.equal(inserted.figureId, "fig-arch");
  assert.equal(inserted.blocks.length, 2);
  const fig = inserted.blocks[1];
  assert.equal(fig.type, "figure");
  if (fig.type === "figure") {
    assert.equal(fig.caption, "System architecture diagram");
    assert.equal(fig.widthPercent, 100);
    assert.equal(fig.align, "center");
    assert.equal(fig.dataUrl, "data:image/png;base64,NEW");
  }
}

{
  const existing: ContentBlock = {
    id: "fig-arch",
    type: "figure",
    caption: "Custom caption kept",
    fileName: "old.png",
    mimeType: "image/png",
    dataUrl: "data:image/png;base64,OLD",
    widthPercent: 70,
    align: "right",
  };
  const replaced = applyDiagramFigureToBlocks({
    blocks: [paragraph, existing, otherFigure],
    image: {
      dataUrl: "data:image/png;base64,REPLACED",
      fileName: "architecture.png",
      mimeType: "image/png",
    },
    defaultCaption: "System architecture diagram",
    existingFigureId: "fig-arch",
  });
  assert.equal(replaced.mode, "replace");
  assert.equal(replaced.figureId, "fig-arch");
  assert.equal(replaced.blocks.length, 3);
  const fig = replaced.blocks[1];
  assert.equal(fig.type, "figure");
  if (fig.type === "figure") {
    assert.equal(fig.id, "fig-arch");
    assert.equal(fig.caption, "Custom caption kept");
    assert.equal(fig.widthPercent, 70);
    assert.equal(fig.align, "right");
    assert.equal(fig.dataUrl, "data:image/png;base64,REPLACED");
    assert.equal(fig.fileName, "architecture.png");
  }
  const untouched = replaced.blocks[2];
  assert.equal(untouched.type, "figure");
  if (untouched.type === "figure") {
    assert.equal(untouched.id, "fig-other");
    assert.equal(untouched.dataUrl, "data:image/png;base64,OTHER");
  }
}

{
  // Without explicit id, replace first figure that has an image — not a duplicate insert.
  const existing: ContentBlock = {
    id: "fig-first",
    type: "figure",
    caption: "Keep me",
    fileName: "a.png",
    mimeType: "image/png",
    dataUrl: "data:image/png;base64,A",
  };
  const result = applyDiagramFigureToBlocks({
    blocks: [existing],
    image: {
      dataUrl: "data:image/png;base64,B",
      fileName: "b.png",
      mimeType: "image/png",
    },
    defaultCaption: "Ignored on replace",
  });
  assert.equal(result.mode, "replace");
  assert.equal(result.blocks.length, 1);
  assert.equal(result.blocks[0].type, "figure");
  if (result.blocks[0].type === "figure") {
    assert.equal(result.blocks[0].caption, "Keep me");
    assert.equal(result.blocks[0].dataUrl, "data:image/png;base64,B");
  }
}

assert.equal(
  resolveFypDiagramStatus({ inReportFigureCount: 1, hasLocalPreview: false }),
  "In report"
);

{
  // Persisted specs hydrate; invalid kinds dropped; status becomes Preview when not in report.
  const hydrated = normalizePersistedDiagramSpecs({
    architecture: {
      kind: "architecture",
      nodes: [
        { id: "ui", label: "UI", layer: "Presentation" },
        { id: "api", label: "API", layer: "Application" },
        { id: "db", label: "DB", layer: "Data" },
      ],
      edges: [{ from: "ui", to: "api" }, { from: "api", to: "db" }],
    },
    erd: { kind: "erd", entities: [], relations: "bad" },
    bogus: { kind: "architecture", nodes: [], edges: [] },
  });
  assert.ok(hydrated.architecture);
  assert.equal(hydrated.erd, undefined);
  assert.equal(
    resolveFypDiagramStatus({
      inReportFigureCount: 0,
      hasLocalPreview: Boolean(hydrated.architecture),
    }),
    "Preview"
  );
}

console.log("verify_diagram_insert_phase_d: all checks passed");
