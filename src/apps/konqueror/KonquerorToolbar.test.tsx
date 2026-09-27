import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { KonquerorToolbar } from "./KonquerorToolbar";
import type { KonquerorToolbarProfile } from "./toolbarProfile";
import type { WindowLayoutMode } from "../../window-manager/types";

const noop = () => undefined;

const renderToolbar = (profile: KonquerorToolbarProfile, viewMode: "tree" | "icons" = "tree", layoutMode: WindowLayoutMode = "desktop"): string =>
  renderToStaticMarkup(
    <KonquerorToolbar
      profile={profile}
      layoutMode={layoutMode}
      canGoBack
      canGoForward
      canGoUp
      canGoHome
      canReload
      canStop={false}
      canSecurity={profile === "web"}
      canPrint={profile !== "resource-manager"}
      canZoomIn
      canZoomOut
      canCut
      canCopy
      canPaste
      cutTitle="Cut"
      copyTitle="Copy"
      pasteTitle="Paste"
      directoryViewMode={viewMode}
      viewControlsDisabled={false}
      onBack={noop}
      onForward={noop}
      onUp={noop}
      onHome={noop}
      onReload={noop}
      onStop={noop}
      onSecurity={noop}
      onPrint={noop}
      onCut={noop}
      onCopy={noop}
      onPaste={noop}
      onIconView={noop}
      onTreeView={noop}
      onZoomIn={noop}
      onZoomOut={noop}
      onNewWindow={noop}
    />,
  );

const getButtonLabels = (markup: string): string[] =>
  [...markup.matchAll(/<button[^>]*aria-label="([^"]+)"[^>]*>/g)].map((match) => match[1]);

const expectHomeSeparatedFromReload = (markup: string) => {
  expect(markup).toMatch(
    /aria-label="Home"[^>]*>[\s\S]*?<\/button><span class="toolbar-separator" aria-hidden="true"><\/span><\/span><span class="toolbar-group" data-toolbar-group="1">[\s\S]*?aria-label="Reload"/,
  );
};

describe("KonquerorToolbar", () => {
  it("renders the Resource Manager KDE3 button inventory in order", () => {
    const markup = renderToolbar("resource-manager");

    expect(getButtonLabels(markup)).toEqual([
      "Up", "Back", "Forward", "Home", "Reload", "Stop",
      "Cut", "Copy", "Paste",
      "Print",
      "Zoom In", "Zoom Out",
      "Icon View", "Tree View",
      "New Konqueror Window",
    ]);
    expect(markup).toContain('data-toolbar-profile="resource-manager"');
    expect(markup.match(/class="toolbar-separator"/g)).toHaveLength(5);
    expectHomeSeparatedFromReload(markup);
    expect(markup).toContain('class="toolbar-spacer"');
    expect(markup).not.toContain("Image View");
    expect(markup).not.toContain("Download");
  });

  it("renders the Web and Document inventories without resource-only view controls", () => {
    const webMarkup = renderToolbar("web");
    const documentMarkup = renderToolbar("document");

    expect(getButtonLabels(webMarkup)).toEqual([
      "Up", "Back", "Forward", "Home", "Reload", "Stop",
      "Cut", "Copy", "Paste",
      "Print",
      "Zoom In", "Zoom Out",
      "Security",
      "New Konqueror Window",
    ]);
    expect(getButtonLabels(documentMarkup)).toEqual([
      "Up", "Back", "Forward", "Home", "Reload", "Stop",
      "Cut", "Copy", "Paste",
      "Print",
      "Zoom In", "Zoom Out",
      "New Konqueror Window",
    ]);
    expect(webMarkup).not.toContain("Icon View");
    expect(documentMarkup).not.toContain("Security");
    expect(documentMarkup).not.toContain("Tree View");
    expect(webMarkup).not.toMatch(/aria-label="Security"[^>]*disabled=""/);
    expect(webMarkup).not.toContain("Download");
    expect(documentMarkup).not.toContain("Download");
    expectHomeSeparatedFromReload(webMarkup);
    expectHomeSeparatedFromReload(documentMarkup);
  });

  it("keeps the image toolbar's single Home-to-Reload separator", () => {
    const markup = renderToolbar("image");

    expectHomeSeparatedFromReload(markup);
    expect(markup.match(/class="toolbar-separator"/g)).toHaveLength(4);
  });

  it("marks Icon View from the shared resource view state while preserving disabled Resource output", () => {
    const markup = renderToolbar("resource-manager", "icons");

    expect(markup).toMatch(/aria-label="Icon View"[^>]*aria-pressed="true"/);
    expect(markup).toMatch(/aria-label="Tree View"[^>]*aria-pressed="false"/);
    expect(markup).toMatch(/aria-label="Print"[^>]*disabled=""/);
    expect(markup).not.toMatch(/aria-label="Zoom In"[^>]*disabled=""/);
    expect(markup).toMatch(/aria-label="Stop"[^>]*disabled=""/);
  });

  it("enables Print for an internal content capability without changing toolbar geometry", () => {
    const markup = renderToolbar("web");

    expect(markup).not.toMatch(/aria-label="Print"[^>]*disabled=""/);
    expect(markup).not.toMatch(/aria-label="Zoom In"[^>]*disabled=""/);
  });

  it("marks Tree View as the default Resource mode and keeps its buttons mutually exclusive", () => {
    const markup = renderToolbar("resource-manager", "tree");

    expect(markup).toMatch(/aria-label="Icon View"[^>]*aria-pressed="false"/);
    expect(markup).toMatch(/aria-label="Tree View"[^>]*aria-pressed="true"/);
    expect(markup).not.toContain("Details View");
  });

  it("keeps all controls as native buttons with accessible labels", () => {
    const markup = renderToolbar("web");

    expect(markup).toContain('aria-label="Konqueror toolbar"');
    expect(markup).toContain('aria-label="New Konqueror Window"');
    expect(markup).toContain('title="New Konqueror Window"');
    expect(markup.match(/type="button"/g)?.length).toBe(getButtonLabels(markup).length);
  });

  it("uses the compact mobile navigation group and keeps the New Window launcher on the right", () => {
    const markup = renderToolbar("image", "tree", "mobile");

    expect(getButtonLabels(markup)).toEqual([
      "Up", "Back", "Forward", "Home", "Reload", "Stop", "New Konqueror Window",
    ]);
    expect([...markup.matchAll(/data-toolbar-action="([^"]+)"/g)].map((match) => match[1])).toEqual([
      "up", "back", "forward", "home", "reload", "stop", "new-window",
    ]);
    expect(markup).toContain('data-toolbar-layout="mobile"');
    expect(markup).not.toContain('data-toolbar-action="cut"');
    expect(markup).not.toContain('data-toolbar-action="copy"');
    expect(markup).not.toContain('data-toolbar-action="paste"');
    expect(markup).not.toContain('data-toolbar-action="print"');
    expect(markup).not.toContain('class="toolbar-separator"');
    expect(markup).not.toContain('class="toolbar-grip"');
  });
});
