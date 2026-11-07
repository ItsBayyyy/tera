import { OfficerShell } from "@/components/officer-shell";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return <OfficerShell>{children}</OfficerShell>;
}
