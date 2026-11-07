"use client";

import { useCallback, useEffect, useId, useState, type FormEvent } from "react";
import { Badge, Button, Card, EmptyState, ErrorState, FieldError, Label, ListSkeleton, Notice, inputClass } from "@/components/ui";
import { CameraCapture } from "@/components/camera-capture";
import { MatchResult } from "@/components/match-result";
import { DogName, PhotoBox, VaccineBadge } from "@/components/dog-bits";
import { qualityMessage } from "@/lib/ai/messages";
import type { QualityReason } from "@/lib/ai/types";
import type { MatchCandidate } from "@/lib/scan-client";
import type { Zone } from "@/lib/match/zone";
import type { VaccineState } from "@/lib/vaccine";

type DemoDog = {
  id: string;
  nickname: string | null;
  color: string;
  seeded: boolean;
  photoCount: number;
  photoUrl: string | null;
  vaccine: VaccineState;
  lastVaccinatedAt: string | null;
};
type Probe = { path: string; url: string | null; answer: string };
type DemoState = { dogs: DemoDog[]; probes: Probe[] };

type ScanOutcome =
  | { kind: "idle" }
  | { kind: "busy"; label: string }
  | { kind: "unavailable" }
  | { kind: "rejected"; reasons: QualityReason[] }
  | { kind: "error"; message: string }
  | { kind: "result"; zone: Zone; candidates: MatchCandidate[]; answer: string | null; chosen: MatchCandidate | null };

type ScanApiResponse =
  | { available: false }
  | { available: true; quality: { ok: boolean; reasons: QualityReason[] }; zone: Zone | null; candidates: MatchCandidate[] };

async function demoScan(body: FormData): Promise<ScanOutcome> {
  const response = await fetch("/api/demo/scan", { method: "POST", body }).catch(() => null);
  if (!response) return { kind: "error", message: "Tidak ada sinyal." };
  const data = (await response.json()) as ScanApiResponse & { error?: string };
  if (!response.ok) return { kind: "error", message: data.error ?? "Pencocokan gagal." };
  if (!data.available) return { kind: "unavailable" };
  if (!data.quality.ok || !data.zone) return { kind: "rejected", reasons: data.quality.reasons };
  return { kind: "result", zone: data.zone, candidates: data.candidates, answer: null, chosen: null };
}

export function DemoLab() {
  const [state, setState] = useState<DemoState | null | "error">(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/demo/state").catch(() => null);
    setState(response?.ok ? ((await response.json()) as DemoState) : "error");
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-side fetch after mount
    void load();
  }, [load]);

  return (
    <div className="space-y-10">
      <TryItYourself onChange={load} />
      {state === null ? <ListSkeleton rows={3} label="Memuat data demo" /> : null}
      {state === "error" ? <ErrorState title="Data demo belum bisa dimuat." onRetry={() => void load()} /> : null}
      {state && state !== "error" ? (
        <>
          <Gallery dogs={state.dogs} />
          <Probes probes={state.probes} />
          <ResetDemo addedCount={state.dogs.filter((d) => !d.seeded).length} onDone={load} />
        </>
      ) : null}
    </div>
  );
}

/** In the demo, "register new" sends the visitor back to step 1. */
function goToRegister() {
  document.getElementById("coba-title")?.scrollIntoView({ behavior: "smooth" });
}

