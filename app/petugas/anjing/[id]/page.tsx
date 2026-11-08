import type { Metadata } from "next";
import { Suspense } from "react";
import { OfficerGate } from "@/components/officer-shell";
import { ListSkeleton } from "@/components/ui";
import { DogDetail } from "./dog-detail";

export const metadata: Metadata = { title: "Data anjing" };

export default function DogPage() {
  return (
    <OfficerGate>
      <Suspense fallback={<ListSkeleton rows={4} label="Memuat data anjing" />}>
        <DogDetail />
      </Suspense>
    </OfficerGate>
  );
}
