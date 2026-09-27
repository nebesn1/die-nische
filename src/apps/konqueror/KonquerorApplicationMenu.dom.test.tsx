// @vitest-environment jsdom
import { StrictMode, act, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KonquerorApplicationMenu } from "./KonquerorApplicationMenu";
import type { KonquerorApplicationMenuEntry, KonquerorApplicationMenuRequest } from "./applicationMenuModel";

const entries: readonly KonquerorApplicationMenuEntry[] = [
  { kind: "action", action: "back", label: "Back", enabled: true, title: "Back" },
];

const submenuEntries: readonly KonquerorApplicationMenuEntry[] = [
  {
    kind: "submenu",
    id: "sort",
    label: "Sort",
    enabled: true,
    title: "Sort",
    items: [
      { kind: "action", action: "sort-name", label: "By Name", enabled: true, title: "By Name", checked: true, checkKind: "radio" },
      { kind: "separator" },
      {
        kind: "action",
        action: "toggle-sort-direction",
        label: "Descending",
        enabled: true,
        title: "Descending",
        checked: false,
        checkKind: "checkbox",
      },
    ],
  },
];

let container: HTMLDivElement;
let reactRoot: Root;

const rect = (left: number, top: number, width: number, height: number): DOMRect => ({
  x: left,
  y: top,
  width,
  height,
  top,
  right: left + width,
  bottom: top + height,
  left,
  toJSON: () => ({}),
}) as DOMRect;

const triggerPositions = {
  Location: rect(86, 40, 54, 21),
  Edit: rect(144, 40, 36, 21),
  View: rect(184, 40, 39, 21),
  Go: rect(227, 40, 31, 21),
  Bookmarks: rect(262, 40, 66, 21),
  Tools: rect(332, 40, 42, 21),
  Settings: rect(378, 40, 55, 21),
  Window: rect(437, 40, 52, 21),
  Help: rect(493, 40, 38, 21),
} as const;

const renderMenu = (openMenu: KonquerorApplicationMenuRequest | null, menuEntries = entries) => {
  act(() => {
    reactRoot.render(
      <StrictMode>
        <KonquerorApplicationMenu
          menuBarRef={createRef<HTMLElement>()}
          popupRef={createRef<HTMLDivElement>()}
          screenArea={{ x: 0, y: 0, width: 900, height: 686 }}
          openMenu={openMenu}
          entries={menuEntries}
          onToggleMenu={() => undefined}
          onAction={() => undefined}
          onEscape={() => undefined}
        />
      </StrictMode>,
    );
  });
};

const getPopup = (): HTMLElement => {
  const popup = container.querySelector<HTMLElement>(".konqueror-menu-popup");

  if (!popup) {
    throw new Error("Missing Konqueror application menu popup");
  }

  return popup;
};

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  reactRoot = createRoot(container);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function getBoundingClientRect(this: HTMLElement) {
    if (this.classList.contains("konqueror-menu-popup")) {
      return rect(0, 0, 150, 188);
    }

    if (this.dataset.submenuId) {
      return rect(840, 640, 150, 21);
    }

    if (this.classList.contains("konqueror-menuitem")) {
      return triggerPositions[this.textContent as keyof typeof triggerPositions];
    }

    return rect(0, 0, 0, 0);
  });
});

afterEach(() => {
  act(() => reactRoot.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe("Konqueror application-menu pre-paint positioning", () => {
  it("uses each menu trigger's current rect and never exposes a previous menu position", () => {
    renderMenu({ menu: "location", requestId: 1 });
    const popup = getPopup();
    expect(popup.dataset.menuRequestId).toBe("1");
    expect(popup.dataset.positioned).toBe("true");
    expect(popup.style.left).toBe("86px");
    expect(popup.style.top).toBe("60px");

    renderMenu({ menu: "edit", requestId: 2 });
    expect(popup.dataset.menuRequestId).toBe("2");
    expect(popup.dataset.positioned).toBe("true");
    expect(popup.style.left).toBe("144px");
    expect(popup.style.top).toBe("60px");

    renderMenu({ menu: "view", requestId: 3 });
    expect(popup.dataset.menuRequestId).toBe("3");
    expect(popup.dataset.positioned).toBe("true");
    expect(popup.style.left).toBe("184px");
    expect(popup.style.top).toBe("60px");
  });

  it("creates a fresh positioned request when the same menu reopens", () => {
    renderMenu({ menu: "help", requestId: 4 });
    expect(getPopup().style.left).toBe("493px");

    renderMenu(null);
    expect(container.querySelector(".konqueror-menu-popup")).toBeNull();

    renderMenu({ menu: "help", requestId: 5 });
    const popup = getPopup();
    expect(popup.dataset.menuRequestId).toBe("5");
    expect(popup.dataset.positioned).toBe("true");
    expect(popup.style.left).toBe("493px");
    expect(popup.style.top).toBe("60px");
  });

  it("keeps nested menus owner-scoped, pre-paint positioned, and flipped inside ScreenArea", () => {
    renderMenu({ menu: "view", requestId: 6 }, submenuEntries);

    const sortTrigger = container.querySelector<HTMLButtonElement>("button[data-submenu-id='sort']");
    if (!sortTrigger) throw new Error("Missing Sort submenu trigger");

    act(() => sortTrigger.click());

    const submenu = container.querySelector<HTMLElement>(".konqueror-menu-popup--submenu");
    if (!submenu) throw new Error("Missing Sort submenu");
    expect(submenu.style.visibility).not.toBe("hidden");
    expect(submenu.style.right).toBe("calc(100% - 2px)");
    expect(submenu.textContent).toContain("By Name");
    expect(submenu.querySelector("button[role='menuitemradio']")?.getAttribute("aria-checked")).toBe("true");
    expect(submenu.querySelector("button[role='menuitemcheckbox']")?.getAttribute("aria-checked")).toBe("false");

    renderMenu({ menu: "edit", requestId: 7 }, entries);
    expect(container.querySelector(".konqueror-menu-popup--submenu")).toBeNull();
  });
});
