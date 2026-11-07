export const MAX_IMAGE_SIDE = 1024;
export const JPEG_QUALITY = 0.8;

/** Target size that keeps the aspect ratio with the longest side at most `maxSide`. Never upscales. */
export function fitWithin(width: number, height: number, maxSide: number = MAX_IMAGE_SIDE) {
  const longest = Math.max(width, height);
  if (longest <= maxSide) return { width, height };
  const scale = maxSide / longest;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}
