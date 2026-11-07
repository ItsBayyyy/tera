import "server-only";
import type { z } from "zod";
import { getServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Thresholds } from "@/lib/match/zone";

export type Db = SupabaseClient<Database>;

export function json(body: unknown, status = 200, headers?: HeadersInit) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

/** User-facing error: short Indonesian sentence, never a stack trace or SQL message. */
export function fail(status: number, error: string, fieldErrors?: Record<string, string>) {
  return json({ error, ...(fieldErrors ? { fieldErrors } : {}) }, status);
}

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

export function formObject(form: FormData, keys: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of keys) {
    const value = form.get(key);
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function readImage(value: FormDataEntryValue | null): Blob | null | "invalid" {
  if (value === null || value === "") return null;
  if (typeof value === "string") return "invalid";
  if (value.size === 0) return null;
  if (value.size > MAX_UPLOAD_BYTES || !IMAGE_TYPES.has(value.type)) return "invalid";
  return value;
}

export type Staff = {
  supabase: Db;
  userId: string;
  role: Database["public"]["Enums"]["user_role"];
};

/** Authorises a route handler call. Returns a Response to send back when access is denied. */
export async function requireStaff(options: { admin?: boolean } = {}): Promise<Staff | Response> {
  const supabase = await getServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return fail(401, "Sesi berakhir. Masuk lagi.");
  const { data: profile } = await supabase.from("profiles").select("role").eq("user_id", auth.user.id).maybeSingle();
  if (!profile) return fail(403, "Akun ini belum terdaftar sebagai petugas.");
  if (options.admin && profile.role !== "admin") return fail(403, "Hanya admin yang boleh melakukan ini.");
  return { supabase, userId: auth.user.id, role: profile.role };
}

export type MatchConfig = Thresholds & { vaccineValidDays: number };

export async function loadMatchConfig(db: Db): Promise<MatchConfig> {
  const { data } = await db.from("app_config").select("key, value");
  const lookup = new Map((data ?? []).map((row) => [row.key, Number(row.value)]));
  return {
    strong: lookup.get("match_strong") ?? 0.7,
    unsure: lookup.get("match_unsure") ?? 0.5,
    vaccineValidDays: lookup.get("vaccine_valid_days") ?? 365,
  };
}

export async function signPaths(db: Db, bucket: string, paths: string[], expiresIn = 60 * 30) {
  const unique = [...new Set(paths.filter(Boolean))];
  if (unique.length === 0) return new Map<string, string>();
  const { data } = await db.storage.from(bucket).createSignedUrls(unique, expiresIn);
  return new Map((data ?? []).flatMap((entry) => (entry.path && entry.signedUrl ? [[entry.path, entry.signedUrl]] : [])));
}
