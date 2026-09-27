export type KCalcStatisticsQueryCommandId =
  | "stat-count"
  | "stat-sum"
  | "stat-mean"
  | "stat-sum-squares"
  | "stat-sample-standard-deviation"
  | "stat-population-standard-deviation"
  | "stat-median";

const statisticsQueryCommandIds: readonly KCalcStatisticsQueryCommandId[] = [
  "stat-count",
  "stat-sum",
  "stat-mean",
  "stat-sum-squares",
  "stat-sample-standard-deviation",
  "stat-population-standard-deviation",
  "stat-median",
];

const isFiniteResult = (value: number): number | null => Number.isFinite(value) ? value : null;

const sumValues = (values: readonly number[]): number => values.reduce((total, value) => total + value, 0);

const meanValue = (values: readonly number[]): number | null => values.length === 0 ? null : sumValues(values) / values.length;

const standardDeviation = (values: readonly number[], denominator: number): number | null => {
  const mean = meanValue(values);

  if (mean === null || denominator <= 0) {
    return null;
  }

  const squaredDeviationTotal = values.reduce((total, value) => total + (value - mean) ** 2, 0);
  return isFiniteResult(Math.sqrt(squaredDeviationTotal / denominator));
};

const medianValue = (values: readonly number[]): number | null => {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 1
    ? sorted[middle]
    : isFiniteResult((sorted[middle - 1] + sorted[middle]) / 2);
};

export function isKCalcStatisticsQueryCommand(commandId: string): commandId is KCalcStatisticsQueryCommandId {
  return statisticsQueryCommandIds.includes(commandId as KCalcStatisticsQueryCommandId);
}

export function evaluateKCalcStatisticsQuery(
  commandId: KCalcStatisticsQueryCommandId,
  values: readonly number[],
): number | null {
  switch (commandId) {
    case "stat-count":
      return values.length;
    case "stat-sum":
      return isFiniteResult(sumValues(values));
    case "stat-mean":
      return isFiniteResult(meanValue(values) ?? Number.NaN);
    case "stat-sum-squares":
      return isFiniteResult(values.reduce((total, value) => total + value ** 2, 0));
    case "stat-sample-standard-deviation":
      return standardDeviation(values, values.length - 1);
    case "stat-population-standard-deviation":
      return standardDeviation(values, values.length);
    case "stat-median":
      return medianValue(values);
  }
}
