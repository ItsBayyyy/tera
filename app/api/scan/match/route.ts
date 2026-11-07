import { z } from "zod";
import { fail, fieldErrors, json, loadMatchConfig, requireStaff } from "@/lib/api";
import { runMatch } from "@/lib/match/run";
import { embeddingSchema, uuid } from "@/lib/validation/common";
import { MAX_SCAN_PHOTOS } from "@/lib/scan-limits";
import { logEvent } from "@/lib/log";

const bodySchema = z.object({
  banjarId: uuid,
  embeddings: z.array(embeddingSchema).min(1).max(MAX_SCAN_PHOTOS),
});

export async function POST(request: Request) {
  const staff = await requireStaff();
  if (staff instanceof Response) return staff;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail(400, "Data scan tidak valid.", fieldErrors(parsed.error));

  try {
    const config = await loadMatchConfig(staff.supabase);
    const result = await runMatch({
      db: staff.supabase,
      embeddings: parsed.data.embeddings,
      banjarId: parsed.data.banjarId,
      config,
      source: "officer",
      actorId: staff.userId,
      signPhotos: true,
    });
    logEvent("info", "scan.matched", { zone: result.zone, candidates: result.candidates.length });
    return json({ ...result, thresholds: { strong: config.strong, unsure: config.unsure } });
  } catch (error) {
    logEvent("error", "scan.match_failed", { message: error instanceof Error ? error.message : "unknown" });
    return fail(500, "Pencocokan gagal. Coba lagi atau catat tanpa verifikasi AI.");
  }
}
