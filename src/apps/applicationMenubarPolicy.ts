import { useContext, useEffect } from "react";
import { WindowManagerContext } from "../window-manager/useWindowManager";
import type { WindowLayoutMode } from "../window-manager/types";

export const APPLICATION_MENUBAR_CLASS = "application-menubar";

/** Keeps persistent application menu state from outliving its mobile presentation. */
export function useApplicationMenubarPolicy(closeMenu: () => void, layoutMode?: WindowLayoutMode): void {
  const windowManager = useContext(WindowManagerContext);
  const effectiveLayoutMode = layoutMode ?? windowManager?.layoutMode ?? "desktop";

  useEffect(() => {
    if (effectiveLayoutMode === "mobile") {
      closeMenu();
    }
  }, [closeMenu, effectiveLayoutMode]);
}
