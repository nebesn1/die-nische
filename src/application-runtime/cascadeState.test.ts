import { describe, expect, it } from "vitest";
import {
  getApplicationCascadeKey,
  initialApplicationCascadeState,
  reconcileApplicationCascadeState,
  reserveApplicationCascadeSerial,
} from "./cascadeState";
import type { DesktopId, DesktopWindow } from "../window-manager/types";

const makeWindow = (id: string, desktopId: DesktopId, appId = "konsole"): DesktopWindow => ({
  id,
  appId,
  title: appId,
  iconId: appId,
  desktopId,
  bounds: { x: 0, y: 0, width: 400, height: 300 },
  zIndex: 1,
  isActive: false,
  state: "normal",
  isDraggable: true,
  minimumWidth: 1,
  minimumHeight: 1,
  isResizable: true,
});

describe("application cascade allocation", () => {
  it("keeps visual cascade serials independent per desktop and application", () => {
    const desktopOneFirst = reserveApplicationCascadeSerial(initialApplicationCascadeState, 1, "konqueror");
    const desktopOneSecond = reserveApplicationCascadeSerial(desktopOneFirst.state, 1, "konqueror");
    const desktopTwoFirst = reserveApplicationCascadeSerial(desktopOneSecond.state, 2, "konqueror");
    const desktopOneThird = reserveApplicationCascadeSerial(desktopTwoFirst.state, 1, "konqueror");
    const otherAppFirst = reserveApplicationCascadeSerial(desktopOneThird.state, 1, "test-multiple");

    expect(desktopOneFirst.serial).toBe(0);
    expect(desktopOneSecond.serial).toBe(1);
    expect(desktopTwoFirst.serial).toBe(0);
    expect(desktopOneThird.serial).toBe(2);
    expect(otherAppFirst.serial).toBe(0);
  });

  it("is session-volatile and has no relationship to WindowId allocation", () => {
    const reserved = reserveApplicationCascadeSerial(initialApplicationCascadeState, 3, "konqueror");

    expect(reserved.state.nextSerialByDesktopAndApplication).toEqual({ "3:konqueror": 1 });
    expect(initialApplicationCascadeState.nextSerialByDesktopAndApplication).toEqual({});
  });

  it("keeps a non-empty group's serial monotonic when a middle window closes", () => {
    const first = reserveApplicationCascadeSerial(initialApplicationCascadeState, 1, "konsole");
    const second = reserveApplicationCascadeSerial(first.state, 1, "konsole");
    const third = reserveApplicationCascadeSerial(second.state, 1, "konsole");
    const afterMiddleClose = reconcileApplicationCascadeState(third.state, [
      makeWindow("app:konsole", 1),
      makeWindow("app:konsole::3", 1),
    ]);
    const fourth = reserveApplicationCascadeSerial(afterMiddleClose, 1, "konsole");

    expect(fourth.serial).toBe(3);
  });

  it("removes an empty desktop/application lifecycle so a later window restarts at slot zero", () => {
    const first = reserveApplicationCascadeSerial(initialApplicationCascadeState, 1, "konsole");
    const second = reserveApplicationCascadeSerial(first.state, 1, "konsole");
    const reset = reconcileApplicationCascadeState(second.state, []);
    const reopened = reserveApplicationCascadeSerial(reset, 1, "konsole");

    expect(reset.nextSerialByDesktopAndApplication).toEqual({});
    expect(reopened.serial).toBe(0);
    expect(reopened.state.nextSerialByDesktopAndApplication).toEqual({ "1:konsole": 1 });
  });

  it("isolates reset and progression by desktop and application", () => {
    const desktopOne = reserveApplicationCascadeSerial(initialApplicationCascadeState, 1, "konsole");
    const desktopTwo = reserveApplicationCascadeSerial(desktopOne.state, 2, "konsole");
    const otherApp = reserveApplicationCascadeSerial(desktopTwo.state, 1, "kwrite");
    const reconciled = reconcileApplicationCascadeState(otherApp.state, [
      makeWindow("app:konsole::2", 2),
      makeWindow("app:kwrite", 1, "kwrite"),
    ]);
    const reopenedDesktopOne = reserveApplicationCascadeSerial(reconciled, 1, "konsole");
    const continuedDesktopTwo = reserveApplicationCascadeSerial(reopenedDesktopOne.state, 2, "konsole");

    expect(reconciled.nextSerialByDesktopAndApplication).toEqual({
      [getApplicationCascadeKey(2, "konsole")]: 1,
      [getApplicationCascadeKey(1, "kwrite")]: 1,
    });
    expect(reopenedDesktopOne.serial).toBe(0);
    expect(continuedDesktopTwo.serial).toBe(1);
  });

  it("seeds a target desktop after Move to Desktop without repositioning the moved window", () => {
    const source = reserveApplicationCascadeSerial(initialApplicationCascadeState, 1, "kcalc");
    const afterMove = reconcileApplicationCascadeState(source.state, [makeWindow("app:kcalc", 2, "kcalc")]);
    const nextSource = reserveApplicationCascadeSerial(afterMove, 1, "kcalc");
    const nextTarget = reserveApplicationCascadeSerial(nextSource.state, 2, "kcalc");

    expect(afterMove.nextSerialByDesktopAndApplication).toEqual({ "2:kcalc": 1 });
    expect(nextSource.serial).toBe(0);
    expect(nextTarget.serial).toBe(1);
  });

  it("supports a newly introduced desktop and drops its placement state once it no longer has windows", () => {
    const first = reserveApplicationCascadeSerial(initialApplicationCascadeState, 5, "kwrite");
    const second = reserveApplicationCascadeSerial(first.state, 5, "kwrite");
    const reconciled = reconcileApplicationCascadeState(second.state, []);
    const fresh = reserveApplicationCascadeSerial(reconciled, 5, "kwrite");

    expect(first.serial).toBe(0);
    expect(second.serial).toBe(1);
    expect(reconciled.nextSerialByDesktopAndApplication).toEqual({});
    expect(fresh.serial).toBe(0);
  });
});
