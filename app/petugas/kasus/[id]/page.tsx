import type { Metadata } from "next";
import { Suspense } from "react";
import { OfficerGate } from "@/components/officer-shell";
import { ListSkeleton } from "@/components/ui";
import { CaseDetail } from "./case-detail";

export const metadata: Metadata = { title: "Detail kasus" };

export default function CasePage() {
  return (
    <OfficerGate>
      <Suspense fallback={<ListSkeleton rows={4} label="Memuat kasus" />}>
        <CaseDetail />
      </Suspense>
    </OfficerGate>
  );
}
