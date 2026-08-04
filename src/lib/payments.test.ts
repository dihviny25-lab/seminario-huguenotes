import { describe, expect, it } from "vitest";

import { computeMonthlySeries } from "@/lib/payments";

describe("computeMonthlySeries", () => {
  it("generates consecutive months with the given due day", () => {
    expect(computeMonthlySeries("2026-03", 3, 10)).toEqual([
      { period: "2026-03", dueDate: "2026-03-10" },
      { period: "2026-04", dueDate: "2026-04-10" },
      { period: "2026-05", dueDate: "2026-05-10" },
    ]);
  });

  it("rolls over into the next year", () => {
    expect(computeMonthlySeries("2026-11", 3, 5)).toEqual([
      { period: "2026-11", dueDate: "2026-11-05" },
      { period: "2026-12", dueDate: "2026-12-05" },
      { period: "2027-01", dueDate: "2027-01-05" },
    ]);
  });

  it("clamps the due day to the last real day of shorter months", () => {
    const [, february] = computeMonthlySeries("2026-01", 2, 31);
    expect(february).toEqual({ period: "2026-02", dueDate: "2026-02-28" });
  });

  it("clamps to February 29 on a leap year", () => {
    const [, february] = computeMonthlySeries("2028-01", 2, 31);
    expect(february).toEqual({ period: "2028-02", dueDate: "2028-02-29" });
  });

  it("returns an empty array when months is zero", () => {
    expect(computeMonthlySeries("2026-01", 0, 10)).toEqual([]);
  });
});
