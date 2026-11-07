"use client";

import { useCallback, useEffect, useId, useState, type FormEvent } from "react";
import { Badge, Button, EmptyState, FieldError, Label, ListSkeleton, Notice, inputClass } from "@/components/ui";
import { getBrowserClient } from "@/lib/supabase/browser";
import type { Tables } from "@/lib/supabase/database.types";

type Facility = Tables<"facilities">;

/** Facility contacts shown to bitten citizens. Only what an admin enters here is ever displayed. */
export function FacilityManager() {
  const [facilities, setFacilities] = useState<Facility[] | null>(null);
  const [editing, setEditing] = useState<Facility | "new" | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "danger"; text: string } | null>(null);

  const load = useCallback(async () => {
    const { data } = await getBrowserClient().from("facilities").select("*").order("name");
    setFacilities(data ?? []);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-side fetch after mount
    void load();
  }, [load]);

  async function remove(facility: Facility) {
    if (!window.confirm(`Hapus ${facility.name}? Warga tidak akan melihatnya lagi.`)) return;
    const response = await fetch(`/api/admin/facilities/${facility.id}`, { method: "DELETE" }).catch(() => null);
    setMessage(response?.ok ? { tone: "ok", text: "Faskes dihapus." } : { tone: "danger", text: "Faskes belum terhapus." });
    await load();
  }

  return (
    <section aria-labelledby="faskes-admin-title" className="space-y-3">
      <h2 id="faskes-admin-title" className="text-xl font-bold">
        Fasilitas kesehatan
      </h2>
      <p className="text-ink-muted">Ditampilkan ke warga di halaman darurat. Isi hanya dari sumber resmi dan cek nomornya.</p>
      {message ? <Notice tone={message.tone} title={message.text} /> : null}
      {facilities === null ? <ListSkeleton rows={2} label="Memuat faskes" /> : null}
      {facilities?.length === 0 && editing === null ? (
        <EmptyState title="Belum ada faskes" action={<Button onClick={() => setEditing("new")}>Tambah faskes</Button>}>
          Selama kosong, warga diarahkan ke puskesmas atau rumah sakit terdekat dan nomor 119.
        </EmptyState>
      ) : null}
      {facilities && facilities.length > 0 ? (
        <ul className="divide-y divide-line rounded-card border border-line bg-surface">
          {facilities.map((facility) => (
            <li key={facility.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="font-semibold">{facility.name}</p>
                <p className="text-sm text-ink-muted">
                  {facility.type}
                  {facility.phone ? ` · ${facility.phone}` : ""}
                </p>
                {facility.handles_bites ? null : <Badge tone="neutral">Tidak ditampilkan ke warga</Badge>}
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setEditing(facility)}>
                  Ubah
                </Button>
                <Button variant="ghost" onClick={() => remove(facility)}>
                  Hapus
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {editing ? (
        <FacilityForm
          facility={editing === "new" ? null : editing}
          onDone={async (text) => {
            setEditing(null);
            setMessage({ tone: "ok", text });
            await load();
          }}
          onCancel={() => setEditing(null)}
        />
      ) : facilities && facilities.length > 0 ? (
        <Button variant="secondary" onClick={() => setEditing("new")}>
          Tambah faskes
        </Button>
      ) : null}
    </section>
  );
}

function FacilityForm({
  facility,
  onDone,
  onCancel,
}: {
  facility: Facility | null;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const ids = {
    name: useId(),
    type: useId(),
    phone: useId(),
    address: useId(),
    note: useId(),
    bites: useId(),
    nameError: useId(),
    typeError: useId(),
  };
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = {
      name: form.get("name"),
      type: form.get("type"),
      phone: form.get("phone"),
      address: form.get("address"),
      readinessNote: form.get("readinessNote"),
      handlesBites: form.get("handlesBites") === "on",
    };
    setPending(true);
    const response = await fetch(facility ? `/api/admin/facilities/${facility.id}` : "/api/admin/facilities", {
      method: facility ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    setPending(false);
    if (response?.ok) return onDone(facility ? "Faskes diperbarui." : "Faskes ditambahkan.");
    const data = response ? ((await response.json()) as { error?: string; fieldErrors?: Record<string, string> }) : null;
    setErrors(data?.fieldErrors ?? {});
    setError(data?.error ?? "Belum tersimpan. Periksa sinyal.");
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4 rounded-card border border-line bg-surface p-4">
      <h3 className="text-lg font-bold">{facility ? "Ubah faskes" : "Tambah faskes"}</h3>
      <div>
        <Label htmlFor={ids.name}>Nama</Label>
        <input id={ids.name} name="name" defaultValue={facility?.name} className={inputClass} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? ids.nameError : undefined} />
        <FieldError id={ids.nameError} message={errors.name} />
      </div>
      <div>
        <Label htmlFor={ids.type}>Jenis</Label>
        <input id={ids.type} name="type" placeholder="Puskesmas, RSUD, Rabies Center" defaultValue={facility?.type} className={inputClass} aria-invalid={Boolean(errors.type)} aria-describedby={errors.type ? ids.typeError : undefined} />
        <FieldError id={ids.typeError} message={errors.type} />
      </div>
      <div>
        <Label htmlFor={ids.phone} hint="(opsional)">
          Telepon
        </Label>
        <input id={ids.phone} name="phone" type="tel" defaultValue={facility?.phone ?? ""} className={inputClass} />
      </div>
      <div>
        <Label htmlFor={ids.address} hint="(opsional)">
          Alamat
        </Label>
        <input id={ids.address} name="address" defaultValue={facility?.address ?? ""} className={inputClass} />
      </div>
      <div>
        <Label htmlFor={ids.note} hint="(opsional)">
          Catatan kesiapan
        </Label>
        <input id={ids.note} name="readinessNote" placeholder="Misalnya: stok VAR tersedia, jam layanan" defaultValue={facility?.readiness_note ?? ""} className={inputClass} />
      </div>
      <label htmlFor={ids.bites} className="flex min-h-12 cursor-pointer items-center gap-3">
        <input id={ids.bites} name="handlesBites" type="checkbox" defaultChecked={facility?.handles_bites ?? true} className="size-5 accent-[var(--color-accent)]" />
        Melayani kasus gigitan (tampilkan ke warga)
      </label>
      {error ? <Notice tone="danger" title={error} /> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Menyimpan…" : "Simpan"}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Batal
        </Button>
      </div>
    </form>
  );
}
