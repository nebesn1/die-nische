import type { KCalcAngleUnit, KCalcNumberBase } from "./kcalcModeState";
import {
  appendKCalcRadixDigit,
  createKCalcRadixEntry,
  createKCalcRadixEntryFromValue,
  getKCalcRadix,
  getKCalcRadixEntryValue,
  getKCalcSafeNumber,
  isKCalcRadixDigit,
  removeKCalcRadixDigit,
  toggleKCalcRadixEntrySign,
  truncateFiniteNumberForKCalcRadix,
  type KCalcRadixEntry,
} from "./kcalcRadix";
import { evaluateKCalcScientificCommand, isKCalcScientificCommand, type KCalcScientificCommandId } from "./kcalcScientificMath";
import {
  evaluateKCalcStatisticsQuery,
  isKCalcStatisticsQueryCommand,
  type KCalcStatisticsQueryCommandId,
} from "./kcalcStatisticsMath";
import {
  evaluateKCalcLogicBinaryCommand,
  evaluateKCalcLogicComplement,
  isKCalcLogicBinaryCommand,
  isKCalcLogicCommand,
  type KCalcLogicBinaryCommandId,
} from "./kcalcLogicMath";
import {
  isKCalcConstantRecallCommand,
  isKCalcConstantStoreCommand,
  type KCalcConstantCommandId,
  type KCalcConstantValue,
} from "./kcalcConstants";
import {
  formatKCalcClipboardValue,
  parseKCalcClipboardText,
  type KCalcClipboardValue,
} from "./kcalcClipboard";
import {
  appendKCalcResultHistory,
  canRedoKCalcResultHistory,
  canUndoKCalcResultHistory,
  initialKCalcResultHistory,
  redoKCalcResultHistory,
  undoKCalcResultHistory,
  type KCalcResultHistory,
  type KCalcResultHistoryValue,
} from "./kcalcResultHistory";

export const MAX_CALCULATOR_DIGITS = 14;
export const MAX_CALCULATOR_RADIX_DIGITS = 100_000;

export type CalculatorBinaryOperator = "+" | "-" | "*" | "/" | "mod" | "int-div" | "power" | "inverse-power";

type CalculatorLogicOperand =
  | Readonly<{ kind: "exact"; value: bigint }>
  | Readonly<{ kind: "fraction" }>;

export type CalculatorOperandDomain = "number-compatible" | "exact-integer-only" | "unavailable";

export type CalculatorCommandId = KCalcScientificCommandId
  | KCalcStatisticsQueryCommandId
  | "mod"
  | "int-div"
  | "reciprocal"
  | "factorial"
  | "square"
  | "cube"
  | "sqrt"
  | "cuberoot"
  | "power"
  | "inverse-power"
  | "memory-recall"
  | "memory-store"
  | "memory-add"
  | "memory-subtract"
  | "memory-clear"
  | "stat-enter-data"
  | "stat-delete-data"
  | "stat-clear"
  | "stat-clear-inverse-noop"
  | "built-in-constant-recall"
  | "edit-copy"
  | "edit-cut"
  | "edit-paste"
  | "edit-undo"
  | "edit-redo"
  | KCalcConstantCommandId
  | KCalcLogicBinaryCommandId
  | "logic-complement"
  | "percent";

export type CalculatorCommandContext = Readonly<{
  angleUnit: KCalcAngleUnit;
  numberBase?: KCalcNumberBase;
  clipboardText?: string;
  constantValue?: KCalcConstantValue;
  builtInConstantValue?: number;
}>;

export type CalculatorAction =
  | { readonly type: "digit"; readonly digit: string; readonly numberBase?: KCalcNumberBase }
  | { readonly type: "decimal"; readonly numberBase?: KCalcNumberBase }
  | { readonly type: "operator"; readonly operator: CalculatorBinaryOperator; readonly numberBase?: KCalcNumberBase }
  | { readonly type: "command"; readonly commandId: CalculatorCommandId; readonly context?: CalculatorCommandContext }
  | { readonly type: "equals"; readonly numberBase?: KCalcNumberBase }
  | { readonly type: "toggle-sign" }
  | { readonly type: "clear" }
  | { readonly type: "clear-entry" }
  | { readonly type: "backspace" }
  | { readonly type: "set-base"; readonly numberBase: KCalcNumberBase }
  | { readonly type: "clipboard-copy" }
  | { readonly type: "clipboard-cut" }
  | { readonly type: "clipboard-paste"; readonly text: string; readonly numberBase?: KCalcNumberBase }
  | { readonly type: "history-undo"; readonly numberBase?: KCalcNumberBase }
  | { readonly type: "history-redo"; readonly numberBase?: KCalcNumberBase };

export interface CalculatorState {
  readonly display: string;
  readonly radixEntry: KCalcRadixEntry | null;
  readonly accumulator: number | null;
  readonly pendingOperator: CalculatorBinaryOperator | null;
  readonly logicPendingOperand: CalculatorLogicOperand | null;
  readonly pendingLogicOperator: KCalcLogicBinaryCommandId | null;
  readonly waitingForOperand: boolean;
  readonly hasCurrentOperand: boolean;
  readonly error: boolean;
  readonly memoryValue: number | null;
  readonly statisticsValues: readonly number[];
  /** Display-only, per-instance browsing of completed nonzero results. */
  readonly resultHistory: KCalcResultHistory;
}

export const initialCalculatorState: CalculatorState = {
  display: "0",
  radixEntry: null,
  accumulator: null,
  pendingOperator: null,
  logicPendingOperand: null,
  pendingLogicOperator: null,
  waitingForOperand: false,
  hasCurrentOperand: false,
  error: false,
  memoryValue: null,
  statisticsValues: [],
  resultHistory: initialKCalcResultHistory,
};

const hasMaximumDigits = (display: string): boolean => display.replace(/[^0-9]/g, "").length >= MAX_CALCULATOR_DIGITS;

const hasPendingOperation = (state: CalculatorState): boolean =>
  state.pendingOperator !== null || state.pendingLogicOperator !== null;

