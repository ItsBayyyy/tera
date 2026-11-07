import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui";
import { DemoLab } from "./demo-lab";

export const metadata: Metadata = { title: "Mode demo" };

export default function DemoPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16 pt-6">
      <Link href="/" className="inline-flex min-h-12 items-center font-semibold text-accent">
        ← Beranda
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">Mode demo</h1>
        <Badge tone="wait">Data demo</Badge>
      </div>
      <p className="mt-2 max-w-prose text-ink-muted">
        Coba alur pencocokan petugas tanpa login. Semua data di halaman ini tersimpan di banjar DEMO yang terpisah dari data
        petugas dan bisa direset. Skor yang tampil adalah kemiripan kosinus apa adanya, bukan persentase akurasi.
      </p>
      <div className="mt-8">
        <DemoLab />
      </div>
    </main>
  );
}
