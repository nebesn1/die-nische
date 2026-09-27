import { describe, expect, it } from "vitest";
import { getKonquerorTreePresentation } from "./treePresentation";
import type { KonquerorVisibleTreeRow } from "./treeProjection";

const row = (overrides: Partial<KonquerorVisibleTreeRow>): KonquerorVisibleTreeRow => ({
  nodeId: "node",
  parentId: "parent",
  depth: 0,
  expandable: false,
  expanded: false,
  hasChildren: false,
  isLastSibling: true,
  ancestorContinuation: [],
  ...overrides,
});

describe("Konqueror Tree connector presentation", () => {
  it("maps every top-level row to a T-junction or final elbow without a root stem", () => {
    expect(getKonquerorTreePresentation(row({ depth: 0, isLastSibling: false }))).toEqual({
      ancestorSegments: [],
      currentBranch: "tee",
    });
    expect(getKonquerorTreePresentation(row({ depth: 0, isLastSibling: true }))).toEqual({
      ancestorSegments: [],
      currentBranch: "elbow",
    });
  });

  it("maps nested T-junctions and elbows directly from projection metadata", () => {
    expect(getKonquerorTreePresentation(row({ depth: 1, isLastSibling: false, ancestorContinuation: [true] }))).toEqual({
      ancestorSegments: [{ level: 0, continues: true }],
      currentBranch: "tee",
    });
    expect(getKonquerorTreePresentation(row({ depth: 1, isLastSibling: true, ancestorContinuation: [false] }))).toEqual({
      ancestorSegments: [{ level: 0, continues: false }],
      currentBranch: "elbow",
    });
  });

  it("preserves every ancestor continuation segment for deep rows", () => {
    expect(getKonquerorTreePresentation(row({
      depth: 3,
      isLastSibling: true,
      ancestorContinuation: [true, false, true],
    }))).toEqual({
      ancestorSegments: [
        { level: 0, continues: true },
        { level: 1, continues: false },
        { level: 2, continues: true },
      ],
      currentBranch: "elbow",
    });
  });
});