export const classifyCalculatorOperandDomain = (state: CalculatorState): CalculatorOperandDomain => {
  if (state.error) {
    return "unavailable";
  }

  if (state.radixEntry !== null) {
    return getKCalcSafeNumber(getKCalcRadixEntryValue(state.radixEntry)) === null
      ? "exact-integer-only"
      : "number-compatible";
  }

  return Number.isFinite(Number(state.display)) ? "number-compatible" : "unavailable";
};

export const canCurrentCalculatorValueEnterNumberDomain = (state: CalculatorState): boolean =>
  classifyCalculatorOperandDomain(state) === "number-compatible";

export function getKCalcClipboardText(state: CalculatorState, numberBase: KCalcNumberBase): string | null {
  if (state.error) {
    return null;
  }

  const value: KCalcClipboardValue = state.radixEntry === null
    ? { kind: "number", value: Number(state.display) }
    : { kind: "integer", value: getKCalcRadixEntryValue(state.radixEntry) };

  return formatKCalcClipboardValue(value, numberBase);
}

const getCurrentEntryNumber = (state: CalculatorState): number | null => {
  const value = state.radixEntry === null
    ? Number(state.display)
    : getKCalcSafeNumber(getKCalcRadixEntryValue(state.radixEntry));

  return value !== null && Number.isFinite(value) ? value : null;
};

export const getKCalcConstantValueFromCalculatorState = (state: CalculatorState): KCalcConstantValue | null => {
  if (state.error) {
    return null;
  }

  if (state.radixEntry !== null) {
    return { kind: "integer", value: getKCalcRadixEntryValue(state.radixEntry) };
  }

  const value = Number(state.display);
  return Number.isFinite(value) ? { kind: "number", value } : null;
};

const getActionNumberBase = (numberBase: KCalcNumberBase | undefined): KCalcNumberBase => numberBase ?? "decimal";

const getRadixEntryForNumber = (value: number, numberBase: KCalcNumberBase): KCalcRadixEntry | null => {
  const integerValue = truncateFiniteNumberForKCalcRadix(value);
  return integerValue === null ? null : createKCalcRadixEntryFromValue(integerValue, getKCalcRadix(numberBase));
};

const formatCalculatorValueForBase = (value: number, numberBase: KCalcNumberBase): Pick<CalculatorState, "display" | "radixEntry"> | null => {
  if (numberBase === "decimal") {
    const display = formatCalculatorNumber(value);
    return display === "Error" ? null : { display, radixEntry: null };
  }

  const radixEntry = getRadixEntryForNumber(value, numberBase);
  return radixEntry === null
    ? null
    : {
      display: `${radixEntry.negative ? "-" : ""}${radixEntry.digits}`,
      radixEntry,
    };
};

const formatExactIntegerForBase = (value: bigint, numberBase: KCalcNumberBase): Pick<CalculatorState, "display" | "radixEntry"> => {
  const radixEntry = createKCalcRadixEntryFromValue(value, getKCalcRadix(numberBase));

  return {
    display: `${radixEntry.negative ? "-" : ""}${radixEntry.digits}`,
    radixEntry,
  };
};

const getCurrentLogicOperand = (state: CalculatorState): CalculatorLogicOperand | null => {
  if (state.radixEntry !== null) {
    return { kind: "exact", value: getKCalcRadixEntryValue(state.radixEntry) };
  }

  const value = Number(state.display);

  if (!Number.isFinite(value)) {
    return null;
  }

  if (Number.isSafeInteger(value)) {
    return { kind: "exact", value: BigInt(value) };
  }

  return Number.isInteger(value) ? null : { kind: "fraction" };
};

const createRadixDisplayState = (state: CalculatorState, numberBase: KCalcNumberBase): CalculatorState => {
  if (state.error) {
    return state;
  }

  if (numberBase === "decimal") {
    if (state.radixEntry === null) {
      return {
        ...state,
        waitingForOperand: true,
        hasCurrentOperand: hasPendingOperation(state),
      };
    }

    const exactValue = getKCalcRadixEntryValue(state.radixEntry);
    const safeValue = getKCalcSafeNumber(exactValue);

    if (safeValue !== null) {
      return {
        ...state,
        display: formatCalculatorNumber(safeValue),
        radixEntry: null,
        waitingForOperand: true,
        hasCurrentOperand: hasPendingOperation(state),
      };
    }

    const radixEntry = createKCalcRadixEntryFromValue(exactValue, getKCalcRadix(numberBase));
    return {
      ...state,
      display: `${radixEntry.negative ? "-" : ""}${radixEntry.digits}`,
      radixEntry,
      waitingForOperand: true,
      hasCurrentOperand: hasPendingOperation(state),
    };
  }

  let radixEntry: KCalcRadixEntry | null;

  if (state.radixEntry === null) {
    const currentValue = getCurrentEntryNumber(state);

    if (currentValue === null) {
      return createErrorState(state.memoryValue, state.statisticsValues, state.resultHistory);
    }

    radixEntry = getRadixEntryForNumber(currentValue, numberBase);
  } else {
    radixEntry = createKCalcRadixEntryFromValue(getKCalcRadixEntryValue(state.radixEntry), getKCalcRadix(numberBase));
  }

  if (radixEntry === null) {
    return createErrorState(state.memoryValue, state.statisticsValues, state.resultHistory);
  }

  return {
    ...state,
    display: `${radixEntry.negative ? "-" : ""}${radixEntry.digits}`,
    radixEntry,
    waitingForOperand: true,
    hasCurrentOperand: hasPendingOperation(state),
  };
};

const createArithmeticInitialState = (
  memoryValue: number | null,
  statisticsValues: readonly number[],
  resultHistory: KCalcResultHistory,
): CalculatorState => memoryValue === null && statisticsValues.length === 0 && resultHistory.values.length === 0
  ? initialCalculatorState
  : {
    ...initialCalculatorState,
    memoryValue,
    statisticsValues,
    resultHistory,
  };

