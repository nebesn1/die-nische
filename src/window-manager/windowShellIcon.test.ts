import { describe, expect, it } from "vitest";
import type { DesktopWindow } from "./types";
import { getWindowShellIconId } from "./windowShellIcon";

const windowFor = (id: string, appId = "konqueror"): DesktopWindow => ({
  id,
  appId,
  title: id,
  iconId: appId,
  desktopId: 1,
  bounds: { x: 0, y: 0, width: 320, height: 220 },
  zIndex: 1,
  isActive: false,
  state: "normal",
  isDraggable: true,
  minimumWidth: 280,
  minimumHeight: 180,
  isResizable: true,
});

describe("window shell icon selection", () => {
  it("uses semantic metadata only for its exact WindowId", () => {
    const documents = windowFor("app:konqueror");
    const downloads = windowFor("app:konqueror::2");
    const metadata = {
      [documents.id]: { isHomeLocation: false, semanticIconId: "documents" },
      [downloads.id]: { isHomeLocation: false, semanticIconId: "downloads" },
    };

    expect(getWindowShellIconId(documents, metadata)).toBe("documents");
    expect(getWindowShellIconId(downloads, metadata)).toBe("downloads");
  });

  it("falls back to the registered application icon without valid semantic metadata", () => {
    expect(getWindowShellIconId(windowFor("kwrite", "kwrite"), {})).toBe("kwrite");
    expect(getWindowShellIconId(windowFor("konqueror"), {})).toBe("konqueror");
    expect(
      getWindowShellIconId(windowFor("konqueror"), {
        konqueror: { isHomeLocation: false, semanticIconId: "not-an-icon" },
      }),
    ).toBe("konqueror");
  });

  it("does not infer icon identity from captions, desktop, or active state", () => {
    const documents = windowFor("app:konqueror", "konqueror");
    const metadata = { [documents.id]: { isHomeLocation: false, semanticIconId: "documents" } };

    expect(getWindowShellIconId({ ...documents, title: "Trash - Konqueror", desktopId: 4, isActive: true }, metadata)).toBe(
      "documents",
    );
  });
});
