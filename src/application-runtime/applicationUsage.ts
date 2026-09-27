export interface ApplicationUsageRecord {
  readonly appId: string;
  readonly count: number;
  readonly lastUsedSequence: number;
}

export interface ApplicationUsageState {
  readonly recordsByAppId: Readonly<Record<string, ApplicationUsageRecord>>;
  readonly nextSequence: number;
}

export const MOST_USED_APPLICATION_LIMIT = 4;

export const initialApplicationUsageState: ApplicationUsageState = Object.freeze({
  recordsByAppId: Object.freeze({}),
  nextSequence: 1,
});

export function recordApplicationUse(state: ApplicationUsageState, appId: string): ApplicationUsageState {
  const previous = state.recordsByAppId[appId];
  const record: ApplicationUsageRecord = Object.freeze({
    appId,
    count: (previous?.count ?? 0) + 1,
    lastUsedSequence: state.nextSequence,
  });

  return {
    recordsByAppId: {
      ...state.recordsByAppId,
      [appId]: record,
    },
    nextSequence: state.nextSequence + 1,
  };
}

export function getMostUsedApplicationIds(
  state: ApplicationUsageState,
  eligibleAppIds: readonly string[],
  limit = MOST_USED_APPLICATION_LIMIT,
): readonly string[] {
  const eligibleIds = new Set(eligibleAppIds);

  return Object.values(state.recordsByAppId)
    .filter((record) => eligibleIds.has(record.appId))
    .sort((left, right) =>
      right.count - left.count
      || right.lastUsedSequence - left.lastUsedSequence
      || (left.appId < right.appId ? -1 : left.appId > right.appId ? 1 : 0),
    )
    .slice(0, limit)
    .map((record) => record.appId);
}
