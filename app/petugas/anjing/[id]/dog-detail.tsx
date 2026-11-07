"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Badge, EmptyState, ErrorState, ListSkeleton, Notice } from "@/components/ui";
import { CameraCapture } from "@/components/camera-capture";
import { DogName, PhotoBox, VaccineBadge } from "@/components/dog-bits";
import { getBrowserClient } from "@/lib/supabase/browser";
import { vaccineState } from "@/lib/vaccine";
import { formatDate, formatDateTime } from "@/lib/format";
import { AI_STATUS_LABEL } from "@/lib/validation/vaccination";
import { OWNERSHIP_LABEL, SEX_LABEL } from "@/lib/validation/dog";
import { analyzePhoto, appendPhotos, type ScanPhoto } from "@/lib/scan-client";
import { qualityMessage } from "@/lib/ai/messages";
import type { Tables } from "@/lib/supabase/database.types";

type Detail = {
  dog: Tables<"dogs"> & { banjars: { name: string } | null };
  photos: { id: string; url: string | null; created_at: string; embedded: boolean }[];
  vaccinations: Tables<"vaccinations">[];
  validDays: number;
};

type State = { kind: "loading" } | { kind: "missing" } | { kind: "error" } | { kind: "ready"; detail: Detail };

const AI_TONE = { verified: "ok", pending: "wait", manual: "neutral" } as const;

