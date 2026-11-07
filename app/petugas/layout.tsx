import { OfficerShell } from "@/components/officer-shell";

export default function OfficerLayout({ children }: LayoutProps<"/petugas">) {
  return <OfficerShell>{children}</OfficerShell>;
}
