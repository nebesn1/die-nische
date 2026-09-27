import { describe, expect, it } from "vitest";
import {
  initialKonquerorApplicationMenuSubmenuState,
  konquerorApplicationMenuSubmenuReducer,
} from "./applicationMenuSubmenuState";

describe("Konqueror application-menu submenu state", () => {
  it("keeps one submenu open and ignores a stale close request for a replacement submenu", () => {
    const createNew = konquerorApplicationMenuSubmenuReducer(initialKonquerorApplicationMenuSubmenuState, {
      type: "open",
      submenuId: "create-new",
    });
    const pendingCreateNew = konquerorApplicationMenuSubmenuReducer(createNew, {
      type: "schedule-close",
      submenuId: "create-new",
    });
    const sort = konquerorApplicationMenuSubmenuReducer(pendingCreateNew, {
      type: "open",
      submenuId: "sort",
    });

    expect(konquerorApplicationMenuSubmenuReducer(sort, {
      type: "close-if-pending",
      submenuId: "create-new",
    })).toEqual(sort);
  });

  it("closes the current submenu only after its own pending close and can clear all state", () => {
    const opened = konquerorApplicationMenuSubmenuReducer(initialKonquerorApplicationMenuSubmenuState, {
      type: "open",
      submenuId: "view-mode",
    });
    const pending = konquerorApplicationMenuSubmenuReducer(opened, {
      type: "schedule-close",
      submenuId: "view-mode",
    });

    expect(konquerorApplicationMenuSubmenuReducer(pending, {
      type: "close-if-pending",
      submenuId: "view-mode",
    })).toEqual(initialKonquerorApplicationMenuSubmenuState);
    expect(konquerorApplicationMenuSubmenuReducer(opened, { type: "close-all" }))
      .toEqual(initialKonquerorApplicationMenuSubmenuState);
  });
});
