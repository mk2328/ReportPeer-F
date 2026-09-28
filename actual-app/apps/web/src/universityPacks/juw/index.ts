import type { UniversityPack } from "@/universityPacks/types";
import { JUW_CHAPTER_STRUCTURE } from "@/universityPacks/juw/chapterStructure";
import { JUW_EDITOR_SEED_STRUCTURE } from "@/universityPacks/juw/editorSeedStructure";
import {
  JUW_ACADEMIC_WRITING_RULES,
  JUW_ABSTRACT_GENERATION_RULES,
  JUW_SYSTEM_PROMPT,
} from "@/universityPacks/juw/aiRules";

/**
 * JUW university pack (web-facing).
 * Formatting SoT remains apps/engine/templates/juw/config.json + template.docx.
 */
export const juwUniversityPack: UniversityPack = {
  id: "juw",
  displayName: "Jinnah University for Women",
  aliases: [
    "juw",
    "jinnah university for women",
    "jinnah university for women (juw)",
  ],
  chapterStructure: JUW_CHAPTER_STRUCTURE,
  editorSeedStructure: JUW_EDITOR_SEED_STRUCTURE,
  academicWritingRules: JUW_ACADEMIC_WRITING_RULES,
  systemPrompt: JUW_SYSTEM_PROMPT,
  abstractGenerationRules: JUW_ABSTRACT_GENERATION_RULES,
  engineFormattingConfig: "config.json",
  engineTemplateDocx: "template.docx",
};

export {
  JUW_CHAPTER_STRUCTURE,
  JUW_EDITOR_SEED_STRUCTURE,
  JUW_ACADEMIC_WRITING_RULES,
  JUW_ABSTRACT_GENERATION_RULES,
  JUW_SYSTEM_PROMPT,
};