function ScanOutcomeView({ outcome, onChoose }: { outcome: ScanOutcome; onChoose: (c: MatchCandidate) => void }) {
  if (outcome.kind === "idle") return null;
  if (outcome.kind === "busy") {
    return (
      <p role="status" className="font-semibold text-ink-muted">
        {outcome.label}
      </p>
    );
  }
  if (outcome.kind === "unavailable") {
    return (
      <Notice tone="wait" title="AI sedang tidak tersedia.">
        Di aplikasi petugas, langkah berikutnya adalah &quot;Catat tanpa verifikasi AI&quot;: foto disimpan dan dicocokkan ulang saat AI pulih.
      </Notice>
    );
  }
  if (outcome.kind === "rejected") return <Notice tone="wait" title={qualityMessage(outcome.reasons)} />;
  if (outcome.kind === "error") return <Notice tone="danger" title={outcome.message} />;
  return (
    <div className="space-y-4">
      {outcome.chosen ? (
        <Notice tone="ok" title={`Dipilih: ${outcome.chosen.nickname ?? outcome.chosen.color}`}>
          Di aplikasi petugas, langkah berikutnya adalah melihat status vaksin lalu &quot;Catat vaksin&quot;.
        </Notice>
      ) : (
        <MatchResult zone={outcome.zone} candidates={outcome.candidates} onChoose={onChoose} onRegister={goToRegister} />
      )}
      {outcome.answer ? (
        <p className="rounded-xl bg-accent-soft p-3 text-accent">
          Jawaban sebenarnya: foto ini milik anjing <strong>{outcome.answer}</strong>.
        </p>
      ) : null}
    </div>
  );
}

function TryItYourself({ onChange }: { onChange: () => void }) {
  const ids = { color: useId(), nickname: useId(), colorError: useId() };
  const [photoA, setPhotoA] = useState<Blob | null>(null);
  const [registered, setRegistered] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<ScanOutcome>({ kind: "idle" });

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!photoA) return;
    const form = new FormData(event.currentTarget);
    form.set("image", photoA, "a.jpg");
    setPending(true);
    setRegisterError(null);
    const response = await fetch("/api/demo/register", { method: "POST", body: form }).catch(() => null);
    setPending(false);
    const data = response ? ((await response.json()) as { error?: string; fieldErrors?: Record<string, string> }) : null;
    if (!response?.ok) {
      setErrors(data?.fieldErrors ?? {});
      setRegisterError(data?.error ?? "Tidak ada sinyal.");
      return;
    }
    setErrors({});
    setRegistered(String(form.get("nickname") || form.get("color")));
    onChange();
  }

  async function matchB(blob: Blob) {
    setOutcome({ kind: "busy", label: "Memeriksa foto… Mencari kecocokan…" });
    const body = new FormData();
    body.set("image", blob, "b.jpg");
    setOutcome(await demoScan(body));
  }

  return (
    <section aria-labelledby="coba-title" className="space-y-4">
      <h2 id="coba-title" className="text-xl font-bold">
        Coba dengan foto Anda
      </h2>
      <p className="text-ink-muted">Pakai dua foto berbeda dari anjing yang sama. Foto A didaftarkan, foto B dicocokkan.</p>

      <Card className="space-y-4">
        <h3 className="font-bold">
          <span className="tabular mr-2 inline-flex size-7 items-center justify-center rounded-full bg-ink text-sm text-white">1</span>
          Daftarkan dari foto A
        </h3>
        {registered ? (
          <Notice tone="ok" title={`Terdaftar: ${registered}`} />
        ) : (
          <>
            {photoA ? <p className="font-semibold text-ok">Foto A siap.</p> : <CameraCapture onCapture={setPhotoA} captureLabel="Foto A" />}
            <form onSubmit={register} noValidate className="space-y-4">
              <div>
                <Label htmlFor={ids.color}>Warna bulu</Label>
                <input id={ids.color} name="color" className={inputClass} aria-invalid={Boolean(errors.color)} aria-describedby={errors.color ? ids.colorError : undefined} />
                <FieldError id={ids.colorError} message={errors.color} />
              </div>
              <div>
                <Label htmlFor={ids.nickname} hint="(opsional)">
                  Nama panggilan
                </Label>
                <input id={ids.nickname} name="nickname" className={inputClass} />
              </div>
              {registerError ? <Notice tone="danger" title={registerError} /> : null}
              <Button type="submit" disabled={!photoA || pending} className="w-full">
                {pending ? "Memeriksa dan menyimpan…" : "Daftarkan anjing demo"}
              </Button>
            </form>
          </>
        )}
      </Card>

      <Card className="space-y-4">
        <h3 className="font-bold">
          <span className="tabular mr-2 inline-flex size-7 items-center justify-center rounded-full bg-ink text-sm text-white">2</span>
          Cocokkan foto B
        </h3>
        <CameraCapture onCapture={matchB} disabled={outcome.kind === "busy"} captureLabel="Foto B" />
        <div aria-live="polite">
          <ScanOutcomeView
            outcome={outcome}
            onChoose={(chosen) => outcome.kind === "result" && setOutcome({ ...outcome, chosen })}
          />
        </div>
      </Card>
    </section>
  );
}

