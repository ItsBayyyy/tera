import { getAdminClient } from "@/lib/supabase/admin";
import { clientIp, fail, json, loadMatchConfig } from "@/lib/api";
import { analyzeImage } from "@/lib/ai/client";
import { runMatch } from "@/lib/match/run";
import { demoLimiter, getDemoBanjarId } from "@/lib/demo";
import { readDemoImage } from "@/lib/demo-image";

// Room for an AI service cold start on top of the 15 s analysis timeout; platform defaults can be lower.
export const maxDuration = 60;

/** Demo: analyse one photo (upload or test photo) and match it against the DEMO banjar only. */
export async function POST(request: Request) {
  if (!demoLimiter.scan(clientIp(request)).ok) return fail(429, "Terlalu banyak percobaan. Tunggu beberapa menit.");
  const db = getAdminClient();
  const image = await readDemoImage(db, await request.formData());
  if (typeof image === "string") return fail(400, image);

  const outcome = await analyzeImage(image);
  if (outcome.kind === "unavailable") return json({ available: false });
  const { quality, embedding } = outcome.result;
  if (!quality.ok || !embedding) return json({ available: true, quality, zone: null, candidates: [] });

  const config = await loadMatchConfig(db);
  const result = await runMatch({
    db,
    embeddings: [embedding],
    banjarId: await getDemoBanjarId(db),
    config,
    source: "demo",
    actorId: null,
    signPhotos: true,
  });
  return json({ available: true, quality, ...result });
}