export function formatCalculatorNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return "Error";
  }

  if (Object.is(value, -0) || value === 0) {
    return "0";
  }

  const normalized = Number(value.toPrecision(12));

  if (!Number.isFinite(normalized)) {
    return "Error";
  }

  return Object.is(normalized, -0) || normalized === 0 ? "0" : normalized.toString();
}

const isValidCalculatorResult = (value: number): value is number => Number.isFinite(value) && formatCalculatorNumber(value) !== "Error";

const calculateModulo = (left: number, right: number): number | null => {
  if (right === 0) {
    return null;
  }

  // KCalc documents Mod as a Euclidean remainder, so it remains non-negative.
  const divisor = Math.abs(right);
  const remainder = left % divisor;
  return remainder < 0 ? remainder + divisor : remainder;
};

const calculateInversePower = (left: number, right: number): number | null => {
  if (right === 0) {
    return null;
  }

  if (left < 0) {
    if (!Number.isInteger(right) || Math.abs(right) % 2 === 0) {
      return null;
    }

    const result = -Math.pow(-left, 1 / right);
    return isValidCalculatorResult(result) ? result : null;
  }

  const result = Math.pow(left, 1 / right);
  return isValidCalculatorResult(result) ? result : null;
};

export function applyCalculatorBinaryOperation(
  left: number,
  operator: CalculatorBinaryOperator,
  right: number,
): number | null {
  if (operator === "+") {
    return left + right;
  }

  if (operator === "-") {
    return left - right;
  }

  if (operator === "*") {
    return left * right;
  }

  if (operator === "/") {
    return right === 0 ? null : left / right;
  }

  if (operator === "mod") {
    return calculateModulo(left, right);
  }

  if (operator === "int-div") {
    return right === 0 ? null : Math.trunc(left / right);
  }

  if (operator === "power") {
    const result = Math.pow(left, right);
    return isValidCalculatorResult(result) ? result : null;
  }

  return calculateInversePower(left, right);
}

const createErrorState = (
  memoryValue: number | null,
  statisticsValues: readonly number[],
  resultHistory: KCalcResultHistory,
): CalculatorState => ({
  ...createArithmeticInitialState(memoryValue, statisticsValues, resultHistory),
  display: "Error",
  radixEntry: null,
  error: true,
});

const displayResult = (
  result: number,
  memoryValue: number | null,
  statisticsValues: readonly number[],
  resultHistory: KCalcResultHistory,
  numberBase: KCalcNumberBase,
): CalculatorState => {
  const presentation = formatCalculatorValueForBase(result, numberBase);

  return presentation === null
    ? createErrorState(memoryValue, statisticsValues, resultHistory)
    : {
      ...presentation,
      accumulator: null,
      pendingOperator: null,
      logicPendingOperand: null,
      pendingLogicOperator: null,
      waitingForOperand: true,
      hasCurrentOperand: false,
      error: false,
      memoryValue,
      statisticsValues,
      resultHistory,
    };
};

const displayCommandResult = (state: CalculatorState, result: number, numberBase: KCalcNumberBase): CalculatorState => {
  const presentation = formatCalculatorValueForBase(result, numberBase);

  if (presentation === null) {
    return createErrorState(state.memoryValue, state.statisticsValues, state.resultHistory);
  }

  return {
    ...state,
    ...presentation,
    waitingForOperand: !hasPendingOperation(state),
    hasCurrentOperand: hasPendingOperation(state),
    error: false,
  };
};

const displayExactLogicResult = (
  result: bigint,
  memoryValue: number | null,
  statisticsValues: readonly number[],
  resultHistory: KCalcResultHistory,
  numberBase: KCalcNumberBase,
): CalculatorState => ({
  ...formatExactIntegerForBase(result, numberBase),
  accumulator: null,
  pendingOperator: null,
  logicPendingOperand: null,
  pendingLogicOperator: null,
  waitingForOperand: true,
  hasCurrentOperand: false,
  error: false,
  memoryValue,
  statisticsValues,
  resultHistory,
});

const displayExactLogicCommandResult = (
  state: CalculatorState,
  result: bigint,
  numberBase: KCalcNumberBase,
): CalculatorState => ({
  ...state,
  ...formatExactIntegerForBase(result, numberBase),
  waitingForOperand: !hasPendingOperation(state),
  hasCurrentOperand: hasPendingOperation(state),
  error: false,
});

const getKCalcResultHistoryValue = (state: CalculatorState): KCalcResultHistoryValue | null => {
  if (state.error) {
    return null;
  }

  if (state.radixEntry !== null) {
    return getKCalcRadixEntryValue(state.radixEntry);
  }

  const value = Number(state.display);
  return Number.isFinite(value) ? value : null;
};

const appendCurrentKCalcResultToHistory = (state: CalculatorState): CalculatorState => {
  const value = getKCalcResultHistoryValue(state);
  return value === null ? state : { ...state, resultHistory: appendKCalcResultHistory(state.resultHistory, value) };
};

const displayKCalcResultHistoryValue = (
  state: CalculatorState,
  value: KCalcResultHistoryValue,
  resultHistory: KCalcResultHistory,
  numberBase: KCalcNumberBase,
): CalculatorState => {
  const presentation = typeof value === "bigint"
    ? formatExactIntegerForBase(value, numberBase)
    : formatCalculatorValueForBase(value, numberBase);

  if (presentation === null) {
    return createErrorState(state.memoryValue, state.statisticsValues, resultHistory);
  }

  return {
    ...state,
    ...presentation,
    waitingForOperand: true,
    hasCurrentOperand: hasPendingOperation(state),
    error: false,
    resultHistory,
  };
};

const displayClipboardValue = (
  state: CalculatorState,
  value: KCalcClipboardValue,
  numberBase: KCalcNumberBase,
): CalculatorState => {
  const presentation = value.kind === "integer"
    ? formatExactIntegerForBase(value.value, numberBase)
    : formatCalculatorValueForBase(value.value, numberBase);

  if (presentation === null) {
    return createErrorState(state.memoryValue, state.statisticsValues, state.resultHistory);
  }

  return {
    ...state,
    ...presentation,
    waitingForOperand: true,
    hasCurrentOperand: hasPendingOperation(state),
    error: false,
  };
};

