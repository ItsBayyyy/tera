"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { Camera, MapPin, TriangleAlert } from "lucide-react";
import { Button, Card, FieldError, Label, Notice, inputClass } from "@/components/ui";
import { BODY_PARTS, BODY_PART_LABEL } from "@/lib/validation/report";
import { compressImage } from "@/lib/image/compress";
import { roundCoordinate } from "@/lib/geo";
import { FacilityList } from "./facility-list";

type BanjarOption = { id: string; name: string; district: string | null };
type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "error"; message: string; fieldErrors?: Record<string, string> }
  | { kind: "done"; caseCode: string };

function localNowValue() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

export function BiteReportFlow() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  if (status.kind === "done") return <ReportReceived caseCode={status.caseCode} />;

  return (
    <section aria-labelledby="lapor-title" className="mt-10">
      <h2 id="lapor-title" className="text-xl font-bold">
        Laporkan gigitan ke petugas
      </h2>
      <p className="mt-1 text-ink-muted">Tidak wajib. Semua isian boleh dikosongkan. Laporan membantu petugas melacak anjingnya.</p>
      {open ? (
        <ReportForm status={status} setStatus={setStatus} />
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          <Button onClick={() => setOpen(true)}>Isi laporan singkat</Button>
          <a href="#faskes" className="inline-flex min-h-12 items-center justify-center font-semibold text-accent underline underline-offset-4">
            Lewati, lihat tempat berobat
          </a>
          <div id="faskes">
            <FacilityList />
          </div>
        </div>
      )}
    </section>
  );
}

