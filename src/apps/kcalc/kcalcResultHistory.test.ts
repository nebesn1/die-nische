import { describe, expect, it } from "vitest";
import {
  appendKCalcResultHistory,
  canRedoKCalcResultHistory,
  canUndoKCalcResultHistory,
  initialKCalcResultHistory,
  redoKCalcResultHistory,
  undoKCalcResultHistory,
} from "./kcalcResultHistory";

describe("KCalc result history", () => {
  it("records only finite nonzero values without losing number or BigInt identity", () => {
    let history = appendKCalcResultHistory(initialKCalcResultHistory, 0);
    history = appendKCalcResultHistory(history, Number.POSITIVE_INFINITY);
    history = appendKCalcResultHistory(history, 0n);
    expect(history).toBe(initialKCalcResultHistory);

    history = appendKCalcResultHistory(history, 0.5);
    history = appendKCalcResultHistory(history, -3);
    history = appendKCalcResultHistory(history, 0x20000000000001n);
    expect(history).toEqual({ values: [0x20000000000001n, -3, 0.5], cursor: 0 });
  });

  it("keeps KDE3's first-Undo pointer behavior and reverse Redo traversal", () => {
    let history = initialKCalcResultHistory;
    history = appendKCalcResultHistory(history, 5);
    history = appendKCalcResultHistory(history, 8);
    history = appendKCalcResultHistory(history, 12);

    const firstUndo = undoKCalcResultHistory(history)!;
    expect(firstUndo).toEqual({ value: 12, history: { values: [12, 8, 5], cursor: 1 } });
    const secondUndo = undoKCalcResultHistory(firstUndo.history)!;
    expect(secondUndo.value).toBe(8);
    const thirdUndo = undoKCalcResultHistory(secondUndo.history)!;
    expect(thirdUndo.value).toBe(5);
    expect(canUndoKCalcResultHistory(thirdUndo.history)).toBe(false);

    const firstRedo = redoKCalcResultHistory(thirdUndo.history)!;
    expect(firstRedo.value).toBe(5);
    const secondRedo = redoKCalcResultHistory(firstRedo.history)!;
    expect(secondRedo.value).toBe(8);
    const thirdRedo = redoKCalcResultHistory(secondRedo.history)!;
    expect(thirdRedo.value).toBe(12);
    expect(canRedoKCalcResultHistory(thirdRedo.history)).toBe(false);
  });

  it("prepends a later result without truncating earlier history", () => {
    const history = {
      values: [12, 8, 5],
      cursor: 2,
    } as const;

    expect(appendKCalcResultHistory(history, 20)).toEqual({
      values: [20, 12, 8, 5],
      cursor: 0,
    });
  });
});
