import { useCallback, useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { areResponsiveLayoutsEqual } from "./responsiveLayout";
import {
  applyResponsiveLayoutCssVariables,
  ResponsiveLayoutContext,
  readResponsiveLayoutFromBrowser,
} from "./responsiveLayoutContext";

const requestFrame = (callback: FrameRequestCallback): number => {
  if (typeof window.requestAnimationFrame === "function") {
    return window.requestAnimationFrame(callback);
  }

  return window.setTimeout(() => callback(performance.now()), 0);
};

const cancelFrame = (id: number): void => {
  if (typeof window.cancelAnimationFrame === "function") {
    window.cancelAnimationFrame(id);
    return;
  }

  window.clearTimeout(id);
};

export function ResponsiveLayoutProvider({ children }: { readonly children: ReactNode }) {
  const [layout, setLayout] = useState(readResponsiveLayoutFromBrowser);

  const refresh = useCallback(() => {
    const next = readResponsiveLayoutFromBrowser();
    setLayout((current) => areResponsiveLayoutsEqual(current, next) ? current : next);
  }, []);

  useLayoutEffect(() => applyResponsiveLayoutCssVariables(layout), [layout]);

  useLayoutEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    let frameId: number | null = null;

    const scheduleRefresh = () => {
      if (frameId !== null) {
        return;
      }

      frameId = requestFrame(() => {
        frameId = null;
        refresh();
      });
    };

    const visualViewport = window.visualViewport;
    const rootElement = document.getElementById("root");
    const rootResizeObserver = typeof ResizeObserver === "function" && rootElement
      ? new ResizeObserver(scheduleRefresh)
      : null;

    window.addEventListener("resize", scheduleRefresh);
    visualViewport?.addEventListener("resize", scheduleRefresh);
    if (rootResizeObserver && rootElement) {
      rootResizeObserver.observe(rootElement);
    }

    return () => {
      if (frameId !== null) {
        cancelFrame(frameId);
      }
      rootResizeObserver?.disconnect();
      window.removeEventListener("resize", scheduleRefresh);
      visualViewport?.removeEventListener("resize", scheduleRefresh);
    };
  }, [refresh]);

  return <ResponsiveLayoutContext.Provider value={layout}>{children}</ResponsiveLayoutContext.Provider>;
}
