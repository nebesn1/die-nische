import { readFileSync } from "node:fs";
import { createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { KonquerorDropActionMenu } from "./KonquerorDropActionMenu";
import type { KonquerorDropActionRequest } from "./dragDropController";
import { konquerorDropActionMenuEntries } from "./dropActionMenuModel";

const request: KonquerorDropActionRequest = {
  requestId: 1,
  ownerWindowId: "window-a",
  targetWindowId: "window-a",
  rawDraggedNodeIds: ["vfs-content-e594a065214576326cb903a5"],
  operationRootNodeIds: ["vfs-content-e594a065214576326cb903a5"],
  sourceParentIdsByNodeId: { "vfs-content-e594a065214576326cb903a5": "vfs-documents" },
  targetFolderNodeId: "vfs-downloads",
  clientX: 48,
  clientY: 62,
};

describe("Konqueror Drop Action menu model", () => {
  it("keeps the KDE order, visible shortcut labels, and enabled Link Here action", () => {
    expect(konquerorDropActionMenuEntries).toEqual([
      { action: "move", label: "Move Here", shortcut: "Shift", enabled: true },
      { action: "copy", label: "Copy Here", shortcut: "Ctrl", enabled: true },
      { action: "link", label: "Link Here", shortcut: "Ctrl+Shift", enabled: true },
      { action: "cancel", label: "Cancel", shortcut: "Escape", enabled: true },
    ]);
  });

  it("uses the existing pre-paint, owner-popup, and Escape dismissal contract", () => {
    const markup = renderToStaticMarkup(
      <KonquerorDropActionMenu
        request={request}
        containerRef={createRef<HTMLDivElement>()}
        screenArea={{ x: 0, y: 0, width: 1024, height: 768 }}
        onDismiss={() => undefined}
        onAction={() => undefined}
      />,
    );

    expect(markup).toContain('aria-label="Drop action menu"');
    expect(markup).toContain("Move Here");
    expect(markup).toContain("Copy Here");
    expect(markup).toContain("Link Here");
    expect(markup).toContain("Cancel");
    expect(markup).toContain("Ctrl+Shift");
    expect(markup).not.toContain('disabled=""');
    expect(markup).toContain('role="separator"');
    expect(markup).toContain("visibility:hidden");
    expect(markup).toContain("pointer-events:none");

    const source = readFileSync(new URL("./KonquerorDropActionMenu.tsx", import.meta.url), "utf8");
    expect(source).toContain("useApplicationMenuDismissal");
    expect(source).toContain("useMeasuredPopupPosition");
    expect(source).toContain("getKonquerorPopupLocalPosition");
    expect(source).not.toContain("document.addEventListener");
    expect(source).not.toContain("window.addEventListener");
  });
});
