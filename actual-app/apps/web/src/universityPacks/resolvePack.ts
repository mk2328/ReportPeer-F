import type { UniversityPack } from "@/universityPacks/types";
import { juwUniversityPack } from "@/universityPacks/juw";

const PACKS: Record<string, UniversityPack> = {
  [juwUniversityPack.id]: juwUniversityPack,
};

/** Normalize university labels to pack ids (mirrors engine config_loader aliases). */
export function normalizeUniversitySlug(university: string | null | undefined): string {
  if (!university) return juwUniversityPack.id;
  const key = university.trim().toLowerCase();
  for (const pack of Object.values(PACKS)) {
    if (pack.id === key || pack.aliases.some((a) => a === key)) {
      return pack.id;
    }
  }
  // Unknown universities fall back to JUW (same as engine Phase 1 behavior).
  return juwUniversityPack.id;
}

/**
 * Resolve a university pack by id or display name.
 * Only JUW is registered today; NED/IBA/FAST can register without changing callers.
 */
export function resolveUniversityPack(
  university: string | null | undefined
): UniversityPack {
  const slug = normalizeUniversitySlug(university);
  return PACKS[slug] || juwUniversityPack;
}

export function listUniversityPackIds(): string[] {
  return Object.keys(PACKS);
}
