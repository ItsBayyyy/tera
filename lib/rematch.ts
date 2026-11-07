import "server-only";
import { analyzeImage } from "@/lib/ai/client";
import { loadMatchConfig, type Db } from "@/lib/api";
import { logEvent } from "@/lib/log";

export type RematchSummary = {
  processed: number;
  embedded: number;
  rejected: number;
  duplicatesFlagged: number;
  verifiedDogs: number;
  aiAvailable: boolean;
  remaining: number;
};

const BATCH = 25;
export const REJECTED_PREFIX = "rejected:";

/**
 * Re-processes photos saved while the AI service was down ("Catat tanpa verifikasi AI").
 * Each new embedding is matched against the dog's banjar; a close match to a *different* dog
 * is flagged as a possible duplicate registration for an officer to review.
 * Vaccinations are promoted from `pending` to `verified` only when no open duplicate flag exists.
 */
export async function rematchPending(db: Db): Promise<RematchSummary> {
  const summary: RematchSummary = {
    processed: 0,
    embedded: 0,
    rejected: 0,
    duplicatesFlagged: 0,
    verifiedDogs: 0,
    aiAvailable: true,
    remaining: 0,
  };
  const config = await loadMatchConfig(db);

  const { data: photos, error } = await db
    .from("dog_photos")
    .select("id, dog_id, storage_path, dogs!inner(banjar_id)")
    .is("embedding", null)
    .or(`model_version.is.null,model_version.not.like.${REJECTED_PREFIX}*`)
    .order("created_at")
    .limit(BATCH);
  if (error) throw new Error(`pending query failed: ${error.code}`);

  const touchedDogs = new Set<string>();

  for (const photo of photos ?? []) {
    const { data: file } = await db.storage.from("dog-photos").download(photo.storage_path);
    if (!file) continue;
    const outcome = await analyzeImage(file);
    if (outcome.kind === "unavailable") {
      summary.aiAvailable = false;
      break;
    }
    summary.processed += 1;
    touchedDogs.add(photo.dog_id);
    const { embedding, model_version, quality, detection } = outcome.result;

    if (!embedding) {
      summary.rejected += 1;
      await db
        .from("dog_photos")
        .update({ model_version: `${REJECTED_PREFIX}${quality.reasons.join(",") || "NO_EMBEDDING"}` })
        .eq("id", photo.id);
      continue;
    }

    const vector = JSON.stringify(embedding);
    await db
      .from("dog_photos")
      .update({ embedding: vector, model_version, quality_score: detection.score })
      .eq("id", photo.id);
    summary.embedded += 1;

    const { data: matches } = await db.rpc("match_dogs", {
      query: vector,
      p_banjar_id: photo.dogs.banjar_id,
      p_k: 5,
    });
    const rival = (matches ?? []).find((m) => m.dog_id !== photo.dog_id && m.best_score >= config.unsure);
    if (rival) {
      const { data: flagged } = await db
        .from("duplicate_flags")
        .upsert(
          { dog_id: photo.dog_id, candidate_dog_id: rival.dog_id, score: rival.best_score },
          { onConflict: "dog_id,candidate_dog_id", ignoreDuplicates: true },
        )
        .select("id");
      summary.duplicatesFlagged += flagged?.length ?? 0;
    }
  }

  for (const dogId of touchedDogs) {
    const { count: openFlags } = await db
      .from("duplicate_flags")
      .select("id", { count: "exact", head: true })
      .eq("dog_id", dogId)
      .eq("status", "open");
    const { count: embeddedPhotos } = await db
      .from("dog_photos")
      .select("id", { count: "exact", head: true })
      .eq("dog_id", dogId)
      .not("embedding", "is", null);
    if (!openFlags && embeddedPhotos) {
      const { data: promoted } = await db
        .from("vaccinations")
        .update({ ai_status: "verified" })
        .eq("dog_id", dogId)
        .eq("ai_status", "pending")
        .select("id");
      if (promoted?.length) summary.verifiedDogs += 1;
    }
  }

  const { count } = await db
    .from("dog_photos")
    .select("id", { count: "exact", head: true })
    .is("embedding", null)
    .or(`model_version.is.null,model_version.not.like.${REJECTED_PREFIX}*`);
  summary.remaining = count ?? 0;

  logEvent("info", "rematch.finished", summary);
  return summary;
}
