export type Zone = "strong" | "unsure" | "none";

export type Thresholds = {
  strong: number;
  unsure: number;
};

export type Candidate = {
  dogId: string;
  score: number;
  photoPath: string | null;
};

export function classifyZone(bestScore: number | null, thresholds: Thresholds): Zone {
  if (bestScore === null) return "none";
  if (bestScore >= thresholds.strong) return "strong";
  if (bestScore >= thresholds.unsure) return "unsure";
  return "none";
}

/**
 * A scan has 1–3 photos and each photo yields its own ranked list.
 * A dog's score for the scan is its best score across all photos.
 */
export function mergeCandidates<T extends Candidate>(perPhoto: T[][], limit: number): T[] {
  const best = new Map<string, T>();
  for (const list of perPhoto) {
    for (const candidate of list) {
      const current = best.get(candidate.dogId);
      if (!current || candidate.score > current.score) best.set(candidate.dogId, candidate);
    }
  }
  return [...best.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}

export type ScanDecision<T extends Candidate> = {
  zone: Zone;
  /** Up to five dogs, best first; kept so "Bukan" can fall back to the next candidates. */
  ranked: T[];
  /** What the zone shows first. */
  display: T[];
};

/** How many candidates each zone shows: one large card, five side by side, or three small ones. */
export const ZONE_DISPLAY_COUNT: Record<Zone, number> = { strong: 1, unsure: 5, none: 3 };

export function decideScan<T extends Candidate>(perPhoto: T[][], thresholds: Thresholds): ScanDecision<T> {
  const ranked = mergeCandidates(perPhoto, 5);
  const zone = classifyZone(ranked[0]?.score ?? null, thresholds);
  return { zone, ranked, display: ranked.slice(0, ZONE_DISPLAY_COUNT[zone]) };
}

export function validateThresholds(thresholds: Thresholds): string | null {
  const { strong, unsure } = thresholds;
  if (!(unsure >= -1 && strong <= 1)) return "Ambang harus di antara -1 dan 1.";
  if (!(unsure < strong)) return "Ambang ragu harus lebih kecil dari ambang kuat.";
  return null;
}
