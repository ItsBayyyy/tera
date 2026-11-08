import type { Metadata } from "next";
import Link from "next/link";
import { Phone } from "lucide-react";
import { FIRST_AID_INTRO, FIRST_AID_REVIEWED } from "@/content/first-aid";
import { BiteReportFlow } from "./bite-report-flow";
import { FirstAidGuide } from "./first-aid-guide";

export const metadata: Metadata = {
  title: "Digigit anjing",
};

export default function EmergencyPage() {
  return (
    <>
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-40 pt-6">
        <Link href="/" className="inline-flex min-h-12 items-center font-semibold text-accent">
          ← Beranda
        </Link>
        <h1 className="mt-2 text-[1.75rem] font-bold leading-tight">Digigit anjing? Lakukan ini sekarang.</h1>
        <p className="mt-2 text-lg leading-snug text-ink">{FIRST_AID_INTRO}</p>

        <FirstAidGuide />
        {FIRST_AID_REVIEWED ? null : (
          <p className="mt-3 text-sm text-ink-muted">
            Isi panduan ini masih menunggu tinjauan tenaga kesehatan. Ikuti arahan petugas puskesmas atau rumah sakit.
          </p>
        )}

        <BiteReportFlow />
      </main>

      <nav
        aria-label="Telepon darurat"
        className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-canvas px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3"
      >
        <div className="mx-auto grid max-w-xl grid-cols-2 gap-3">
          <a href="tel:119" className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-danger text-lg font-bold text-white hover:bg-danger-hover">
            <Phone aria-hidden="true" className="size-5" />
            Telepon 119
          </a>
          <a href="tel:112" className="flex min-h-14 items-center justify-center gap-2 rounded-xl border-2 border-danger bg-surface text-lg font-bold text-danger hover:bg-danger-soft">
            <Phone aria-hidden="true" className="size-5" />
            Telepon 112
          </a>
        </div>
        <p className="mx-auto mt-2 max-w-xl text-center text-xs text-ink-muted">119 layanan kesehatan darurat · 112 panggilan darurat</p>
      </nav>
    </>
  );
}
