"use client";

import { X } from "lucide-react";
import { qualityMessage } from "@/lib/ai/messages";
import type { ScanPhoto } from "@/lib/scan-client";

const STATUS_TEXT: Record<ScanPhoto["status"], string> = {
  checking: "Memeriksa foto…",
  ok: "Foto bisa dipakai",
  rejected: "",
  unavailable: "AI tidak menjawab",
  error: "Gagal dikirim",
};

const STATUS_TONE: Record<ScanPhoto["status"], string> = {
  checking: "text-ink-muted",
  ok: "text-ok",
  rejected: "text-wait",
  unavailable: "text-wait",
  error: "text-danger",
};

export function PhotoStrip({ photos, onRemove }: { photos: ScanPhoto[]; onRemove: (id: string) => void }) {
  if (photos.length === 0) return null;
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Foto scan">
      {photos.map((photo, index) => (
        <li key={photo.id} className="flex gap-3 rounded-card border border-line bg-surface p-2 sm:flex-col">
          {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
          <img src={photo.previewUrl} alt={`Foto ${index + 1}`} className="size-20 shrink-0 rounded-lg object-cover sm:aspect-[4/3] sm:h-auto sm:w-full" />
          <div className="flex min-w-0 flex-1 items-start justify-between gap-2">
            <p className={`text-[0.95rem] font-semibold ${STATUS_TONE[photo.status]}`} aria-live="polite">
              {photo.status === "rejected" ? qualityMessage(photo.reasons) : STATUS_TEXT[photo.status]}
            </p>
            <button
              type="button"
              onClick={() => onRemove(photo.id)}
              className="-m-1 inline-flex size-12 shrink-0 items-center justify-center rounded-xl text-ink-muted hover:bg-sunken hover:text-ink"
              aria-label={`Hapus foto ${index + 1}`}
            >
              <X aria-hidden="true" className="size-5" />
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
