// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getDesktopUiScale,
  getEffectiveDesktopUiScale,
  getRequestedDesktopUiScale,
  getCssViewportSize,
  getLogicalViewportSize,
  toLogicalCoordinate,
  toLogicalPoint,
  toLogicalRect,
} from "./desktopUiScale";

const makeRect = (width: number, height: number): DOMRect => ({
  bottom: height,
  height,
  left: 0,
  right: width,
  top: 0,
  width,
  x: 0,
  y: 0,
  toJSON: () => ({}),
} as DOMRect);

describe("desktop UI scale geometry", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses the stylesheet scale token and converts physical geometry to logical coordinates", () => {
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      getPropertyValue: () => "1.4",
    } as unknown as CSSStyleDeclaration);

    expect(getDesktopUiScale()).toBe(1.4);
    expect(toLogicalCoordinate(140)).toBe(100);
    expect(toLogicalPoint({ x: 280, y: 420 })).toEqual({ x: 200, y: 300 });
    expect(toLogicalRect({ left: 14, top: 28, right: 154, bottom: 168, width: 140, height: 140 })).toMatchObject({
      left: 10,
      top: 20,
      right: 110,
      width: 100,
      height: 100,
    });
    expect(toLogicalRect({ left: 14, top: 28, right: 154, bottom: 168, width: 140, height: 140 }).bottom).toBeCloseTo(120);
  });

  it("uses the browser-applied shell zoom for rendered geometry when it differs from the requested scale", () => {
    const shell = document.createElement("main");
    shell.className = "desktop-shell";
    document.body.append(shell);
    vi.spyOn(window, "getComputedStyle").mockImplementation((element) => ({
      zoom: element === shell ? "1.40625" : "",
      getPropertyValue: (property: string) => property === "--kde-ui-scale" ? "1.4" : "",
    } as unknown as CSSStyleDeclaration));

    expect(getRequestedDesktopUiScale()).toBe(1.4);
    expect(getEffectiveDesktopUiScale()).toBe(1.40625);
    expect(getDesktopUiScale()).toBe(1.40625);
    expect(toLogicalCoordinate(140.625)).toBeCloseTo(100);

    shell.remove();
  });

  it("falls back to the requested scale before the shell exists or when computed zoom is invalid", () => {
    vi.spyOn(window, "getComputedStyle").mockImplementation((element) => ({
      zoom: element instanceof HTMLElement ? "auto" : "",
      getPropertyValue: (property: string) => property === "--kde-ui-scale" ? "1.4" : "",
    } as unknown as CSSStyleDeclaration));

    expect(getRequestedDesktopUiScale()).toBe(1.4);
    expect(getEffectiveDesktopUiScale()).toBe(1.4);

    const shell = document.createElement("main");
    shell.className = "desktop-shell";
    document.body.append(shell);
    expect(getEffectiveDesktopUiScale()).toBe(1.4);
    shell.remove();
  });

  it("derives the logical viewport from the physical browser viewport", () => {
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      getPropertyValue: () => "1.4",
    } as unknown as CSSStyleDeclaration);
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1400 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 980 });

    expect(getLogicalViewportSize().width).toBeCloseTo(1000);
    expect(getLogicalViewportSize().height).toBeCloseTo(700);
  });

  it("derives logical viewport dimensions from the effective scale", () => {
    const root = document.createElement("div");
    root.id = "root";
    document.body.append(root);
    const shell = document.createElement("main");
    shell.className = "desktop-shell";
    root.append(shell);
    vi.spyOn(root, "getBoundingClientRect").mockReturnValue(makeRect(1920, 1080));
    vi.spyOn(window, "getComputedStyle").mockImplementation((element) => ({
      zoom: element === shell ? "1.40625" : "",
      getPropertyValue: (property: string) => property === "--kde-ui-scale" ? "1.4" : "",
    } as unknown as CSSStyleDeclaration));

    expect(getLogicalViewportSize().width).toBeCloseTo(1920 / 1.40625);
    expect(getLogicalViewportSize().height).toBeCloseTo(1080 / 1.40625);

    root.remove();
  });

  it("round-trips measured viewport widths for quantized and exact applied scales", () => {
    const root = document.createElement("div");
    root.id = "root";
    const shell = document.createElement("main");
    shell.className = "desktop-shell";
    root.append(shell);
    document.body.append(root);
    let viewportWidth = 1920;
    let appliedZoom = 1.40625;
    vi.spyOn(root, "getBoundingClientRect").mockImplementation(() => makeRect(viewportWidth, 1080));
    vi.spyOn(window, "getComputedStyle").mockImplementation((element) => ({
      zoom: element === shell ? `${appliedZoom}` : "",
      getPropertyValue: (property: string) => property === "--kde-ui-scale" ? "1.4" : "",
    } as unknown as CSSStyleDeclaration));

    expect(getLogicalViewportSize().width * appliedZoom).toBeCloseTo(1920);

    viewportWidth = 1024;
    expect(getLogicalViewportSize().width * appliedZoom).toBeCloseTo(1024);

    appliedZoom = 1.4;
    expect(getLogicalViewportSize().width * appliedZoom).toBeCloseTo(1024);

    root.remove();
  });

  it("prefers the unzoomed root used geometry over stale window dimensions", () => {
    const root = document.createElement("div");
    root.id = "root";
    document.body.append(root);
    vi.spyOn(root, "getBoundingClientRect").mockReturnValue(makeRect(390, 844));
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 412 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 915 });

    expect(getCssViewportSize()).toEqual({ width: 390, height: 844 });

    root.remove();
  });

  it("falls back to window dimensions when the root is missing or has unusable geometry", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 412 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 915 });
    expect(getCssViewportSize()).toEqual({ width: 412, height: 915 });

    const root = document.createElement("div");
    root.id = "root";
    document.body.append(root);
    const rootRect = vi.spyOn(root, "getBoundingClientRect");

    rootRect.mockReturnValue(makeRect(0, 0));
    expect(getCssViewportSize()).toEqual({ width: 412, height: 915 });

    rootRect.mockReturnValue({ width: Number.NaN, height: Number.POSITIVE_INFINITY } as DOMRect);
    expect(getCssViewportSize()).toEqual({ width: 412, height: 915 });
    root.remove();
  });

  it("falls back to unscaled geometry when stylesheet variables are unavailable", () => {
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      getPropertyValue: () => "",
    } as unknown as CSSStyleDeclaration);

    expect(getDesktopUiScale()).toBe(1);
    expect(toLogicalCoordinate(140)).toBe(140);
  });
});
