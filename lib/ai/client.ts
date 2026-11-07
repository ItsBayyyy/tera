import "server-only";
import { analyzeResponseSchema, type AnalyzeOutcome } from "./types";
import { logEvent } from "@/lib/log";

export const AI_TIMEOUT_MS = 15_000;

/** Sends one compressed photo to the AI service. Never throws: callers branch on the outcome. */
export async function analyzeImage(image: Blob, timeoutMs: number = AI_TIMEOUT_MS): Promise<AnalyzeOutcome> {
  const baseUrl = process.env.AI_SERVICE_URL;
  const key = process.env.AI_SERVICE_KEY;
  if (!baseUrl || !key) {
    logEvent("error", "ai.not_configured", {});
    return { kind: "unavailable", reason: "not_configured" };
  }

  const form = new FormData();
  form.append("image", image, "photo.jpg");
  const started = Date.now();

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/analyze`, {
      method: "POST",
      headers: { "X-Service-Key": key },
      body: form,
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    if (!response.ok) {
      logEvent("error", "ai.http_error", { status: response.status, ms: Date.now() - started });
      return { kind: "unavailable", reason: "http" };
    }
    const parsed = analyzeResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      logEvent("error", "ai.contract_mismatch", { issues: parsed.error.issues.length });
      return { kind: "unavailable", reason: "contract" };
    }
    logEvent("info", "ai.analyzed", {
      ms: Date.now() - started,
      ok: parsed.data.quality.ok,
      embedded: parsed.data.embedding !== null,
    });
    return { kind: "ok", result: parsed.data };
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "TimeoutError";
    logEvent("error", timedOut ? "ai.timeout" : "ai.network_error", { ms: Date.now() - started });
    return { kind: "unavailable", reason: timedOut ? "timeout" : "network" };
  }
}
