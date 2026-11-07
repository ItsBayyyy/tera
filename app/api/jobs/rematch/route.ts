import { timingSafeEqual } from "node:crypto";
import { getAdminClient } from "@/lib/supabase/admin";
import { fail, json, requireStaff } from "@/lib/api";
import { rematchPending } from "@/lib/rematch";
import { logEvent } from "@/lib/log";

function hasJobSecret(request: Request): boolean {
  const secret = process.env.JOBS_SECRET;
  const header = request.headers.get("authorization") ?? "";
  if (!secret || !header.startsWith("Bearer ")) return false;
  const given = Buffer.from(header.slice(7));
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Admin button or scheduler (Bearer JOBS_SECRET): embed photos saved without AI and flag duplicates. */
export async function POST(request: Request) {
  if (!hasJobSecret(request)) {
    const staff = await requireStaff({ admin: true });
    if (staff instanceof Response) return staff;
  }
  try {
    return json(await rematchPending(getAdminClient()));
  } catch (error) {
    logEvent("error", "rematch.failed", { message: error instanceof Error ? error.message : "unknown" });
    return fail(500, "Proses ulang gagal. Coba lagi nanti.");
  }
}
