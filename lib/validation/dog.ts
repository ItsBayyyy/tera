import { z } from "zod";
import { emptyToUndefined, optionalText, phoneSchema, uuid } from "./common";

export const DOG_SEX = ["male", "female", "unknown"] as const;
export const DOG_OWNERSHIP = ["owned", "stray", "unknown"] as const;

export const SEX_LABEL: Record<(typeof DOG_SEX)[number], string> = {
  male: "Jantan",
  female: "Betina",
  unknown: "Belum tahu",
};

export const OWNERSHIP_LABEL: Record<(typeof DOG_OWNERSHIP)[number], string> = {
  owned: "Ada pemilik",
  stray: "Liar",
  unknown: "Belum tahu",
};

export const dogAttributesSchema = z.object({
  banjarId: uuid,
  nickname: optionalText(60),
  color: z.string().trim().min(1, "Isi warna bulu.").max(60),
  sex: z.enum(DOG_SEX),
  ownership: z.enum(DOG_OWNERSHIP),
  ownerName: optionalText(80),
  ownerPhone: z.preprocess(emptyToUndefined, phoneSchema.optional()),
});

export type DogAttributes = z.infer<typeof dogAttributesSchema>;
