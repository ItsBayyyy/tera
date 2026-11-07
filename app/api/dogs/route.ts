import { fail, fieldErrors, formObject, json, requireStaff } from "@/lib/api";
import { dogAttributesSchema } from "@/lib/validation/dog";
import { uuid } from "@/lib/validation/common";
import { readPhotoUploads, savePhotos } from "@/lib/photos";
import { logEvent } from "@/lib/log";

const FIELDS = ["banjarId", "nickname", "color", "sex", "ownership", "ownerName", "ownerPhone"] as const;

/** Registers a new dog with its scan photos (embeddings may be null when AI was unavailable). */
export async function POST(request: Request) {
  const staff = await requireStaff();
  if (staff instanceof Response) return staff;

  const form = await request.formData();
  const parsed = dogAttributesSchema.safeParse(formObject(form, FIELDS));
  if (!parsed.success) return fail(400, "Periksa isian yang ditandai.", fieldErrors(parsed.error));
  const photos = readPhotoUploads(form);
  if (typeof photos === "string") return fail(400, photos);
  if (photos.length === 0) return fail(400, "Sertakan minimal satu foto anjing.");

  const dog = parsed.data;
  const { data: created, error } = await staff.supabase
    .from("dogs")
    .insert({
      banjar_id: dog.banjarId,
      nickname: dog.nickname ?? null,
      color: dog.color,
      sex: dog.sex,
      ownership: dog.ownership,
      owner_name: dog.ownerName ?? null,
      owner_phone: dog.ownerPhone ?? null,
    })
    .select("id")
    .single();
  if (error || !created) return fail(500, "Anjing belum tersimpan. Coba lagi.");

  try {
    await savePhotos(staff.supabase, created.id, dog.banjarId, photos);
  } catch (photoError) {
    logEvent("error", "dog.photo_save_failed", { message: photoError instanceof Error ? photoError.message : "unknown" });
    await staff.supabase.from("dogs").delete().eq("id", created.id);
    return fail(500, "Foto belum tersimpan. Coba lagi.");
  }

  const matchLogId = uuid.safeParse(form.get("matchLogId"));
  if (matchLogId.success) {
    await staff.supabase.from("match_logs").update({ chosen_dog_id: created.id }).eq("id", matchLogId.data);
  }

  logEvent("info", "dog.registered", { photos: photos.length, embedded: photos.filter((p) => p.embedding).length });
  return json({ dogId: created.id }, 201);
}
