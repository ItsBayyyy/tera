"use client";

import { useId, type FormEvent } from "react";
import { Button, FieldError, Label, inputClass } from "@/components/ui";
import { DOG_OWNERSHIP, DOG_SEX, OWNERSHIP_LABEL, SEX_LABEL } from "@/lib/validation/dog";

export type DogFormValues = Record<"nickname" | "color" | "sex" | "ownership" | "ownerName" | "ownerPhone", string>;

type Props = {
  pending: boolean;
  errors: Record<string, string>;
  submitLabel: string;
  onSubmit: (values: DogFormValues) => void;
  showOwner?: boolean;
};

function ChoiceGroup({ legend, name, options }: { legend: string; name: string; options: readonly [string, string][] }) {
  return (
    <fieldset>
      <legend className="text-[0.95rem] font-semibold">{legend}</legend>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {options.map(([value, label], index) => (
          <label
            key={value}
            className="flex min-h-12 cursor-pointer items-center justify-center rounded-xl border-2 border-line-strong bg-surface px-2 text-center text-[0.95rem] font-semibold has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:text-accent"
          >
            <input type="radio" name={name} value={value} defaultChecked={index === options.length - 1} className="sr-only" />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function DogForm({ pending, errors, submitLabel, onSubmit, showOwner = true }: Props) {
  const ids = {
    nickname: useId(),
    color: useId(),
    colorError: useId(),
    ownerName: useId(),
    ownerPhone: useId(),
    ownerPhoneError: useId(),
  };

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const get = (key: string) => String(form.get(key) ?? "");
    onSubmit({
      nickname: get("nickname"),
      color: get("color"),
      sex: get("sex"),
      ownership: get("ownership"),
      ownerName: get("ownerName"),
      ownerPhone: get("ownerPhone"),
    });
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <div>
        <Label htmlFor={ids.color}>Warna bulu</Label>
        <input
          id={ids.color}
          name="color"
          required
          placeholder="Misalnya: cokelat, belang putih"
          className={inputClass}
          aria-invalid={Boolean(errors.color)}
          aria-describedby={errors.color ? ids.colorError : undefined}
        />
        <FieldError id={ids.colorError} message={errors.color} />
      </div>
      <div>
        <Label htmlFor={ids.nickname} hint="(opsional)">
          Nama panggilan
        </Label>
        <input id={ids.nickname} name="nickname" className={inputClass} />
      </div>
      <ChoiceGroup legend="Jenis kelamin" name="sex" options={DOG_SEX.map((v) => [v, SEX_LABEL[v]] as [string, string])} />
      <ChoiceGroup
        legend="Kepemilikan"
        name="ownership"
        options={DOG_OWNERSHIP.map((v) => [v, OWNERSHIP_LABEL[v]] as [string, string])}
      />
      {showOwner ? (
        <fieldset className="rounded-card border border-line p-3">
          <legend className="px-1 text-[0.95rem] font-semibold">Pemilik (opsional, data pribadi)</legend>
          <p className="text-sm text-ink-muted">Isi hanya bila pemilik setuju. Tidak pernah ditampilkan ke warga.</p>
          <div className="mt-3 space-y-4">
            <div>
              <Label htmlFor={ids.ownerName}>Nama pemilik</Label>
              <input id={ids.ownerName} name="ownerName" autoComplete="off" className={inputClass} />
            </div>
            <div>
              <Label htmlFor={ids.ownerPhone}>Nomor HP pemilik</Label>
              <input
                id={ids.ownerPhone}
                name="ownerPhone"
                type="tel"
                inputMode="tel"
                autoComplete="off"
                className={inputClass}
                aria-invalid={Boolean(errors.ownerPhone)}
                aria-describedby={errors.ownerPhone ? ids.ownerPhoneError : undefined}
              />
              <FieldError id={ids.ownerPhoneError} message={errors.ownerPhone} />
            </div>
          </div>
        </fieldset>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Menyimpan…" : submitLabel}
      </Button>
    </form>
  );
}