function ReportForm({ status, setStatus }: { status: Status; setStatus: (s: Status) => void }) {
  const ids = {
    time: useId(),
    banjar: useId(),
    phone: useId(),
    consent: useId(),
    photo: useId(),
    errorPhone: useId(),
    errorConsent: useId(),
  };
  const [banjars, setBanjars] = useState<BanjarOption[]>([]);
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [locationNote, setLocationNote] = useState<string | null>(null);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/banjars")
      .then((response) => (response.ok ? response.json() : { banjars: [] }))
      .then((data: { banjars: BanjarOption[] }) => setBanjars(data.banjars))
      .catch(() => setBanjars([]));
  }, []);

  useEffect(() => () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
  }, [photoPreview]);

  function shareLocation() {
    if (!("geolocation" in navigator)) {
      setLocationNote("Ponsel ini tidak mendukung lokasi. Lewati saja.");
      return;
    }
    setLocationNote("Mengambil lokasi…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({ lat: roundCoordinate(position.coords.latitude), lon: roundCoordinate(position.coords.longitude) });
        setLocationNote(null);
      },
      () => setLocationNote("Lokasi tidak didapat. Lewati saja, laporan tetap bisa dikirim."),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  }

  async function choosePhoto(file: File | undefined) {
    if (!file) return;
    try {
      const compressed = await compressImage(file);
      setPhoto(compressed);
      setPhotoPreview(URL.createObjectURL(compressed));
    } catch {
      setPhoto(null);
      setPhotoPreview(null);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = new FormData();
    const bittenAtLocal = String(form.get("bittenAt") ?? "");
    if (bittenAtLocal) body.set("bittenAt", new Date(bittenAtLocal).toISOString());
    for (const key of ["bodyPart", "banjarId", "contactPhone"]) body.set(key, String(form.get(key) ?? ""));
    body.set("consent", form.get("consent") ? "true" : "false");
    if (location) {
      body.set("lat", String(location.lat));
      body.set("lon", String(location.lon));
    }
    if (photo) body.set("photo", photo, "anjing.jpg");

    setStatus({ kind: "sending" });
    try {
      const response = await fetch("/api/reports", { method: "POST", body });
      const data = (await response.json()) as { caseCode?: string; error?: string; fieldErrors?: Record<string, string> };
      if (response.ok && data.caseCode) {
        setStatus({ kind: "done", caseCode: data.caseCode });
        window.scrollTo({ top: 0 });
        return;
      }
      setStatus({ kind: "error", message: data.error ?? "Laporan belum terkirim. Coba lagi.", fieldErrors: data.fieldErrors });
    } catch {
      setStatus({
        kind: "error",
        message: "Laporan belum terkirim karena tidak ada sinyal. Isian Anda masih ada. Coba kirim lagi nanti.",
      });
    }
  }

  const fieldErrors = status.kind === "error" ? (status.fieldErrors ?? {}) : {};

  return (
    <form onSubmit={submit} className="mt-4 space-y-6" noValidate>
      <div>
        <Label htmlFor={ids.time}>Kapan digigit?</Label>
        <input id={ids.time} name="bittenAt" type="datetime-local" defaultValue={localNowValue()} className={inputClass} />
      </div>

      <fieldset>
        <legend className="text-[0.95rem] font-semibold">Bagian tubuh yang digigit</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {BODY_PARTS.map((part) => (
            <label
              key={part}
              className="flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border-2 border-line-strong bg-surface px-3 has-[:checked]:border-accent has-[:checked]:bg-accent-soft"
            >
              <input type="radio" name="bodyPart" value={part} className="size-5 accent-[var(--color-accent)]" />
              <span className="text-[0.95rem] leading-tight">{BODY_PART_LABEL[part]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <p className="text-[0.95rem] font-semibold">Lokasi kejadian</p>
        <p className="text-sm text-ink-muted">Dibulatkan sekitar 100 meter. Tidak disimpan lebih tepat dari itu.</p>
        {location ? (
          <p className="tabular mt-2 rounded-xl bg-ok-soft px-3 py-3 font-medium text-ok">
            Lokasi tersimpan ({location.lat.toFixed(3)}, {location.lon.toFixed(3)})
          </p>
        ) : (
          <Button variant="secondary" className="mt-2 w-full" onClick={shareLocation}>
            <MapPin aria-hidden="true" className="size-5" />
            Bagikan lokasi
          </Button>
        )}
        {locationNote ? (
          <p className="mt-2 text-sm text-ink-muted" aria-live="polite">
            {locationNote}
          </p>
        ) : null}
        <Label htmlFor={ids.banjar}>
          <span className="mt-4 block">Banjar</span>
        </Label>
        <select id={ids.banjar} name="banjarId" defaultValue="" className={inputClass}>
          <option value="">Tidak tahu / lewati</option>
          {banjars.map((banjar) => (
            <option key={banjar.id} value={banjar.id}>
              {banjar.name}
              {banjar.district ? ` · ${banjar.district}` : ""}
            </option>
          ))}
        </select>
      </div>

      <div>
        <p className="text-[0.95rem] font-semibold">Foto anjing</p>
        <p className="mt-1 flex gap-2 rounded-xl bg-wait-soft p-3 text-[0.95rem] text-wait">
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
          <span>Ambil dari jarak aman. Jangan mendekati atau mengejar anjing.</span>
        </p>
        <label
          htmlFor={ids.photo}
          className={`${photo ? "border-accent" : "border-line-strong"} mt-2 flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 bg-surface px-4 font-semibold`}
        >
          <Camera aria-hidden="true" className="size-5" />
          {photo ? "Ganti foto" : "Foto anjing (opsional)"}
        </label>
        <input
          id={ids.photo}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(event) => choosePhoto(event.target.files?.[0])}
        />
        {photoPreview ? (
          // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
          <img src={photoPreview} alt="Pratinjau foto anjing" className="mt-2 max-h-48 rounded-xl object-contain" />
        ) : null}
      </div>

      <div>
        <Label htmlFor={ids.phone} hint="(opsional)">
          Nomor HP
        </Label>
        <input
          id={ids.phone}
          name="contactPhone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="0812…"
          aria-describedby={fieldErrors.contactPhone ? ids.errorPhone : undefined}
          aria-invalid={Boolean(fieldErrors.contactPhone)}
          className={inputClass}
        />
        <FieldError id={ids.errorPhone} message={fieldErrors.contactPhone} />
        <label htmlFor={ids.consent} className="mt-3 flex min-h-12 cursor-pointer items-start gap-3">
          <input
            id={ids.consent}
            name="consent"
            type="checkbox"
            className="mt-1 size-5 shrink-0 accent-[var(--color-accent)]"
            aria-describedby={fieldErrors.consent ? ids.errorConsent : undefined}
          />
          <span className="text-[0.95rem]">Saya setuju petugas kesehatan menghubungi nomor ini untuk menindaklanjuti gigitan.</span>
        </label>
        <FieldError id={ids.errorConsent} message={fieldErrors.consent} />
      </div>

      {status.kind === "error" ? <Notice tone="danger" title={status.message} /> : null}

      <Button type="submit" className="w-full" disabled={status.kind === "sending"}>
        {status.kind === "sending" ? "Mengirim laporan…" : "Kirim laporan"}
      </Button>
    </form>
  );
}

function ReportReceived({ caseCode }: { caseCode: string }) {
  return (
    <section aria-labelledby="diterima-title" className="mt-10 space-y-4" aria-live="polite">
      <Card className="border-2 border-ok">
        <h2 id="diterima-title" className="text-xl font-bold text-ok">
          Laporan diterima petugas
        </h2>
        <p className="mt-2 text-ink-muted">Sebutkan kode ini bila petugas menghubungi atau saat berobat:</p>
        <p data-testid="case-code" className="tabular mt-2 text-4xl font-bold tracking-[0.12em]" aria-label={`Kode kasus ${caseCode.split("").join(" ")}`}>
          {caseCode}
        </p>
      </Card>
      <Notice tone="danger" title="Tetap ke puskesmas atau rumah sakit hari ini.">
        Laporan ini tidak menggantikan pemeriksaan. Hanya tenaga kesehatan yang bisa menentukan perlu tidaknya vaksin anti-rabies.
      </Notice>
      <FacilityList />
    </section>
  );
}
