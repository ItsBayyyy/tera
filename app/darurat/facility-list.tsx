"use client";

import { useEffect, useState } from "react";
import { Phone } from "lucide-react";
import { ListSkeleton } from "@/components/ui";

type Facility = {
  id: string;
  name: string;
  type: string;
  phone: string | null;
  address: string | null;
  readiness_note: string | null;
};

type State = { kind: "loading" } | { kind: "ready"; facilities: Facility[] } | { kind: "offline" };

/** Facility contacts come only from admin input; with none entered the guidance stays generic. */
export function FacilityList() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    fetch("/api/facilities")
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json() as Promise<{ facilities: Facility[] }>;
      })
      .then((data) => setState({ kind: "ready", facilities: data.facilities }))
      .catch(() => setState({ kind: "offline" }));
  }, []);

  return (
    <section aria-labelledby="faskes-title" className="mt-6">
      <h3 id="faskes-title" className="text-lg font-bold">
        Tempat berobat gigitan anjing
      </h3>
      {state.kind === "loading" ? <ListSkeleton rows={2} label="Memuat daftar faskes" /> : null}
      {state.kind === "offline" || (state.kind === "ready" && state.facilities.length === 0) ? (
        <p className="mt-2 rounded-xl bg-surface p-4 leading-relaxed text-ink-muted ring-1 ring-line">
          {state.kind === "offline" ? "Daftar faskes tidak bisa dimuat tanpa sinyal. " : "Daftar faskes belum diisi petugas. "}
          Datangi puskesmas atau rumah sakit terdekat hari ini. Bila darurat, telepon 119.
        </p>
      ) : null}
      {state.kind === "ready" && state.facilities.length > 0 ? (
        <ul className="mt-3 space-y-3">
          {state.facilities.map((facility) => (
            <li key={facility.id} className="rounded-card border border-line bg-surface p-4">
              <p className="font-bold">{facility.name}</p>
              <p className="text-sm text-ink-muted">{facility.type}</p>
              {facility.address ? <p className="mt-1">{facility.address}</p> : null}
              {facility.readiness_note ? <p className="mt-1 text-sm text-ink-muted">{facility.readiness_note}</p> : null}
              {facility.phone ? (
                <a
                  href={`tel:${facility.phone.replace(/[^\d+]/g, "")}`}
                  className="mt-3 inline-flex min-h-12 items-center gap-2 rounded-xl border-2 border-line-strong px-4 font-semibold"
                >
                  <Phone aria-hidden="true" className="size-4" />
                  {facility.phone}
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
