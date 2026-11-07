import "server-only";
import { decideScan, type Zone } from "./zone";
import { vaccineState, type VaccineState } from "@/lib/vaccine";
import { signPaths, type Db, type MatchConfig } from "@/lib/api";
import type { Database } from "@/lib/supabase/database.types";

export type MatchCandidate = {
  dogId: string;
  score: number;
  photoPath: string | null;
  photoUrl: string | null;
  nickname: string | null;
  color: string;
  sex: Database["public"]["Enums"]["dog_sex"];
  ownership: Database["public"]["Enums"]["dog_ownership"];
  lastVaccinatedAt: string | null;
  lastAiStatus: Database["public"]["Enums"]["ai_status"] | null;
  vaccine: VaccineState;
};

export type MatchResult = {
  zone: Zone;
  /** Ranked best-first (max 5); the UI decides how many to show per zone. */
  candidates: MatchCandidate[];
  matchLogId: string | null;
};

type RunMatchInput = {
  db: Db;
  embeddings: number[][];
  banjarId: string | null;
  config: MatchConfig;
  source: Database["public"]["Enums"]["match_source"];
  actorId: string | null;
  signPhotos: boolean;
};

/** Runs match_dogs once per scan photo, merges per dog, decides the zone and writes the audit log. */
export async function runMatch(input: RunMatchInput): Promise<MatchResult> {
  const { db, embeddings, banjarId, config } = input;

  const perPhoto = await Promise.all(
    embeddings.map(async (embedding) => {
      const { data, error } = await db.rpc("match_dogs", {
        query: JSON.stringify(embedding),
        p_banjar_id: banjarId as string,
        p_k: 5,
      });
      if (error) throw new Error(`match_dogs failed: ${error.code}`);
      return (data ?? []).map(
        (row): MatchCandidate => ({
          dogId: row.dog_id,
          score: row.best_score,
          photoPath: row.best_photo_path,
          photoUrl: null,
          nickname: row.nickname,
          color: row.color,
          sex: row.sex,
          ownership: row.ownership,
          lastVaccinatedAt: row.last_vaccinated_at,
          lastAiStatus: row.last_ai_status,
          vaccine: vaccineState(row.last_vaccinated_at, config.vaccineValidDays),
        }),
      );
    }),
  );

  const { zone, ranked: candidates } = decideScan(perPhoto, config);

  if (input.signPhotos) {
    const urls = await signPaths(db, "dog-photos", candidates.flatMap((c) => (c.photoPath ? [c.photoPath] : [])));
    for (const candidate of candidates) candidate.photoUrl = candidate.photoPath ? (urls.get(candidate.photoPath) ?? null) : null;
  }

  const { data: log } = await db
    .from("match_logs")
    .insert({
      actor_id: input.actorId,
      source: input.source,
      zone,
      banjar_id: banjarId,
      top_candidates: candidates.map((c) => ({ dog_id: c.dogId, score: Number(c.score.toFixed(4)) })),
    })
    .select("id")
    .single();

  return { zone, candidates, matchLogId: log?.id ?? null };
}
