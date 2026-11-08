import Link from "next/link";
import { ShieldCheck, Siren } from "lucide-react";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-8 pt-10">
      <p className="text-lg font-bold tracking-tight">Tera</p>
      <h1 className="mt-6 text-[1.75rem] font-bold leading-tight">Apa yang Anda perlukan sekarang?</h1>

      <nav aria-label="Pilih mode" className="mt-8 flex flex-1 flex-col gap-4">
        <Link
          href="/darurat"
          className="flex min-h-36 flex-col justify-center gap-2 rounded-card bg-danger px-5 py-6 text-white hover:bg-danger-hover"
        >
          <Siren aria-hidden="true" className="size-8" />
          <span className="text-2xl font-bold">Saya digigit anjing</span>
          <span className="text-base text-white/90">Langkah pertolongan pertama dan nomor darurat. Tanpa login.</span>
        </Link>

        <Link
          href="/petugas"
          className="flex min-h-36 flex-col justify-center gap-2 rounded-card border-2 border-line-strong bg-surface px-5 py-6 hover:bg-sunken"
        >
          <ShieldCheck aria-hidden="true" className="size-8 text-accent" />
          <span className="text-2xl font-bold">Saya petugas</span>
          <span className="text-base text-ink-muted">Scan wajah anjing, cek dan catat vaksin.</span>
        </Link>
      </nav>

      <Link href="/demo" className="mt-8 inline-flex min-h-12 items-center self-center px-3 font-semibold text-accent underline underline-offset-4">
        Mode demo untuk juri
      </Link>
    </main>
  );
}
