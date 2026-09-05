import { describe, expect, it } from "vitest";

import { effectiveTeacherId, isFutureOrToday } from "./teachingAssignments";

describe("effectiveTeacherId", () => {
  it("uses the lesson override when present", () => {
    expect(effectiveTeacherId("substitute", "owner")).toBe("substitute");
  });

  it("inherits the discipline teacher when the lesson has no override", () => {
    expect(effectiveTeacherId(null, "owner")).toBe("owner");
  });

  it("remains unassigned when neither level has a teacher", () => {
    expect(effectiveTeacherId(null, null)).toBeNull();
  });
});

describe("isFutureOrToday", () => {
  it("accepts today and future dates", () => {
    expect(isFutureOrToday("2026-09-05", "2026-09-05")).toBe(true);
    expect(isFutureOrToday("2026-09-06", "2026-09-05")).toBe(true);
  });

  it("rejects past dates", () => {
    expect(isFutureOrToday("2026-09-04", "2026-09-05")).toBe(false);
  });
});
