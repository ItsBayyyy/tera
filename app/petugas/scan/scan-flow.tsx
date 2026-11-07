"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { banjarLabel, useOfficer } from "@/components/officer-context";
import { CameraCapture } from "@/components/camera-capture";
import { PhotoStrip } from "@/components/photo-strip";
import { MatchResult } from "@/components/match-result";
import { DogForm, type DogFormValues } from "@/components/dog-form";
import { DogName, VaccineBadge } from "@/components/dog-bits";
import { Button, Card, Label, LinkButton, Notice, inputClass } from "@/components/ui";
import { analyzePhoto, appendPhotos, type MatchCandidate, type ScanMatchResponse, type ScanPhoto } from "@/lib/scan-client";
import { MAX_SCAN_PHOTOS } from "@/lib/scan-limits";
import type { VaccineState } from "@/lib/vaccine";

type Mode = "ai" | "pending" | "manual";
type ChosenDog = { id: string; nickname: string | null; color: string; vaccine: VaccineState; lastVaccinatedAt: string | null };

type Phase =
  | { kind: "capture" }
  | { kind: "matching" }
  | { kind: "result"; match: ScanMatchResponse }
  | { kind: "register"; mode: Mode; matchLogId: string | null }
  | { kind: "vaccinate"; dog: ChosenDog; mode: Mode; matchLogId: string | null; isNew: boolean }
  | { kind: "done"; dog: ChosenDog; vaccinated: boolean; mode: Mode };

const AI_STATUS_FOR_MODE = { ai: "verified", pending: "pending", manual: "manual" } as const;

