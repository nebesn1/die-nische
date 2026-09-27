import { createContext } from "react";
import {
  createDefaultKCalcConstantRegistry,
  type KCalcConstantRegistry,
  type KCalcConstantSlotId,
  type KCalcConstantValue,
} from "./kcalcConstants";
import type { KCalcConstantsPersistenceStatus, KCalcConstantsSaveResult } from "./kcalcConstantsPersistence";

export interface KCalcConstantsContextValue {
  readonly constants: KCalcConstantRegistry;
  readonly persistenceStatus: KCalcConstantsPersistenceStatus;
  storeConstant(slotId: KCalcConstantSlotId, value: KCalcConstantValue): KCalcConstantsSaveResult;
  updateConstants(constants: KCalcConstantRegistry): KCalcConstantsSaveResult;
}

const defaultKCalcConstantsContextValue: KCalcConstantsContextValue = {
  constants: createDefaultKCalcConstantRegistry(),
  persistenceStatus: { type: "storage-unavailable" },
  storeConstant: () => ({ type: "storage-unavailable" }),
  updateConstants: () => ({ type: "storage-unavailable" }),
};

export const KCalcConstantsContext = createContext<KCalcConstantsContextValue>(defaultKCalcConstantsContextValue);
