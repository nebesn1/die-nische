import { useEffect, useMemo, useReducer, type ReactNode } from "react";
import { useOptionalDesktopSession } from "../../desktop/useDesktopSession";
import { initialKonquerorClipboardState, konquerorClipboardReducer } from "./clipboardState";
import { KonquerorClipboardContext } from "./konquerorClipboardContext";

/** Session-owned file-operation clipboard shared by every Konqueror window. */
export function KonquerorClipboardProvider({ children }: { readonly children: ReactNode }) {
  const [state, dispatch] = useReducer(konquerorClipboardReducer, initialKonquerorClipboardState);
  const desktopSession = useOptionalDesktopSession();

  useEffect(() => {
    if ((desktopSession?.resetGeneration ?? 0) > 0) {
      dispatch({ type: "clear" });
    }
  }, [desktopSession?.resetGeneration]);

  const value = useMemo(() => ({ state, dispatch }), [state]);

  return <KonquerorClipboardContext.Provider value={value}>{children}</KonquerorClipboardContext.Provider>;
}
