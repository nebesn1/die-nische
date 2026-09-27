import { useContext } from "react";
import { VfsContext, type VfsContextValue } from "./VfsContext";

export function useVfs(): VfsContextValue {
  const context = useContext(VfsContext);

  if (!context) {
    throw new Error("useVfs must be used inside VfsProvider");
  }

  return context;
}