export function ScanFlow() {
  const { state } = useOfficer();
  const [photos, setPhotos] = useState<ScanPhoto[]>([]);
  const [phase, setPhase] = useState<Phase>({ kind: "capture" });
  const [error, setError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const photosRef = useRef(photos);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.previewUrl)), []);
  useEffect(() => {
    headingRef.current?.focus();
  }, [phase.kind]);

  if (state.kind !== "ready") return null;
  const banjar = state.banjars.find((b) => b.id === state.activeBanjarId);
  if (!banjar) {
    return (
      <Notice tone="wait" title="Pilih banjar dulu.">
        <Link href="/petugas" className="font-semibold text-accent underline">
          Kembali ke halaman petugas
        </Link>
      </Notice>
    );
  }
  const banjarId = banjar.id;

  const usable = photos.filter((p) => p.status === "ok");
  const checking = photos.some((p) => p.status === "checking");
  const aiDown = photos.some((p) => p.status === "unavailable");
  const rejectedCount = photos.filter((p) => p.status === "rejected").length;

  async function addPhoto(blob: Blob) {
    if (photosRef.current.length >= MAX_SCAN_PHOTOS) return;
    const photo: ScanPhoto = {
      id: crypto.randomUUID(),
      blob,
      previewUrl: URL.createObjectURL(blob),
      status: "checking",
      reasons: [],
      embedding: null,
      detectionScore: null,
      modelVersion: null,
    };
    setPhotos((list) => [...list, photo]);
    const analyzed = await analyzePhoto(photo);
    setPhotos((list) => list.map((p) => (p.id === photo.id ? analyzed : p)));
  }

  function removePhoto(id: string) {
    setPhotos((list) => {
      const target = list.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return list.filter((p) => p.id !== id);
    });
  }

  async function findMatch() {
    setError(null);
    setPhase({ kind: "matching" });
    try {
      const response = await fetch("/api/scan/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ banjarId, embeddings: usable.map((p) => p.embedding) }),
      });
      const data = (await response.json()) as ScanMatchResponse & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Pencocokan gagal.");
      setPhase({ kind: "result", match: data });
    } catch (matchError) {
      setError(matchError instanceof Error ? matchError.message : "Pencocokan gagal.");
      setPhase({ kind: "capture" });
    }
  }

  function choose(candidate: MatchCandidate, matchLogId: string | null) {
    setPhase({
      kind: "vaccinate",
      dog: {
        id: candidate.dogId,
        nickname: candidate.nickname,
        color: candidate.color,
        vaccine: candidate.vaccine,
        lastVaccinatedAt: candidate.lastVaccinatedAt,
      },
      mode: "ai",
      matchLogId,
      isNew: false,
    });
  }

  async function register(values: DogFormValues, mode: Mode, matchLogId: string | null) {
    setPending(true);
    setFormErrors({});
    setError(null);
    const body = new FormData();
    for (const [key, value] of Object.entries(values)) body.set(key, value);
    body.set("banjarId", banjarId);
    if (matchLogId) body.set("matchLogId", matchLogId);
    const toSave = mode === "ai" ? usable : photos.filter((p) => p.status !== "checking");
    appendPhotos(body, toSave, mode);
    try {
      const response = await fetch("/api/dogs", { method: "POST", body });
      const data = (await response.json()) as { dogId?: string; error?: string; fieldErrors?: Record<string, string> };
      if (!response.ok || !data.dogId) {
        setFormErrors(data.fieldErrors ?? {});
        setError(data.error ?? "Anjing belum tersimpan.");
        return;
      }
      setPhase({
        kind: "vaccinate",
        dog: { id: data.dogId, nickname: values.nickname || null, color: values.color, vaccine: "none", lastVaccinatedAt: null },
        mode,
        matchLogId,
        isNew: true,
      });
    } catch {
      setError("Tidak ada sinyal. Data masih di layar, coba simpan lagi.");
    } finally {
      setPending(false);
    }
  }

  async function finish(dog: ChosenDog, mode: Mode, matchLogId: string | null, isNew: boolean, vaccinate: boolean, batch: string, attachPhotos: boolean) {
    setPending(true);
    setError(null);
    try {
      if (!isNew && attachPhotos && usable.length > 0) {
        const body = new FormData();
        appendPhotos(body, usable, "ai");
        const response = await fetch(`/api/dogs/${dog.id}/photos`, { method: "POST", body });
        if (!response.ok) throw new Error("Foto belum tersimpan.");
      }
      if (vaccinate) {
        const response = await fetch("/api/vaccinations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dogId: dog.id, batch, aiStatus: AI_STATUS_FOR_MODE[mode], matchLogId: matchLogId ?? undefined }),
        });
        if (!response.ok) throw new Error("Vaksin belum tercatat.");
      } else if (matchLogId && !isNew) {
        await fetch("/api/scan/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ matchLogId, dogId: dog.id }),
        });
      }
      setPhase({ kind: "done", dog, vaccinated: vaccinate, mode });
    } catch (finishError) {
      setError(finishError instanceof Error ? `${finishError.message} Coba lagi.` : "Gagal menyimpan. Coba lagi.");
    } finally {
      setPending(false);
    }
  }

  function restart() {
    photos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    setPhotos([]);
    setError(null);
    setFormErrors({});
    setPhase({ kind: "capture" });
  }

  const errorNotice = error ? <Notice tone="danger" title={error} /> : null;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-ink-muted">Banjar: {banjarLabel(banjar)}</p>
        <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-bold outline-none">
          {phase.kind === "capture" || phase.kind === "matching"
            ? "Foto wajah anjing"
            : phase.kind === "result"
              ? "Hasil pencocokan"
              : phase.kind === "register"
                ? "Daftarkan anjing baru"
                : phase.kind === "vaccinate"
                  ? phase.isNew
                    ? "Anjing terdaftar"
                    : "Anjing dikenali"
                  : "Selesai"}
        </h1>
      </div>

      {phase.kind === "capture" || phase.kind === "matching" ? (
        <>
          <p className="text-ink-muted">Ambil 1–3 foto wajah dari depan, cahaya cukup. Foto lebih banyak membantu pencocokan.</p>
          <PhotoStrip photos={photos} onRemove={removePhoto} />
          {aiDown ? (
            <Notice tone="wait" title="AI sedang tidak tersedia.">
              Anda tetap bisa mencatat. Foto disimpan dan diperiksa ulang otomatis saat AI pulih.
              <Button variant="secondary" className="mt-3 w-full" onClick={() => setPhase({ kind: "register", mode: "pending", matchLogId: null })}>
                Catat tanpa verifikasi AI
              </Button>
            </Notice>
          ) : null}
          {!aiDown && usable.length === 0 && rejectedCount >= 2 ? (
            <Notice tone="wait" title="Foto belum lolos pemeriksaan.">
              Coba sekali lagi dengan cahaya lebih baik, atau catat manual bila anjing tidak bisa difoto.
              <Button variant="secondary" className="mt-3 w-full" onClick={() => setPhase({ kind: "register", mode: "manual", matchLogId: null })}>
                Catat manual
              </Button>
            </Notice>
          ) : null}
          {errorNotice}
          {photos.length < MAX_SCAN_PHOTOS ? (
            <CameraCapture onCapture={addPhoto} disabled={phase.kind === "matching"} captureLabel={photos.length ? "Tambah foto" : "Foto wajah anjing"} />
          ) : null}
          <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-canvas px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3">
            <div className="mx-auto max-w-3xl">
              <Button className="min-h-14 w-full text-lg" disabled={usable.length === 0 || checking || phase.kind === "matching"} onClick={findMatch}>
                {phase.kind === "matching"
                  ? "Mencari kecocokan…"
                  : checking
                    ? "Memeriksa foto…"
                    : `Cari kecocokan${usable.length ? ` (${usable.length} foto)` : ""}`}
              </Button>
            </div>
          </div>
          <p className="sr-only" aria-live="polite">
            {phase.kind === "matching" ? "Mencari kecocokan" : ""}
          </p>
        </>
      ) : null}

      {phase.kind === "result" ? (
        <MatchResult
          zone={phase.match.zone}
          candidates={phase.match.candidates}
          onChoose={(candidate) => choose(candidate, phase.match.matchLogId)}
          onRegister={() => setPhase({ kind: "register", mode: "ai", matchLogId: phase.match.matchLogId })}
        />
      ) : null}

      {phase.kind === "register" ? (
        <>
          {phase.mode === "pending" ? (
            <Notice tone="wait" title="Dicatat tanpa verifikasi AI">
              Sistem belum bisa memastikan anjing ini belum terdaftar. Bila ternyata sudah, admin akan melihat tanda calon duplikat.
            </Notice>
          ) : null}
          {phase.mode === "manual" ? (
            <Notice tone="wait" title="Dicatat manual">
              Foto tidak lolos pemeriksaan, jadi pencocokan dilewati. Catatan vaksin diberi tanda manual.
            </Notice>
          ) : null}
          {errorNotice}
          <DogForm
            pending={pending}
            errors={formErrors}
            submitLabel="Simpan anjing"
            onSubmit={(values) => register(values, phase.mode, phase.matchLogId)}
          />
          <Button variant="ghost" className="w-full" onClick={() => setPhase({ kind: "capture" })}>
            Kembali ke foto
          </Button>
        </>
      ) : null}

      {phase.kind === "vaccinate" ? (
        <VaccinatePanel
          dog={phase.dog}
          isNew={phase.isNew}
          canAttach={!phase.isNew && usable.length > 0}
          pending={pending}
          error={errorNotice}
          onFinish={(vaccinate, batch, attach) => finish(phase.dog, phase.mode, phase.matchLogId, phase.isNew, vaccinate, batch, attach)}
        />
      ) : null}

      {phase.kind === "done" ? (
        <Card className="space-y-4 border-2 border-ok" aria-live="polite">
          <p className="text-xl font-bold text-ok">{phase.vaccinated ? "Vaksin tercatat" : "Tersimpan"}</p>
          <p>
            <DogName nickname={phase.dog.nickname} color={phase.dog.color} />
            {phase.mode === "pending" ? " · menunggu verifikasi AI" : phase.mode === "manual" ? " · dicatat manual" : ""}
          </p>
          <Button className="min-h-14 w-full text-lg" onClick={restart}>
            Scan anjing berikutnya
          </Button>
          <LinkButton variant="secondary" className="w-full" href={`/petugas/anjing/${phase.dog.id}`}>
            Lihat data anjing
          </LinkButton>
        </Card>
      ) : null}
    </div>
  );
}

