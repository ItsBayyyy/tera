"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Phone } from "lucide-react";
import { Badge, Button, EmptyState, ErrorState, ListSkeleton, Notice } from "@/components/ui";
import { DogName, PhotoBox, ScoreBar, VaccineBadge } from "@/components/dog-bits";
import { getBrowserClient } from "@/lib/supabase/browser";
import { formatDateTime } from "@/lib/format";
import { classifyZone, type Thresholds } from "@/lib/match/zone";
import { vaccineState } from "@/lib/vaccine";
import type { Tables } from "@/lib/supabase/database.types";
import { bodyPartLabel, STATUS_LABEL, STATUS_TONE, type ReportStatus } from "../case-queue";

type Candidate = {
  dogId: string;
  score: number;
  nickname: string | null;
  color: string;
  photoUrl: string | null;
  lastVaccinatedAt: string | null;
};

type Detail = {
  report: Tables<"bite_reports"> & { banjars: { name: string } | null };
  photoUrl: string | null;
  candidates: Candidate[];
  thresholds: Thresholds;
  validDays: number;
};

type State = { kind: "loading" } | { kind: "missing" } | { kind: "error" } | { kind: "ready"; detail: Detail };

function readCandidates(value: unknown): { dog_id: string; score: number }[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is { dog_id: string; score: number } =>
      typeof item === "object" && item !== null && typeof item.dog_id === "string" && typeof item.score === "number",
  );
}

