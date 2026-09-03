import { describe, expect, it } from "vitest";

import { canDeletePost, canDeleteThread } from "@/lib/forumPermissions";

describe("canDeleteThread", () => {
  it("allows a moderator to delete a topic with replies", () => {
    expect(canDeleteThread({ isModerator: true, isAuthor: false, postCount: 2 })).toBe(true);
  });

  it("allows the author to delete a topic without replies", () => {
    expect(canDeleteThread({ isModerator: false, isAuthor: true, postCount: 0 })).toBe(true);
  });

  it("prevents the author from deleting a topic with replies", () => {
    expect(canDeleteThread({ isModerator: false, isAuthor: true, postCount: 1 })).toBe(false);
  });
});

describe("canDeletePost", () => {
  it("prevents the opening post from being deleted in isolation", () => {
    expect(canDeletePost({ isOpeningPost: true, isAuthor: true, isModerator: false })).toBe(false);
    expect(canDeletePost({ isOpeningPost: true, isAuthor: false, isModerator: true })).toBe(false);
  });

  it("allows an author or moderator to delete a reply", () => {
    expect(canDeletePost({ isOpeningPost: false, isAuthor: true, isModerator: false })).toBe(true);
    expect(canDeletePost({ isOpeningPost: false, isAuthor: false, isModerator: true })).toBe(true);
  });
});
