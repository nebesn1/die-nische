import { describe, expect, it } from "vitest";
import {
  initialKonquerorContextSubmenuState,
  KONQUEROR_SUBMENU_CLOSE_GRACE_MS,
  konquerorContextSubmenuReducer,
} from "./contextSubmenuState";

describe("Konqueror context submenu interaction state", () => {
  it("keeps a submenu open while a parent-to-child transition cancels its pending close", () => {
    const open = konquerorContextSubmenuReducer(initialKonquerorContextSubmenuState, { type: "open", submenuId: "preview-in" });
    const leavingParent = konquerorContextSubmenuReducer(open, { type: "schedule-close", submenuId: "preview-in" });
    const enteredChild = konquerorContextSubmenuReducer(leavingParent, { type: "cancel-close", submenuId: "preview-in" });
    const staleTimer = konquerorContextSubmenuReducer(enteredChild, { type: "close-if-pending", submenuId: "preview-in" });

    expect(KONQUEROR_SUBMENU_CLOSE_GRACE_MS).toBeGreaterThanOrEqual(100);
    expect(KONQUEROR_SUBMENU_CLOSE_GRACE_MS).toBeLessThanOrEqual(200);
    expect(staleTimer).toEqual({ openSubmenuId: "preview-in", pendingCloseId: null });
  });

  it("switches submenu parents and only closes an interaction family after its grace expires", () => {
    const preview = konquerorContextSubmenuReducer(initialKonquerorContextSubmenuState, { type: "open", submenuId: "preview-in" });
    const openWith = konquerorContextSubmenuReducer(preview, { type: "open", submenuId: "open-with" });
    const pending = konquerorContextSubmenuReducer(openWith, { type: "schedule-close", submenuId: "open-with" });
    const closed = konquerorContextSubmenuReducer(pending, { type: "close-if-pending", submenuId: "open-with" });

    expect(openWith).toEqual({ openSubmenuId: "open-with", pendingCloseId: null });
    expect(closed).toBe(initialKonquerorContextSubmenuState);
  });

  it("treats Actions as the same locally owned submenu interaction family", () => {
    const preview = konquerorContextSubmenuReducer(initialKonquerorContextSubmenuState, { type: "open", submenuId: "preview-in" });
    const actions = konquerorContextSubmenuReducer(preview, { type: "open", submenuId: "actions" });

    expect(actions).toEqual({ openSubmenuId: "actions", pendingCloseId: null });
  });

  it("clears an open submenu immediately for Escape, outside dismissal, and menu unmount", () => {
    const open = konquerorContextSubmenuReducer(initialKonquerorContextSubmenuState, { type: "open", submenuId: "preview-in" });

    expect(konquerorContextSubmenuReducer(open, { type: "close-all" })).toBe(initialKonquerorContextSubmenuState);
  });
});
