import type { Metadata } from "next";
import { OfficerGate } from "@/components/officer-shell";
import { AdminDashboard } from "./admin-dashboard";

export const metadata: Metadata = { title: "Admin" };

export default function AdminPage() {
  return (
    <OfficerGate>
      <AdminDashboard />
    </OfficerGate>
  );
}
