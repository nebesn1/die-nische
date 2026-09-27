import { describe, expect, it } from "vitest";
import { createDefaultKCalcConstantRegistry, setKCalcConstantName, setKCalcConstantValue } from "./kcalcConstants";
import {
  KCALC_CONSTANTS_STORAGE_KEY,
  createKCalcConstantsStorage,
  parsePersistedKCalcConstants,
  serializeKCalcConstants,
  type KCalcConstantsStorageBackend,
} from "./kcalcConstantsPersistence";

function createMemoryStorage(initial: Readonly<Record<string, string>> = {}): KCalcConstantsStorageBackend & { readonly values: Map<string, string> } {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

describe("KCalc constants persistence", () => {
  it("serializes finite numbers and exact integers without presentation-base loss", () => {
    const constants = setKCalcConstantValue(
      setKCalcConstantValue(createDefaultKCalcConstantRegistry(), "constant-1", { kind: "number", value: 1.5 }),
      "constant-2",
      { kind: "integer", value: 9007199254740993n },
    );
    const serialized = serializeKCalcConstants(constants);

    expect(serialized).toContain('"kind":"number","value":"1.5"');
    expect(serialized).toContain('"kind":"integer","value":"9007199254740993"');
    expect(parsePersistedKCalcConstants(serialized)).toEqual({ type: "valid", constants });
  });

  it("restores a write-through registry and safely falls back for malformed records", () => {
    const storage = createMemoryStorage();
    const adapter = createKCalcConstantsStorage(() => storage);
    const saved = setKCalcConstantValue(createDefaultKCalcConstantRegistry(), "constant-1", { kind: "integer", value: -10n });

    expect(adapter.save(saved)).toEqual({ type: "saved" });
    expect(adapter.load()).toEqual({ type: "loaded", constants: saved });

    storage.values.set(KCALC_CONSTANTS_STORAGE_KEY, "{bad");
    expect(adapter.load()).toMatchObject({ type: "invalid", constants: createDefaultKCalcConstantRegistry() });
    expect(storage.values.has(KCALC_CONSTANTS_STORAGE_KEY)).toBe(false);
  });

  it("rejects nonfinite numbers, invalid integer text, and unsupported documents", () => {
    expect(parsePersistedKCalcConstants(JSON.stringify({ version: 1, slots: [
      ...Array.from({ length: 5 }, (_, index) => ({ name: `C${index + 1}`, value: { kind: "number", value: "0" } })),
      { name: "C6", value: { kind: "number", value: "Infinity" } },
    ] }))).toEqual({ type: "invalid", reason: "invalid-slots" });
    expect(parsePersistedKCalcConstants(JSON.stringify({ version: 1, slots: Array.from({ length: 6 }, (_, index) => ({
      name: `C${index + 1}`,
      value: { kind: "integer", value: "0x10" },
    })) }))).toEqual({ type: "invalid", reason: "invalid-slots" });
    expect(parsePersistedKCalcConstants(JSON.stringify({ version: 2, slots: [] }))).toEqual({ type: "unsupported-version", version: 2 });
  });

  it("keeps H1-style name/value records compatible without a schema migration", () => {
    const h1Record = setKCalcConstantValue(
      setKCalcConstantName(createDefaultKCalcConstantRegistry(), "constant-1", "PI"),
      "constant-2",
      { kind: "integer", value: 9007199254740993n },
    );

    expect(parsePersistedKCalcConstants(serializeKCalcConstants(h1Record))).toEqual({ type: "valid", constants: h1Record });
  });
});