function VaccinatePanel({
  dog,
  isNew,
  canAttach,
  pending,
  error,
  onFinish,
}: {
  dog: ChosenDog;
  isNew: boolean;
  canAttach: boolean;
  pending: boolean;
  error: ReactNode;
  onFinish: (vaccinate: boolean, batch: string, attach: boolean) => void;
}) {
  const batchId = useId();
  const attachId = useId();
  const [batch, setBatch] = useState("");
  const [attach, setAttach] = useState(true);

  return (
    <div className="space-y-5">
      <Card className="space-y-2">
        <p className="text-xl font-bold">
          <DogName nickname={dog.nickname} color={dog.color} />
        </p>
        <p className="text-ink-muted">Warna: {dog.color}</p>
        <VaccineBadge state={dog.vaccine} lastAt={dog.lastVaccinatedAt} />
      </Card>
      {dog.vaccine === "active" ? (
        <Notice tone="ok" title="Vaksin masih aktif.">
          Tidak perlu divaksin ulang kecuali ada alasan medis.
        </Notice>
      ) : null}
      <div>
        <Label htmlFor={batchId} hint="(opsional)">
          Nomor batch vaksin
        </Label>
        <input id={batchId} value={batch} onChange={(e) => setBatch(e.target.value)} className={inputClass} autoComplete="off" />
      </div>
      {canAttach ? (
        <label htmlFor={attachId} className="flex min-h-12 cursor-pointer items-start gap-3">
          <input
            id={attachId}
            type="checkbox"
            checked={attach}
            onChange={(e) => setAttach(e.target.checked)}
            className="mt-1 size-5 shrink-0 accent-[var(--color-accent)]"
          />
          <span>Simpan foto scan ini ke data anjing agar pencocokan berikutnya lebih kuat.</span>
        </label>
      ) : null}
      {error}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-canvas px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3">
        <div className="mx-auto grid max-w-3xl gap-2">
          <Button className="min-h-14 w-full text-lg" disabled={pending} onClick={() => onFinish(true, batch, attach)}>
            {pending ? "Menyimpan…" : "Catat vaksin"}
          </Button>
          <Button variant="secondary" className="w-full" disabled={pending} onClick={() => onFinish(false, batch, attach)}>
            {isNew ? "Selesai tanpa vaksin" : "Selesai, tidak divaksin"}
          </Button>
        </div>
      </div>
    </div>
  );
}
