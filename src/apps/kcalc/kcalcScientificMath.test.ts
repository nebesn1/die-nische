import { describe, expect, it } from "vitest";
import {
  convertKCalcAngleToRadians,
  convertKCalcRadiansToAngle,
  evaluateKCalcScientificCommand,
  getKCalcCircularComponents,
} from "./kcalcScientificMath";

describe("KCalc scientific angle conversion", () => {
  it("converts Degrees and Gradians to and from radians", () => {
    expect(convertKCalcAngleToRadians(180, "degrees")).toBeCloseTo(Math.PI);
    expect(convertKCalcAngleToRadians(200, "gradians")).toBeCloseTo(Math.PI);
    expect(convertKCalcRadiansToAngle(Math.PI / 2, "degrees")).toBeCloseTo(90);
    expect(convertKCalcRadiansToAngle(Math.PI / 2, "gradians")).toBeCloseTo(100);
  });

  it("normalizes exact Degree and Gradian quadrants without floating-point residue", () => {
    expect(getKCalcCircularComponents(0, "degrees")).toEqual({ sine: 0, cosine: 1 });
    expect(getKCalcCircularComponents(90, "degrees")).toEqual({ sine: 1, cosine: 0 });
    expect(getKCalcCircularComponents(180, "degrees")).toEqual({ sine: 0, cosine: -1 });
    expect(getKCalcCircularComponents(270, "degrees")).toEqual({ sine: -1, cosine: 0 });
    expect(getKCalcCircularComponents(-90, "degrees")).toEqual({ sine: -1, cosine: 0 });
    expect(getKCalcCircularComponents(450, "degrees")).toEqual({ sine: 1, cosine: 0 });
    expect(getKCalcCircularComponents(0, "gradians")).toEqual({ sine: 0, cosine: 1 });
    expect(getKCalcCircularComponents(100, "gradians")).toEqual({ sine: 1, cosine: 0 });
    expect(getKCalcCircularComponents(200, "gradians")).toEqual({ sine: 0, cosine: -1 });
    expect(getKCalcCircularComponents(300, "gradians")).toEqual({ sine: -1, cosine: 0 });
    expect(getKCalcCircularComponents(500, "gradians")).toEqual({ sine: 1, cosine: 0 });
  });
});

describe("KCalc finite scientific evaluation", () => {
  it("evaluates direct and inverse circular trigonometry with the captured Angle unit", () => {
    expect(evaluateKCalcScientificCommand("sin", 30, "degrees")).toBeCloseTo(0.5);
    expect(evaluateKCalcScientificCommand("cos", 60, "degrees")).toBeCloseTo(0.5);
    expect(evaluateKCalcScientificCommand("tan", 45, "degrees")).toBeCloseTo(1);
    expect(evaluateKCalcScientificCommand("sin", Math.PI / 6, "radians")).toBeCloseTo(0.5);
    expect(evaluateKCalcScientificCommand("sin", 100, "gradians")).toBe(1);
    expect(evaluateKCalcScientificCommand("asin", 0.5, "degrees")).toBeCloseTo(30);
    expect(evaluateKCalcScientificCommand("acos", 0.5, "degrees")).toBeCloseTo(60);
    expect(evaluateKCalcScientificCommand("atan", 1, "degrees")).toBeCloseTo(45);
    expect(evaluateKCalcScientificCommand("asin", 0.5, "radians")).toBeCloseTo(Math.PI / 6);
    expect(evaluateKCalcScientificCommand("asin", 1, "gradians")).toBe(100);
    expect(evaluateKCalcScientificCommand("asin", 2, "degrees")).toBeNull();
    expect(evaluateKCalcScientificCommand("acos", -2, "degrees")).toBeNull();
  });

  it("uses exact Degree and Gradian circular components to normalize tangent singularities as project failures", () => {
    expect(evaluateKCalcScientificCommand("tan", 90, "degrees")).toBeNull();
    expect(evaluateKCalcScientificCommand("tan", 100, "gradians")).toBeNull();
  });

  it("evaluates hyperbolic families independently from Angle", () => {
    expect(evaluateKCalcScientificCommand("sinh", 0, "degrees")).toBe(0);
    expect(evaluateKCalcScientificCommand("cosh", 0, "radians")).toBe(1);
    expect(evaluateKCalcScientificCommand("tanh", 0, "gradians")).toBe(0);
    expect(evaluateKCalcScientificCommand("sinh", 1, "degrees")).toBeCloseTo(Math.sinh(1));
    expect(evaluateKCalcScientificCommand("cosh", 1, "radians")).toBeCloseTo(Math.cosh(1));
    expect(evaluateKCalcScientificCommand("tanh", 1, "gradians")).toBeCloseTo(Math.tanh(1));
    expect(evaluateKCalcScientificCommand("asinh", 0, "degrees")).toBe(0);
    expect(evaluateKCalcScientificCommand("acosh", 1, "radians")).toBe(0);
    expect(evaluateKCalcScientificCommand("atanh", 0, "gradians")).toBe(0);
    expect(evaluateKCalcScientificCommand("sinh", 1, "degrees")).toBe(evaluateKCalcScientificCommand("sinh", 1, "radians"));
    expect(evaluateKCalcScientificCommand("asinh", 1, "degrees")).toBe(evaluateKCalcScientificCommand("asinh", 1, "gradians"));
    expect(evaluateKCalcScientificCommand("acosh", 0.5, "degrees")).toBeNull();
    expect(evaluateKCalcScientificCommand("atanh", 1, "degrees")).toBeNull();
    expect(evaluateKCalcScientificCommand("atanh", -1, "degrees")).toBeNull();
    expect(evaluateKCalcScientificCommand("atanh", 2, "degrees")).toBeNull();
  });

  it("keeps logarithmic and exponential results finite-only", () => {
    expect(evaluateKCalcScientificCommand("log10", 1, "degrees")).toBe(0);
    expect(evaluateKCalcScientificCommand("log10", 10, "degrees")).toBe(1);
    expect(evaluateKCalcScientificCommand("log10", 100, "degrees")).toBe(2);
    expect(evaluateKCalcScientificCommand("ln", 1, "degrees")).toBe(0);
    expect(evaluateKCalcScientificCommand("ln", Math.E, "degrees")).toBeCloseTo(1);
    expect(evaluateKCalcScientificCommand("log10", 0, "degrees")).toBeNull();
    expect(evaluateKCalcScientificCommand("log10", -1, "degrees")).toBeNull();
    expect(evaluateKCalcScientificCommand("ln", 0, "degrees")).toBeNull();
    expect(evaluateKCalcScientificCommand("ln", -1, "degrees")).toBeNull();
    expect(evaluateKCalcScientificCommand("pow10", 0, "degrees")).toBe(1);
    expect(evaluateKCalcScientificCommand("pow10", 2, "degrees")).toBe(100);
    expect(evaluateKCalcScientificCommand("pow10", -2, "degrees")).toBeCloseTo(0.01);
    expect(evaluateKCalcScientificCommand("exp", 0, "degrees")).toBe(1);
    expect(evaluateKCalcScientificCommand("exp", 1, "degrees")).toBeCloseTo(Math.E);
    expect(evaluateKCalcScientificCommand("pow10", 1000, "degrees")).toBeNull();
    expect(evaluateKCalcScientificCommand("exp", 1000, "degrees")).toBeNull();
  });
});
