import { describe, expect, it } from "vitest";

import {
  computeCurrentAmount,
  computeDiscountedAmount,
  computeMonthlySeries,
  formatPeriodLabel,
} from "@/lib/payments";

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

describe("formatPeriodLabel", () => {
  it("formats a YYYY-MM period as Mês/Ano", () => {
    expect(formatPeriodLabel("2026-09")).toBe("Setembro/2026");
  });

  it("formats January correctly (month index edge case)", () => {
    expect(formatPeriodLabel("2027-01")).toBe("Janeiro/2027");
  });
});

describe("computeDiscountedAmount", () => {
  it("applies the punctuality discount percentage", () => {
    expect(computeDiscountedAmount(187.5, 20)).toBeCloseTo(150);
    expect(computeDiscountedAmount(150, 20)).toBeCloseTo(120);
    expect(computeDiscountedAmount(125, 20)).toBeCloseTo(100);
  });

  it("returns the full amount unchanged when there's no discount", () => {
    expect(computeDiscountedAmount(200, 0)).toBe(200);
  });
});

describe("computeCurrentAmount", () => {
  const charge = { fullAmount: 150, discountPercent: 20, dueDate: "2026-09-10" };

  it("applies the discount when paid before the due date", () => {
    expect(computeCurrentAmount(charge, "2026-09-05")).toBeCloseTo(120);
  });

  it("still applies the discount on the due date itself", () => {
    expect(computeCurrentAmount(charge, "2026-09-10")).toBeCloseTo(120);
  });

  it("charges the full amount once the due date has passed", () => {
    expect(computeCurrentAmount(charge, "2026-09-11")).toBe(150);
  });

  it("charges the full amount unchanged when there's no discount configured", () => {
    const avulsa = { fullAmount: 300, discountPercent: 0, dueDate: "2026-09-10" };
    expect(computeCurrentAmount(avulsa, "2026-09-05")).toBe(300);
    expect(computeCurrentAmount(avulsa, "2026-09-11")).toBe(300);
  });
});