const replaceEntry = (state: CalculatorState, display: string): CalculatorState => ({
  ...state,
  display,
  radixEntry: null,
  waitingForOperand: false,
});

const applyCalculatorOperator = (state: CalculatorState, operator: CalculatorBinaryOperator, numberBase: KCalcNumberBase): CalculatorState => {
  if (state.pendingLogicOperator !== null) {
    if (!(state.waitingForOperand && !state.hasCurrentOperand)) {
      const finalized = finalizeCompletedPendingOperation(state, numberBase);
      return finalized.error ? finalized : applyCalculatorOperator(finalized, operator, numberBase);
    }

    const currentValue = getCurrentEntryNumber(state);

    if (currentValue === null) {
      return createErrorState(state.memoryValue, state.statisticsValues, state.resultHistory);
    }

    return {
      ...state,
      accumulator: currentValue,
      pendingOperator: operator,
      logicPendingOperand: null,
      pendingLogicOperator: null,
      waitingForOperand: true,
      hasCurrentOperand: false,
    };
  }

  const currentValue = getCurrentEntryNumber(state);

  if (currentValue === null) {
    return createErrorState(state.memoryValue, state.statisticsValues, state.resultHistory);
  }

  if (state.pendingOperator && state.waitingForOperand && !state.hasCurrentOperand) {
    return {
      ...state,
      pendingOperator: operator,
    };
  }

  if (state.pendingOperator !== null && state.accumulator !== null) {
    const result = applyCalculatorBinaryOperation(state.accumulator, state.pendingOperator, currentValue);

    if (result === null || !isValidCalculatorResult(result)) {
      return createErrorState(state.memoryValue, state.statisticsValues, state.resultHistory);
    }

    const presentation = formatCalculatorValueForBase(result, numberBase);

    if (presentation === null) {
      return createErrorState(state.memoryValue, state.statisticsValues, state.resultHistory);
    }

    return {
      ...presentation,
      accumulator: result,
      pendingOperator: operator,
      logicPendingOperand: null,
      pendingLogicOperator: null,
      waitingForOperand: true,
      hasCurrentOperand: false,
      error: false,
      memoryValue: state.memoryValue,
      statisticsValues: state.statisticsValues,
      resultHistory: state.resultHistory,
    };
  }

  return {
    ...state,
    accumulator: currentValue,
    pendingOperator: operator,
    logicPendingOperand: null,
    pendingLogicOperator: null,
    waitingForOperand: true,
    hasCurrentOperand: false,
  };
};

const applyFactorial = (value: number): number | null => {
  if (!Number.isInteger(value) || value < 0) {
    return null;
  }

  let result = 1;

  for (let factor = 2; factor <= value; factor += 1) {
    result *= factor;

    if (!Number.isFinite(result)) {
      return null;
    }
  }

  return result;
};

const applyCubeRoot = (value: number): number => Math.sign(value) * Math.pow(Math.abs(value), 1 / 3);

const applyUnaryCommand = (
  state: CalculatorState,
  commandId: Extract<CalculatorCommandId, "reciprocal" | "factorial" | "square" | "cube" | "sqrt" | "cuberoot">,
  numberBase: KCalcNumberBase,
): CalculatorState => {
  const value = getCurrentEntryNumber(state);

  if (value === null) {
    return createErrorState(state.memoryValue, state.statisticsValues, state.resultHistory);
  }

  let result: number | null;

  switch (commandId) {
    case "reciprocal":
      result = value === 0 ? null : 1 / value;
      break;
    case "factorial":
      result = applyFactorial(value);
      break;
    case "square":
      result = value * value;
      break;
    case "cube":
      result = value * value * value;
      break;
    case "sqrt":
      result = value < 0 ? null : Math.sqrt(value);
      break;
    case "cuberoot":
      result = applyCubeRoot(value);
      break;
  }

  return result === null || !isValidCalculatorResult(result)
    ? createErrorState(state.memoryValue, state.statisticsValues, state.resultHistory)
    : displayCommandResult(state, result, numberBase);
};

const applyScientificCommand = (
  state: CalculatorState,
  commandId: KCalcScientificCommandId,
  angleUnit: KCalcAngleUnit,
  numberBase: KCalcNumberBase,
): CalculatorState => {
  const value = getCurrentEntryNumber(state);

  if (value === null) {
    return createErrorState(state.memoryValue, state.statisticsValues, state.resultHistory);
  }

  const result = evaluateKCalcScientificCommand(commandId, value, angleUnit);

  return result === null ? createErrorState(state.memoryValue, state.statisticsValues, state.resultHistory) : displayCommandResult(state, result, numberBase);
};

const applyPercent = (state: CalculatorState, numberBase: KCalcNumberBase): CalculatorState => {
  if (state.pendingOperator === null || state.accumulator === null || (state.waitingForOperand && !state.hasCurrentOperand)) {
    return state;
  }

  const left = state.accumulator;
  const right = getCurrentEntryNumber(state);

  if (right === null) {
    return createErrorState(state.memoryValue, state.statisticsValues, state.resultHistory);
  }
  let result: number | null;

  if (state.pendingOperator === "+" || state.pendingOperator === "-") {
    result = applyCalculatorBinaryOperation(left, state.pendingOperator, left * right / 100);
  } else if (state.pendingOperator === "*") {
    result = left * right / 100;
  } else if (state.pendingOperator === "/") {
    result = right === 0 ? null : left / right * 100;
  } else {
    result = applyCalculatorBinaryOperation(left, state.pendingOperator, right);
  }

  return result === null || !isValidCalculatorResult(result)
    ? createErrorState(state.memoryValue, state.statisticsValues, state.resultHistory)
    : displayResult(result, state.memoryValue, state.statisticsValues, state.resultHistory, numberBase);
};

