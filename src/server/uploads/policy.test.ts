import { describe, expect, it } from "vitest";

import { getUploadPolicy, parseUploadPurpose } from "./policy";

describe("upload policy", () => {
  it("aceita somente finalidades conhecidas", () => {
    expect(parseUploadPurpose('{"purpose":"assignment"}')).toBe("assignment");
    expect(parseUploadPurpose('{"purpose":"video"}')).toBe("video");
    expect(() => parseUploadPurpose('{"purpose":"unknown"}')).toThrow();
    expect(() => parseUploadPurpose(null)).toThrow();
  });

  it("restringe tarefa a 50 MB e não exige professor", () => {
    const policy = getUploadPolicy("assignment");
    expect(policy.requiresTeacher).toBe(false);
    expect(policy.maximumSizeInBytes).toBe(50 * 1024 * 1024);
    expect(policy.allowedContentTypes).not.toContain("video/mp4");
  });

  it("reserva vídeo grande para professor", () => {
    const policy = getUploadPolicy("video");
    expect(policy.requiresTeacher).toBe(true);
    expect(policy.maximumSizeInBytes).toBe(2 * 1024 * 1024 * 1024);
    expect(policy.allowedContentTypes).toEqual(["video/mp4", "video/webm", "video/quicktime"]);
  });
});
