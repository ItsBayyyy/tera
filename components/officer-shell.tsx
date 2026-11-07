"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { ErrorState, ListSkeleton } from "@/components/ui";
import { OfficerProvider, useOfficer } from "./officer-context";

const NAV = [
  { href: "/petugas", label: "Scan", exact: true },
  { href: "/petugas/kasus", label: "Kasus" },
  { href: "/admin", label: "Admin", adminOnly: true },
];

export function OfficerShell({ children }: { children: ReactNode }) {
  return (
    <OfficerProvider>
      <OfficerHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-32 pt-4">
        <OfficerGate>{children}</OfficerGate>
      </main>
    </OfficerProvider>
  );
}

function OfficerHeader() {
  const { signOut } = useOfficer();

  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 pt-3">
        <Link href="/petugas" className="text-lg font-bold">
          KenalAsu <span className="font-medium text-ink-muted">Petugas</span>
        </Link>
        <button
          type="button"
          onClick={signOut}
          className="min-h-12 rounded-xl px-3 font-semibold text-ink-muted hover:bg-sunken hover:text-ink"
        >
          Keluar
        </button>
      </div>
      {/* The active tab depends on the URL, which is only known at request time. */}
      <Suspense fallback={<div className="h-12" />}>
        <OfficerNav />
      </Suspense>
    </header>
  );
}

function OfficerNav() {
  const pathname = usePathname();
  const { state } = useOfficer();
  const isAdmin = state.kind === "ready" && state.role === "admin";

  return (
      <nav aria-label="Menu petugas" className="mx-auto max-w-3xl px-2">
        <ul className="flex gap-1">
          {NAV.filter((item) => !item.adminOnly || isAdmin).map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex min-h-12 items-center border-b-[3px] px-3 font-semibold ${
                    active ? "border-accent text-accent" : "border-transparent text-ink-muted hover:text-ink"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
  );
}

function OfficerGate({ children }: { children: ReactNode }) {
  const { state, reload } = useOfficer();
  if (state.kind === "loading") return <ListSkeleton rows={3} label="Memuat akun petugas" />;
  if (state.kind === "error") {
    return (
      <ErrorState title="Data akun belum bisa dimuat." onRetry={reload}>
        Periksa sinyal. Bila tetap gagal, minta admin memastikan akun Anda terdaftar sebagai petugas.
      </ErrorState>
    );
  }
  return children;
}
