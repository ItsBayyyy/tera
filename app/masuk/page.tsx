import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Masuk petugas" };

export default function LoginPage() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 pb-10 pt-6">
      <Link href="/" className="inline-flex min-h-12 items-center font-semibold text-accent">
        ← Beranda
      </Link>
      <h1 className="mt-2 text-[1.75rem] font-bold">Masuk petugas</h1>
      <p className="mt-1 text-ink-muted">Akun dibuat oleh admin dinas. Digigit anjing? <Link href="/darurat" className="font-semibold text-danger underline underline-offset-4">Buka panduan darurat</Link>.</p>
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
