"use client";

import { useId, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, FieldError, Label, Notice, inputClass } from "@/components/ui";
import { hasAuthCookie } from "@/lib/auth-cookie";
import { getBrowserClient } from "@/lib/supabase/browser";

const COOKIE_BLOCKED = "Browser ini tidak mau menyimpan sesi masuk.";
const COOKIE_BLOCKED_DETAIL =
  "Buka Tera langsung di tab browser, bukan di dalam simulator atau bingkai halaman lain, lalu pastikan cookie untuk situs ini diizinkan.";

/** Only same-site paths are allowed as the post-login destination. */
function safeNext(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/petugas";
}

export function LoginForm() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("lanjut"));
  const ids = { email: useId(), password: useId(), emailError: useId(), passwordError: useId() };
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string; formDetail?: string }>(
    {},
  );
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const fieldErrors = {
      email: email ? undefined : "Isi email.",
      password: password ? undefined : "Isi kata sandi.",
    };
    if (fieldErrors.email || fieldErrors.password) {
      setErrors(fieldErrors);
      return;
    }
    setPending(true);
    setErrors({});
    const { error } = await getBrowserClient().auth.signInWithPassword({ email, password });
    if (error) {
      setPending(false);
      setErrors({
        form:
          error.status === 400
            ? "Email atau kata sandi salah."
            : "Belum bisa masuk. Periksa sinyal lalu coba lagi.",
      });
      return;
    }
    // Without the cookie the server sees no session and sends the officer straight back here.
    if (!hasAuthCookie(document.cookie)) {
      setPending(false);
      setErrors({ form: COOKIE_BLOCKED, formDetail: COOKIE_BLOCKED_DETAIL });
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <form onSubmit={submit} noValidate className="mt-6 space-y-5">
      <div>
        <Label htmlFor={ids.email}>Email</Label>
        <input
          id={ids.email}
          name="email"
          type="email"
          autoComplete="username"
          inputMode="email"
          className={inputClass}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? ids.emailError : undefined}
        />
        <FieldError id={ids.emailError} message={errors.email} />
      </div>
      <div>
        <Label htmlFor={ids.password}>Kata sandi</Label>
        <input
          id={ids.password}
          name="password"
          type="password"
          autoComplete="current-password"
          className={inputClass}
          aria-invalid={Boolean(errors.password)}
          aria-describedby={errors.password ? ids.passwordError : undefined}
        />
        <FieldError id={ids.passwordError} message={errors.password} />
      </div>
      {errors.form ? (
        <Notice tone="danger" title={errors.form}>
          {errors.formDetail}
        </Notice>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Masuk…" : "Masuk"}
      </Button>
    </form>
  );
}
