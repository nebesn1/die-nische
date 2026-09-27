// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RunCommandDialog } from "./RunCommandDialog";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let reactRoot: Root | null = null;

afterEach(() => {
  act(() => reactRoot?.unmount());
  container?.remove();
  container = null;
  reactRoot = null;
});

const renderDialog = () => {
  container = document.createElement("div");
  document.body.append(container);
  reactRoot = createRoot(container);
  const onChange = vi.fn();
  const onRun = vi.fn();
  const onCancel = vi.fn();

  act(() => reactRoot?.render(
    <RunCommandDialog value="" error={null} onChange={onChange} onRun={onRun} onCancel={onCancel} onDismissError={() => undefined} />,
  ));

  return { onChange, onRun, onCancel };
};

describe("RunCommandDialog", () => {
  it("focuses its single command field, submits on Enter, and cancels on Escape", () => {
    const handlers = renderDialog();
    const input = container?.querySelector<HTMLInputElement>("#run-command-input");
    const form = container?.querySelector<HTMLFormElement>("form");
    const dialog = container?.querySelector<HTMLElement>("[role=dialog]");
    if (!input || !form || !dialog) throw new Error("Run Command dialog is missing.");

    expect(document.activeElement).toBe(input);
    expect(container?.querySelector(".run-command-window")).not.toBeNull();
    expect(container?.querySelector(".run-command-window__titlebar")?.textContent).toBe("Run Command");
    expect(container?.querySelector(".run-command-dialog h2")).toBeNull();
    act(() => form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(handlers.onRun).toHaveBeenCalledTimes(1);
    act(() => dialog.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" })));
    expect(handlers.onCancel).toHaveBeenCalledTimes(1);
  });

  it("keeps the command dialog mounted behind a focused KDE-style error alert", () => {
    container = document.createElement("div");
    document.body.append(container);
    reactRoot = createRoot(container);
    const onDismissError = vi.fn();

    act(() => reactRoot?.render(
      <RunCommandDialog
        value="missing-command"
        error="missing-command: command not found"
        onChange={() => undefined}
        onRun={() => undefined}
        onCancel={() => undefined}
        onDismissError={onDismissError}
      />,
    ));

    const alert = container.querySelector<HTMLElement>("[role=alertdialog]");
    const input = container.querySelector<HTMLInputElement>("#run-command-input");
    const ok = alert?.querySelector<HTMLButtonElement>("button");
    if (!alert || !input || !ok) throw new Error("Command error alert is missing.");

    expect(input.value).toBe("missing-command");
    expect(alert.textContent).toContain("missing-command: command not found");
    expect(document.activeElement).toBe(ok);
    act(() => ok.click());
    expect(onDismissError).toHaveBeenCalledTimes(1);
  });
});
