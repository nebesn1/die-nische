import { describe, expect, it } from "vitest";
import { getKFindResultSelection } from "./resultSelection";

const ids = ["result-a", "result-b", "result-c"] as const;

describe("KFind result selection", () => {
  it("moves from the selected stable id and clamps at visible-result boundaries", () => {
    expect(getKFindResultSelection(ids, "result-a", "next")).toBe("result-b");
    expect(getKFindResultSelection(ids, "result-c", "previous")).toBe("result-b");
    expect(getKFindResultSelection(ids, "result-a", "previous")).toBe("result-a");
    expect(getKFindResultSelection(ids, "result-c", "next")).toBe("result-c");
  });

  it("starts at the first or last visible result when there is no selection", () => {
    expect(getKFindResultSelection(ids, null, "next")).toBe("result-a");
    expect(getKFindResultSelection(ids, null, "previous")).toBe("result-c");
    expect(getKFindResultSelection([], null, "next")).toBeNull();
  });

  it("skips deleted snapshot ids because callers pass only live visible results", () => {
    expect(getKFindResultSelection(["result-a", "result-c"], "result-a", "next")).toBe("result-c");
    expect(getKFindResultSelection(["result-a", "result-c"], "result-b", "next")).toBe("result-a");
  });
});
