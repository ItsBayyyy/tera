import type { QualityReason } from "@/lib/ai/types";
import type { MatchResult } from "@/lib/match/run";

export type { MatchCandidate, MatchResult } from "@/lib/match/run";

export type PhotoStatus = "checking" | "ok" | "rejected" | "unavailable" | "error";

export type ScanPhoto = {
  id: string;
  blob: Blob;
  previewUrl: string;
  status: PhotoStatus;
  reasons: QualityReason[];
  embedding: number[] | null;
  detectionScore: number | null;
  modelVersion: string | null;
};

type AnalyzeApiResponse =
  | { available: false }
  | {
      available: true;
      quality: { ok: boolean; reasons: QualityReason[] };
      detection: { found: boolean; score: number };
      embedding: number[] | null;
      model_version: string;
    };

/** Sends one photo to /api/scan/analyze (or the demo equivalent) and folds the answer into the photo. */
export async function analyzePhoto(photo: ScanPhoto, endpoint = "/api/scan/analyze"): Promise<ScanPhoto> {
  const body = new FormData();
  body.set("image", photo.blob, "scan.jpg");
  try {
    const response = await fetch(endpoint, { method: "POST", body });
    if (!response.ok) return { ...photo, status: response.status === 401 ? "error" : "unavailable" };
    const data = (await response.json()) as AnalyzeApiResponse;
    if (!data.available) return { ...photo, status: "unavailable" };
    const usable = data.quality.ok && data.embedding !== null;
    return {
      ...photo,
      status: usable ? "ok" : "rejected",
      reasons: data.quality.reasons,
      embedding: data.embedding,
      detectionScore: data.detection.found ? data.detection.score : null,
      modelVersion: data.model_version,
    };
  } catch {
    return { ...photo, status: "unavailable" };
  }
}

export type ScanMatchResponse = MatchResult & { thresholds: { strong: number; unsure: number } };

/** Builds the multipart body that /api/dogs and /api/dogs/[id]/photos expect. */
export function appendPhotos(body: FormData, photos: ScanPhoto[], mode: "ai" | "pending" | "manual") {
  const meta = photos.map((photo) => ({
    embedding: mode === "ai" ? photo.embedding : null,
    detectionScore: mode === "ai" ? photo.detectionScore : null,
    // Photos the AI already rejected are marked so the rematch job does not retry them forever.
    modelVersion:
      mode === "manual" && photo.status === "rejected" ? `rejected:${photo.reasons.join(",") || "QUALITY"}` : mode === "ai" ? photo.modelVersion : null,
  }));
  for (const photo of photos) body.append("photo", photo.blob, "foto.jpg");
  body.set("photoMeta", JSON.stringify(meta));
}
