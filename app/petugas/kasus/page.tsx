import type { Metadata } from "next";
import { OfficerGate } from "@/components/officer-shell";
import { CaseQueue } from "./case-queue";

export const metadata: Metadata = { title: "Laporan gigitan" };

export default function CasesPage() {
  return (
    <OfficerGate>
      <CaseQueue />
    </OfficerGate>
  );
}
