"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useState, type FormEvent } from "react";
import { useOfficer } from "@/components/officer-context";
import { Badge, Button, Card, EmptyState, ErrorState, FieldError, Label, ListSkeleton, Notice, inputClass } from "@/components/ui";
import { getBrowserClient } from "@/lib/supabase/browser";
import { formatPercent, formatScore } from "@/lib/format";
import type { Tables } from "@/lib/supabase/database.types";
import { FacilityManager } from "./facility-manager";

export function AdminDashboard() {
  const { state } = useOfficer();
  if (state.kind !== "ready") return null;
  if (state.role !== "admin") {
    return (
      <Notice tone="wait" title="Halaman ini khusus admin.">
        <Link href="/petugas" className="font-semibold text-accent underline">
          Kembali ke halaman petugas
        </Link>
      </Notice>
    );
  }
  return (
    <div className="space-y-10">
      <h1 className="text-2xl font-bold">Admin</h1>
      <Coverage />
      <PendingWork />
      <ThresholdForm />
      <FacilityManager />
    </div>
  );
}

type CoverageRow = {
  banjar_id: string;
  name: string;
  district: string | null;
  is_sample: boolean;
  dogs_registered: number;
  dogs_vaccinated_active: number;
  bite_reports: number;
};

function Coverage() {
  const [rows, setRows] = useState<CoverageRow[] | null | "error">(null);

  const load = useCallback(async () => {
    const { data, error } = await getBrowserClient().rpc("banjar_coverage");
    setRows(error ? "error" : data);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-side fetch after mount
    void load();
  }, [load]);

  const totals = Array.isArray(rows)
    ? rows.reduce(
        (acc, r) => ({
          dogs: acc.dogs + r.dogs_registered,
          vaccinated: acc.vaccinated + r.dogs_vaccinated_active,
          bites: acc.bites + r.bite_reports,
        }),
        { dogs: 0, vaccinated: 0, bites: 0 },
      )
    : null;

  return (
    <section aria-labelledby="cakupan-title" className="space-y-3">
      <h2 id="cakupan-title" className="text-xl font-bold">
        Cakupan vaksin per banjar
      </h2>
      <p className="text-ink-muted">
        Dihitung dari anjing yang terdaftar di Tera, bukan populasi anjing sebenarnya. Tervaksin = vaksin dalam periode aktif.
      </p>
      {rows === null ? <ListSkeleton rows={3} label="Memuat cakupan" /> : null}
      {rows === "error" ? <ErrorState title="Cakupan belum bisa dimuat." onRetry={() => void load()} /> : null}
      {Array.isArray(rows) && rows.length === 0 ? <EmptyState title="Belum ada banjar." /> : null}
      {Array.isArray(rows) && rows.length > 0 && totals ? (
        <div className="overflow-x-auto rounded-card border border-line bg-surface">
          <table className="tabular w-full min-w-[34rem] text-left">
            <caption className="sr-only">Cakupan vaksin per banjar</caption>
            <thead className="border-b border-line bg-sunken text-sm text-ink-muted">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Banjar</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Terdaftar</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Tervaksin aktif</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Cakupan</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Laporan gigitan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((row) => (
                <tr key={row.banjar_id}>
                  <th scope="row" className="px-4 py-3 font-semibold">
                    {row.name}
                    {row.is_sample ? <span className="ml-2 text-sm font-normal text-ink-muted">(contoh)</span> : null}
                    {row.district ? <span className="block text-sm font-normal text-ink-muted">{row.district}</span> : null}
                  </th>
                  <td className="px-4 py-3 text-right">{row.dogs_registered}</td>
                  <td className="px-4 py-3 text-right">{row.dogs_vaccinated_active}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatPercent(row.dogs_vaccinated_active, row.dogs_registered)}</td>
                  <td className="px-4 py-3 text-right">{row.bite_reports}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-line font-bold">
              <tr>
                <th scope="row" className="px-4 py-3">Total</th>
                <td className="px-4 py-3 text-right">{totals.dogs}</td>
                <td className="px-4 py-3 text-right">{totals.vaccinated}</td>
                <td className="px-4 py-3 text-right">{formatPercent(totals.vaccinated, totals.dogs)}</td>
                <td className="px-4 py-3 text-right">{totals.bites}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : null}
    </section>
  );
}

type Flag = Pick<Tables<"duplicate_flags">, "id" | "dog_id" | "candidate_dog_id" | "score">;
type RematchSummary = { processed: number; embedded: number; rejected: number; duplicatesFlagged: number; verifiedDogs: number; aiAvailable: boolean; remaining: number };

function PendingWork() {
  const [pendingPhotos, setPendingPhotos] = useState<number | null>(null);
  const [flags, setFlags] = useState<Flag[] | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ tone: "ok" | "wait" | "danger"; text: string } | null>(null);

  const load = useCallback(async () => {
    const supabase = getBrowserClient();
    const [photos, open] = await Promise.all([
      supabase
        .from("dog_photos")
        .select("id", { count: "exact", head: true })
        .is("embedding", null)
        .or("model_version.is.null,model_version.not.like.rejected:*"),
      supabase.from("duplicate_flags").select("id, dog_id, candidate_dog_id, score").eq("status", "open").order("score", { ascending: false }),
    ]);
    setPendingPhotos(photos.count ?? 0);
    setFlags(open.data ?? []);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-side fetch after mount
    void load();
  }, [load]);

  async function rematch() {
    setRunning(true);
    setResult(null);
    const response = await fetch("/api/jobs/rematch", { method: "POST" }).catch(() => null);
    setRunning(false);
    if (!response?.ok) {
      setResult({ tone: "danger", text: "Proses ulang gagal. Coba lagi nanti." });
      return;
    }
    const s = (await response.json()) as RematchSummary;
    setResult(
      s.aiAvailable
        ? {
            tone: "ok",
            text: `${s.processed} foto diproses: ${s.embedded} dicocokkan, ${s.rejected} ditolak kualitas, ${s.duplicatesFlagged} calon duplikat, ${s.verifiedDogs} anjing terverifikasi. Sisa ${s.remaining}.`,
          }
        : { tone: "wait", text: `AI masih belum tersedia. ${s.processed} foto sempat diproses, sisa ${s.remaining}.` },
    );
    await load();
  }

  async function resolve(id: string, action: "dismiss" | "merge") {
    const response = await fetch(`/api/admin/duplicates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    }).catch(() => null);
    setResult(response?.ok ? { tone: "ok", text: action === "merge" ? "Data anjing digabung." : "Ditandai bukan duplikat." } : { tone: "danger", text: "Belum tersimpan." });
    await load();
  }

  return (
    <section aria-labelledby="tertunda-title" className="space-y-3">
      <h2 id="tertunda-title" className="text-xl font-bold">
        Verifikasi tertunda
      </h2>
      <Card className="space-y-3">
        <p>
          Foto yang dicatat tanpa AI:{" "}
          <span className="tabular font-bold">{pendingPhotos === null ? "…" : pendingPhotos}</span>
        </p>
        <Button variant="secondary" disabled={running || pendingPhotos === 0} onClick={rematch}>
          {running ? "Memproses…" : "Proses ulang sekarang"}
        </Button>
        {result ? <Notice tone={result.tone} title={result.text} /> : null}
      </Card>
      <h3 className="text-lg font-bold">Calon duplikat</h3>
      {flags === null ? <ListSkeleton rows={2} label="Memuat calon duplikat" /> : null}
      {flags?.length === 0 ? <p className="text-ink-muted">Tidak ada calon duplikat.</p> : null}
      {flags && flags.length > 0 ? (
        <ul className="space-y-3">
          {flags.map((flag) => (
            <li key={flag.id} className="space-y-3 rounded-card border border-wait-line bg-surface p-4">
              <p>
                <Link href={`/petugas/anjing/${flag.dog_id}`} className="font-semibold text-accent underline">
                  Anjing baru
                </Link>{" "}
                mirip{" "}
                <Link href={`/petugas/anjing/${flag.candidate_dog_id}`} className="font-semibold text-accent underline">
                  anjing terdaftar
                </Link>{" "}
                <Badge tone="wait">Kemiripan {formatScore(flag.score)}</Badge>
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" onClick={() => resolve(flag.id, "dismiss")}>
                  Bukan duplikat
                </Button>
                <Button onClick={() => resolve(flag.id, "merge")}>Gabungkan</Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function ThresholdForm() {
  const ids = { strong: useId(), unsure: useId(), days: useId(), unsureError: useId() };
  const [values, setValues] = useState<{ strong: string; unsure: string; days: string; note: string | null } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<{ tone: "ok" | "danger"; text: string } | null>(null);

  useEffect(() => {
    getBrowserClient()
      .from("app_config")
      .select("key, value, note")
      .then(({ data }) => {
        const map = new Map((data ?? []).map((row) => [row.key, row]));
        setValues({
          strong: String(map.get("match_strong")?.value ?? ""),
          unsure: String(map.get("match_unsure")?.value ?? ""),
          days: String(map.get("vaccine_valid_days")?.value ?? ""),
          note: map.get("match_strong")?.note ?? null,
        });
      });
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!values) return;
    setStatus(null);
    const response = await fetch("/api/admin/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchStrong: values.strong, matchUnsure: values.unsure, vaccineValidDays: values.days }),
    }).catch(() => null);
    const data = response ? ((await response.json()) as { error?: string; fieldErrors?: Record<string, string> }) : null;
    setErrors(data?.fieldErrors ?? {});
    setStatus(response?.ok ? { tone: "ok", text: "Pengaturan tersimpan." } : { tone: "danger", text: data?.error ?? "Belum tersimpan." });
  }

  return (
    <section aria-labelledby="ambang-title" className="space-y-3">
      <h2 id="ambang-title" className="text-xl font-bold">
        Ambang pencocokan
      </h2>
      {values?.note ? <Notice tone="wait" title={values.note} /> : null}
      {values === null ? (
        <ListSkeleton rows={2} label="Memuat pengaturan" />
      ) : (
        <form onSubmit={save} noValidate className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor={ids.strong}>Ambang kuat</Label>
              <input id={ids.strong} inputMode="decimal" value={values.strong} onChange={(e) => setValues({ ...values, strong: e.target.value })} className={inputClass} />
            </div>
            <div>
              <Label htmlFor={ids.unsure}>Ambang ragu</Label>
              <input
                id={ids.unsure}
                inputMode="decimal"
                value={values.unsure}
                onChange={(e) => setValues({ ...values, unsure: e.target.value })}
                className={inputClass}
                aria-invalid={Boolean(errors.matchUnsure)}
                aria-describedby={errors.matchUnsure ? ids.unsureError : undefined}
              />
              <FieldError id={ids.unsureError} message={errors.matchUnsure} />
            </div>
            <div>
              <Label htmlFor={ids.days}>Periode vaksin (hari)</Label>
              <input id={ids.days} inputMode="numeric" value={values.days} onChange={(e) => setValues({ ...values, days: e.target.value })} className={inputClass} />
            </div>
          </div>
          <p className="text-sm text-ink-muted">
            Kemiripan ≥ ambang kuat: satu kandidat besar. Di antara keduanya: lima kandidat untuk diperiksa. Di bawah ambang ragu: tawarkan daftar baru.
            Gunakan rekomendasi dari <code>scripts/eval.py</code>.
          </p>
          {status ? <Notice tone={status.tone} title={status.text} /> : null}
          <Button type="submit">Simpan pengaturan</Button>
        </form>
      )}
    </section>
  );
}
