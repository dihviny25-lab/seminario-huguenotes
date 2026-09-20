import { describe, expect, it } from "vitest";

import { createKeyedSerialExecutor, replaceValueIfLatestRevision } from "./optimisticState";

describe("replaceValueIfLatestRevision", () => {
  it("replaces the value when it still belongs to the settled request", () => {
    expect(
      replaceValueIfLatestRevision({ question: "option-b" }, "question", 2, 2, "option-a"),
    ).toEqual({ question: "option-a" });
  });

  it("removes the value when the matching request has no previous value", () => {
    expect(replaceValueIfLatestRevision({ question: "option-a" }, "question", 1, 1)).toEqual({});
  });

  it("preserves a newer value written while the older request was pending", () => {
    const current = { question: "option-c" };

    expect(replaceValueIfLatestRevision(current, "question", 1, 2, "option-a")).toBe(current);
  });

  it("preserves a newer revision even when it repeats the older value", () => {
    const current = { question: "option-a" };

    expect(replaceValueIfLatestRevision(current, "question", 1, 3)).toBe(current);
  });
});

describe("createKeyedSerialExecutor", () => {
  it("preserves request order for the same key", async () => {
    const runSerially = createKeyedSerialExecutor();
    const events: Array<string> = [];
    let releaseFirst!: () => void;

    const first = runSerially("question", async () => {
      events.push("first:start");
      await new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });
      events.push("first:end");
    });
    const second = runSerially("question", async () => {
      events.push("second:start");
    });

    await Promise.resolve();
    expect(events).toEqual(["first:start"]);

    releaseFirst();
    await Promise.all([first, second]);
    expect(events).toEqual(["first:start", "first:end", "second:start"]);
  });

  it("allows independent keys to run in parallel", async () => {
    const runSerially = createKeyedSerialExecutor();
    const events: Array<string> = [];
    let releaseFirst!: () => void;

    const first = runSerially("question-a", async () => {
      events.push("a:start");
      await new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });
    });
    const second = runSerially("question-b", async () => {
      events.push("b:start");
    });

    await second;
    expect(events).toEqual(["a:start", "b:start"]);

    releaseFirst();
    await first;
  });

  it("continues the queue after a failed request", async () => {
    const runSerially = createKeyedSerialExecutor();
    const first = runSerially("grade", async () => {
      throw new Error("network failure");
    });
    const second = runSerially("grade", async () => "saved");

    await expect(first).rejects.toThrow("network failure");
    await expect(second).resolves.toBe("saved");
  });
});
