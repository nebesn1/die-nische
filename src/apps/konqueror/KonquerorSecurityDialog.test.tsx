// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KonquerorSecurityDialog } from "./KonquerorSecurityDialog";

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

describe("KonquerorSecurityDialog", () => {
  it("renders owned HTTPS information without fabricated certificate attributes", () => {
    act(() => {
      reactRoot.render(
        <KonquerorSecurityDialog
          securityInfo={{
            kind: "external-https",
            location: "https://example.com:8443/path?q=one#section",
            protocol: "HTTPS",
            host: "example.com",
            port: "8443",
            loadStatus: "Loading stopped",
            summary: "The current page was requested using HTTPS.",
          }}
          onClose={() => undefined}
        />,
      );
    });

    expect(container.textContent).toContain("KDE SSL Information - Konqueror");
    expect(container.textContent).toContain("https://example.com:8443/path?q=one#section");
    expect(container.textContent).toContain("Host:");
    expect(container.textContent).toContain("example.com");
    expect(container.textContent).toContain("Loading stopped");
    expect(container.textContent).toContain("Detailed certificate information is unavailable in this web version of Konqueror.");
    expect(container.textContent).not.toContain("TLS version");
    expect(container.textContent).not.toContain("Cipher");
  });

  it("uses the existing dialog close contract for OK, titlebar close, and Escape", () => {
    const onClose = vi.fn();
    act(() => {
      reactRoot.render(
        <KonquerorSecurityDialog
          securityInfo={{
            kind: "internal",
            location: "about:konqueror",
            typeLabel: "Internal Konqueror page",
            summary: "The current connection is not secured with SSL.",
          }}
          onClose={onClose}
        />,
      );
    });

    const dialog = container.querySelector<HTMLElement>("[role='dialog']");
    const ok = container.querySelector<HTMLButtonElement>(".konqueror-dialog-button");
    const close = container.querySelector<HTMLButtonElement>("button[aria-label='Close KDE SSL Information']");
    expect(document.activeElement).toBe(ok);
    expect(dialog?.textContent).toContain("The current connection is not secured with SSL.");
    expect(dialog?.textContent).toContain("Internal Konqueror page");

    act(() => close?.click());
    act(() => ok?.click());
    act(() => dialog?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));

    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
