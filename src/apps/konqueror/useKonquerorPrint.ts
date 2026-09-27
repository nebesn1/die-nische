import { useContext } from "react";
import { KonquerorPrintContext, type KonquerorPrintContextValue } from "./konquerorPrintContext";

export function useOptionalKonquerorPrint(): KonquerorPrintContextValue | null {
  return useContext(KonquerorPrintContext);
}
