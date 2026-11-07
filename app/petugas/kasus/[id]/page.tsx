import type { Metadata } from "next";
import { Suspense } from "react";
import { ListSkeleton } from "@/components/ui";
import { CaseDetail } from "./case-detail";

export const metadata: Metadata = { title: "Detail kasus" };

export default function CasePage() {
  return (
    <Suspense fallback={<ListSkeleton rows={4} label="Memuat kasus" />}>
      <CaseDetail />
    </Suspense>
  );
}