const finalizeLogicPendingOperation = (state: CalculatorState, numberBase: KCalcNumberBase): CalculatorState => {
  if (
    state.pendingLogicOperator === null
    || state.logicPendingOperand === null
    || (state.waitingForOperand && !state.hasCurrentOperand)
  ) {
    return state;
  }

  const rightOperand = getCurrentLogicOperand(state);

  if (rightOperand === null) {
    return createErrorState(state.memoryValue, state.statisticsValues, state.resultHistory);
  }

  const hasFraction = state.logicPendingOperand.kind === "fraction" || rightOperand.kind === "fraction";
  const isBooleanOperation = state.pendingLogicOperator === "logic-and"
    || state.pendingLogicOperator === "logic-or"
    || state.pendingLogicOperator === "logic-xor";

  if (hasFraction && isBooleanOperation) {
    return displayExactLogicResult(0n, state.memoryValue, state.statisticsValues, state.resultHistory, numberBase);
  }

  if (hasFraction || state.logicPendingOperand.kind !== "exact" || rightOperand.kind !== "exact") {
    return createErrorState(state.memoryValue, state.statisticsValues, state.resultHistory);
  }

  const result = evaluateKCalcLogicBinaryCommand(
    state.pendingLogicOperator,
    state.logicPendingOperand.value,
    rightOperand.value,
  );

  return result === null
    ? createErrorState(state.memoryValue, state.statisticsValues, state.resultHistory)
    : displayExactLogicResult(result, state.memoryValue, state.statisticsValues, state.resultHistory, numberBase);
};

const finalizeNumberPendingOperation = (state: CalculatorState, numberBase: KCalcNumberBase): CalculatorState => {
  if (state.pendingOperator === null || state.accumulator === null || (state.waitingForOperand && !state.hasCurrentOperand)) {
    return state;
  }

  const right = getCurrentEntryNumber(state);

  if (right === null) {
    return createErrorState(state.memoryValue, state.statisticsValues, state.resultHistory);
  }

  const result = applyCalculatorBinaryOperation(state.accumulator, state.pendingOperator, right);

  return result === null || !isValidCalculatorResult(result)
    ? createErrorState(state.memoryValue, state.statisticsValues, state.resultHistory)
    : displayResult(result, state.memoryValue, state.statisticsValues, state.resultHistory, numberBase);
};

const finalizeCompletedPendingOperation = (state: CalculatorState, numberBase: KCalcNumberBase): CalculatorState =>
  state.pendingLogicOperator === null
    ? finalizeNumberPendingOperation(state, numberBase)
    : finalizeLogicPendingOperation(state, numberBase);

const hasCompletedPendingOperation = (state: CalculatorState): boolean =>
  hasPendingOperation(state) && !(state.waitingForOperand && !state.hasCurrentOperand);

const applyLogicBinaryCommand = (
  state: CalculatorState,
  commandId: KCalcLogicBinaryCommandId,
  numberBase: KCalcNumberBase,
): CalculatorState => {
  if (state.pendingLogicOperator !== null) {
    if (state.waitingForOperand && !state.hasCurrentOperand) {
      return { ...state, pendingLogicOperator: commandId };
    }

    const finalized = finalizeCompletedPendingOperation(state, numberBase);
    return finalized.error ? finalized : applyLogicBinaryCommand(finalized, commandId, numberBase);
  }

  if (state.pendingOperator !== null && !(state.waitingForOperand && !state.hasCurrentOperand)) {
    const finalized = finalizeCompletedPendingOperation(state, numberBase);
    return finalized.error ? finalized : applyLogicBinaryCommand(finalized, commandId, numberBase);
  }

  const operand = getCurrentLogicOperand(state);

  if (operand === null || (operand.kind === "fraction" && (commandId === "logic-left-shift" || commandId === "logic-right-shift"))) {
    return createErrorState(state.memoryValue, state.statisticsValues, state.resultHistory);
  }

  return {
    ...state,
    accumulator: null,
    pendingOperator: null,
    logicPendingOperand: operand,
    pendingLogicOperator: commandId,
    waitingForOperand: true,
    hasCurrentOperand: false,
  };
};

const applyLogicComplement = (state: CalculatorState, numberBase: KCalcNumberBase): CalculatorState => {
  const operand = getCurrentLogicOperand(state);

  if (operand === null || operand.kind !== "exact") {
    return createErrorState(state.memoryValue, state.statisticsValues, state.resultHistory);
  }

  return displayExactLogicCommandResult(state, evaluateKCalcLogicComplement(operand.value), numberBase);
};

const commitCurrentEntryForMemoryCommand = (state: CalculatorState, numberBase: KCalcNumberBase): CalculatorState => {
  const finalized = finalizeCompletedPendingOperation(state, numberBase);

  if (finalized.error || hasPendingOperation(finalized)) {
    return finalized;
  }

  return {
    ...finalized,
    waitingForOperand: true,
    hasCurrentOperand: false,
  };
};

const applyMemoryCommand = (
  state: CalculatorState,
  commandId: Extract<CalculatorCommandId, "memory-recall" | "memory-store" | "memory-add" | "memory-subtract" | "memory-clear">,
  numberBase: KCalcNumberBase,
): CalculatorState => {
  if (commandId === "memory-recall") {
    if (state.memoryValue === null) {
      return state;
    }

    const presentation = formatCalculatorValueForBase(state.memoryValue, numberBase);
    return presentation === null ? createErrorState(state.memoryValue, state.statisticsValues, state.resultHistory) : {
      ...state,
      ...presentation,
      waitingForOperand: false,
      hasCurrentOperand: hasPendingOperation(state),
    };
  }

  if (commandId === "memory-clear") {
    return state.memoryValue === null ? state : { ...state, memoryValue: null };
  }

  const committed = commitCurrentEntryForMemoryCommand(state, numberBase);

  if (committed.error) {
    return committed;
  }

  const currentValue = getCurrentEntryNumber(committed);

  if (currentValue === null) {
    return createErrorState(committed.memoryValue, committed.statisticsValues, committed.resultHistory);
  }
  const nextMemoryValue = commandId === "memory-store"
    ? currentValue
    : (committed.memoryValue ?? 0) + (commandId === "memory-add" ? currentValue : -currentValue);

  const completed = appendCurrentKCalcResultToHistory(committed);

  return isValidCalculatorResult(nextMemoryValue)
    ? { ...completed, memoryValue: nextMemoryValue }
    : createErrorState(committed.memoryValue, committed.statisticsValues, committed.resultHistory);
};

