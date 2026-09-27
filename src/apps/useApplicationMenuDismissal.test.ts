import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./useApplicationMenuDismissal.ts", import.meta.url), "utf8");

describe("application menubar dismissal boundary", () => {
  it("registers one capture-phase pointer observer only while a menu is open", () => {
    expect(source).toContain("if (!isOpen)");
    expect(source).toContain('document.addEventListener("pointerdown", handlePointerDown, true)');
    expect(source).toContain('document.removeEventListener("pointerdown", handlePointerDown, true)');
    expect(source).not.toContain("window.addEventListener");
    expect(source).not.toContain("setInterval");
    expect(source).not.toContain("MutationObserver");
  });

  it("keeps menubar and popup targets inside while leaving outside pointer events unconsumed", () => {
    expect(source).toContain("menuBarRef.current?.contains(target)");
    expect(source).toContain("dismissRef.current()");
    expect(source).not.toContain("preventDefault");
    expect(source).not.toContain("stopPropagation");
    expect(source).not.toContain("menu-dismiss-overlay");
  });

  it("keeps the latest dismiss callback without re-registering a listener for every render", () => {
    expect(source).toContain("const dismissRef = useRef(onDismiss)");
    expect(source).toContain("dismissRef.current = onDismiss");
    expect(source).toContain("}, [isOpen, menuBarRef])");
  });
});
