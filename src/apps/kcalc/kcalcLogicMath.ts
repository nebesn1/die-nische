export const MAX_KCALC_LOGIC_SHIFT_BITS = 100_000;

export type KCalcLogicBinaryCommandId =
  | "logic-and"
  | "logic-or"
  | "logic-xor"
  | "logic-left-shift"
  | "logic-right-shift";

export type KCalcLogicCommandId = KCalcLogicBinaryCommandId | "logic-complement";

const getShiftMagnitude = (shiftCount: bigint): number | null => {
  const magnitude = shiftCount < 0n ? -shiftCount : shiftCount;

  return magnitude > BigInt(MAX_KCALC_LOGIC_SHIFT_BITS) ? null : Number(magnitude);
};

const powerOfTwo = (shiftCount: number): bigint => 2n ** BigInt(shiftCount);

export const isKCalcLogicCommand = (commandId: string): commandId is KCalcLogicCommandId =>
  commandId === "logic-and"
  || commandId === "logic-or"
  || commandId === "logic-xor"
  || commandId === "logic-left-shift"
  || commandId === "logic-right-shift"
  || commandId === "logic-complement";

export const isKCalcLogicBinaryCommand = (commandId: string): commandId is KCalcLogicBinaryCommandId =>
  commandId === "logic-and"
  || commandId === "logic-or"
  || commandId === "logic-xor"
  || commandId === "logic-left-shift"
  || commandId === "logic-right-shift";

export const evaluateKCalcLogicComplement = (value: bigint): bigint => -value - 1n;

export const evaluateKCalcLogicBinaryCommand = (
  commandId: KCalcLogicBinaryCommandId,
  left: bigint,
  right: bigint,
): bigint | null => {
  if (commandId === "logic-and") {
    return left & right;
  }

  if (commandId === "logic-or") {
    return left | right;
  }

  if (commandId === "logic-xor") {
    return left ^ right;
  }

  const shiftMagnitude = getShiftMagnitude(right);

  if (shiftMagnitude === null) {
    return null;
  }

  const multiplier = powerOfTwo(shiftMagnitude);
  const shiftsLeft = commandId === "logic-left-shift" ? right >= 0n : right < 0n;

  return shiftsLeft ? left * multiplier : left / multiplier;
};
