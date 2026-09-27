import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  cloneKCalcConstantRegistry,
  createDefaultKCalcConstantRegistry,
  setKCalcConstantValue,
  type KCalcConstantRegistry,
  type KCalcConstantSlotId,
  type KCalcConstantValue,
} from "./kcalcConstants";
import { KCalcConstantsContext } from "./kcalcConstantsContextValue";
import {
  createKCalcConstantsStorage,
  type KCalcConstantsPersistenceStatus,
  type KCalcConstantsStorage,
} from "./kcalcConstantsPersistence";

type KCalcConstantsProviderProps = {
  readonly children: ReactNode;
  readonly initialConstants?: KCalcConstantRegistry;
  readonly storage?: KCalcConstantsStorage;
};

export function KCalcConstantsProvider({ children, initialConstants, storage }: KCalcConstantsProviderProps) {
  const [persistence] = useState(() => storage ?? createKCalcConstantsStorage());
  const [startup] = useState(() => initialConstants === undefined
    ? persistence.load()
    : { type: "provided" as const, constants: cloneKCalcConstantRegistry(initialConstants) });
  const [constants, setConstants] = useState<KCalcConstantRegistry>(() =>
    cloneKCalcConstantRegistry(startup.constants ?? createDefaultKCalcConstantRegistry()),
  );
  const [persistenceStatus, setPersistenceStatus] = useState<KCalcConstantsPersistenceStatus>(startup);

  const updateConstants = useCallback((next: KCalcConstantRegistry) => {
    const result = persistence.save(next);

    setConstants(next);
    setPersistenceStatus(result);

    return result;
  }, [persistence]);

  const storeConstant = useCallback((slotId: KCalcConstantSlotId, value: KCalcConstantValue) =>
    updateConstants(setKCalcConstantValue(constants, slotId, value)), [constants, updateConstants]);

  const value = useMemo(
    () => ({ constants, persistenceStatus, storeConstant, updateConstants }),
    [constants, persistenceStatus, storeConstant, updateConstants],
  );

  return <KCalcConstantsContext.Provider value={value}>{children}</KCalcConstantsContext.Provider>;
}
