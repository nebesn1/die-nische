// @vitest-environment jsdom
import type { MouseEvent as ReactMouseEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import { activatePublishedTagPermalink } from "./tagActivation";

const createClickEvent = (options: MouseEventInit = {}): ReactMouseEvent<HTMLAnchorElement> => {
  const preventDefault = vi.fn();
  return {
    defaultPrevented: false,
    button: options.button ?? 0,
    metaKey: options.metaKey ?? false,
    ctrlKey: options.ctrlKey ?? false,
    shiftKey: options.shiftKey ?? false,
    altKey: options.altKey ?? false,
    preventDefault,
    isDefaultPrevented: () => false,
    isPropagationStopped: () => false,
    persist: () => undefined,
  } as unknown as ReactMouseEvent<HTMLAnchorElement>;
};

describe("published tag activation", () => {
  it("pushes a canonical hash only when needed while always activating the exact ordinary tag", () => {
    window.history.replaceState(null, "", "/");
    const activate = vi.fn();
    const pushState = vi.spyOn(window.history, "pushState");

    activatePublishedTagPermalink(createClickEvent(), "C++", activate);
    expect(window.location.hash).toBe("#/blog/tag/C%2B%2B");
    expect(pushState).toHaveBeenCalledTimes(1);
    expect(activate).toHaveBeenLastCalledWith("C++");

    activatePublishedTagPermalink(createClickEvent(), "C++", activate);
    expect(pushState).toHaveBeenCalledTimes(1);
    expect(activate).toHaveBeenCalledTimes(2);
    expect(activate).toHaveBeenLastCalledWith("C++");
  });

  it("keeps modified tag activation native without changing current-window history or selection", () => {
    window.history.replaceState(null, "", "/");
    const activate = vi.fn();
    const pushState = vi.spyOn(window.history, "pushState");

    activatePublishedTagPermalink(createClickEvent({ ctrlKey: true }), "A/B", activate);

    expect(window.location.hash).toBe("");
    expect(pushState).not.toHaveBeenCalled();
    expect(activate).not.toHaveBeenCalled();
  });
});
