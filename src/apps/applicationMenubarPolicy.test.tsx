// @vitest-environment jsdom
import { act } from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useApplicationMenubarPolicy } from "./applicationMenubarPolicy";
import type { WindowLayoutMode } from "../window-manager/types";

((globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true);

const persistentMenubarSources = [
  readFileSync(resolve(process.cwd(), "src/apps/kcontrol/KControl.tsx"), "utf8"),
  readFileSync(resolve(process.cwd(), "src/apps/kcalc/KCalc.tsx"), "utf8"),
  readFileSync(resolve(process.cwd(), "src/apps/kwrite/KWrite.tsx"), "utf8"),
  readFileSync(resolve(process.cwd(), "src/apps/konsole/KonsoleMenuBar.tsx"), "utf8"),
  readFileSync(resolve(process.cwd(), "src/apps/konqueror/KonquerorApplicationMenu.tsx"), "utf8"),
];
const konquerorWindowSource = readFileSync(resolve(process.cwd(), "src/apps/konqueror/Konqueror.tsx"), "utf8");

let container: HTMLDivElement;
let root: Root;

function PolicyProbe({ layoutMode, onClose }: { readonly layoutMode: WindowLayoutMode; readonly onClose: () => void }) {
  useApplicationMenubarPolicy(onClose, layoutMode);
  return null;
}

afterEach(() => {
  if (root !== undefined) {
    act(() => root.unmount());
  }
  container?.remove();
});

describe("application menubar mobile policy", () => {
  it("marks only persistent first-party menubars with the shared semantic class", () => {
    for (const source of persistentMenubarSources) {
      expect(source).toContain("APPLICATION_MENUBAR_CLASS");
    }
    expect(konquerorWindowSource).toContain("useApplicationMenubarPolicy");
  });

  it("closes local menubar state on desktop-to-mobile transitions without remounting the consumer", () => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    const closeMenu = vi.fn();

    act(() => root.render(<PolicyProbe layoutMode="desktop" onClose={closeMenu} />));
    expect(closeMenu).not.toHaveBeenCalled();

    act(() => root.render(<PolicyProbe layoutMode="mobile" onClose={closeMenu} />));
    expect(closeMenu).toHaveBeenCalledTimes(1);

    act(() => root.render(<PolicyProbe layoutMode="desktop" onClose={closeMenu} />));
    expect(closeMenu).toHaveBeenCalledTimes(1);

    act(() => root.render(<PolicyProbe layoutMode="mobile" onClose={closeMenu} />));
    expect(closeMenu).toHaveBeenCalledTimes(2);
  });
});
