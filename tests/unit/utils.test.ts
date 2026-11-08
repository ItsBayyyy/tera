import { describe, expect, it } from "vitest";
import { vaccineState, vaccineExpiry } from "@/lib/vaccine";
import { formatCountdown, formatPercent, formatScore, scoreBarWidth } from "@/lib/format";
import { CASE_CODE_ALPHABET, generateCaseCode } from "@/lib/case-code";
import { roundCoordinate } from "@/lib/geo";
import { createRateLimiter } from "@/lib/rate-limit";
import { fitWithin } from "@/lib/image/resize";
import { qualityMessage } from "@/lib/ai/messages";
import { hasAuthCookie } from "@/lib/auth-cookie";

describe("vaccineState", () => {
  const now = new Date("2026-11-08T00:00:00Z");

  it("is none without a vaccination", () => {
    expect(vaccineState(null, 365, now)).toBe("none");
  });

  it("is active inside the period and expired after it", () => {
    expect(vaccineState("2026-01-01T00:00:00Z", 365, now)).toBe("active");
    expect(vaccineState("2025-11-07T00:00:00Z", 365, now)).toBe("expired");
  });

  it("computes the expiry date", () => {
    expect(vaccineExpiry("2026-01-01T00:00:00Z", 10).toISOString()).toBe("2026-01-11T00:00:00.000Z");
  });
});

describe("format", () => {
  it("formats similarity with an Indonesian decimal comma", () => {
    expect(formatScore(0.8234)).toBe("0,82");
  });

  it("clamps the score bar to 0–100", () => {
    expect(scoreBarWidth(-0.3)).toBe(0);
    expect(scoreBarWidth(0.456)).toBe(46);
    expect(scoreBarWidth(1.4)).toBe(100);
  });

  it("formats coverage and guards against empty banjars", () => {
    expect(formatPercent(1, 3)).toBe("33,3%");
    expect(formatPercent(0, 0)).toBe("–");
  });
});

describe("generateCaseCode", () => {
  it("uses the unambiguous alphabet in XXX-XXX form", () => {
    let i = 0;
    const seq = [0, 0.99, 0.5, 0.1, 0.2, 0.3];
    const code = generateCaseCode(() => seq[i++ % seq.length]);
    expect(code).toMatch(/^[A-Z0-9]{3}-[A-Z0-9]{3}$/);
    for (const ch of code.replace("-", "")) expect(CASE_CODE_ALPHABET).toContain(ch);
  });

  it("never contains look-alike characters", () => {
    for (let n = 0; n < 200; n++) expect(generateCaseCode()).not.toMatch(/[01OILSZ25B8]/);
  });
});

describe("roundCoordinate", () => {
  it("rounds to three decimals", () => {
    expect(roundCoordinate(-8.6704582)).toBe(-8.67);
    expect(roundCoordinate(115.2126293)).toBe(115.213);
  });
});

describe("createRateLimiter", () => {
  it("blocks after the limit within a window and resets afterwards", () => {
    let t = 0;
    const hit = createRateLimiter(2, 1000, () => t);
    expect(hit("ip").ok).toBe(true);
    expect(hit("ip").ok).toBe(true);
    const blocked = hit("ip");
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBe(1);
    expect(hit("other").ok).toBe(true);
    t = 1000;
    expect(hit("ip").ok).toBe(true);
  });
});

describe("fitWithin", () => {
  it("scales the longest side down to 1024", () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1024, height: 768 });
    expect(fitWithin(1000, 3000)).toEqual({ width: 341, height: 1024 });
  });

  it("never upscales small photos", () => {
    expect(fitWithin(640, 480)).toEqual({ width: 640, height: 480 });
  });
});

describe("qualityMessage", () => {
  it("explains the first failure reason", () => {
    expect(qualityMessage(["TOO_DARK", "BLUR"])).toContain("gelap");
  });

  it("has a fallback when no reason is given", () => {
    expect(qualityMessage([])).toContain("Coba foto lagi");
  });
});

describe("hasAuthCookie", () => {
  it("finds the session cookie, also when chunked", () => {
    expect(hasAuthCookie("sb-127-auth-token=base64-abc")).toBe(true);
    expect(hasAuthCookie("theme=light; sb-abcd1234-auth-token.0=base64-abc")).toBe(true);
  });

  it("is false when the browser did not store it", () => {
    expect(hasAuthCookie("")).toBe(false);
    expect(hasAuthCookie("theme=light; sb-127-auth-token-code-verifier=x")).toBe(false);
  });
});

describe("formatCountdown", () => {
  it("shows minutes and seconds with leading zeros", () => {
    expect(formatCountdown(15 * 60_000)).toBe("15:00");
    expect(formatCountdown(61_000)).toBe("01:01");
  });

  it("rounds partial seconds up and never goes negative", () => {
    expect(formatCountdown(999)).toBe("00:01");
    expect(formatCountdown(0)).toBe("00:00");
    expect(formatCountdown(-5_000)).toBe("00:00");
  });
});
