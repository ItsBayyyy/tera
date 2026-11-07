"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { Camera } from "lucide-react";
import { banjarLabel, useOfficer } from "@/components/officer-context";
import { EmptyState, ErrorState, Label, LinkButton, ListSkeleton, inputClass } from "@/components/ui";
import { DogName, VaccineBadge } from "@/components/dog-bits";
import { getBrowserClient } from "@/lib/supabase/browser";
import { vaccineState } from "@/lib/vaccine";

type DogRow = {
  id: string;
  nickname: string | null;
  color: string;
  created_at: string;
  vaccinations: { vaccinated_at: string }[];
};

type ListState = { kind: "loading" } | { kind: "error" } | { kind: "ready"; dogs: DogRow[]; validDays: number };

export function OfficerHome() {
  const { state, setActiveBanjar } = useOfficer();
  const selectId = useId();
  if (state.kind !== "ready") return null;
  const active = state.banjars.find((b) => b.id === state.activeBanjarId);

  return (
    <>
      <h1 className="text-2xl font-bold">Halo{state.fullName ? `, ${state.fullName}` : ""}</h1>
      <div className="mt-4">
        <Label htmlFor={selectId}>Banjar aktif</Label>
        <select
          id={selectId}
          value={state.activeBanjarId ?? ""}
          onChange={(event) => setActiveBanjar(event.target.value)}
          className={inputClass}
        >
          <option value="" disabled>
            Pilih banjar tempat bertugas
          </option>
          {state.banjars.map((banjar) => (
            <option key={banjar.id} value={banjar.id}>
              {banjarLabel(banjar)}
              {banjar.is_sample ? " (contoh)" : ""}
            </option>
          ))}
        </select>
        <p className="mt-1 text-sm text-ink-muted">Pencocokan hanya mencari anjing di banjar ini.</p>
      </div>

      {active ? <DogList banjarId={active.id} /> : null}

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-canvas px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3">
        <div className="mx-auto max-w-3xl">
          {active ? (
            <LinkButton href="/petugas/scan" className="min-h-16 w-full text-lg">
              <Camera aria-hidden="true" className="size-6" />
              Scan anjing
            </LinkButton>
          ) : (
            <p className="py-3 text-center font-semibold text-ink-muted">Pilih banjar dulu untuk mulai scan.</p>
          )}
        </div>
      </div>
    </>
  );
}

function DogList({ banjarId }: { banjarId: string }) {
  const [list, setList] = useState<ListState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const supabase = getBrowserClient();
    Promise.all([
      supabase
        .from("dogs")
        .select("id, nickname, color, created_at, vaccinations(vaccinated_at)")
        .eq("banjar_id", banjarId)
        .order("created_at", { ascending: false })
        .order("vaccinated_at", { referencedTable: "vaccinations", ascending: false })
        .limit(30),
      supabase.from("app_config").select("value").eq("key", "vaccine_valid_days").maybeSingle(),
    ]).then(([dogs, config]) => {
      if (cancelled) return;
      if (dogs.error) setList({ kind: "error" });
      else setList({ kind: "ready", dogs: dogs.data, validDays: Number(config.data?.value ?? 365) });
    });
    return () => {
      cancelled = true;
    };
  }, [banjarId, attempt]);

  return (
    <section aria-labelledby="dogs-title" className="mt-8">
      <h2 id="dogs-title" className="text-lg font-bold">
        Anjing terdaftar di banjar ini
      </h2>
      <div className="mt-3">
        {list.kind === "loading" ? <ListSkeleton label="Memuat daftar anjing" /> : null}
        {list.kind === "error" ? (
          <ErrorState
            title="Daftar anjing belum bisa dimuat."
            onRetry={() => {
              setList({ kind: "loading" });
              setAttempt((n) => n + 1);
            }}
          />
        ) : null}
        {list.kind === "ready" && list.dogs.length === 0 ? (
          <EmptyState title="Belum ada anjing terdaftar">
            Scan anjing pertama. Bila tidak ada yang cocok, Anda bisa langsung mendaftarkannya.
          </EmptyState>
        ) : null}
        {list.kind === "ready" && list.dogs.length > 0 ? (
          <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
            {list.dogs.map((dog) => {
              const last = dog.vaccinations[0]?.vaccinated_at ?? null;
              return (
                <li key={dog.id}>
                  <Link href={`/petugas/anjing/${dog.id}`} className="flex min-h-16 flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-sunken">
                    <span className="font-semibold">
                      <DogName nickname={dog.nickname} color={dog.color} />
                      <span className="block text-sm font-normal text-ink-muted">{dog.color}</span>
                    </span>
                    <VaccineBadge state={vaccineState(last, list.validDays)} lastAt={last} />
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
