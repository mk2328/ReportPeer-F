/**
 * University pack resolver + JUW seed/structure smoke checks.
 * Run: npx tsx tools/verify_university_pack.ts
 */
import assert from "node:assert/strict";
import {
  listUniversityPackIds,
  normalizeUniversitySlug,
  resolveUniversityPack,
} from "../src/universityPacks";
import { JUW_CHAPTER_STRUCTURE } from "../src/services/ai/juwSectionGuide";
import {
  ABSTRACT_GENERATION_RULES,
  JUW_ACADEMIC_WRITING_RULES,
  JUW_SYSTEM_PROMPT,
} from "../src/services/ai/prompts";

assert.deepEqual(listUniversityPackIds(), ["juw"]);
assert.equal(normalizeUniversitySlug("JUW"), "juw");
assert.equal(normalizeUniversitySlug("Jinnah University for Women"), "juw");
assert.equal(normalizeUniversitySlug("unknown-uni"), "juw");

const pack = resolveUniversityPack("juw");
assert.equal(pack.id, "juw");
assert.equal(pack.engineFormattingConfig, "config.json");
assert.equal(pack.engineTemplateDocx, "template.docx");
assert.ok(pack.chapterStructure.length >= 7);
assert.equal(pack.chapterStructure[0].title, "Introduction");
assert.ok(pack.editorSeedStructure.some((n) => n.id === "abstract"));
assert.ok(
  pack.editorSeedStructure.some(
    (n) => n.id === "ch3" && n.subitems?.some((s) => s.id === "ch3-1")
  )
);

// Compatibility re-exports still point at pack content
assert.equal(JUW_CHAPTER_STRUCTURE[2].title, "Analysis and Design");
assert.match(JUW_ACADEMIC_WRITING_RULES, /third person/i);
assert.match(JUW_SYSTEM_PROMPT, /Jinnah University for Women/i);
assert.match(ABSTRACT_GENERATION_RULES, /Abstract-specific/i);

// Seed Ch.3 titles match prior hardcoded project create (regression lock)
const ch3 = pack.editorSeedStructure.find((n) => n.id === "ch3");
assert.ok(ch3?.subitems);
assert.deepEqual(
  ch3!.subitems!.map((s) => s.id),
  ["ch3-1", "ch3-2", "ch3-3", "ch3-4", "ch3-5", "ch3-6"]
);

console.log("verify_university_pack: all checks passed");
