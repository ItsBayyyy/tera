import { fail, json, requireStaff } from "@/lib/api";
import { uuid } from "@/lib/validation/common";
import { readPhotoUploads, savePhotos } from "@/lib/photos";
import { logEvent } from "@/lib/log";

/** Adds photos to an existing dog, e.g. after a confirmed scan, to strengthen future matches. */
export async function POST(request: Request, ctx: RouteContext<"/api/dogs/[id]/photos">) {
  const staff = await requireStaff();
  if (staff instanceof Response) return staff;

  const id = uuid.safeParse((await ctx.params).id);
  if (!id.success) return fail(400, "Anjing tidak ditemukan.");
  const { data: dog } = await staff.supabase.from("dogs").select("id, banjar_id").eq("id", id.data).maybeSingle();
  if (!dog) return fail(404, "Anjing tidak ditemukan.");

  const photos = readPhotoUploads(await request.formData());
  if (typeof photos === "string") return fail(400, photos);
  if (photos.length === 0) return fail(400, "Pilih minimal satu foto.");

  try {
    const paths = await savePhotos(staff.supabase, dog.id, dog.banjar_id, photos);
    return json({ added: paths.length }, 201);
  } catch (error) {
    logEvent("error", "dog.photo_add_failed", { message: error instanceof Error ? error.message : "unknown" });
    return fail(500, "Foto belum tersimpan. Coba lagi.");
  }
}
