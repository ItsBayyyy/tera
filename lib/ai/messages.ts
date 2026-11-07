import type { QualityReason } from "./types";

/** Short, actionable feedback for an officer holding a phone in the sun. */
export const QUALITY_MESSAGES: Record<QualityReason, string> = {
  BLUR: "Foto buram. Tahan ponsel diam, lalu foto lagi.",
  TOO_DARK: "Terlalu gelap. Cari cahaya.",
  TOO_BRIGHT: "Terlalu terang. Hindari cahaya langsung ke lensa.",
  TOO_SMALL: "Anjing terlalu kecil di foto. Dekatkan sedikit.",
  NO_DOG: "Anjing tidak terlihat. Arahkan kamera ke anjing.",
  FACE_NOT_VISIBLE: "Wajah anjing tidak terlihat. Foto dari depan.",
};

export function qualityMessage(reasons: readonly QualityReason[]): string {
  const first = reasons[0];
  return first ? QUALITY_MESSAGES[first] : "Foto belum bisa dipakai. Coba foto lagi.";
}
