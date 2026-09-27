import { describe, expect, it } from "vitest";
import { createBlogSearchOpenIntent, isBlogSearchOpenIntent } from "./launchIntent";

describe("Blog Search launch intent", () => {
  it("carries only query text for a routed singleton request", () => {
    expect(createBlogSearchOpenIntent("KDE robot")).toEqual({ type: "open-blog-search", query: "KDE robot" });
    expect(isBlogSearchOpenIntent({ type: "open-blog-search", query: "机器人" })).toBe(true);
    expect(isBlogSearchOpenIntent({ type: "open-blog-search" })).toBe(false);
    expect(isBlogSearchOpenIntent({ type: "open-blog-search", query: 1 })).toBe(false);
  });
});
