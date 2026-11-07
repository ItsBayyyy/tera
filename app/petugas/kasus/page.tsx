import type { Metadata } from "next";
import { CaseQueue } from "./case-queue";

export const metadata: Metadata = { title: "Laporan gigitan" };

export default function CasesPage() {
  return <CaseQueue />;
}
