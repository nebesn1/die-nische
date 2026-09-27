import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string): string =>
  readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");

describe("application close request boundary", () => {
  it("routes titlebar and window-menu Close through Application Runtime", () => {
    const frameSource = readSource("../window-manager/WindowFrame.tsx");
    const menuSource = readSource("../window-manager/window-menu/WindowMenuPanel.tsx");

    expect(frameSource).toContain("applicationRuntime.requestWindowClose(desktopWindow.id)");
    expect(menuSource).toContain("applicationRuntime.requestWindowClose(desktopWindow.id)");
    expect(frameSource).not.toContain("closeWindow(desktopWindow.id)");
    expect(menuSource).not.toContain("closeWindow(desktopWindow.id)");
  });

  it("keeps the reducer-level close primitive inside Runtime commit paths", () => {
    const providerSource = readSource("./ApplicationRuntimeProvider.tsx");

    expect(providerSource).toContain("getApplicationCloseBehavior(definition)");
    expect(providerSource).toContain("dispatchRuntime({ type: \"clear-close-request\", windowId, requestId });");
    expect(providerSource).toContain("closeWindow(windowId);");
    expect(providerSource).not.toContain("beforeunload");
    expect(providerSource).not.toContain("window.confirm");
  });
});
