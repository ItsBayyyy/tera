import { describe, expect, it } from "vitest";
import { reportSchema } from "@/lib/validation/report";
import { dogAttributesSchema } from "@/lib/validation/dog";
import { configSchema, facilitySchema } from "@/lib/validation/admin";
import { EMBEDDING_DIM, embeddingSchema, phoneSchema } from "@/lib/validation/common";
import { analyzeResponseSchema } from "@/lib/ai/types";

const BANJAR = "8b0f3c2a-1d2e-4f5a-9b6c-7d8e9f0a1b2c";

describe("phoneSchema", () => {
  it("normalises Indonesian mobile formats to 08…", () => {
    expect(phoneSchema.parse("+62 812-3456-7890")).toBe("081234567890");
    expect(phoneSchema.parse("6281234567890")).toBe("081234567890");
    expect(phoneSchema.parse("0812 3456 7890")).toBe("081234567890");
  });

  it("rejects landlines and junk", () => {
    expect(phoneSchema.safeParse("0361 123456").success).toBe(false);
    expect(phoneSchema.safeParse("abc").success).toBe(false);
  });
});

describe("reportSchema", () => {
  it("accepts an empty report: every field is optional", () => {
    const parsed = reportSchema.parse({ consent: false });
    expect(parsed.consent).toBe(false);
    expect(parsed.contactPhone).toBeUndefined();
  });

  it("treats empty strings from forms as missing", () => {
    const parsed = reportSchema.parse({
      bittenAt: "",
      bodyPart: "",
      banjarId: "",
      lat: "",
      lon: "",
      contactPhone: "",
      consent: "false",
    });
    expect(parsed).toEqual({ consent: false });
  });

  it("requires consent when a phone number is given", () => {
    expect(reportSchema.safeParse({ contactPhone: "081234567890", consent: false }).success).toBe(false);
    expect(reportSchema.safeParse({ contactPhone: "081234567890", consent: "on" }).success).toBe(true);
  });

  it("rejects bite times in the future", () => {
    const future = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    expect(reportSchema.safeParse({ bittenAt: future, consent: false }).success).toBe(false);
  });

  it("requires both coordinates or neither", () => {
    expect(reportSchema.safeParse({ lat: "-8.67", consent: false }).success).toBe(false);
    expect(reportSchema.safeParse({ lat: "-8.67", lon: "115.21", consent: false }).success).toBe(true);
  });

  it("rejects unknown body parts", () => {
    expect(reportSchema.safeParse({ bodyPart: "ekor", consent: false }).success).toBe(false);
  });
});

describe("dogAttributesSchema", () => {
  it("requires a colour and trims optional text", () => {
    expect(
      dogAttributesSchema.safeParse({ banjarId: BANJAR, color: " ", sex: "male", ownership: "stray" }).success,
    ).toBe(false);
    const parsed = dogAttributesSchema.parse({
      banjarId: BANJAR,
      color: "Cokelat",
      nickname: "  ",
      sex: "male",
      ownership: "owned",
      ownerPhone: "",
    });
    expect(parsed.nickname).toBeUndefined();
    expect(parsed.ownerPhone).toBeUndefined();
  });
});

describe("configSchema", () => {
  it("rejects an unsure threshold above the strong one", () => {
    expect(configSchema.safeParse({ matchStrong: 0.5, matchUnsure: 0.6, vaccineValidDays: 365 }).success).toBe(false);
    expect(configSchema.safeParse({ matchStrong: "0.7", matchUnsure: "0.5", vaccineValidDays: "365" }).success).toBe(
      true,
    );
  });
});

describe("facilitySchema", () => {
  it("parses a checkbox value", () => {
    const parsed = facilitySchema.parse({ name: "Puskesmas", type: "Puskesmas", handlesBites: "on" });
    expect(parsed.handlesBites).toBe(true);
  });
});

describe("embedding and AI contract", () => {
  it("requires the embedding dimension of the model", () => {
    expect(embeddingSchema.safeParse(new Array(EMBEDDING_DIM).fill(0.01)).success).toBe(true);
    expect(embeddingSchema.safeParse([0.1, 0.2]).success).toBe(false);
  });

  it("accepts a rejected-photo response with a null embedding", () => {
    const parsed = analyzeResponseSchema.safeParse({
      quality: { ok: false, reasons: ["NO_DOG"], blur: 120.5, brightness: 98.1, width: 800, height: 600 },
      detection: { found: false, box: null, score: 0 },
      embedding: null,
      model_version: "test",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects unknown reason codes", () => {
    const parsed = analyzeResponseSchema.safeParse({
      quality: { ok: false, reasons: ["WHATEVER"], blur: 0, brightness: 0, width: 0, height: 0 },
      detection: { found: false, box: null, score: 0 },
      embedding: null,
      model_version: "test",
    });
    expect(parsed.success).toBe(false);
  });
});
