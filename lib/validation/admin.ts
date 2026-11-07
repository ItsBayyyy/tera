import { z } from "zod";
import { emptyToUndefined, optionalText } from "./common";

export const configSchema = z
  .object({
    matchStrong: z.coerce.number().min(-1).max(1),
    matchUnsure: z.coerce.number().min(-1).max(1),
    vaccineValidDays: z.coerce.number().int().min(30).max(1095),
  })
  .refine((c) => c.matchUnsure < c.matchStrong, {
    message: "Ambang ragu harus lebih kecil dari ambang kuat.",
    path: ["matchUnsure"],
  });

export const facilitySchema = z.object({
  name: z.string().trim().min(2, "Isi nama faskes.").max(120),
  type: z.string().trim().min(2, "Isi jenis faskes.").max(60),
  phone: optionalText(30),
  address: optionalText(200),
  lat: z.preprocess(emptyToUndefined, z.coerce.number().min(-90).max(90).optional()),
  lon: z.preprocess(emptyToUndefined, z.coerce.number().min(-180).max(180).optional()),
  handlesBites: z.preprocess((value) => value === true || value === "true" || value === "on", z.boolean()),
  readinessNote: optionalText(200),
});
