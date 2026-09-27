// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nContext } from "../i18n/I18nContext";
import { createTranslator } from "../i18n/translate";
import type { DesktopIconDefinition } from "./desktopIconTypes";
import { DesktopIcon } from "./DesktopIcon";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const definition: DesktopIconDefinition = {
  id: "desktop-blog",
  label: "Blog",
  labelLines: ["Blog"],
  iconId: "blog",
  initialColumn: 1,
  initialRow: 1,
  action: { type: "launch-application", appId: "blog" },
};

const secondDefinition: DesktopIconDefinition = {
  ...definition,
  id: "desktop-notes",
  label: "Notes",
  labelLines: ["Notes"],
  iconId: "kwrite",
  action: { type: "launch-application", appId: "kwrite" },
};

let container: HTMLDivElement | null = null;
let root: Root | null = null;

const createPointerEvent = (type: string, pointerId = 1) => {
  const event = new Event(type, { bubbles: true, cancelable: true }) as PointerEvent;
  Object.defineProperties(event, {
    button: { value: 0 },
    clientX: { value: 52 },
    clientY: { value: 44 },
    isPrimary: { value: true },
    pointerId: { value: pointerId },
    pointerType: { value: "touch" },
  });
  return event;
};

function TouchIconHarness({ onOpen, onContext }: { onOpen: ReturnType<typeof vi.fn>; onContext: ReturnType<typeof vi.fn> }) {
  const [selected, setSelected] = useState(false);
  return (
    <I18nContext.Provider value={{ locale: "en", t: createTranslator("en") }}>
      <DesktopIcon
        definition={definition}
        icon={<span>icon</span>}
        selected={selected}
        onSelect={() => setSelected(true)}
        onOpen={onOpen}
        onNavigate={() => undefined}
        onClearSelection={() => setSelected(false)}
        onOpenContextMenu={onContext}
      />
    </I18nContext.Provider>
  );
}

function TwoTouchIconHarness({ onOpen, onContext }: { onOpen: ReturnType<typeof vi.fn>; onContext: ReturnType<typeof vi.fn> }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const renderIcon = (iconDefinition: DesktopIconDefinition) => (
    <DesktopIcon
      definition={iconDefinition}
      icon={<span>{iconDefinition.label}</span>}
      selected={selectedId === iconDefinition.id}
      onSelect={setSelectedId}
      onOpen={onOpen}
      onNavigate={() => undefined}
      onClearSelection={() => setSelectedId(null)}
      onOpenContextMenu={onContext}
    />
  );

  return (
    <I18nContext.Provider value={{ locale: "en", t: createTranslator("en") }}>
      {renderIcon(definition)}
      {renderIcon(secondDefinition)}
    </I18nContext.Provider>
  );
}

const renderHarness = (onOpen: ReturnType<typeof vi.fn>, onContext: ReturnType<typeof vi.fn>) => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(<TouchIconHarness onOpen={onOpen} onContext={onContext} />));
  const button = container.querySelector<HTMLButtonElement>("[data-desktop-icon]");
  if (!button) throw new Error("Desktop icon missing");
  return button;
};

const renderTwoIconHarness = (onOpen: ReturnType<typeof vi.fn>, onContext: ReturnType<typeof vi.fn>) => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(<TwoTouchIconHarness onOpen={onOpen} onContext={onContext} />));
  const buttons = [...container.querySelectorAll<HTMLButtonElement>("[data-desktop-icon]")];
  if (buttons.length !== 2) throw new Error("Desktop icons missing");
  return buttons;
};

const tap = (button: HTMLButtonElement, pointerId: number) => {
  act(() => button.dispatchEvent(createPointerEvent("pointerdown", pointerId)));
  act(() => button.dispatchEvent(createPointerEvent("pointerup", pointerId)));
  act(() => button.click());
};

afterEach(() => {
  vi.useRealTimers();
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe("DesktopIcon touch interaction", () => {
  it("selects on the first touch tap and opens exactly once on the second tap", () => {
    const onOpen = vi.fn();
    const onContext = vi.fn();
    const button = renderHarness(onOpen, onContext);

    tap(button, 1);
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(onOpen).not.toHaveBeenCalled();

    tap(button, 2);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onContext).not.toHaveBeenCalled();
  });

  it("opens the existing icon context-menu boundary on long press and consumes the ghost click", () => {
    vi.useFakeTimers();
    const onOpen = vi.fn();
    const onContext = vi.fn();
    const button = renderHarness(onOpen, onContext);

    act(() => button.dispatchEvent(createPointerEvent("pointerdown")));
    act(() => vi.advanceTimersByTime(500));
    expect(onContext).toHaveBeenCalledWith("desktop-blog", 52, 44);

    act(() => button.dispatchEvent(createPointerEvent("pointerup")));
    act(() => button.click());
    expect(onOpen).not.toHaveBeenCalled();
    expect(onContext).toHaveBeenCalledTimes(1);
  });

  it("does not retain a pending second-tap open after another icon becomes selected", () => {
    const onOpen = vi.fn();
    const onContext = vi.fn();
    const [blog, notes] = renderTwoIconHarness(onOpen, onContext);

    tap(blog, 1);
    tap(notes, 2);
    expect(blog.getAttribute("aria-pressed")).toBe("false");
    expect(notes.getAttribute("aria-pressed")).toBe("true");
    expect(onOpen).not.toHaveBeenCalled();

    tap(blog, 3);
    expect(blog.getAttribute("aria-pressed")).toBe("true");
    expect(onOpen).not.toHaveBeenCalled();
  });
});