export function DogDetail() {
  const { id } = useParams<{ id: string }>();
  const [state, setState] = useState<State>({ kind: "loading" });

  const load = useCallback(async () => {
    const supabase = getBrowserClient();
    const [dog, photos, vaccinations, config] = await Promise.all([
      supabase.from("dogs").select("*, banjars(name)").eq("id", id).maybeSingle(),
      supabase.from("dog_photos").select("id, storage_path, created_at, model_version").eq("dog_id", id).order("created_at"),
      supabase.from("vaccinations").select("*").eq("dog_id", id).order("vaccinated_at", { ascending: false }),
      supabase.from("app_config").select("value").eq("key", "vaccine_valid_days").maybeSingle(),
    ]);
    if (dog.error || photos.error || vaccinations.error) return setState({ kind: "error" });
    if (!dog.data) return setState({ kind: "missing" });
    const paths = photos.data.map((p) => p.storage_path);
    const signed = paths.length ? await supabase.storage.from("dog-photos").createSignedUrls(paths, 1800) : { data: [] };
    const urls = new Map((signed.data ?? []).map((s) => [s.path, s.signedUrl]));
    setState({
      kind: "ready",
      detail: {
        dog: dog.data,
        photos: photos.data.map((p) => ({
          id: p.id,
          url: urls.get(p.storage_path) ?? null,
          created_at: p.created_at,
          // model_version is set only when the AI produced an embedding (or "rejected:…" when it refused).
          embedded: Boolean(p.model_version) && !p.model_version?.startsWith("rejected:"),
        })),
        vaccinations: vaccinations.data,
        validDays: Number(config.data?.value ?? 365),
      },
    });
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-side fetch after mount
    load().catch(() => setState({ kind: "error" }));
  }, [load]);

  if (state.kind === "loading") return <ListSkeleton rows={4} label="Memuat data anjing" />;
  if (state.kind === "error") return <ErrorState title="Data anjing belum bisa dimuat." onRetry={() => void load()} />;
  if (state.kind === "missing") {
    return (
      <EmptyState title="Anjing tidak ditemukan" action={<Link className="font-semibold text-accent underline" href="/petugas">Kembali</Link>}>
        Mungkin data sudah digabung dengan anjing lain oleh admin.
      </EmptyState>
    );
  }

  const { dog, photos, vaccinations, validDays } = state.detail;
  const last = vaccinations[0]?.vaccinated_at ?? null;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/petugas" className="inline-flex min-h-12 items-center font-semibold text-accent">
          ← Daftar anjing
        </Link>
        <h1 className="text-2xl font-bold">
          <DogName nickname={dog.nickname} color={dog.color} />
        </h1>
        <p className="text-ink-muted">{dog.banjars?.name}</p>
        <div className="mt-2">
          <VaccineBadge state={vaccineState(last, validDays)} lastAt={last} />
        </div>
      </div>

      <section aria-labelledby="foto-title">
        <h2 id="foto-title" className="text-lg font-bold">
          Foto ({photos.length})
        </h2>
        {photos.length === 0 ? (
          <p className="mt-2 text-ink-muted">Belum ada foto.</p>
        ) : (
          <ul className="mt-2 grid grid-cols-3 gap-2">
            {photos.map((photo, index) => (
              <li key={photo.id} className="relative">
                <PhotoBox url={photo.url} alt={`Foto ${index + 1}, ${formatDate(photo.created_at)}`} className="aspect-square w-full rounded-lg" />
                {photo.embedded ? null : (
                  <span className="absolute bottom-1 left-1 rounded bg-wait-soft px-1.5 py-0.5 text-xs font-semibold text-wait">Belum dicocokkan</span>
                )}
              </li>
            ))}
          </ul>
        )}
        <AddPhoto dogId={dog.id} onAdded={() => void load()} />
      </section>

      <section aria-labelledby="atribut-title">
        <h2 id="atribut-title" className="text-lg font-bold">
          Data anjing
        </h2>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-card border border-line bg-surface p-4">
          <dt className="text-ink-muted">Warna</dt>
          <dd className="font-medium">{dog.color}</dd>
          <dt className="text-ink-muted">Kelamin</dt>
          <dd className="font-medium">{SEX_LABEL[dog.sex]}</dd>
          <dt className="text-ink-muted">Kepemilikan</dt>
          <dd className="font-medium">{OWNERSHIP_LABEL[dog.ownership]}</dd>
          {dog.owner_name ? (
            <>
              <dt className="text-ink-muted">Pemilik</dt>
              <dd className="font-medium">{dog.owner_name}</dd>
            </>
          ) : null}
          {dog.owner_phone ? (
            <>
              <dt className="text-ink-muted">HP pemilik</dt>
              <dd className="tabular font-medium">{dog.owner_phone}</dd>
            </>
          ) : null}
          <dt className="text-ink-muted">Didaftarkan</dt>
          <dd className="font-medium">{formatDate(dog.created_at)}</dd>
        </dl>
      </section>

      <section aria-labelledby="vaksin-title">
        <h2 id="vaksin-title" className="text-lg font-bold">
          Riwayat vaksin
        </h2>
        {vaccinations.length === 0 ? (
          <p className="mt-2 text-ink-muted">Belum ada catatan vaksin. Scan anjing ini untuk mencatat.</p>
        ) : (
          <ol className="mt-2 divide-y divide-line rounded-card border border-line bg-surface">
            {vaccinations.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <span>
                  <span className="tabular font-semibold">{formatDateTime(v.vaccinated_at)}</span>
                  {v.batch ? <span className="block text-sm text-ink-muted">Batch {v.batch}</span> : null}
                </span>
                <Badge tone={AI_TONE[v.ai_status]}>{AI_STATUS_LABEL[v.ai_status]}</Badge>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function AddPhoto({ dogId, onAdded }: { dogId: string; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "wait" | "danger"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function add(blob: Blob) {
    setBusy(true);
    setMessage(null);
    const photo: ScanPhoto = {
      id: crypto.randomUUID(),
      blob,
      previewUrl: "",
      status: "checking",
      reasons: [],
      embedding: null,
      detectionScore: null,
      modelVersion: null,
    };
    const analyzed = await analyzePhoto(photo);
    if (analyzed.status === "rejected") {
      setMessage({ tone: "wait", text: qualityMessage(analyzed.reasons) });
      setBusy(false);
      return;
    }
    const body = new FormData();
    appendPhotos(body, [analyzed], analyzed.status === "ok" ? "ai" : "pending");
    const response = await fetch(`/api/dogs/${dogId}/photos`, { method: "POST", body }).catch(() => null);
    setBusy(false);
    if (!response?.ok) {
      setMessage({ tone: "danger", text: "Foto belum tersimpan. Coba lagi." });
      return;
    }
    setMessage({
      tone: "ok",
      text: analyzed.status === "ok" ? "Foto ditambahkan." : "Foto disimpan. Akan dicocokkan saat AI pulih.",
    });
    setOpen(false);
    onAdded();
  }

  return (
    <div className="mt-3 space-y-3">
      {message ? <Notice tone={message.tone} title={message.text} /> : null}
      {open ? (
        <CameraCapture onCapture={add} disabled={busy} captureLabel={busy ? "Memeriksa foto…" : "Foto wajah anjing"} />
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="min-h-12 font-semibold text-accent underline underline-offset-4">
          Tambah foto
        </button>
      )}
    </div>
  );
}
