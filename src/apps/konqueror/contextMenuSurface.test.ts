import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const konquerorSource = readFileSync(new URL("./Konqueror.tsx", import.meta.url), "utf8");
const detailsSource = readFileSync(new URL("./KonquerorDirectoryView.tsx", import.meta.url), "utf8");
const iconSource = readFileSync(new URL("./KonquerorIconView.tsx", import.meta.url), "utf8");
const marqueeSource = readFileSync(new URL("./useKonquerorDirectoryMarquee.ts", import.meta.url), "utf8");
const cssSource = readFileSync(new URL("../../theme/kde3.css", import.meta.url), "utf8");

describe("Konqueror context-menu surface", () => {
  it("uses a full-height Details surface for background context menus while leaving headers outside that action", () => {
    expect(detailsSource).toContain("touchInteraction.consumeNativeContextMenu()");
    expect(detailsSource).toContain("handleBackgroundContextMenu(event)");
    expect(detailsSource).toContain("onContextMenu={(event) => event.stopPropagation()}");
    expect(detailsSource).toContain("isKonquerorDirectoryItemContextMenuTarget(event.target)");
    expect(detailsSource).toContain("onOpenBackgroundContextMenu(event.clientX, event.clientY);");
    expect(cssSource).toMatch(/\.konqueror-directory-view\s*\{\s*position: relative;\s*min-height: 100%;/);
  });

  it("keeps Icon View on the same local directory context boundary", () => {
    expect(iconSource).toContain("touchInteraction.consumeNativeContextMenu()");
    expect(iconSource).toContain("handleBackgroundContextMenu(event)");
    expect(iconSource).toContain("event.stopPropagation();");
    expect(iconSource).toContain("onOpenItemContextMenu(node.id, event.clientX, event.clientY)");
    expect(iconSource).not.toContain("document.addEventListener");
  });

  it("keeps background selection local while marquee pointer capture remains owner-scoped", () => {
    for (const source of [detailsSource, iconSource]) {
      expect(source).toContain("marquee.handleBackgroundClick(event)");
      expect(source).toContain("marquee.handleBackgroundPointerDown(event)");
      expect(source).toContain("marquee.handleBackgroundLostPointerCapture(event)");
      expect(source).toContain("event.ctrlKey");
      expect(source).toContain("event.shiftKey");
      expect(source).not.toContain("document.addEventListener");
      expect(source).not.toContain("window.addEventListener");
    }

    expect(marqueeSource).toContain("event.target !== event.currentTarget");
    expect(marqueeSource).toContain("event.currentTarget.setPointerCapture(event.pointerId)");
    expect(marqueeSource).toContain("releasePointerCapture(session.pointerId)");
    expect(marqueeSource).not.toContain("document.addEventListener");
    expect(marqueeSource).not.toContain("window.addEventListener");
    expect(marqueeSource).not.toContain("DataTransfer");
    expect(cssSource).toMatch(/\.konqueror-selection-marquee\s*\{[\s\S]*?pointer-events: none;/);
  });

  it("renders context menus through the owner WindowPopupLayer while keeping application content clipped", () => {
    const viewportIndex = konquerorSource.indexOf('className={`konqueror-directory-viewport');
    const popupLayerIndex = konquerorSource.indexOf("<WindowOwnedPopupPortal>");

    expect(viewportIndex).toBeGreaterThan(-1);
    expect(popupLayerIndex).toBeGreaterThan(viewportIndex);
    expect(cssSource).toMatch(/\.konqueror-content\s*\{[\s\S]*?overflow: hidden;/);
    expect(cssSource).toMatch(/\.konqueror-directory-viewport\s*\{[\s\S]*?overflow: auto;/);
    expect(konquerorSource).toContain("windowPopupLayer?.popupLayerRef ?? contentRef");
    expect(cssSource).toMatch(/\.window-owned-popup-layer\s*\{[\s\S]*?overflow: visible;[\s\S]*?pointer-events: none;/);
    expect(cssSource).toMatch(/\.konqueror-context-menu\s*\{[\s\S]*?pointer-events: auto;/);
  });
});