const applyStatisticsCommand = (
  state: CalculatorState,
  commandId: Extract<CalculatorCommandId, "stat-enter-data" | "stat-delete-data" | "stat-clear" | "stat-clear-inverse-noop">,
  numberBase: KCalcNumberBase,
): CalculatorState => {
  if (commandId === "stat-clear-inverse-noop") {
    return state;
  }

  if (commandId === "stat-clear") {
    return state.statisticsValues.length === 0 ? state : { ...state, statisticsValues: [] };
  }

  if (commandId === "stat-delete-data") {
    if (state.statisticsValues.length === 0) {
      return state;
    }

    const presentation = formatCalculatorValueForBase(0, numberBase);

    if (presentation === null) {
      return createErrorState(state.memoryValue, state.statisticsValues, state.resultHistory);
    }

    return {
      ...state,
      ...presentation,
      waitingForOperand: true,
      hasCurrentOperand: false,
      error: false,
      statisticsValues: state.statisticsValues.slice(0, -1),
    };
  }

  const currentValue = getCurrentEntryNumber(state);

  if (currentValue === null) {
    return createErrorState(state.memoryValue, state.statisticsValues, state.resultHistory);
  }

  const statisticsValues = [...state.statisticsValues, currentValue];
  const presentation = formatCalculatorValueForBase(statisticsValues.length, numberBase);

  if (presentation === null) {
    return createErrorState(state.memoryValue, state.statisticsValues, state.resultHistory);
  }

  return {
    ...state,
    ...presentation,
    waitingForOperand: true,
    hasCurrentOperand: hasPendingOperation(state) && !state.waitingForOperand,
    error: false,
    statisticsValues,
  };
};

const applyStatisticsQueryCommand = (
  state: CalculatorState,
  commandId: KCalcStatisticsQueryCommandId,
  numberBase: KCalcNumberBase,
): CalculatorState => {
  const result = evaluateKCalcStatisticsQuery(commandId, state.statisticsValues);

  return result === null
    ? createErrorState(state.memoryValue, state.statisticsValues, state.resultHistory)
    : displayCommandResult(state, result, numberBase);
};

const applyConstantRecall = (
  state: CalculatorState,
  value: KCalcConstantValue | undefined,
  numberBase: KCalcNumberBase,
): CalculatorState => {
  if (value === undefined) {
    return state;
  }

  const presentation = value.kind === "integer"
    ? formatExactIntegerForBase(value.value, numberBase)
    : formatCalculatorValueForBase(value.value, numberBase);

  if (presentation === null) {
    return createErrorState(state.memoryValue, state.statisticsValues, state.resultHistory);
  }

  return {
    ...state,
    ...presentation,
    waitingForOperand: true,
    hasCurrentOperand: hasPendingOperation(state),
    error: false,
  };
};

const applyBuiltInConstantRecall = (
  state: CalculatorState,
  value: number | undefined,
  numberBase: KCalcNumberBase,
): CalculatorState => {
  if (value === undefined || !Number.isFinite(value)) {
    return createErrorState(state.memoryValue, state.statisticsValues, state.resultHistory);
  }

  const presentation = formatCalculatorValueForBase(value, numberBase);

  if (presentation === null) {
    return createErrorState(state.memoryValue, state.statisticsValues, state.resultHistory);
  }

  return {
    ...state,
    ...presentation,
    waitingForOperand: true,
    hasCurrentOperand: hasPendingOperation(state),
    error: false,
  };
};

const applyConstantStore = (state: CalculatorState, numberBase: KCalcNumberBase): CalculatorState => {
  const value = getKCalcConstantValueFromCalculatorState(state);

  if (value === null) {
    return createErrorState(state.memoryValue, state.statisticsValues, state.resultHistory);
  }

  const presentation = value.kind === "integer"
    ? formatExactIntegerForBase(value.value, numberBase)
    : formatCalculatorValueForBase(value.value, numberBase);

  if (presentation === null) {
    return createErrorState(state.memoryValue, state.statisticsValues, state.resultHistory);
  }

  return {
    ...state,
    ...presentation,
    waitingForOperand: true,
    hasCurrentOperand: hasPendingOperation(state) && !state.waitingForOperand,
    error: false,
  };
};

export function getCalculatorActionForCommand(
  commandId: string,
  context: CalculatorCommandContext = { angleUnit: "degrees", numberBase: "decimal" },
): CalculatorAction | null {
  if (isKCalcLogicCommand(commandId)) {
    return { type: "command", commandId, context };
  }

  if (isKCalcScientificCommand(commandId)) {
    return { type: "command", commandId, context };
  }

  if (isKCalcStatisticsQueryCommand(commandId)) {
    return { type: "command", commandId, context };
  }

  if (isKCalcConstantRecallCommand(commandId) || isKCalcConstantStoreCommand(commandId)) {
    return { type: "command", commandId, context };
  }

  switch (commandId) {
    case "edit-undo":
      return { type: "history-undo", numberBase: context.numberBase };
    case "edit-redo":
      return { type: "history-redo", numberBase: context.numberBase };
    case "edit-copy":
      return { type: "clipboard-copy" };
    case "edit-cut":
      return { type: "clipboard-cut" };
    case "edit-paste":
      return context.clipboardText === undefined
        ? null
        : { type: "clipboard-paste", text: context.clipboardText, numberBase: context.numberBase };
    case "mod":
    case "int-div":
    case "reciprocal":
    case "factorial":
    case "square":
    case "cube":
    case "sqrt":
    case "cuberoot":
    case "power":
    case "inverse-power":
    case "memory-recall":
    case "memory-store":
    case "memory-add":
    case "memory-subtract":
    case "memory-clear":
    case "stat-enter-data":
    case "stat-delete-data":
    case "stat-clear":
    case "stat-clear-inverse-noop":
    case "built-in-constant-recall":
    case "percent":
      return { type: "command", commandId, context };
    default:
      return null;
  }
}

