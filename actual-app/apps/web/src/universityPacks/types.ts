/**
 * University pack contracts (web-side).
 * Engine formatting remains in apps/engine/templates/<slug>/config.json + template.docx.
 */

export type UniversityChapterDef = {
  chapter: number;
  title: string;
  sections: string[];
};

/** Minimal editor structure node used when seeding a new project. */
export type UniversitySeedNode = {
  id: string;
  title: string;
  level: number;
  subitems?: UniversitySeedNode[];
};

export type UniversityPack = {
  id: string;
  displayName: string;
  aliases: string[];
  /** Canonical chapter/section list for AI section guides (matches engine config chapter_structure). */
  chapterStructure: readonly UniversityChapterDef[];
  /** Exact editor seed tree (ids/titles) for new projects. */
  editorSeedStructure: UniversitySeedNode[];
  /** Academic writing rules injected into AI prompts. */
  academicWritingRules: string;
  /** System prompt for the Academic AI Copilot. */
  systemPrompt: string;
  /** Abstract-only generation rules. */
  abstractGenerationRules: string;
  /**
   * Relative path under apps/engine/templates/<id>/ for formatting SoT.
   * Web does not apply these; the Python engine loads them.
   */
  engineFormattingConfig: string;
  engineTemplateDocx: string;
};
