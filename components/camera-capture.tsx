"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Camera, ImageUp } from "lucide-react";
import { Button } from "@/components/ui";
import { compressImage } from "@/lib/image/compress";
import { fitWithin, JPEG_QUALITY } from "@/lib/image/resize";

type Props = {
  disabled?: boolean;
  onCapture: (blob: Blob) => void;
  captureLabel: string;
};

/**
 * Live viewfinder via getUserMedia when the browser allows it; otherwise (no camera, permission
 * denied, insecure origin) the native camera/file picker. Both paths produce a ≤1024px JPEG
 * without EXIF.
 */
export function CameraCapture({ disabled, onCapture, captureLabel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [live, setLive] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const inputId = useId();

  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), []);

  async function openCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setNote("Kamera langsung tidak tersedia. Pakai tombol unggah foto.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 } },
        audio: false,
      });
      streamRef.current = stream;
      setLive(true);
      setNote(null);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });
    } catch {
      setNote("Izin kamera ditolak atau kamera tidak ada. Pakai tombol unggah foto.");
    }
  }

  function closeCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setLive(false);
  }

  function snap() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const { width, height } = fitWithin(video.videoWidth, video.videoHeight);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")?.drawImage(video, 0, 0, width, height);
    canvas.toBlob((blob) => blob && onCapture(blob), "image/jpeg", JPEG_QUALITY);
  }

  async function pickFile(file: File | undefined) {
    if (!file) return;
    try {
      onCapture(await compressImage(file));
    } catch {
      setNote("Foto tidak bisa dibaca. Coba foto lain.");
    }
  }

  return (
    <div className="space-y-3">
      {live ? (
        <div className="overflow-hidden rounded-card bg-ink">
          <video ref={videoRef} playsInline muted className="aspect-[4/3] w-full object-cover" aria-label="Pratinjau kamera" />
        </div>
      ) : null}
      <div className="grid gap-3">
        {live ? (
          <>
            <Button onClick={snap} disabled={disabled} className="min-h-16 text-lg">
              <Camera aria-hidden="true" className="size-6" />
              {captureLabel}
            </Button>
            <Button variant="secondary" onClick={closeCamera}>
              Tutup kamera
            </Button>
          </>
        ) : (
          <Button onClick={openCamera} disabled={disabled} className="min-h-16 text-lg">
            <Camera aria-hidden="true" className="size-6" />
            {captureLabel}
          </Button>
        )}
        <label
          htmlFor={inputId}
          className={`inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-line-strong bg-surface px-4 font-semibold hover:bg-sunken ${
            disabled ? "pointer-events-none opacity-55" : ""
          }`}
        >
          <ImageUp aria-hidden="true" className="size-5" />
          Unggah foto
        </label>
        <input
          id={inputId}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          disabled={disabled}
          data-testid="photo-input"
          onChange={(event) => {
            void pickFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </div>
      {note ? (
        <p className="text-sm text-ink-muted" aria-live="polite">
          {note}
        </p>
      ) : null}
    </div>
  );
}