const isCalculatorCommandReducerAvailable = (state: CalculatorState, commandId: string): boolean => {
  if (getCalculatorActionForCommand(commandId) === null) {
    return false;
  }

  if (isKCalcConstantRecallCommand(commandId) || commandId === "built-in-constant-recall") {
    return true;
  }

  if (commandId === "edit-undo") {
    return canUndoKCalcResultHistory(state.resultHistory);
  }

  if (commandId === "edit-redo") {
    return canRedoKCalcResultHistory(state.resultHistory);
  }

  if (state.error) {
    return false;
  }

  if (commandId === "memory-recall") {
    return state.memoryValue !== null;
  }

  return commandId !== "stat-delete-data" || state.statisticsValues.length > 0;
};

const commandRequiresNumberOperand = (commandId: string): boolean =>
  isKCalcScientificCommand(commandId)
  || commandId === "mod"
  || commandId === "int-div"
  || commandId === "reciprocal"
  || commandId === "factorial"
  || commandId === "square"
  || commandId === "cube"
  || commandId === "sqrt"
  || commandId === "cuberoot"
  || commandId === "power"
  || commandId === "inverse-power"
  || commandId === "memory-store"
  || commandId === "memory-add"
  || commandId === "memory-subtract"
  || commandId === "stat-enter-data"
  || commandId === "percent";

export function isCalculatorCommandEnabled(state: CalculatorState, commandId: string): boolean {
  return isCalculatorCommandReducerAvailable(state, commandId)
    && (!commandRequiresNumberOperand(commandId) || canCurrentCalculatorValueEnterNumberDomain(state));
}

export const isCalculatorActionEnabled = (state: CalculatorState, action: CalculatorAction): boolean => {
  if (action.type === "command") {
    return isCalculatorCommandEnabled(state, action.commandId);
  }

  if (action.type === "operator") {
    return !state.error && canCurrentCalculatorValueEnterNumberDomain(state);
  }

  if (action.type === "equals") {
    return !state.error && (state.pendingLogicOperator !== null || state.pendingOperator === null || canCurrentCalculatorValueEnterNumberDomain(state));
  }

  if (action.type === "history-undo") {
    return canUndoKCalcResultHistory(state.resultHistory);
  }

  if (action.type === "history-redo") {
    return canRedoKCalcResultHistory(state.resultHistory);
  }

  return true;
};

