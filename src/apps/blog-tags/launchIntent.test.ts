import { describe, expect, it } from "vitest";
import { createBlogTagsOpenIntent, isBlogTagsOpenIntent } from "./launchIntent";

describe("Blog Tags launch intent", () => {
  it("carries only an optional exact selected tag string", () => {
    expect(createBlogTagsOpenIntent()).toEqual({ type: "open-blog-tags" });
    expect(createBlogTagsOpenIntent({ selectedTag: "机器人" })).toEqual({ type: "open-blog-tags", selectedTag: "机器人" });
    expect(isBlogTagsOpenIntent({ type: "open-blog-tags", selectedTag: "Qt" })).toBe(true);
    expect(isBlogTagsOpenIntent({ type: "open-blog-tags", selectedTag: 1 })).toBe(false);
  });
});
