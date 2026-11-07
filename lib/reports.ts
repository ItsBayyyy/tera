import "server-only";
import { analyzeImage } from "@/lib/ai/client";
import { loadMatchConfig, type Db } from "@/lib/api";
import { runMatch } from "@/lib/match/run";
import { logEvent } from "@/lib/log";

/**
 * Matches a citizen's dog photo against the registry after the citizen already has their case code.
 * The result is stored for officers only; nothing about the dog is ever sent back to the citizen.
 */
export async function matchReportPhoto(db: Db, reportId: string, photo: Blob, banjarId: string | null) {
  const outcome = await analyzeImage(photo);
  if (outcome.kind === "unavailable" || !outcome.result.embedding) {
    logEvent("info", "report.match_skipped", {
      reason: outcome.kind === "unavailable" ? outcome.reason : (outcome.result.quality.reasons[0] ?? "no_embedding"),
    });
    return;
  }
  try {
    const config = await loadMatchConfig(db);
    const result = await runMatch({
      db,
      embeddings: [outcome.result.embedding],
      banjarId,
      config,
      source: "citizen",
      actorId: null,
      signPhotos: false,
    });
    const top = result.candidates[0];
    await db
      .from("bite_reports")
      .update({
        matched_dog_id: top?.dogId ?? null,
        match_score: top?.score ?? null,
        match_log_id: result.matchLogId,
      })
      .eq("id", reportId);
    logEvent("info", "report.matched", { zone: result.zone });
  } catch (error) {
    logEvent("error", "report.match_failed", { message: error instanceof Error ? error.message : "unknown" });
  }
}
