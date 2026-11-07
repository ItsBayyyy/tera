import { z } from "zod";
import { emptyToUndefined, phoneSchema, uuid } from "./common";

export const BODY_PARTS = ["kepala", "tangan", "lengan", "kaki", "badan", "lainnya"] as const;

export const BODY_PART_LABEL: Record<(typeof BODY_PARTS)[number], string> = {
  kepala: "Kepala, wajah, atau leher",
  tangan: "Tangan atau jari",
  lengan: "Lengan",
  kaki: "Kaki",
  badan: "Badan",
  lainnya: "Lainnya",
};

const MAX_REPORT_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const CLOCK_SKEW_MS = 10 * 60 * 1000;

export const reportSchema = z
  .object({
    bittenAt: z.preprocess(
      emptyToUndefined,
      z.iso
        .datetime({ offset: true })
        .refine((value) => {
          const t = new Date(value).getTime();
          return t <= Date.now() + CLOCK_SKEW_MS && t >= Date.now() - MAX_REPORT_AGE_MS;
        }, "Waktu gigitan harus dalam 30 hari terakhir.")
        .optional(),
    ),
    bodyPart: z.preprocess(emptyToUndefined, z.enum(BODY_PARTS).optional()),
    banjarId: z.preprocess(emptyToUndefined, uuid.optional()),
    lat: z.preprocess(emptyToUndefined, z.coerce.number().min(-90).max(90).optional()),
    lon: z.preprocess(emptyToUndefined, z.coerce.number().min(-180).max(180).optional()),
    contactPhone: z.preprocess(emptyToUndefined, phoneSchema.optional()),
    consent: z.preprocess((value) => value === true || value === "true" || value === "on", z.boolean()),
  })
  .refine((report) => !report.contactPhone || report.consent, {
    message: "Centang persetujuan agar petugas boleh menghubungi nomor ini.",
    path: ["consent"],
  })
  .refine((report) => (report.lat === undefined) === (report.lon === undefined), {
    message: "Lokasi tidak lengkap.",
    path: ["lat"],
  });

export type ReportInput = z.infer<typeof reportSchema>;
