import { z } from "zod";

export const QUALITY_REASONS = ["BLUR", "TOO_DARK", "TOO_BRIGHT", "TOO_SMALL", "NO_DOG", "FACE_NOT_VISIBLE"] as const;
export type QualityReason = (typeof QUALITY_REASONS)[number];

/** Response contract of the AI service `POST /v1/analyze`. */
export const analyzeResponseSchema = z.object({
  quality: z.object({
    ok: z.boolean(),
    reasons: z.array(z.enum(QUALITY_REASONS)),
    blur: z.number(),
    brightness: z.number(),
    width: z.number().int(),
    height: z.number().int(),
  }),
  detection: z.object({
    found: z.boolean(),
    box: z.tuple([z.number(), z.number(), z.number(), z.number()]).nullable(),
    score: z.number(),
  }),
  embedding: z.array(z.number()).nullable(),
  model_version: z.string(),
});

export type AnalyzeResponse = z.infer<typeof analyzeResponseSchema>;

export type AnalyzeOutcome =
  | { kind: "ok"; result: AnalyzeResponse }
  | { kind: "unavailable"; reason: "timeout" | "network" | "http" | "contract" | "not_configured" };
