import { describe, expect, it } from "vitest";
import {
  getMostUsedApplicationIds,
  initialApplicationUsageState,
  MOST_USED_APPLICATION_LIMIT,
  recordApplicationUse,
} from "./applicationUsage";

describe("application runtime usage", () => {
  it("starts empty and records stable application identities without persistence", () => {
    const first = recordApplicationUse(initialApplicationUsageState, "kwrite");
    const second = recordApplicationUse(first, "kwrite");

    expect(initialApplicationUsageState.recordsByAppId).toEqual({});
    expect(second.recordsByAppId).toEqual({
      kwrite: { appId: "kwrite", count: 2, lastUsedSequence: 2 },
    });
    expect(second.nextSequence).toBe(3);
  });

  it("projects count, recency, and code-point order without mutating source state", () => {
    const state = {
      recordsByAppId: {
        konsole: { appId: "konsole", count: 2, lastUsedSequence: 7 },
        kcalc: { appId: "kcalc", count: 2, lastUsedSequence: 9 },
        kwrite: { appId: "kwrite", count: 2, lastUsedSequence: 9 },
        kfind: { appId: "kfind", count: 1, lastUsedSequence: 10 },
      },
      nextSequence: 11,
    };

    expect(getMostUsedApplicationIds(state, ["kwrite", "konsole", "kcalc", "kfind"])).toEqual([
      "kcalc",
      "kwrite",
      "konsole",
      "kfind",
    ]);
    expect(state.recordsByAppId.kfind.count).toBe(1);
  });

  it("filters internal applications and lets a newly dominant fourth entry enter the top four", () => {
    let state = initialApplicationUsageState;
    ["kwrite", "kwrite", "kwrite", "kcalc", "kcalc", "konsole", "blog-search"].forEach((appId) => {
      state = recordApplicationUse(state, appId);
    });

    expect(getMostUsedApplicationIds(state, ["kwrite", "kcalc", "konsole"])).toEqual([
      "kwrite",
      "kcalc",
      "konsole",
    ]);

    ["kfind", "kfind", "kfind", "kfind"].forEach((appId) => {
      state = recordApplicationUse(state, appId);
    });

    expect(getMostUsedApplicationIds(state, ["kwrite", "kcalc", "konsole", "kfind"])).toEqual([
      "kfind",
      "kwrite",
      "kcalc",
      "konsole",
    ]);
  });

  it("shows zero through four eligible applications and excludes only the fifth ranked row", () => {
    expect(MOST_USED_APPLICATION_LIMIT).toBe(4);
    const eligible = ["kwrite", "kcalc", "konsole", "kfind", "kcontrol"];
    let state = initialApplicationUsageState;

    expect(getMostUsedApplicationIds(state, eligible)).toEqual([]);

    ["kwrite", "kcalc", "konsole", "kfind", "kcontrol"].forEach((appId, index) => {
      state = recordApplicationUse(state, appId);
      const result = getMostUsedApplicationIds(state, eligible);
      expect(result).toHaveLength(Math.min(index + 1, MOST_USED_APPLICATION_LIMIT));
    });

    expect(getMostUsedApplicationIds(state, eligible)).toEqual([
      "kcontrol",
      "kfind",
      "konsole",
      "kcalc",
    ]);
    expect(getMostUsedApplicationIds(state, eligible)).not.toContain("kwrite");
  });
});
