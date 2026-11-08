import type { Metadata } from "next";
import { OfficerGate } from "@/components/officer-shell";
import { ScanFlow } from "./scan-flow";

export const metadata: Metadata = { title: "Scan anjing" };

export default function ScanPage() {
  return (
    <OfficerGate>
      <ScanFlow />
    </OfficerGate>
  );
}
