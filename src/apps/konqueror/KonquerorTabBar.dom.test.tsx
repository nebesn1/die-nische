import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { KonquerorTabBar } from "./KonquerorTabBar";
import { addKonquerorTab, createInitialKonquerorWindowTabs } from "./konquerorTabs";

describe("KonquerorTabBar", () => {
  it("hides the implicit one-tab session and renders KDE3 controls only for multiple tabs", () => {
    const one = createInitialKonquerorWindowTabs({ type: "directory", nodeId: "documents" }, "/home/user/Documents");
    const two = addKonquerorTab(one, { type: "file", nodeId: "notes", previewerId: "embedded-text" }, "/home/user/Documents/notes.txt");

    expect(renderToStaticMarkup(
      <KonquerorTabBar tabs={one.tabs} activeTabId={one.activeTabId} getLabel={() => "Documents"} onNewTab={() => undefined} onSelectTab={() => undefined} onCloseCurrentTab={() => undefined} />,
    )).toBe("");

    const markup = renderToStaticMarkup(
      <KonquerorTabBar tabs={two.tabs} activeTabId={two.activeTabId} getLabel={(tab) => tab.id === "tab-1" ? "Documents" : "notes.txt"} onNewTab={() => undefined} onSelectTab={() => undefined} onCloseCurrentTab={() => undefined} />,
    );
    expect(markup).toContain('class="konqueror-tabbar"');
    expect(markup).toContain('aria-label="New Tab"');
    expect(markup).toContain('aria-label="Close Current Tab"');
    expect(markup).toContain('role="tablist"');
    expect(markup).toContain('data-konqueror-tab-id="tab-2"');
    expect(markup).not.toContain("onDoubleClick");
  });
});
