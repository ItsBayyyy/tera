import { z } from "zod";
import { optionalText, uuid } from "./common";

export const AI_STATUS = ["verified", "pending", "manual"] as const;

export const AI_STATUS_LABEL: Record<(typeof AI_STATUS)[number], string> = {
  verified: "Terverifikasi AI",
  pending: "Menunggu verifikasi AI",
  manual: "Dicatat manual",
};

export const vaccinationSchema = z.object({
  dogId: uuid,
  batch: optionalText(40),
  aiStatus: z.enum(AI_STATUS),
  matchLogId: uuid.optional(),
});