export function reduceCalculator(state: CalculatorState, action: CalculatorAction): CalculatorState {
  if (action.type === "clear") {
    return createArithmeticInitialState(state.memoryValue, state.statisticsValues, state.resultHistory);
  }

  if (action.type === "set-base") {
    return createRadixDisplayState(state, action.numberBase);
  }

  if (action.type === "history-undo") {
    const navigation = undoKCalcResultHistory(state.resultHistory);
    return navigation === null
      ? state
      : displayKCalcResultHistoryValue(state, navigation.value, navigation.history, getActionNumberBase(action.numberBase));
  }

  if (action.type === "history-redo") {
    const navigation = redoKCalcResultHistory(state.resultHistory);
    return navigation === null
      ? state
      : displayKCalcResultHistoryValue(state, navigation.value, navigation.history, getActionNumberBase(action.numberBase));
  }

  if (action.type === "clipboard-copy") {
    return state;
  }

  if (action.type === "clipboard-cut") {
    if (state.error) {
      return state;
    }

    return {
      ...state,
      display: "0",
      radixEntry: null,
      waitingForOperand: hasPendingOperation(state),
      hasCurrentOperand: hasPendingOperation(state),
    };
  }

  if (action.type === "clipboard-paste") {
    const parsed = parseKCalcClipboardText(action.text, getActionNumberBase(action.numberBase));

    return parsed === null
      ? createErrorState(state.memoryValue, state.statisticsValues, state.resultHistory)
      : displayClipboardValue(state, parsed, getActionNumberBase(action.numberBase));
  }

  if (action.type === "digit") {
    const numberBase = getActionNumberBase(action.numberBase);
    const radix = getKCalcRadix(numberBase);

    if (!isKCalcRadixDigit(action.digit, radix)) {
      return state;
    }

    const digit = action.digit.toUpperCase();
    const useRadixEntry = numberBase !== "decimal" || state.radixEntry !== null;

    if (state.error) {
      if (useRadixEntry) {
        const radixEntry = createKCalcRadixEntry(radix, false, digit)!;
        return {
          ...createArithmeticInitialState(state.memoryValue, state.statisticsValues, state.resultHistory),
          display: radixEntry.digits,
          radixEntry,
          hasCurrentOperand: false,
        };
      }

      return {
        ...createArithmeticInitialState(state.memoryValue, state.statisticsValues, state.resultHistory),
        display: digit === "0" ? "0" : digit,
        hasCurrentOperand: false,
      };
    }

    if (useRadixEntry) {
      const radixEntry = state.waitingForOperand || state.radixEntry === null
        ? createKCalcRadixEntry(radix, false, digit)!
        : appendKCalcRadixDigit(state.radixEntry, digit);

      if (radixEntry === null || (!state.waitingForOperand && state.radixEntry !== null && state.radixEntry.digits.length >= MAX_CALCULATOR_RADIX_DIGITS)) {
        return state;
      }

      return {
        ...state,
        display: `${radixEntry.negative ? "-" : ""}${radixEntry.digits}`,
        radixEntry,
        waitingForOperand: false,
        hasCurrentOperand: hasPendingOperation(state),
      };
    }

    if (state.waitingForOperand) {
      return {
        ...state,
        display: digit === "0" ? "0" : digit,
        waitingForOperand: false,
        hasCurrentOperand: hasPendingOperation(state),
      };
    }

    if (hasMaximumDigits(state.display)) {
      return state;
    }

    if (state.display === "0") {
      return { ...replaceEntry(state, digit === "0" ? "0" : digit), hasCurrentOperand: hasPendingOperation(state) };
    }

    if (state.display === "-0") {
      return { ...replaceEntry(state, digit === "0" ? "-0" : `-${digit}`), hasCurrentOperand: hasPendingOperation(state) };
    }

    return { ...replaceEntry(state, `${state.display}${digit}`), hasCurrentOperand: hasPendingOperation(state) };
  }

  if (action.type === "decimal") {
    if (getActionNumberBase(action.numberBase) !== "decimal" || state.radixEntry !== null || state.error || state.display.includes(".")) {
      return state;
    }

    if (state.waitingForOperand) {
      return {
        ...state,
        display: "0.",
        waitingForOperand: false,
        hasCurrentOperand: hasPendingOperation(state),
      };
    }

    return { ...replaceEntry(state, `${state.display}.`), hasCurrentOperand: hasPendingOperation(state) };
  }

  if (action.type === "toggle-sign") {
    if (state.error || state.display === "0" || state.display === "0.") {
      return state;
    }

    if (state.radixEntry !== null) {
      const radixEntry = toggleKCalcRadixEntrySign(state.radixEntry);
      return {
        ...state,
        display: `${radixEntry.negative ? "-" : ""}${radixEntry.digits}`,
        radixEntry,
      };
    }

    return {
      ...state,
      display: state.display.startsWith("-") ? state.display.slice(1) : `-${state.display}`,
    };
  }

  if (action.type === "backspace") {
    if (state.error || state.waitingForOperand) {
      return state;
    }

    if (state.radixEntry !== null) {
      const radixEntry = removeKCalcRadixDigit(state.radixEntry);
      return {
        ...state,
        display: `${radixEntry.negative ? "-" : ""}${radixEntry.digits}`,
        radixEntry,
      };
    }

    const nextDisplay = state.display.slice(0, -1);

    return replaceEntry(state, nextDisplay === "" || nextDisplay === "-" ? "0" : nextDisplay);
  }

  if (action.type === "clear-entry") {
    if (state.error) {
      return createArithmeticInitialState(state.memoryValue, state.statisticsValues, state.resultHistory);
    }

    return {
      ...state,
      display: "0",
      radixEntry: null,
      waitingForOperand: hasPendingOperation(state),
      hasCurrentOperand: false,
    };
  }

  if (action.type === "command" && isKCalcConstantRecallCommand(action.commandId)) {
    return applyConstantRecall(
      state,
      action.context?.constantValue,
      getActionNumberBase(action.context?.numberBase),
    );
  }

  if (action.type === "command" && action.commandId === "built-in-constant-recall") {
    return applyBuiltInConstantRecall(
      state,
      action.context?.builtInConstantValue,
      getActionNumberBase(action.context?.numberBase),
    );
  }

  if (state.error) {
    return state;
  }

  if (action.type === "operator") {
    return applyCalculatorOperator(state, action.operator, getActionNumberBase(action.numberBase));
  }

  if (action.type === "equals") {
    if (!hasCompletedPendingOperation(state)) {
      return state;
    }

    const completed = finalizeCompletedPendingOperation(state, getActionNumberBase(action.numberBase));
    return completed.error ? completed : appendCurrentKCalcResultToHistory(completed);
  }

  if (action.type === "command") {
    if (!isCalculatorCommandReducerAvailable(state, action.commandId)) {
      return state;
    }

    if (isKCalcScientificCommand(action.commandId)) {
      return applyScientificCommand(
        state,
        action.commandId,
        action.context?.angleUnit ?? "degrees",
        getActionNumberBase(action.context?.numberBase),
      );
    }

    if (isKCalcStatisticsQueryCommand(action.commandId)) {
      return applyStatisticsQueryCommand(state, action.commandId, getActionNumberBase(action.context?.numberBase));
    }

    if (isKCalcConstantStoreCommand(action.commandId)) {
      return applyConstantStore(state, getActionNumberBase(action.context?.numberBase));
    }

    if (isKCalcLogicBinaryCommand(action.commandId)) {
      return applyLogicBinaryCommand(state, action.commandId, getActionNumberBase(action.context?.numberBase));
    }

    if (action.commandId === "logic-complement") {
      return applyLogicComplement(state, getActionNumberBase(action.context?.numberBase));
    }

    switch (action.commandId) {
      case "mod":
      case "int-div":
      case "power":
      case "inverse-power":
        return applyCalculatorOperator(state, action.commandId, getActionNumberBase(action.context?.numberBase));
      case "reciprocal":
      case "factorial":
      case "square":
      case "cube":
      case "sqrt":
      case "cuberoot":
        return applyUnaryCommand(state, action.commandId, getActionNumberBase(action.context?.numberBase));
      case "memory-recall":
      case "memory-store":
      case "memory-add":
      case "memory-subtract":
      case "memory-clear":
        return applyMemoryCommand(state, action.commandId, getActionNumberBase(action.context?.numberBase));
      case "stat-enter-data":
      case "stat-delete-data":
      case "stat-clear":
      case "stat-clear-inverse-noop":
        return applyStatisticsCommand(state, action.commandId, getActionNumberBase(action.context?.numberBase));
      case "percent":
        return applyPercent(state, getActionNumberBase(action.context?.numberBase));
    }
  }

  return state;
}

export function getCalculatorActionForKey(key: string, numberBase?: KCalcNumberBase): CalculatorAction | null {
  const withNumberBase = <T extends CalculatorAction>(action: T): T | CalculatorAction => numberBase === undefined
    ? action
    : { ...action, numberBase } as CalculatorAction;

  if (/^[0-9]$/.test(key)) {
    return withNumberBase({ type: "digit", digit: key });
  }

  if (key === ".") {
    return withNumberBase({ type: "decimal" });
  }

  if (key === "+" || key === "-" || key === "*" || key === "/") {
    return withNumberBase({ type: "operator", operator: key });
  }

  if (key === "=" || key === "Enter") {
    return withNumberBase({ type: "equals" });
  }

  if (key === "Escape") {
    return { type: "clear" };
  }

  if (key === "Backspace") {
    return { type: "backspace" };
  }

  if (key === "Delete") {
    return { type: "clear-entry" };
  }

  return null;
}
