"use client";

import { createContext, use, useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase/browser";
import type { Tables } from "@/lib/supabase/database.types";

export type Banjar = Pick<Tables<"banjars">, "id" | "name" | "village" | "district" | "regency" | "is_sample" | "is_demo">;

type OfficerState =
  | { kind: "loading" }
  | { kind: "error" }
  | {
      kind: "ready";
      userId: string;
      email: string;
      fullName: string;
      role: "officer" | "admin";
      banjars: Banjar[];
      activeBanjarId: string | null;
    };

type OfficerContextValue = {
  state: OfficerState;
  setActiveBanjar: (id: string) => void;
  reload: () => void;
  signOut: () => Promise<void>;
};

const OfficerContext = createContext<OfficerContextValue | null>(null);
const BANJAR_KEY = "kenalasu.activeBanjar";

export function OfficerProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<OfficerState>({ kind: "loading" });

  const load = useCallback(async () => {
    const supabase = getBrowserClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      router.replace(`/masuk?lanjut=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    const [profileResult, banjarResult] = await Promise.all([
      supabase.from("profiles").select("full_name, role, default_banjar_id").eq("user_id", auth.user.id).maybeSingle(),
      supabase.from("banjars").select("id, name, village, district, regency, is_sample, is_demo").eq("is_demo", false).order("name"),
    ]);
    const profile = profileResult.data;
    if (profileResult.error || banjarResult.error || !profile) {
      setState({ kind: "error" });
      return;
    }
    const banjars = banjarResult.data;
    const stored = window.localStorage.getItem(BANJAR_KEY);
    const active =
      banjars.find((b) => b.id === stored)?.id ??
      banjars.find((b) => b.id === profile.default_banjar_id)?.id ??
      null;
    setState({
      kind: "ready",
      userId: auth.user.id,
      email: auth.user.email ?? "",
      fullName: profile.full_name,
      role: profile.role,
      banjars,
      activeBanjarId: active,
    });
  }, [router]);

  useEffect(() => {
    // Data comes from the browser client after mount; there is no server snapshot to hydrate from.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load().catch(() => setState({ kind: "error" }));
  }, [load]);

  const setActiveBanjar = useCallback((id: string) => {
    window.localStorage.setItem(BANJAR_KEY, id);
    setState((current) => (current.kind === "ready" ? { ...current, activeBanjarId: id } : current));
  }, []);

  const signOut = useCallback(async () => {
    await getBrowserClient().auth.signOut();
    router.replace("/masuk");
  }, [router]);

  const reload = useCallback(() => {
    setState({ kind: "loading" });
    load().catch(() => setState({ kind: "error" }));
  }, [load]);

  return <OfficerContext value={{ state, setActiveBanjar, reload, signOut }}>{children}</OfficerContext>;
}

export function useOfficer() {
  const value = use(OfficerContext);
  if (!value) throw new Error("useOfficer must be used inside OfficerProvider");
  return value;
}

export function banjarLabel(banjar: Banjar | undefined): string {
  if (!banjar) return "Belum dipilih";
  return [banjar.name, banjar.district].filter(Boolean).join(" · ");
}
