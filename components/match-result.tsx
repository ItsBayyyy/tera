"use client";

import { useState } from "react";
import { Badge, Button } from "@/components/ui";
import { DogName, PhotoBox, ScoreBar, VaccineBadge, ZONE_LABEL } from "@/components/dog-bits";
import { ZONE_DISPLAY_COUNT, type Zone } from "@/lib/match/zone";
import type { MatchCandidate } from "@/lib/scan-client";

type Props = {
  zone: Zone;
  candidates: MatchCandidate[];
  onChoose: (candidate: MatchCandidate) => void;
  onRegister: () => void;
};

const ZONE_TONE = { strong: "ok", unsure: "wait", none: "neutral" } as const;

/**
 * Renders the three decision zones: one big candidate, five side by side, or "register new".
 * Officer/demo only: shows vaccine status, which citizens never see.
 */
export function MatchResult({ zone, candidates, onChoose, onRegister }: Props) {
  const [rejectedTop, setRejectedTop] = useState(false);
  const effectiveZone: Zone = zone === "strong" && rejectedTop ? "unsure" : zone;
  const pool = rejectedTop ? candidates.slice(1) : candidates;
  const visible = pool.slice(0, ZONE_DISPLAY_COUNT[effectiveZone]);

  return (
    <section aria-labelledby="hasil-title" aria-live="polite" className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="hasil-title" className="text-xl font-bold">
          {rejectedTop ? "Mungkin salah satu ini?" : ZONE_LABEL[zone]}
        </h2>
        {rejectedTop ? null : <Badge tone={ZONE_TONE[zone]}>Zona {zone === "strong" ? "kuat" : zone === "unsure" ? "ragu" : "tidak cocok"}</Badge>}
      </div>

      {effectiveZone === "strong" && visible[0] ? (
        <article className="overflow-hidden rounded-card border-2 border-ok bg-surface">
          <PhotoBox url={visible[0].photoUrl} alt="Foto anjing terdaftar" className="aspect-[4/3] w-full" />
          <div className="space-y-3 p-4">
            <p className="text-xl font-bold">
              <DogName nickname={visible[0].nickname} color={visible[0].color} />
            </p>
            <p className="text-ink-muted">Warna: {visible[0].color}</p>
            <ScoreBar score={visible[0].score} zone="strong" />
            <VaccineBadge state={visible[0].vaccine} lastAt={visible[0].lastVaccinatedAt} />
            <div className="grid grid-cols-2 gap-3 pt-1">
              <Button onClick={() => onChoose(visible[0])}>Ya, anjing ini</Button>
              <Button variant="secondary" onClick={() => setRejectedTop(true)}>
                Bukan
              </Button>
            </div>
          </div>
        </article>
      ) : null}

      {effectiveZone === "unsure" ? (
        <>
          <p className="text-ink-muted">Bandingkan wajah, warna, dan tanda khusus. Pilih bila yakin.</p>
          {visible.length === 0 ? <p className="text-ink-muted">Tidak ada kandidat lain.</p> : null}
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {visible.map((candidate) => (
              <li key={candidate.dogId} className="flex flex-col overflow-hidden rounded-card border border-line bg-surface">
                <PhotoBox url={candidate.photoUrl} alt="Foto kandidat" className="aspect-square w-full" />
                <div className="flex flex-1 flex-col gap-2 p-3">
                  <p className="font-bold leading-tight">
                    <DogName nickname={candidate.nickname} color={candidate.color} />
                  </p>
                  <ScoreBar score={candidate.score} zone={rejectedTop ? "unsure" : zone} />
                  <Button variant="secondary" className="mt-auto w-full px-2" onClick={() => onChoose(candidate)}>
                    Pilih
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {effectiveZone === "none" ? (
        <p className="text-ink-muted">
          {candidates.length === 0
            ? "Belum ada anjing berfoto di banjar ini untuk dibandingkan."
            : "Tidak ada anjing terdaftar yang cukup mirip. Kemungkinan anjing ini belum terdaftar."}
        </p>
      ) : null}

      <Button variant={effectiveZone === "none" ? "primary" : "secondary"} className="w-full" onClick={onRegister}>
        {effectiveZone === "none" ? "Daftarkan anjing baru" : "Tidak ada yang cocok, daftarkan baru"}
      </Button>

      {effectiveZone === "none" && visible.length > 0 ? (
        <details className="rounded-card border border-line bg-surface p-3">
          <summary className="min-h-12 cursor-pointer content-center font-semibold">Lihat {visible.length} anjing terdekat</summary>
          <ul className="mt-2 space-y-2">
            {visible.map((candidate) => (
              <li key={candidate.dogId} className="flex items-center gap-3">
                <PhotoBox url={candidate.photoUrl} alt="Foto kandidat" className="size-14 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    <DogName nickname={candidate.nickname} color={candidate.color} />
                  </p>
                  <ScoreBar score={candidate.score} zone="none" />
                </div>
                <Button variant="ghost" className="shrink-0 px-2" onClick={() => onChoose(candidate)}>
                  Pilih
                </Button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
