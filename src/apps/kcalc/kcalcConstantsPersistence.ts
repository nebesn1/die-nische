import {
  createDefaultKCalcConstantRegistry,
  kcalcConstantSlotIds,
  type KCalcConstantRegistry,
  type KCalcConstantValue,
} from "./kcalcConstants";

export const KCALC_CONSTANTS_STORAGE_KEY = "kde3-web-desktop.kcalc.constants.v1";
export const KCALC_CONSTANTS_SCHEMA_VERSION = 1;

type PersistedKCalcConstantValue = Readonly<{
  kind: "number" | "integer";
  value: string;
}>;

export interface PersistedKCalcConstantsV1 {
  readonly version: typeof KCALC_CONSTANTS_SCHEMA_VERSION;
  readonly slots: readonly Readonly<{
    name: string;
    value: PersistedKCalcConstantValue;
  }>[];
}

type PersistedKCalcConstantsInvalidReason =
  | "malformed-json"
  | "invalid-root"
  | "invalid-version"
  | "missing-slots"
  | "invalid-slots";

export type ParsedKCalcConstants =
  | Readonly<{ type: "valid"; constants: KCalcConstantRegistry }>
  | Readonly<{ type: "invalid"; reason: PersistedKCalcConstantsInvalidReason }>
  | Readonly<{ type: "unsupported-version"; version: number }>;

export type KCalcConstantsLoadResult =
  | Readonly<{ type: "loaded"; constants: KCalcConstantRegistry }>
  | Readonly<{ type: "missing"; constants: KCalcConstantRegistry }>
  | Readonly<{ type: "invalid"; constants: KCalcConstantRegistry; reason: PersistedKCalcConstantsInvalidReason; corruptRecordRemoved: boolean }>
  | Readonly<{ type: "unsupported-version"; constants: KCalcConstantRegistry; version: number }>
  | Readonly<{ type: "storage-unavailable"; constants: KCalcConstantRegistry }>
  | Readonly<{ type: "read-failed"; constants: KCalcConstantRegistry }>;

export type KCalcConstantsSaveResult =
  | Readonly<{ type: "saved" }>
  | Readonly<{ type: "storage-unavailable" }>
  | Readonly<{ type: "write-failed" }>;

export type KCalcConstantsPersistenceStatus = KCalcConstantsLoadResult | KCalcConstantsSaveResult | Readonly<{ type: "provided" }>;

export interface KCalcConstantsStorageBackend {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface KCalcConstantsStorage {
  load(): KCalcConstantsLoadResult;
  save(constants: KCalcConstantRegistry): KCalcConstantsSaveResult;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const serializeConstantValue = (value: KCalcConstantValue): PersistedKCalcConstantValue => ({
  kind: value.kind,
  value: value.value.toString(),
});

const parseConstantValue = (value: unknown): KCalcConstantValue | null => {
  if (!isRecord(value) || typeof value.kind !== "string" || typeof value.value !== "string") {
    return null;
  }

  if (value.kind === "number") {
    const parsed = Number(value.value);
    return Number.isFinite(parsed) ? { kind: "number", value: parsed } : null;
  }

  if (value.kind === "integer" && /^-?(0|[1-9][0-9]*)$/.test(value.value)) {
    try {
      return { kind: "integer", value: BigInt(value.value) };
    } catch {
      return null;
    }
  }

  return null;
};

const parseConstants = (value: unknown): KCalcConstantRegistry | null => {
  if (!Array.isArray(value) || value.length !== kcalcConstantSlotIds.length) {
    return null;
  }

  const defaults = createDefaultKCalcConstantRegistry();
  const slots = value.map((slot, index) => {
    if (!isRecord(slot) || typeof slot.name !== "string" || slot.name.length === 0) {
      return null;
    }

    const constantValue = parseConstantValue(slot.value);
    return constantValue === null ? null : { ...defaults[index], name: slot.name, value: constantValue };
  });

  return slots.every((slot) => slot !== null) ? slots as KCalcConstantRegistry : null;
};

export function serializeKCalcConstants(constants: KCalcConstantRegistry): string {
  const record: PersistedKCalcConstantsV1 = {
    version: KCALC_CONSTANTS_SCHEMA_VERSION,
    slots: constants.map((slot) => ({ name: slot.name, value: serializeConstantValue(slot.value) })),
  };

  return JSON.stringify(record);
}

export function parsePersistedKCalcConstants(raw: string): ParsedKCalcConstants {
  let value: unknown;

  try {
    value = JSON.parse(raw);
  } catch {
    return { type: "invalid", reason: "malformed-json" };
  }

  if (!isRecord(value)) {
    return { type: "invalid", reason: "invalid-root" };
  }

  if (typeof value.version !== "number" || !Number.isInteger(value.version)) {
    return { type: "invalid", reason: "invalid-version" };
  }

  if (value.version !== KCALC_CONSTANTS_SCHEMA_VERSION) {
    return { type: "unsupported-version", version: value.version };
  }

  if (!("slots" in value)) {
    return { type: "invalid", reason: "missing-slots" };
  }

  const constants = parseConstants(value.slots);
  return constants === null ? { type: "invalid", reason: "invalid-slots" } : { type: "valid", constants };
}

const getBrowserLocalStorage = (): KCalcConstantsStorageBackend | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

export function createKCalcConstantsStorage(
  getStorage: () => KCalcConstantsStorageBackend | null = getBrowserLocalStorage,
): KCalcConstantsStorage {
  const getAvailableStorage = (): KCalcConstantsStorageBackend | null => {
    try {
      return getStorage();
    } catch {
      return null;
    }
  };

  return {
    load() {
      const storage = getAvailableStorage();
      const defaults = createDefaultKCalcConstantRegistry();

      if (storage === null) {
        return { type: "storage-unavailable", constants: defaults };
      }

      let raw: string | null;

      try {
        raw = storage.getItem(KCALC_CONSTANTS_STORAGE_KEY);
      } catch {
        return { type: "read-failed", constants: defaults };
      }

      if (raw === null) {
        return { type: "missing", constants: defaults };
      }

      const parsed = parsePersistedKCalcConstants(raw);

      if (parsed.type === "valid") {
        return { type: "loaded", constants: parsed.constants };
      }

      if (parsed.type === "unsupported-version") {
        return { type: "unsupported-version", constants: defaults, version: parsed.version };
      }

      let corruptRecordRemoved = false;

      try {
        storage.removeItem(KCALC_CONSTANTS_STORAGE_KEY);
        corruptRecordRemoved = true;
      } catch {
        // A corrupt record must never prevent a calculator from opening.
      }

      return { type: "invalid", constants: defaults, reason: parsed.reason, corruptRecordRemoved };
    },

    save(constants) {
      const storage = getAvailableStorage();

      if (storage === null) {
        return { type: "storage-unavailable" };
      }

      try {
        storage.setItem(KCALC_CONSTANTS_STORAGE_KEY, serializeKCalcConstants(constants));
        return { type: "saved" };
      } catch {
        return { type: "write-failed" };
      }
    },
  };
}
