export const kcalcConstantSlotIds = [
  "constant-1",
  "constant-2",
  "constant-3",
  "constant-4",
  "constant-5",
  "constant-6",
] as const;

export type KCalcConstantSlotId = (typeof kcalcConstantSlotIds)[number];

export type KCalcConstantRecallCommandId = KCalcConstantSlotId;
export type KCalcConstantStoreCommandId = `store-${KCalcConstantSlotId}`;
export type KCalcConstantCommandId = KCalcConstantRecallCommandId | KCalcConstantStoreCommandId;

export type KCalcConstantValue =
  | Readonly<{ kind: "number"; value: number }>
  | Readonly<{ kind: "integer"; value: bigint }>;

export type KCalcConstantSlot = Readonly<{
  id: KCalcConstantSlotId;
  name: string;
  value: KCalcConstantValue;
}>;

export type KCalcConstantRegistry = readonly KCalcConstantSlot[];

const defaultSlotName = (slotId: KCalcConstantSlotId): string => `C${slotId.slice("constant-".length)}`;

const cloneValue = (value: KCalcConstantValue): KCalcConstantValue => ({ ...value });

export const getKCalcDefaultConstantName = (slotId: KCalcConstantSlotId): string => defaultSlotName(slotId);

export const formatKCalcConstantValue = (value: KCalcConstantValue): string => value.value.toString();

export const parseKCalcConfiguredConstantValue = (raw: string): KCalcConstantValue | null => {
  const text = raw.trim();

  if (/^-?(0|[1-9][0-9]*)$/.test(text)) {
    try {
      const integer = BigInt(text);
      const number = Number(integer);
      return Number.isSafeInteger(number) ? { kind: "number", value: number } : { kind: "integer", value: integer };
    } catch {
      return null;
    }
  }

  if (!/^-?(?:(?:0|[1-9][0-9]*)\.[0-9]+|(?:0|[1-9][0-9]*)(?:\.[0-9]+)?[eE][+-]?[0-9]+)$/.test(text)) {
    return null;
  }

  const value = Number(text);
  return Number.isFinite(value) ? { kind: "number", value } : null;
};

export const createDefaultKCalcConstantRegistry = (): KCalcConstantRegistry =>
  kcalcConstantSlotIds.map((id) => ({
    id,
    name: defaultSlotName(id),
    value: { kind: "number", value: 0 },
  }));

export const cloneKCalcConstantRegistry = (registry: KCalcConstantRegistry): KCalcConstantRegistry =>
  registry.map((slot) => ({ ...slot, value: cloneValue(slot.value) }));

export const isKCalcConstantValue = (value: unknown): value is KCalcConstantValue =>
  typeof value === "object"
  && value !== null
  && (("kind" in value && value.kind === "number" && "value" in value && typeof value.value === "number" && Number.isFinite(value.value))
    || ("kind" in value && value.kind === "integer" && "value" in value && typeof value.value === "bigint"));

export const isKCalcConstantRecallCommand = (commandId: string): commandId is KCalcConstantRecallCommandId =>
  (kcalcConstantSlotIds as readonly string[]).includes(commandId);

export const isKCalcConstantStoreCommand = (commandId: string): commandId is KCalcConstantStoreCommandId =>
  commandId.startsWith("store-") && isKCalcConstantRecallCommand(commandId.slice("store-".length));

export const getKCalcConstantSlotIdForCommand = (commandId: string): KCalcConstantSlotId | null => {
  if (isKCalcConstantRecallCommand(commandId)) {
    return commandId;
  }

  return isKCalcConstantStoreCommand(commandId) ? commandId.slice("store-".length) as KCalcConstantSlotId : null;
};

export const getKCalcConstantSlot = (
  registry: KCalcConstantRegistry,
  slotId: KCalcConstantSlotId,
): KCalcConstantSlot => {
  const slot = registry.find((candidate) => candidate.id === slotId);

  if (slot === undefined) {
    throw new Error(`Missing KCalc constant slot: ${slotId}`);
  }

  return slot;
};

export const setKCalcConstantValue = (
  registry: KCalcConstantRegistry,
  slotId: KCalcConstantSlotId,
  value: KCalcConstantValue,
): KCalcConstantRegistry => registry.map((slot) =>
  slot.id === slotId ? { ...slot, value: cloneValue(value) } : slot,
);

export const setKCalcConstantName = (
  registry: KCalcConstantRegistry,
  slotId: KCalcConstantSlotId,
  name: string,
): KCalcConstantRegistry => registry.map((slot) => slot.id === slotId ? { ...slot, name } : slot);

export const setKCalcConstant = (
  registry: KCalcConstantRegistry,
  slotId: KCalcConstantSlotId,
  update: Readonly<{ name: string; value: KCalcConstantValue }>,
): KCalcConstantRegistry => registry.map((slot) => slot.id === slotId
  ? { ...slot, name: update.name, value: cloneValue(update.value) }
  : slot);
