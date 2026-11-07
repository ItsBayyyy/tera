import { describe, expect, it } from "vitest";
import { classifyZone, decideScan, mergeCandidates, validateThresholds } from "@/lib/match/zone";

const t = { strong: 0.7, unsure: 0.5 };
const c = (dogId: string, score: number) => ({ dogId, score, photoPath: `${dogId}.jpg` });

describe("classifyZone", () => {
  it("puts scores at or above the strong threshold in the strong zone", () => {
    expect(classifyZone(0.7, t)).toBe("strong");
    expect(classifyZone(0.95, t)).toBe("strong");
  });

  it("puts scores between the thresholds in the unsure zone, inclusive of the lower bound", () => {
    expect(classifyZone(0.5, t)).toBe("unsure");
    expect(classifyZone(0.6999, t)).toBe("unsure");
  });

  it("puts low scores and empty galleries in the none zone", () => {
    expect(classifyZone(0.4999, t)).toBe("none");
    expect(classifyZone(-0.2, t)).toBe("none");
    expect(classifyZone(null, t)).toBe("none");
  });
});

describe("mergeCandidates", () => {
  it("keeps the best score per dog across photos and sorts descending", () => {
    const merged = mergeCandidates([[c("a", 0.4), c("b", 0.6)], [c("a", 0.8), c("c", 0.3)]], 5);
    expect(merged.map((m) => [m.dogId, m.score])).toEqual([
      ["a", 0.8],
      ["b", 0.6],
      ["c", 0.3],
    ]);
  });

  it("keeps the photo that produced the best score", () => {
    const merged = mergeCandidates(
      [[{ dogId: "a", score: 0.4, photoPath: "old" }], [{ dogId: "a", score: 0.9, photoPath: "new" }]],
      5,
    );
    expect(merged[0].photoPath).toBe("new");
  });

  it("respects the limit", () => {
    const merged = mergeCandidates([[c("a", 0.1), c("b", 0.2), c("c", 0.3)]], 2);
    expect(merged.map((m) => m.dogId)).toEqual(["c", "b"]);
  });

  it("handles scans with no candidates", () => {
    expect(mergeCandidates([[], []], 5)).toEqual([]);
  });
});

describe("decideScan", () => {
  it("shows one large candidate in the strong zone", () => {
    const d = decideScan([[c("a", 0.9), c("b", 0.8)]], t);
    expect(d.zone).toBe("strong");
    expect(d.display).toHaveLength(1);
    expect(d.ranked.map((x) => x.dogId)).toEqual(["a", "b"]);
  });

  it("shows up to five candidates side by side in the unsure zone", () => {
    const list = ["a", "b", "c", "d", "e", "f"].map((id, i) => c(id, 0.65 - i * 0.05));
    const d = decideScan([list], t);
    expect(d.zone).toBe("unsure");
    expect(d.display.map((x) => x.dogId)).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("keeps the three nearest dogs as a safety net in the none zone", () => {
    const d = decideScan([[c("a", 0.3), c("b", 0.2), c("c", 0.1), c("d", 0.05)]], t);
    expect(d.zone).toBe("none");
    expect(d.display.map((x) => x.dogId)).toEqual(["a", "b", "c"]);
  });

  it("can promote a dog to strong because a second photo matched better", () => {
    const d = decideScan([[c("a", 0.55)], [c("a", 0.75)]], t);
    expect(d.zone).toBe("strong");
    expect(d.display[0].score).toBe(0.75);
  });

  it("returns none with no candidates for an empty banjar", () => {
    expect(decideScan([[]], t)).toEqual({ zone: "none", ranked: [], display: [] });
  });
});

describe("validateThresholds", () => {
  it("accepts unsure < strong within range", () => {
    expect(validateThresholds({ strong: 0.7, unsure: 0.5 })).toBeNull();
  });

  it("rejects inverted or out-of-range thresholds", () => {
    expect(validateThresholds({ strong: 0.5, unsure: 0.5 })).not.toBeNull();
    expect(validateThresholds({ strong: 1.2, unsure: 0.5 })).not.toBeNull();
  });
});
