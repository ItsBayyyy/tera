import "server-only";
import { z } from "zod";
import { embeddingSchema } from "@/lib/validation/common";
import { readImage, type Db } from "@/lib/api";
import { MAX_SCAN_PHOTOS } from "@/lib/scan-limits";


const photoMetaSchema = z.object({
  embedding: embeddingSchema.nullable(),
  detectionScore: z.number().min(0).max(1).nullable(),
  modelVersion: z.string().max(120).nullable(),
});

export type PhotoUpload = z.infer<typeof photoMetaSchema> & { blob: Blob };

/**
 * Reads `photo` files plus a `photoMeta` JSON array (one entry per photo, same order).
 * The embedding is whatever the AI service returned during the scan; null means "not analysed".
 */
export function readPhotoUploads(form: FormData): PhotoUpload[] | string {
  const files = form.getAll("photo").map(readImage);
  if (files.some((file) => file === "invalid")) return "Foto harus JPEG/PNG/WebP dan maksimal 5 MB.";
  const blobs = files.filter((file): file is Blob => file instanceof Blob);
  if (blobs.length > MAX_SCAN_PHOTOS) return "Maksimal 3 foto.";

  let rawMeta: unknown = [];
  try {
    rawMeta = JSON.parse(String(form.get("photoMeta") ?? "[]"));
  } catch {
    return "Data foto rusak.";
  }
  const meta = z.array(photoMetaSchema).length(blobs.length).safeParse(rawMeta);
  if (!meta.success) return "Data foto tidak cocok dengan jumlah foto.";
  return blobs.map((blob, i) => ({ blob, ...meta.data[i] }));
}

/** Uploads to the private bucket and records each photo. Returns the stored paths. */
export async function savePhotos(db: Db, dogId: string, banjarId: string, photos: PhotoUpload[]): Promise<string[]> {
  const paths: string[] = [];
  for (const photo of photos) {
    const path = `${banjarId}/${dogId}/${crypto.randomUUID()}.jpg`;
    const { error: uploadError } = await db.storage
      .from("dog-photos")
      .upload(path, photo.blob, { contentType: photo.blob.type || "image/jpeg", upsert: false });
    if (uploadError) throw new Error(`upload failed: ${uploadError.message}`);
    const { error } = await db.from("dog_photos").insert({
      dog_id: dogId,
      storage_path: path,
      quality_score: photo.detectionScore,
      embedding: photo.embedding ? JSON.stringify(photo.embedding) : null,
      model_version: photo.modelVersion,
    });
    if (error) throw new Error(`photo insert failed: ${error.code}`);
    paths.push(path);
  }
  return paths;
}
