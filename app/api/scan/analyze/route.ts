import { analyzeImage } from "@/lib/ai/client";
import { fail, json, readImage, requireStaff } from "@/lib/api";

// Room for an AI service cold start on top of the 15 s analysis timeout; platform defaults can be lower.
export const maxDuration = 60;

/** Quality check + detection + embedding for one scan photo. The embedding goes back to the device for matching. */
export async function POST(request: Request) {
  const staff = await requireStaff();
  if (staff instanceof Response) return staff;

  const image = readImage((await request.formData()).get("image"));
  if (image === null || image === "invalid") return fail(400, "Foto harus JPEG/PNG/WebP dan maksimal 5 MB.");

  const outcome = await analyzeImage(image);
  if (outcome.kind === "unavailable") return json({ available: false });
  return json({ available: true, ...outcome.result });
}
