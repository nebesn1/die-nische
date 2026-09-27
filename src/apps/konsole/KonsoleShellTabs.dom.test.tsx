// @vitest-environment jsdom
import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VfsProvider } from "../../vfs/VfsProvider";
import { Konsole } from "./Konsole";

let container: HTMLDivElement;
let reactRoot: Root;

const shellTab = (name: string) => {
  const tab = [...container.querySelectorAll<HTMLButtonElement>("[role='tab']")].find((candidate) => candidate.textContent === name);
  if (!tab) throw new Error(`Missing shell tab ${name}`);
  return tab;
};

const input = () => {
  const element = container.querySelector<HTMLInputElement>("[aria-label='Konsole command input']");
  if (!element) throw new Error("Missing command input");
  return element;
};

const changeInput = (element: HTMLInputElement, value: string) => {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (!setter) throw new Error("Missing input setter");
  act(() => {
    setter.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
};

const submit = (element: HTMLInputElement) => act(() => {
  element.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
});

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  reactRoot = createRoot(container);
});

afterEach(() => {
  act(() => reactRoot.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe("Konsole shell tabs", () => {
  it("creates independent sessions in the current Konsole window and preserves drafts across tabs", () => {
    const onNewWindow = vi.fn();
    act(() => {
      reactRoot.render(<VfsProvider><StrictMode><Konsole onRequestNewWindow={onNewWindow} /></StrictMode></VfsProvider>);
    });
    changeInput(input(), "echo A");
    act(() => container.querySelector<HTMLButtonElement>("[aria-label='New Shell']")?.click());

    expect([...container.querySelectorAll("[role='tab']")].map((tab) => tab.textContent)).toEqual(["Shell", "Shell No. 2"]);
    expect(container.querySelector("[role='tab'][aria-selected='true']")?.textContent).toBe("Shell No. 2");
    expect(onNewWindow).not.toHaveBeenCalled();
    changeInput(input(), "echo B");
    act(() => shellTab("Shell").click());
    expect(input().value).toBe("echo A");
    act(() => shellTab("Shell No. 2").click());
    expect(input().value).toBe("echo B");
  });

  it("routes commands and the dynamic title through the active shell", () => {
    const setTitle = vi.fn();
    act(() => {
      reactRoot.render(<VfsProvider><Konsole onSetWindowTitle={setTitle} /></VfsProvider>);
    });
    changeInput(input(), "cd Documents");
    submit(input());
    act(() => container.querySelector<HTMLButtonElement>("[aria-label='New Shell']")?.click());

    expect(setTitle).toHaveBeenLastCalledWith("user@kde3:/home/user - Shell No. 2 - Konsole");
    act(() => shellTab("Shell").click());
    expect(container.textContent).toContain("user@kde3:/home/user/Documents$");
    expect(setTitle).toHaveBeenLastCalledWith("user@kde3:/home/user/Documents - Shell - Konsole");
  });

  it("renames the exact active tab in an app-owned dialog and releases its slot only when closed", () => {
    const setTitle = vi.fn();
    act(() => {
      reactRoot.render(<VfsProvider><Konsole onSetWindowTitle={setTitle} /></VfsProvider>);
    });
    act(() => container.querySelector<HTMLButtonElement>("[aria-label='New Shell']")?.click());
    act(() => shellTab("Shell").dispatchEvent(new MouseEvent("dblclick", { bubbles: true })));
    const nameInput = container.querySelector<HTMLInputElement>("[aria-label='Shell name']");
    if (!nameInput) throw new Error("Missing rename input");
    changeInput(nameInput, "Server");
    act(() => [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "OK")?.click());

    expect(shellTab("Server")).toBeTruthy();
    expect(setTitle).toHaveBeenLastCalledWith("user@kde3:/home/user - Shell No. 2 - Konsole");
    act(() => shellTab("Server").click());
    expect(setTitle).toHaveBeenLastCalledWith("user@kde3:/home/user - Server - Konsole");
    act(() => container.querySelector<HTMLButtonElement>("[aria-label='Close Shell']")?.click());
    act(() => container.querySelector<HTMLButtonElement>("[aria-label='New Shell']")?.click());
    expect(shellTab("Shell No. 2")).toBeTruthy();
  });
});
