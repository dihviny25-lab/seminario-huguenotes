import { describe, expect, it } from "vitest";

import { computeWeightedAverage } from "@/lib/grades";

describe("computeWeightedAverage", () => {
  it("returns null when there are no scores yet", () => {
    expect(computeWeightedAverage([])).toBeNull();
  });

  it("averages equally-weighted scores as a plain mean", () => {
    const avg = computeWeightedAverage([
      { score: 8, weight: 1 },
      { score: 6, weight: 1 },
    ]);
    expect(avg).toBe(7);
  });

  it("weighs higher-weight assessments more heavily", () => {
    // Prova (peso 2, nota 10) pesa mais que o trabalho (peso 1, nota 4):
    // (10*2 + 4*1) / 3 = 8
    const avg = computeWeightedAverage([
      { score: 10, weight: 2 },
      { score: 4, weight: 1 },
    ]);
    expect(avg).toBe(8);
  });

  it("returns the single score unchanged when there's only one assessment", () => {
    expect(computeWeightedAverage([{ score: 9.5, weight: 1 }])).toBe(9.5);
  });

  it("returns null instead of dividing by zero when every weight is zero", () => {
    expect(
      computeWeightedAverage([
        { score: 10, weight: 0 },
        { score: 5, weight: 0 },
      ]),
    ).toBeNull();
  });
});
