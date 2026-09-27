import { describe, expect, it } from "vitest";
import { evaluateKCalcStatisticsQuery, isKCalcStatisticsQueryCommand } from "./kcalcStatisticsMath";

describe("KCalc statistics query evaluator", () => {
  it("recognizes only the Statistics query command identities", () => {
    expect(isKCalcStatisticsQueryCommand("stat-count")).toBe(true);
    expect(isKCalcStatisticsQueryCommand("stat-median")).toBe(true);
    expect(isKCalcStatisticsQueryCommand("stat-enter-data")).toBe(false);
  });

  it("evaluates count, sum, squares, and mean with the KDE3 empty-data contract", () => {
    expect(evaluateKCalcStatisticsQuery("stat-count", [])).toBe(0);
    expect(evaluateKCalcStatisticsQuery("stat-sum", [])).toBe(0);
    expect(evaluateKCalcStatisticsQuery("stat-sum-squares", [])).toBe(0);
    expect(evaluateKCalcStatisticsQuery("stat-mean", [])).toBeNull();
    expect(evaluateKCalcStatisticsQuery("stat-count", [1, 2, 3])).toBe(3);
    expect(evaluateKCalcStatisticsQuery("stat-sum", [1, 2, 3])).toBe(6);
    expect(evaluateKCalcStatisticsQuery("stat-sum-squares", [1, 2, 3])).toBe(14);
    expect(evaluateKCalcStatisticsQuery("stat-mean", [1, 2, 3, 4])).toBe(2.5);
  });

  it("uses mean-centered sample and population standard deviations", () => {
    expect(evaluateKCalcStatisticsQuery("stat-sample-standard-deviation", [])).toBeNull();
    expect(evaluateKCalcStatisticsQuery("stat-sample-standard-deviation", [5])).toBeNull();
    expect(evaluateKCalcStatisticsQuery("stat-population-standard-deviation", [])).toBeNull();
    expect(evaluateKCalcStatisticsQuery("stat-population-standard-deviation", [5])).toBe(0);
    expect(evaluateKCalcStatisticsQuery("stat-sample-standard-deviation", [1, 2, 3])).toBeCloseTo(1);
    expect(evaluateKCalcStatisticsQuery("stat-population-standard-deviation", [1, 2, 3])).toBeCloseTo(Math.sqrt(2 / 3));
    expect(evaluateKCalcStatisticsQuery("stat-sample-standard-deviation", [1, 2, 3, 4])).toBeCloseTo(Math.sqrt(5 / 3));
    expect(evaluateKCalcStatisticsQuery("stat-population-standard-deviation", [1, 2, 3, 4])).toBeCloseTo(Math.sqrt(1.25));
  });

  it("calculates a numeric copy-sort median without mutating insertion order", () => {
    const values = [5, 1, 9, 3];

    expect(evaluateKCalcStatisticsQuery("stat-median", [])).toBeNull();
    expect(evaluateKCalcStatisticsQuery("stat-median", [5])).toBe(5);
    expect(evaluateKCalcStatisticsQuery("stat-median", [1, 2, 3])).toBe(2);
    expect(evaluateKCalcStatisticsQuery("stat-median", [1, 2, 3, 4])).toBe(2.5);
    expect(evaluateKCalcStatisticsQuery("stat-median", values)).toBe(4);
    expect(values).toEqual([5, 1, 9, 3]);
  });
});
