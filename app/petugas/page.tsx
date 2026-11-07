import type { Metadata } from "next";
import { OfficerHome } from "./officer-home";

export const metadata: Metadata = { title: "Petugas" };

export default function OfficerPage() {
  return <OfficerHome />;
}
