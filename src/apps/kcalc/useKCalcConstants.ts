import { useContext } from "react";
import { KCalcConstantsContext, type KCalcConstantsContextValue } from "./kcalcConstantsContextValue";

export function useKCalcConstants(): KCalcConstantsContextValue {
  return useContext(KCalcConstantsContext);
}
