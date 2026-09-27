import type { KonquerorVisibleTreeRow } from "./treeProjection";

export type KonquerorTreeCurrentBranch = "tee" | "elbow";

export interface KonquerorTreePresentation {
  readonly ancestorSegments: readonly {
    readonly level: number;
    readonly continues: boolean;
  }[];
  readonly currentBranch: KonquerorTreeCurrentBranch;
}

/** Maps projection metadata to per-row connector segments without DOM measurement. */
export function getKonquerorTreePresentation(row: KonquerorVisibleTreeRow): KonquerorTreePresentation {
  return {
    ancestorSegments: row.ancestorContinuation.map((continues, level) => ({ level, continues })),
    currentBranch: row.isLastSibling ? "elbow" : "tee",
  };
}
