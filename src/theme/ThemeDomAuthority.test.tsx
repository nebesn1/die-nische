// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { DesktopPreferencesProvider } from "../preferences/DesktopPreferencesContext";
import { DEFAULT_DESKTOP_PREFERENCES } from "../preferences/desktopPreferences";
import { useDesktopPreferences } from "../preferences/useDesktopPreferences";
import { ThemeDomAuthority } from "./ThemeDomAuthority";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function ThemeControl() {
  const { applyPreferences, preferences } = useDesktopPreferences();

  return (
    <>
      <ThemeDomAuthority />
      <button type="button" onClick={() => applyPreferences({ ...preferences, themeId: "redmond" })}>Redmond</button>
    </>
  );
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  document.documentElement.removeAttribute("data-kde-theme");
  container = null;
  root = null;
});

describe("global theme DOM authority", () => {
  it("reflects the applied DesktopPreferences theme on the document root without remounting the tree", () => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    act(() => root?.render(
      <DesktopPreferencesProvider initialPreferences={DEFAULT_DESKTOP_PREFERENCES}>
        <ThemeControl />
      </DesktopPreferencesProvider>,
    ));

    expect(document.documentElement.dataset.kdeTheme).toBe("kde-classic");
    const control = container.querySelector("button");
    if (!control) throw new Error("Missing theme control.");
    act(() => control.click());
    expect(document.documentElement.dataset.kdeTheme).toBe("redmond");
    expect(container.querySelector("button")).toBe(control);
  });
});
