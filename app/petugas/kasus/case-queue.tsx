"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Badge, EmptyState, ErrorState, ListSkeleton } from "@/components/ui";
import { getBrowserClient } from "@/lib/supabase/browser";
import { formatDateTime } from "@/lib/format";
import { BODY_PART_LABEL, BODY_PARTS } from "@/lib/validation/report";
import type { Tables } from "@/lib/supabase/database.types";

export type ReportStatus = Tables<"bite_reports">["status"];

export const STATUS_LABEL: Record<ReportStatus, string> = {
  new: "Baru",
  in_progress: "Ditangani",
  closed: "Selesai",
};
export const STATUS_TONE = { new: "danger", in_progress: "wait", closed: "neutral" } as const;

type Row = Pick<
  Tables<"bite_reports">,
  "id" | "case_code" | "status" | "created_at" | "bitten_at" | "body_part" | "photo_path" | "matched_dog_id" | "confirmed_dog_id"
> & { banjars: { name: string } | null };

type State = { kind: "loading" } | { kind: "error" } | { kind: "ready"; rows: Row[] };
type Filter = "open" | "closed";

export function bodyPartLabel(value: string | null): string | null {
  if (!value) return null;
  return (BODY_PARTS as readonly string[]).includes(value) ? BODY_PART_LABEL[value as (typeof BODY_PARTS)[number]] : value;
}

export function CaseQueue() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [filter, setFilter] = useState<Filter>("open");
  const [live, setLive] = useState(false);

  const load = useCallback(async () => {
    const query = getBrowserClient()
      .from("bite_reports")
      .select("id, case_code, status, created_at, bitten_at, body_part, photo_path, matched_dog_id, confirmed_dog_id, banjars(name)")
      .order("created_at", { ascending: false })
      .limit(100);
    const { data, error } = filter === "open" ? await query.neq("status", "closed") : await query.eq("status", "closed");
    setState(error ? { kind: "error" } : { kind: "ready", rows: data });
  }, [filter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-side fetch after mount
    load().catch(() => setState({ kind: "error" }));
  }, [load]);

  // New and updated reports arrive over Supabase Realtime; the list simply reloads.
  useEffect(() => {
    const supabase = getBrowserClient();
    const channel = supabase
      .channel("bite-reports-queue")
      .on("postgres_changes", { event: "*", schema: "public", table: "bite_reports" }, () => {
        void load();
      })
      .subscribe((status) => setLive(status === "SUBSCRIBED"));
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Laporan gigitan</h1>
        <span className="text-sm text-ink-muted" aria-live="polite">
          {live ? "Pembaruan langsung aktif" : "Menyambungkan pembaruan…"}
        </span>
      </div>
      <div role="group" aria-label="Saring laporan" className="grid grid-cols-2 gap-2">
        {(["open", "closed"] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => {
              setState({ kind: "loading" });
              setFilter(value);
            }}
            className="min-h-12 rounded-xl border-2 border-line-strong bg-surface font-semibold aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:text-accent"
          >
            {value === "open" ? "Perlu ditangani" : "Selesai"}
          </button>
        ))}
      </div>

      {state.kind === "loading" ? <ListSkeleton label="Memuat laporan" /> : null}
      {state.kind === "error" ? <ErrorState title="Laporan belum bisa dimuat." onRetry={() => void load()} /> : null}
      {state.kind === "ready" && state.rows.length === 0 ? (
        <EmptyState title={filter === "open" ? "Tidak ada laporan yang menunggu" : "Belum ada laporan selesai"}>
          {filter === "open" ? "Laporan baru dari warga akan muncul di sini tanpa perlu memuat ulang." : null}
        </EmptyState>
      ) : null}
      {state.kind === "ready" && state.rows.length > 0 ? (
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
          {state.rows.map((row) => (
            <li key={row.id}>
              <Link href={`/petugas/kasus/${row.id}`} className="flex min-h-16 flex-col gap-1 px-4 py-3 hover:bg-sunken">
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="tabular text-lg font-bold tracking-wider">{row.case_code}</span>
                  <Badge tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</Badge>
                </span>
                <span className="text-sm text-ink-muted">
                  {formatDateTime(row.bitten_at ?? row.created_at)}
                  {row.banjars ? ` · ${row.banjars.name}` : ""}
                  {row.body_part ? ` · ${bodyPartLabel(row.body_part)}` : ""}
                </span>
                <span className="text-sm">
                  {row.confirmed_dog_id
                    ? "Anjing sudah dikonfirmasi"
                    : row.matched_dog_id
                      ? "Ada kandidat anjing dari AI, perlu dikonfirmasi"
                      : row.photo_path
                        ? "Ada foto anjing"
                        : "Tanpa foto"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
