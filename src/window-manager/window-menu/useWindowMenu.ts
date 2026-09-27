import { useContext } from "react";
import { WindowMenuContext } from "./WindowMenuContext";
import type { WindowMenuContextValue } from "./types";

export function useWindowMenu(): WindowMenuContextValue {
  const context = useContext(WindowMenuContext);

  if (!context) {
    throw new Error("useWindowMenu must be used inside WindowMenuProvider");
  }

  return context;
}
