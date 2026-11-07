import { z } from "zod";
import { getAdminClient } from "@/lib/supabase/admin";
import { clientIp, fail, fieldErrors, formObject, json } from "@/lib/api";
import { analyzeImage } from "@/lib/ai/client";
import { savePhotos } from "@/lib/photos";
import { demoLimiter, getDemoBanjarId } from "@/lib/demo";
import { readDemoImage } from "@/lib/demo-image";
import { qualityMessage } from "@/lib/ai/messages";
import { optionalText } from "@/lib/validation/common";

const demoDogSchema = z.object({
  nickname: optionalText(40),
  color: z.string().trim().min(1, "Isi warna bulu.").max(40),
});

/**
 * Demo: register a dog in the DEMO banjar from one photo. The photo is analysed on the server,
 * so this public endpoint never accepts embeddings from the browser.
 */
export async function POST(request: Request) {
  if (!demoLimiter.register(clientIp(request)).ok) return fail(429, "Terlalu banyak percobaan. Tunggu beberapa menit.");
  const form = await request.formData();
  const parsed = demoDogSchema.safeParse(formObject(form, ["nickname", "color"]));
  if (!parsed.success) return fail(400, "Periksa isian.", fieldErrors(parsed.error));

  const db = getAdminClient();
  const image = await readDemoImage(db, form);
  if (typeof image === "string") return fail(400, image);

  const outcome = await analyzeImage(image);
  if (outcome.kind === "unavailable") return fail(503, "AI sedang tidak tersedia. Coba lagi nanti.");
  const { quality, embedding, detection, model_version } = outcome.result;
  if (!quality.ok || !embedding) return fail(422, qualityMessage(quality.reasons));

  const banjarId = await getDemoBanjarId(db);
  const { data: dog, error } = await db
    .from("dogs")
    .insert({ banjar_id: banjarId, nickname: parsed.data.nickname ?? null, color: parsed.data.color, sex: "unknown", ownership: "unknown", created_by: null })
    .select("id")
    .single();
  if (error || !dog) return fail(500, "Anjing demo belum tersimpan.");
  await savePhotos(db, dog.id, banjarId, [{ blob: image, embedding, detectionScore: detection.score, modelVersion: model_version }]);
  return json({ dogId: dog.id }, 201);
}
