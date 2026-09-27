import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  getKonquerorDirectDropAction,
  getKonquerorVerticalAutoScrollDirection,
  KONQUEROR_DND_AUTO_EXPAND_DELAY_MS,
  KONQUEROR_DND_AUTO_SCROLL_EDGE_PX,
  KONQUEROR_DND_AUTO_SCROLL_INTERVAL_MS,
  KONQUEROR_DND_AUTO_SCROLL_STEP_PX,
} from "./konquerorDragDropModel";

describe("Konqueror shared drag and drop coordination", () => {
  it("chooses direct actions from final supported modifier combinations only", () => {
    expect(getKonquerorDirectDropAction({ ctrlKey: false, shiftKey: false, altKey: false, metaKey: false })).toBeNull();
    expect(getKonquerorDirectDropAction({ ctrlKey: false, shiftKey: true, altKey: false, metaKey: false })).toBe("move");
    expect(getKonquerorDirectDropAction({ ctrlKey: true, shiftKey: false, altKey: false, metaKey: false })).toBe("copy");
    expect(getKonquerorDirectDropAction({ ctrlKey: true, shiftKey: true, altKey: false, metaKey: false })).toBe("link");
    expect(getKonquerorDirectDropAction({ ctrlKey: true, shiftKey: false, altKey: true, metaKey: false })).toBeNull();
    expect(getKonquerorDirectDropAction({ ctrlKey: false, shiftKey: true, altKey: false, metaKey: true })).toBeNull();
  });

  it("uses only the exact resource viewport vertical edge zones", () => {
    expect(getKonquerorVerticalAutoScrollDirection(105, 100, 300, 40, 200)).toBe(-1);
    expect(getKonquerorVerticalAutoScrollDirection(295, 100, 300, 40, 200)).toBe(1);
    expect(getKonquerorVerticalAutoScrollDirection(200, 100, 300, 40, 200)).toBe(0);
    expect(getKonquerorVerticalAutoScrollDirection(105, 100, 300, 0, 200)).toBe(0);
    expect(getKonquerorVerticalAutoScrollDirection(295, 100, 300, 200, 200)).toBe(0);
    expect(getKonquerorVerticalAutoScrollDirection(320, 100, 300, 40, 200)).toBe(0);
  });

  it("keeps the compact timing and scrolling tokens centralized", () => {
    expect(KONQUEROR_DND_AUTO_EXPAND_DELAY_MS).toBe(700);
    expect(KONQUEROR_DND_AUTO_SCROLL_EDGE_PX).toBe(24);
    expect(KONQUEROR_DND_AUTO_SCROLL_STEP_PX).toBe(12);
    expect(KONQUEROR_DND_AUTO_SCROLL_INTERVAL_MS).toBe(60);
  });

  it("keeps the ghost transient, non-interactive, and independent from permanent pointer listeners", () => {
    const coordinator = readFileSync(new URL("./KonquerorDragDropContext.tsx", import.meta.url), "utf8");
    const css = readFileSync(new URL("../../theme/kde3.css", import.meta.url), "utf8");

    expect(coordinator).toContain("document.elementFromPoint");
    expect(coordinator).toContain("document.addEventListener(\"keydown",);
    expect(coordinator).toContain("document.removeEventListener(\"keydown");
    expect(coordinator).not.toContain("document.addEventListener(\"pointermove");
    expect(coordinator).not.toContain("window.addEventListener(\"pointermove");
    expect(css).toContain(".desktop-transient-popup-layer > .konqueror-drag-ghost");
    expect(css).toContain(".konqueror-drag-ghost");
    expect(css).toContain("pointer-events: none;");
  });

  it("keeps folder, file, background, and Desktop Trash destinations distinct", () => {
    const coordinator = readFileSync(new URL("./KonquerorDragDropContext.tsx", import.meta.url), "utf8");
    const tree = readFileSync(new URL("./KonquerorDirectoryView.tsx", import.meta.url), "utf8");
    const icons = readFileSync(new URL("./KonquerorIconView.tsx", import.meta.url), "utf8");

    expect(coordinator).toContain('readonly currentDirectoryNodeId: VfsNodeId | null;');
    expect(coordinator).toContain('kind: "background"');
    expect(coordinator).toContain('kind: "trash"');
    expect(coordinator).toContain('registerDesktopTrashTarget');
    expect(coordinator).toContain('openMoveToTrash(active.plan.rawDraggedNodeIds)');
    expect(coordinator).toContain('return { kind: "invalid", registration };');
    expect(coordinator).not.toContain('canAcceptDropTarget(state.specialLocations.trash)');
    expect(tree).toContain('is-drop-target-background');
    expect(icons).toContain('is-drop-target-background');
  });

  it("routes Desktop Trash before modifier direct actions and leaves normal folders on the existing executor", () => {
    const coordinator = readFileSync(new URL("./KonquerorDragDropContext.tsx", import.meta.url), "utf8");
    const konqueror = readFileSync(new URL("./Konqueror.tsx", import.meta.url), "utf8");

    expect(coordinator.indexOf('if (target?.kind === "trash")')).toBeLessThan(coordinator.indexOf('getKonquerorDirectDropAction(modifiers)'));
    expect(coordinator).toContain('executeDropAction(request, directAction)');
    expect(konqueror).toContain('openMoveToTrashConfirmation(rawDraggedNodeIds, true)');
    expect(konqueror).toContain('buildKonquerorDragOperationPlan(vfs.state, targetNodeIds)');
    expect(konqueror).toContain('preserveClipboard: fromDragDrop');
    expect(konqueror).toContain('!confirmationState.preserveClipboard');
  });

  it("keeps the shared clipboard outside the DnD Trash confirmation lifecycle", () => {
    const types = readFileSync(new URL("./fileOperationTypes.ts", import.meta.url), "utf8");
    const state = readFileSync(new URL("./fileOperationState.ts", import.meta.url), "utf8");
    const konqueror = readFileSync(new URL("./Konqueror.tsx", import.meta.url), "utf8");

    expect(types).toContain("readonly preserveClipboard?: boolean;");
    expect(state).toContain("preserveClipboard: action.preserveClipboard ?? false");
    expect(konqueror).toContain("preserveClipboard: fromDragDrop");
    expect(konqueror).toContain("result.shouldClearClipboard && confirmationState.kind === \"move-to-trash\" && !confirmationState.preserveClipboard");
  });
});
