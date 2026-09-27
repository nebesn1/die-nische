// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KonquerorToolbar } from "./KonquerorToolbar";

let container: HTMLDivElement;
let reactRoot: Root;

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  reactRoot = createRoot(container);
});

afterEach(() => {
  act(() => reactRoot.unmount());
  container.remove();
});

describe("KonquerorToolbar DOM actions", () => {
  it("uses the shared Icon View action and an explicit New Konqueror action", () => {
    const onIconView = vi.fn();
    const onNewWindow = vi.fn();

    act(() => {
      reactRoot.render(
        <KonquerorToolbar
          profile="resource-manager"
          canGoBack={false}
          canGoForward={false}
          canGoUp={false}
          canGoHome
          canReload
          canStop={false}
          canSecurity={false}
          canPrint={false}
          canZoomIn
          canZoomOut
          canCut={false}
          canCopy={false}
          canPaste={false}
          cutTitle="Select a file or folder first"
          copyTitle="Select a file or folder first"
          pasteTitle="Copy or cut an item before pasting"
          directoryViewMode="tree"
          viewControlsDisabled={false}
          onBack={vi.fn()}
          onForward={vi.fn()}
          onUp={vi.fn()}
          onHome={vi.fn()}
          onReload={vi.fn()}
          onStop={vi.fn()}
          onSecurity={vi.fn()}
          onPrint={vi.fn()}
          onCut={vi.fn()}
          onCopy={vi.fn()}
          onPaste={vi.fn()}
          onIconView={onIconView}
          onTreeView={vi.fn()}
          onZoomIn={vi.fn()}
          onZoomOut={vi.fn()}
          onNewWindow={onNewWindow}
        />,
      );
    });

    const iconView = container.querySelector<HTMLButtonElement>("button[aria-label='Icon View']");
    const treeView = container.querySelector<HTMLButtonElement>("button[aria-label='Tree View']");
    const newWindow = container.querySelector<HTMLButtonElement>("button[aria-label='New Konqueror Window']");

    act(() => {
      iconView?.click();
      newWindow?.click();
    });

    expect(onIconView).toHaveBeenCalledTimes(1);
    expect(onNewWindow).toHaveBeenCalledTimes(1);
    expect(treeView?.disabled).toBe(false);
  });
});
