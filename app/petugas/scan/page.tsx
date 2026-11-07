import type { Metadata } from "next";
import { ScanFlow } from "./scan-flow";

export const metadata: Metadata = { title: "Scan anjing" };

export default function ScanPage() {
  return <ScanFlow />;
}
