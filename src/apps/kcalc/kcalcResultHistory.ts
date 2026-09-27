export type KCalcResultHistoryValue = number | bigint;

export type KCalcResultHistory = Readonly<{
  readonly values: readonly KCalcResultHistoryValue[];
  /** Points at the value the next historical Undo will display. */
  readonly cursor: number;
}>;

export const initialKCalcResultHistory: KCalcResultHistory = {
  values: [],
  cursor: 0,
};

const isRecordableValue = (value: KCalcResultHistoryValue): boolean =>
  typeof value === "bigint" ? value !== 0n : Number.isFinite(value) && value !== 0;

export const appendKCalcResultHistory = (
  history: KCalcResultHistory,
  value: KCalcResultHistoryValue,
): KCalcResultHistory => isRecordableValue(value)
  ? { values: [value, ...history.values], cursor: 0 }
  : history;

export const canUndoKCalcResultHistory = (history: KCalcResultHistory): boolean =>
  history.cursor < history.values.length;

export const canRedoKCalcResultHistory = (history: KCalcResultHistory): boolean =>
  history.cursor > 0;

export type KCalcResultHistoryNavigation = Readonly<{
  readonly history: KCalcResultHistory;
  readonly value: KCalcResultHistoryValue;
}>;

// KDE3 displays history[cursor] before advancing, so the first Undo repeats
// the latest completed result and only then exposes the previous result.
export const undoKCalcResultHistory = (
  history: KCalcResultHistory,
): KCalcResultHistoryNavigation | null => {
  if (!canUndoKCalcResultHistory(history)) {
    return null;
  }

  return {
    value: history.values[history.cursor]!,
    history: { ...history, cursor: history.cursor + 1 },
  };
};

export const redoKCalcResultHistory = (
  history: KCalcResultHistory,
): KCalcResultHistoryNavigation | null => {
  if (!canRedoKCalcResultHistory(history)) {
    return null;
  }

  const cursor = history.cursor - 1;
  return {
    value: history.values[cursor]!,
    history: { ...history, cursor },
  };
};
