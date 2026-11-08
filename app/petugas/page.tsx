import type { Metadata } from "next";
import { OfficerGate } from "@/components/officer-shell";
import { OfficerHome } from "./officer-home";

export const metadata: Metadata = { title: "Petugas" };

export default function OfficerPage() {
  return (
    <OfficerGate>
      <OfficerHome />
    </OfficerGate>
  );
}
