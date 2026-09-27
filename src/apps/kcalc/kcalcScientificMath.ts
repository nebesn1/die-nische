import type { KCalcAngleUnit } from "./kcalcModeState";

export type KCalcScientificCommandId =
  | "sin"
  | "asin"
  | "sinh"
  | "asinh"
  | "cos"
  | "acos"
  | "cosh"
  | "acosh"
  | "tan"
  | "atan"
  | "tanh"
  | "atanh"
  | "log10"
  | "pow10"
  | "ln"
  | "exp";

type CircularComponents = Readonly<{
  sine: number;
  cosine: number;
}>;

const degreesPerTurn = 360;
const gradiansPerTurn = 400;

const isFiniteResult = (value: number): number | null => Number.isFinite(value) ? value : null;

const normalizeTurn = (value: number, fullTurn: number): number => ((value % fullTurn) + fullTurn) % fullTurn;

const getExactQuadrant = (value: number, fullTurn: number): number | null => {
  if (!Number.isInteger(value)) {
    return null;
  }

  const quadrantSize = fullTurn / 4;
  const normalized = normalizeTurn(value, fullTurn);

  return normalized % quadrantSize === 0 ? normalized / quadrantSize : null;
};

const exactCircularComponents = (quadrant: number): CircularComponents => {
  switch (quadrant) {
    case 0:
      return { sine: 0, cosine: 1 };
    case 1:
      return { sine: 1, cosine: 0 };
    case 2:
      return { sine: 0, cosine: -1 };
    default:
      return { sine: -1, cosine: 0 };
  }
};

export function convertKCalcAngleToRadians(value: number, angleUnit: KCalcAngleUnit): number {
  if (angleUnit === "degrees") {
    return value * Math.PI / 180;
  }

  return angleUnit === "gradians" ? value * Math.PI / 200 : value;
}

export function convertKCalcRadiansToAngle(value: number, angleUnit: KCalcAngleUnit): number {
  if (angleUnit === "degrees") {
    return value * 180 / Math.PI;
  }

  return angleUnit === "gradians" ? value * 200 / Math.PI : value;
}

export function getKCalcCircularComponents(value: number, angleUnit: KCalcAngleUnit): CircularComponents | null {
  if (!Number.isFinite(value)) {
    return null;
  }

  if (angleUnit === "degrees" || angleUnit === "gradians") {
    const quadrant = getExactQuadrant(value, angleUnit === "degrees" ? degreesPerTurn : gradiansPerTurn);

    if (quadrant !== null) {
      return exactCircularComponents(quadrant);
    }
  }

  const radians = convertKCalcAngleToRadians(value, angleUnit);
  const sine = Math.sin(radians);
  const cosine = Math.cos(radians);

  return Number.isFinite(sine) && Number.isFinite(cosine) ? { sine, cosine } : null;
}

export function isKCalcScientificCommand(commandId: string): commandId is KCalcScientificCommandId {
  return [
    "sin", "asin", "sinh", "asinh", "cos", "acos", "cosh", "acosh",
    "tan", "atan", "tanh", "atanh", "log10", "pow10", "ln", "exp",
  ].includes(commandId);
}

export function evaluateKCalcScientificCommand(
  commandId: KCalcScientificCommandId,
  value: number,
  angleUnit: KCalcAngleUnit,
): number | null {
  if (!Number.isFinite(value)) {
    return null;
  }

  const circular = getKCalcCircularComponents(value, angleUnit);

  switch (commandId) {
    case "sin":
      return circular?.sine ?? null;
    case "cos":
      return circular?.cosine ?? null;
    case "tan":
      return circular === null || circular.cosine === 0 ? null : isFiniteResult(circular.sine / circular.cosine);
    case "asin":
      return value < -1 || value > 1 ? null : isFiniteResult(convertKCalcRadiansToAngle(Math.asin(value), angleUnit));
    case "acos":
      return value < -1 || value > 1 ? null : isFiniteResult(convertKCalcRadiansToAngle(Math.acos(value), angleUnit));
    case "atan":
      return isFiniteResult(convertKCalcRadiansToAngle(Math.atan(value), angleUnit));
    case "sinh":
      return isFiniteResult(Math.sinh(value));
    case "cosh":
      return isFiniteResult(Math.cosh(value));
    case "tanh":
      return isFiniteResult(Math.tanh(value));
    case "asinh":
      return isFiniteResult(Math.asinh(value));
    case "acosh":
      return value < 1 ? null : isFiniteResult(Math.acosh(value));
    case "atanh":
      return value <= -1 || value >= 1 ? null : isFiniteResult(Math.atanh(value));
    case "log10":
      return value <= 0 ? null : isFiniteResult(Math.log10(value));
    case "ln":
      return value <= 0 ? null : isFiniteResult(Math.log(value));
    case "pow10":
      return isFiniteResult(Math.pow(10, value));
    case "exp":
      return isFiniteResult(Math.exp(value));
  }
}