function Gallery({ dogs }: { dogs: DemoDog[] }) {
  return (
    <section aria-labelledby="galeri-title" className="space-y-3">
      <h2 id="galeri-title" className="text-xl font-bold">
        Anjing terdaftar di banjar DEMO
      </h2>
      {dogs.length === 0 ? (
        <EmptyState title="Belum ada anjing demo">
          Foto demo belum dimuat ke server ini. Anda tetap bisa mencoba alur di atas dengan foto sendiri.
        </EmptyState>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {dogs.map((dog) => (
            <li key={dog.id} className="overflow-hidden rounded-card border border-line bg-surface">
              <PhotoBox url={dog.photoUrl} alt={`Foto ${dog.nickname ?? dog.color}`} className="aspect-square w-full" />
              <div className="space-y-2 p-3">
                <p className="font-bold">
                  <DogName nickname={dog.nickname} color={dog.color} />
                </p>
                <p className="text-sm text-ink-muted">
                  {dog.photoCount} foto {dog.seeded ? "· seed" : "· ditambahkan pengunjung"}
                </p>
                <VaccineBadge state={dog.vaccine} lastAt={dog.lastVaccinatedAt} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Probes({ probes }: { probes: Probe[] }) {
  const [active, setActive] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<ScanOutcome>({ kind: "idle" });

  async function run(probe: Probe) {
    setActive(probe.path);
    setOutcome({ kind: "busy", label: "Memeriksa foto… Mencari kecocokan…" });
    const body = new FormData();
    body.set("probe", probe.path);
    const result = await demoScan(body);
    setOutcome(result.kind === "result" ? { ...result, answer: probe.answer } : result);
  }

  return (
    <section aria-labelledby="uji-title" className="space-y-3">
      <h2 id="uji-title" className="text-xl font-bold">
        Foto uji (belum didaftarkan)
      </h2>
      <p className="text-ink-muted">Foto lain dari anjing demo yang tidak ikut disimpan. Pilih satu untuk melihat apakah sistem mengenalinya.</p>
      {probes.length === 0 ? (
        <EmptyState title="Belum ada foto uji">Foto uji dibuat oleh skrip seed demo bersama galeri di atas.</EmptyState>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {probes.map((probe, index) => (
            <li key={probe.path}>
              <button
                type="button"
                onClick={() => run(probe)}
                aria-pressed={active === probe.path}
                className="block w-full overflow-hidden rounded-lg border-2 border-transparent aria-pressed:border-accent"
              >
                <PhotoBox url={probe.url} alt={`Foto uji ${index + 1}`} className="aspect-square w-full" />
                <span className="block py-2 text-sm font-semibold">Cocokkan</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div aria-live="polite">
        <ScanOutcomeView outcome={outcome} onChoose={(chosen) => outcome.kind === "result" && setOutcome({ ...outcome, chosen })} />
      </div>
    </section>
  );
}

function ResetDemo({ addedCount, onDone }: { addedCount: number; onDone: () => void }) {
  const [message, setMessage] = useState<string | null>(null);
  async function reset() {
    const response = await fetch("/api/demo/reset", { method: "POST" }).catch(() => null);
    setMessage(response?.ok ? "Data demo dikembalikan ke awal." : "Reset belum berhasil.");
    onDone();
  }
  return (
    <section aria-labelledby="reset-title" className="space-y-3 border-t border-line pt-6">
      <h2 id="reset-title" className="text-lg font-bold">
        Reset data demo
      </h2>
      <p className="text-ink-muted">
        Menghapus <span className="tabular font-semibold">{addedCount}</span> anjing yang ditambahkan pengunjung. Anjing seed tetap ada.
      </p>
      <Button variant="secondary" onClick={reset} disabled={addedCount === 0}>
        Reset data demo
      </Button>
      {message ? <Badge tone="neutral">{message}</Badge> : null}
    </section>
  );
}
