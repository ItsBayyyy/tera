import "server-only";
import { readImage, type Db } from "@/lib/api";
import { isProbePath } from "@/lib/demo";

/** A demo request carries either an uploaded `image` or the storage path of a test photo (`probe`). */
export async function readDemoImage(db: Db, form: FormData): Promise<Blob | string> {
  const probe = form.get("probe");
  if (typeof probe === "string" && probe) {
    if (!isProbePath(probe)) return "Foto uji tidak dikenal.";
    const { data } = await db.storage.from("dog-photos").download(probe);
    return data ?? "Foto uji tidak ditemukan.";
  }
  const image = readImage(form.get("image"));
  if (image === null || image === "invalid") return "Foto harus JPEG/PNG/WebP dan maksimal 5 MB.";
  return image;
}