export function CaseDetail() {
  const { id } = useParams<{ id: string }>();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const supabase = getBrowserClient();
    const { data: report, error } = await supabase.from("bite_reports").select("*, banjars(name)").eq("id", id).maybeSingle();
    if (error) return setState({ kind: "error" });
    if (!report) return setState({ kind: "missing" });

    const [log, config] = await Promise.all([
      report.match_log_id
        ? supabase.from("match_logs").select("top_candidates").eq("id", report.match_log_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("app_config").select("key, value"),
    ]);
    const settings = new Map((config.data ?? []).map((row) => [row.key, Number(row.value)]));
    const ranked = readCandidates(log.data?.top_candidates);
    const ids = ranked.map((c) => c.dog_id);
    if (report.confirmed_dog_id && !ids.includes(report.confirmed_dog_id)) ids.push(report.confirmed_dog_id);

    const [dogs, photos, vaccinations, reportPhoto] = await Promise.all([
      ids.length ? supabase.from("dogs").select("id, nickname, color").in("id", ids) : Promise.resolve({ data: [] }),
      ids.length
        ? supabase.from("dog_photos").select("dog_id, storage_path").in("dog_id", ids).order("created_at", { ascending: false })
        : Promise.resolve({ data: [] }),
      ids.length
        ? supabase.from("vaccinations").select("dog_id, vaccinated_at").in("dog_id", ids).order("vaccinated_at", { ascending: false })
        : Promise.resolve({ data: [] }),
      report.photo_path ? supabase.storage.from("report-photos").createSignedUrl(report.photo_path, 1800) : Promise.resolve({ data: null }),
    ]);

    const firstPhoto = new Map<string, string>();
    for (const p of photos.data ?? []) if (!firstPhoto.has(p.dog_id)) firstPhoto.set(p.dog_id, p.storage_path);
    const signed = firstPhoto.size
      ? await supabase.storage.from("dog-photos").createSignedUrls([...firstPhoto.values()], 1800)
      : { data: [] };
    const urlByPath = new Map((signed.data ?? []).map((s) => [s.path, s.signedUrl]));
    const lastVax = new Map<string, string>();
    for (const v of vaccinations.data ?? []) if (!lastVax.has(v.dog_id)) lastVax.set(v.dog_id, v.vaccinated_at);
    const scoreById = new Map(ranked.map((c) => [c.dog_id, c.score]));

    const candidates: Candidate[] = (dogs.data ?? [])
      .map((dog) => ({
        dogId: dog.id,
        score: scoreById.get(dog.id) ?? Number.NaN,
        nickname: dog.nickname,
        color: dog.color,
        photoUrl: urlByPath.get(firstPhoto.get(dog.id) ?? "") ?? null,
        lastVaccinatedAt: lastVax.get(dog.id) ?? null,
      }))
      .sort((a, b) => (b.score || -2) - (a.score || -2));

    setState({
      kind: "ready",
      detail: {
        report,
        photoUrl: reportPhoto.data?.signedUrl ?? null,
        candidates,
        thresholds: { strong: settings.get("match_strong") ?? 0.7, unsure: settings.get("match_unsure") ?? 0.5 },
        validDays: settings.get("vaccine_valid_days") ?? 365,
      },
    });
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-side fetch after mount
    load().catch(() => setState({ kind: "error" }));
  }, [load]);

  async function patch(body: { status?: ReportStatus; confirmedDogId?: string | null }, done: string) {
    setSaving(true);
    setMessage(null);
    const response = await fetch(`/api/reports/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    setSaving(false);
    setMessage(response?.ok ? { ok: true, text: done } : { ok: false, text: "Perubahan belum tersimpan. Coba lagi." });
    if (response?.ok) await load();
  }

  if (state.kind === "loading") return <ListSkeleton rows={4} label="Memuat kasus" />;
  if (state.kind === "error") return <ErrorState title="Kasus belum bisa dimuat." onRetry={() => void load()} />;
  if (state.kind === "missing") return <EmptyState title="Kasus tidak ditemukan" />;

  const { report, photoUrl, candidates, thresholds, validDays } = state.detail;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/petugas/kasus" className="inline-flex min-h-12 items-center font-semibold text-accent">
          ← Antrean kasus
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="tabular text-2xl font-bold tracking-wider">{report.case_code}</h1>
          <Badge tone={STATUS_TONE[report.status]}>{STATUS_LABEL[report.status]}</Badge>
        </div>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-card border border-line bg-surface p-4">
        <dt className="text-ink-muted">Digigit</dt>
        <dd className="tabular font-medium">{report.bitten_at ? formatDateTime(report.bitten_at) : "Tidak diisi"}</dd>
        <dt className="text-ink-muted">Dilaporkan</dt>
        <dd className="tabular font-medium">{formatDateTime(report.created_at)}</dd>
        <dt className="text-ink-muted">Bagian tubuh</dt>
        <dd className="font-medium">{bodyPartLabel(report.body_part) ?? "Tidak diisi"}</dd>
        <dt className="text-ink-muted">Banjar</dt>
        <dd className="font-medium">{report.banjars?.name ?? "Tidak diisi"}</dd>
        <dt className="text-ink-muted">Lokasi</dt>
        <dd className="tabular font-medium">
          {report.lat !== null && report.lon !== null ? `${report.lat}, ${report.lon} (±100 m)` : "Tidak dibagikan"}
        </dd>
        <dt className="text-ink-muted">Kontak</dt>
        <dd className="font-medium">
          {report.contact_phone && report.contact_consent ? (
            <a href={`tel:${report.contact_phone}`} className="tabular inline-flex min-h-12 items-center gap-2 text-accent underline">
              <Phone aria-hidden="true" className="size-4" />
              {report.contact_phone}
            </a>
          ) : (
            "Tidak ada"
          )}
        </dd>
      </dl>

      <section aria-labelledby="foto-kasus" className="space-y-2">
        <h2 id="foto-kasus" className="text-lg font-bold">
          Foto dari warga
        </h2>
        {photoUrl ? (
          <PhotoBox url={photoUrl} alt="Foto anjing penggigit dari warga" className="max-h-80 w-full rounded-card object-contain" />
        ) : (
          <p className="text-ink-muted">Warga tidak mengirim foto.</p>
        )}
      </section>

      <section aria-labelledby="kandidat" className="space-y-3">
        <h2 id="kandidat" className="text-lg font-bold">
          Kandidat anjing dari AI
        </h2>
        <Notice tone="wait" title="Saran AI, bukan kepastian.">
          Bandingkan foto warga dengan foto anjing terdaftar. Konfirmasi hanya bila Anda yakin. Status vaksin anjing tidak pernah dipakai untuk menyatakan korban aman.
        </Notice>
        {candidates.length === 0 ? (
          <p className="text-ink-muted">
            {report.photo_path ? "Belum ada kandidat. Foto mungkin tidak jelas atau AI sedang tidak tersedia." : "Tidak ada foto untuk dicocokkan."}
          </p>
        ) : (
          <ul className="space-y-3">
            {candidates.map((candidate) => {
              const confirmed = report.confirmed_dog_id === candidate.dogId;
              return (
                <li key={candidate.dogId} className={`flex gap-3 rounded-card border bg-surface p-3 ${confirmed ? "border-2 border-ok" : "border-line"}`}>
                  <PhotoBox url={candidate.photoUrl} alt="Foto anjing terdaftar" className="size-24 shrink-0 rounded-lg" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Link href={`/petugas/anjing/${candidate.dogId}`} className="font-bold text-accent underline underline-offset-2">
                      <DogName nickname={candidate.nickname} color={candidate.color} />
                    </Link>
                    {Number.isNaN(candidate.score) ? null : (
                      <ScoreBar score={candidate.score} zone={classifyZone(candidate.score, thresholds)} />
                    )}
                    <VaccineBadge state={vaccineState(candidate.lastVaccinatedAt, validDays)} lastAt={candidate.lastVaccinatedAt} />
                    {confirmed ? (
                      <Button variant="ghost" className="px-0" disabled={saving} onClick={() => patch({ confirmedDogId: null }, "Konfirmasi dibatalkan.")}>
                        Batalkan konfirmasi
                      </Button>
                    ) : (
                      <Button variant="secondary" className="w-full" disabled={saving} onClick={() => patch({ confirmedDogId: candidate.dogId }, "Anjing dikonfirmasi.")}>
                        Ya, ini anjingnya
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {message ? <Notice tone={message.ok ? "ok" : "danger"} title={message.text} /> : null}

      <section aria-labelledby="status-kasus" className="space-y-2">
        <h2 id="status-kasus" className="text-lg font-bold">
          Ubah status
        </h2>
        <div className="grid grid-cols-3 gap-2">
          {(["new", "in_progress", "closed"] as const).map((status) => (
            <Button
              key={status}
              variant={report.status === status ? "primary" : "secondary"}
              aria-pressed={report.status === status}
              disabled={saving}
              className="px-2"
              onClick={() => report.status !== status && patch({ status }, `Status: ${STATUS_LABEL[status]}.`)}
            >
              {STATUS_LABEL[status]}
            </Button>
          ))}
        </div>
      </section>
    </div>
  );
}
