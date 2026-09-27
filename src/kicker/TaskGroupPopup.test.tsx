import { createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { DesktopWindow } from "../window-manager/types";
import { TaskGroupButton } from "./TaskGroupButton";
import { TaskGroupPopup } from "./TaskGroupPopup";

const member = (id: string, title: string, overrides: Partial<DesktopWindow> = {}): DesktopWindow => ({
  id,
  appId: "konqueror",
  title,
  iconId: "konqueror",
  desktopId: 1,
  bounds: { x: 0, y: 0, width: 320, height: 220 },
  zIndex: 1,
  isActive: false,
  state: "normal",
  isDraggable: true,
  minimumWidth: 280,
  minimumHeight: 180,
  isResizable: true,
  ...overrides,
});

describe("TaskGroupPopup", () => {
  it("renders live display titles in creation order with active and minimized member presentation", () => {
    const active = member("app:konqueror", "Documents - Konqueror", { isActive: true });
    const minimized = member("app:konqueror::2", "Documents - Konqueror<2>", { state: "minimized" });
    const markup = renderToStaticMarkup(
      <TaskGroupPopup
        appId="konqueror"
        getWindowIconId={(desktopWindow) => desktopWindow.id.endsWith("::2") ? "documents" : "konqueror"}
        members={[active, minimized]}
        activeWindowId={active.id}
        left={20}
        top={620}
        maxHeight={620}
        onClose={() => undefined}
        onSelectWindow={() => undefined}
      />,
    );

    expect(markup).toContain('role="menu"');
    expect(markup.indexOf("Documents - Konqueror")).toBeLessThan(markup.indexOf("Documents - Konqueror&lt;2&gt;"));
    expect(markup).toContain('data-task-group-member="app:konqueror"');
    expect(markup).toContain('data-task-group-member="app:konqueror::2"');
    expect(markup).toContain("task-group-popup__item is-active");
    expect(markup).toContain("task-group-popup__item is-minimized");
    expect(markup).toContain('data-task-window-icon-state="running"');
    expect(markup).toContain('data-task-window-icon-state="minimized"');
    expect(markup).toContain("Minimize Documents - Konqueror");
    expect(markup).toContain("Restore Documents - Konqueror&lt;2&gt;");
    expect(markup).toContain('aria-label="Documents folder"');
  });

  it("keeps active, inactive-visible, and minimized members independently synchronized", () => {
    const active = member("app:konqueror", "Documents - Konqueror", { isActive: true });
    const inactive = member("app:konqueror::2", "Trash - Konqueror");
    const minimized = member("app:konqueror::3", "My Computer - Konqueror", { state: "minimized" });
    const otherVisible = member("app:konqueror::4", "Downloads - Konqueror");
    const markup = renderToStaticMarkup(
      <TaskGroupPopup
        appId="konqueror"
        getWindowIconId={(desktopWindow) => desktopWindow.id.endsWith("::3") ? "trash" : "documents"}
        members={[active, inactive, minimized, otherVisible]}
        activeWindowId={active.id}
        left={20}
        top={620}
        maxHeight={620}
        onClose={() => undefined}
        onSelectWindow={() => undefined}
      />,
    );

    expect(markup.match(/data-task-window-icon-state="running"/g)).toHaveLength(3);
    expect(markup.match(/data-task-window-icon-state="minimized"/g)).toHaveLength(1);
    expect(markup.match(/task-group-popup__item is-minimized/g)).toHaveLength(1);
    expect(markup).toContain('data-task-group-member="app:konqueror::2"');
    expect(markup).toContain('data-task-group-member="app:konqueror::3"');
    expect(markup.match(/aria-label="Documents folder"/g)).toHaveLength(3);
    expect(markup.match(/aria-label="Trash"/g)).toHaveLength(1);
  });

  it("uses a group affordance without a visible count badge or a synthetic window id", () => {
    const markup = renderToStaticMarkup(
      <TaskGroupButton
        ref={createRef<HTMLButtonElement>()}
        appId="konqueror"
        iconId="konqueror"
        isActive
        isOpen={false}
        title="Trash - Konqueror"
        windowCount={3}
        representativeWindowState="normal"
        onToggle={() => undefined}
      />,
    );

    expect(markup).toContain('aria-haspopup="menu"');
    expect(markup).toContain("task-group-button__arrow");
    expect(markup).toContain("▲");
    expect(markup).not.toContain("▼");
    expect(markup).not.toContain("Konqueror (3)");
    expect(markup).not.toContain("data-window-id");
  });

  it("keeps the representative semantic icon and minimized treatment on the same window", () => {
    const markup = renderToStaticMarkup(
      <TaskGroupButton
        ref={createRef<HTMLButtonElement>()}
        appId="konqueror"
        iconId="documents"
        isActive={false}
        isOpen={false}
        title="Documents - Konqueror"
        windowCount={2}
        representativeWindowState="minimized"
        onToggle={() => undefined}
      />,
    );

    expect(markup).toContain('aria-label="Documents folder"');
    expect(markup).toContain('data-task-window-icon-state="minimized"');
  });
});
