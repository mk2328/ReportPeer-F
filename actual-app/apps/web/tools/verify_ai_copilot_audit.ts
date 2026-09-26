/**
 * Offline verification for Academic AI Copilot safety helpers.
 * Run: npx tsx tools/verify_ai_copilot_audit.ts
 */
import assert from "node:assert/strict";
import {
  appendAiDraftToBlocks,
  replaceParagraphBlocksWithAiDraft,
  sectionHasParagraphContent,
  type ContentBlock,
} from "../src/lib/structureUtils";
import { EMPTY_AI_PROFILE_MESSAGE } from "../src/services/ai/aiProfile";
import {
  AI_REFINE_MODE_INSTRUCTIONS,
  isUsableAiDraft,
  JUW_SYSTEM_PROMPT,
  JUW_ACADEMIC_WRITING_RULES,
} from "../src/services/ai/prompts";
import {
  formatJuwSectionGuideForPrompt,
  resolveJuwSectionGuide,
} from "../src/services/ai/juwSectionGuide";
import { buildGenerateContext } from "../src/services/ai/buildContext";

function para(id: string, text: string): ContentBlock {
  return { id, type: "paragraph", text };
}

function list(id: string): ContentBlock {
  return {
    id,
    type: "list",
    listType: "bullet",
    items: [{ id: `${id}-i1`, text: "Keep this bullet", level: 0 }],
  };
}

function figure(id: string): ContentBlock {
  return {
    id,
    type: "figure",
    caption: "Figure 1: Architecture",
    fileName: "architecture.png",
    mimeType: "image/png",
    dataUrl: "data:image/png;base64,abc",
    widthPercent: 80,
    align: "center",
  };
}

// --- Draft validation ---
assert.equal(isUsableAiDraft(""), false);
assert.equal(isUsableAiDraft("short"), false);
assert.equal(isUsableAiDraft(EMPTY_AI_PROFILE_MESSAGE, EMPTY_AI_PROFILE_MESSAGE), false);
assert.equal(
  isUsableAiDraft(
    "This is a sufficiently long academic paragraph for a draft preview."
  ),
  true
);

// --- Append does not overwrite ---
{
  const blocks: ContentBlock[] = [
    para("p1", "Existing paragraph one."),
    list("l1"),
    figure("f1"),
  ];
  const next = appendAiDraftToBlocks(
    blocks,
    "New AI paragraph A.\n\nNew AI paragraph B."
  );
  assert.equal(
    next.filter((b) => b.type === "paragraph" && b.text.includes("Existing")).length,
    1
  );
  assert.equal(next.filter((b) => b.type === "list").length, 1);
  assert.equal(next.filter((b) => b.type === "figure").length, 1);
  assert.ok(next.some((b) => b.type === "paragraph" && b.text.includes("New AI paragraph A")));
}

// --- Replace paragraphs preserves non-paragraphs ---
{
  const blocks: ContentBlock[] = [
    para("p1", "Old A"),
    list("l1"),
    para("p2", "Old B"),
    figure("f1"),
    para("p3", "Old C"),
  ];
  const next = replaceParagraphBlocksWithAiDraft(
    blocks,
    "Replaced one.\n\nReplaced two."
  );
  const texts = next
    .filter((b): b is Extract<ContentBlock, { type: "paragraph" }> => b.type === "paragraph")
    .map((b) => b.text);
  assert.deepEqual(texts, ["Replaced one.", "Replaced two."]);
  assert.equal(next.filter((b) => b.type === "list").length, 1);
  assert.equal(next.filter((b) => b.type === "figure").length, 1);
  assert.equal(next[0].type, "paragraph");
  assert.equal(next[1].type, "list");
  assert.equal(next[2].type, "paragraph");
  assert.equal(next[3].type, "figure");
}

// --- Replace with more draft paras than existing ---
{
  const blocks: ContentBlock[] = [para("p1", "Only one"), list("l1")];
  const next = replaceParagraphBlocksWithAiDraft(blocks, "A.\n\nB.\n\nC.");
  assert.equal(next.filter((b) => b.type === "paragraph").length, 3);
  assert.equal(next.filter((b) => b.type === "list").length, 1);
}

assert.equal(sectionHasParagraphContent([para("p1", "hi")]), true);
assert.equal(sectionHasParagraphContent([para("p1", "  "), list("l1")]), false);

// --- Prompt safety rails present ---
assert.match(JUW_SYSTEM_PROMPT, /third[- ]person/i);
assert.match(JUW_ACADEMIC_WRITING_RULES, /Do not invent/i);
assert.ok(AI_REFINE_MODE_INSTRUCTIONS.grammar.includes("grammar"));
assert.ok(AI_REFINE_MODE_INSTRUCTIONS.tone.includes("academic"));
assert.ok(AI_REFINE_MODE_INSTRUCTIONS.refine.includes("Refine"));
assert.ok(AI_REFINE_MODE_INSTRUCTIONS.humanize.includes("natural"));
assert.match(AI_REFINE_MODE_INSTRUCTIONS.humanize, /Do not invent/i);
assert.match(AI_REFINE_MODE_INSTRUCTIONS.humanize, /third-person/i);

const guide = resolveJuwSectionGuide({
  sectionTitle: "Abstract",
  chapterNumber: null,
  isChapterHeading: false,
});
assert.ok(guide.sectionName === "Abstract");
assert.ok(formatJuwSectionGuideForPrompt(guide).length > 20);

// --- Context: empty profile + section targeting ---
{
  const ctx = buildGenerateContext(
    {
      title: "Campus Attendance System",
      structure: [
        {
          id: "abstract",
          title: "Abstract",
          level: 1,
          blocks: [{ id: "p1", type: "paragraph", text: "Prior draft text remains in context." }],
        },
      ],
      contentMap: {},
      aiProfile: {},
    },
    "abstract"
  );
  assert.equal(ctx.profileEmpty, true);
  assert.ok(ctx.existingContent.includes("Prior draft"));
  assert.ok(ctx.juwSectionGuideText.includes("JUW section guide"));
}

console.log("verify_ai_copilot_audit: all checks passed");
