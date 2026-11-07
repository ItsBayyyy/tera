import { fitWithin, JPEG_QUALITY } from "./resize";

/**
 * Re-encodes a photo through a canvas: scales the longest side to ≤1024 px and drops
 * every metadata block (EXIF GPS, camera serials) because canvas output carries pixels only.
 */
export async function compressImage(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas-unavailable");
    ctx.drawImage(bitmap, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("encode-failed"))), "image/jpeg", JPEG_QUALITY);
    });
  } finally {
    bitmap.close();
  }
}
