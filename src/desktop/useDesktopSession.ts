import { useContext } from "react";
import { DesktopSessionContext, type DesktopSessionContextValue } from "./desktopSessionContext";

export function useDesktopSession(): DesktopSessionContextValue {
  const context = useContext(DesktopSessionContext);

  if (!context) {
    throw new Error("useDesktopSession must be used inside DesktopSessionProvider");
  }

  return context;
}

export function useOptionalDesktopSession(): DesktopSessionContextValue | null {
  return useContext(DesktopSessionContext);
}
