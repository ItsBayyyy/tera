import "server-only";
import { createRateLimiter } from "@/lib/rate-limit";
import type { Db } from "@/lib/api";

export const DEMO_PROBE_PREFIX = "demo-probes";
export const demoLimiter = {
  scan: createRateLimiter(30, 10 * 60 * 1000),
  register: createRateLimiter(10, 10 * 60 * 1000),
  reset: createRateLimiter(5, 10 * 60 * 1000),
};

export async function getDemoBanjarId(db: Db): Promise<string> {
  const { data, error } = await db.from("banjars").select("id").eq("is_demo", true).single();
  if (error || !data) throw new Error("DEMO banjar missing");
  return data.id;
}

/** Probe files are named `<dog-name>__<n>.jpg`, so the demo can reveal the true answer after matching. */
export function probeAnswer(path: string): string {
  const file = path.split("/").pop() ?? "";
  return file.split("__")[0] ?? "";
}

export function isProbePath(path: string): boolean {
  return /^demo-probes\/[A-Za-z0-9_-]+__[A-Za-z0-9_.-]+\.jpe?g$/.test(path);
}
