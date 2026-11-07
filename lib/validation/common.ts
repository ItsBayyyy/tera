import { z } from "zod";

export const EMBEDDING_DIM = 2152;

export const uuid = z.uuid();

export const embeddingSchema = z.array(z.number().finite()).length(EMBEDDING_DIM);

/** Indonesian mobile numbers: 08…, 628… or +628…, spaces and dashes allowed. Returns 08… form. */
export const phoneSchema = z
  .string()
  .trim()
  .transform((raw) => raw.replace(/[\s-]/g, ""))
  .pipe(z.string().regex(/^(\+62|62|0)8\d{7,12}$/, "Nomor HP tidak valid. Contoh: 0812 3456 7890"))
  .transform((digits) => digits.replace(/^(\+62|62)/, "0"));

export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined));

/** Empty form fields arrive as "", which should mean "not given". */
export function emptyToUndefined(value: unknown) {
  return value === "" || value === null ? undefined : value;
}
