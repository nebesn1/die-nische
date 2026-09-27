// @vitest-environment jsdom
import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LaunchApplicationResult } from "../application-runtime/types";
import { ApplicationLauncherContext } from "../application-runtime/useApplicationLauncher";
import { PublishedSearchRouteController } from "./PublishedSearchRouteController";

let container: HTMLDivElement;
let reactRoot: Root;
let launchApplication: ReturnType<typeof vi.fn>;

const renderController = () => {
  launchApplication = vi.fn((): LaunchApplicationResult => "opened");
  act(() => {
    reactRoot.render(
      <StrictMode>
        <ApplicationLauncherContext.Provider value={{ launchApplication, launchNewApplicationInstance: vi.fn((): LaunchApplicationResult => "opened") }}>
          <PublishedSearchRouteController />
        </ApplicationLauncherContext.Provider>
      </StrictMode>,
    );
  });
};

const navigateHash = (hash: string) => {
  act(() => {
    window.history.replaceState(null, "", hash);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });
};

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  reactRoot = createRoot(container);
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  act(() => reactRoot.unmount());
  container.remove();
  window.history.replaceState(null, "", "/");
  vi.restoreAllMocks();
});

describe("PublishedSearchRouteController", () => {
  it("canonicalizes an initial valid query route and delivers one routed singleton intent", () => {
    window.history.replaceState(null, "", "#/blog/search/%20KDE%20%20robot%20");
    const replaceState = vi.spyOn(window.history, "replaceState");
    renderController();

    expect(window.location.hash).toBe("#/blog/search/KDE%20robot");
    expect(replaceState).toHaveBeenCalledWith(null, "", "#/blog/search/KDE%20robot");
    expect(launchApplication).toHaveBeenCalledTimes(1);
    expect(launchApplication).toHaveBeenCalledWith("blog-search", { intent: { type: "open-blog-search", query: "KDE robot" } });

    act(() => {
      window.dispatchEvent(new HashChangeEvent("hashchange"));
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(launchApplication).toHaveBeenCalledTimes(1);
  });

  it("updates the same singleton intent for valid zero-result queries while preserving literal plus", () => {
    window.history.replaceState(null, "", "#/blog/search/zzzz-no-results");
    renderController();
    expect(launchApplication).toHaveBeenLastCalledWith("blog-search", { intent: { type: "open-blog-search", query: "zzzz-no-results" } });

    navigateHash("#/blog/search/C++");
    expect(window.location.hash).toBe("#/blog/search/C%2B%2B");
    expect(launchApplication).toHaveBeenCalledTimes(2);
    expect(launchApplication).toHaveBeenLastCalledWith("blog-search", { intent: { type: "open-blog-search", query: "C++" } });
  });

  it("ignores malformed, extra-segment, Article-search, and Tag routes without rewriting them", () => {
    window.history.replaceState(null, "", "#/blog/search/%GG");
    const replaceState = vi.spyOn(window.history, "replaceState");
    renderController();
    expect(launchApplication).not.toHaveBeenCalled();
    expect(replaceState).not.toHaveBeenCalled();

    ["#/blog/search/A/B", "#/blog/search", "#/blog/tag/KDE%203"].forEach((hash) => navigateHash(hash));
    expect(launchApplication).not.toHaveBeenCalled();
    expect(window.location.hash).toBe("#/blog/tag/KDE%203");
  });

  it("does not close or clear an already opened Search when history leaves its route", () => {
    window.history.replaceState(null, "", "#/blog/search/kde");
    renderController();
    expect(launchApplication).toHaveBeenCalledTimes(1);

    navigateHash("#/blog/an-article");
    expect(launchApplication).toHaveBeenCalledTimes(1);

    navigateHash("#/blog/search/robot");
    expect(launchApplication).toHaveBeenCalledTimes(2);
    expect(launchApplication).toHaveBeenLastCalledWith("blog-search", { intent: { type: "open-blog-search", query: "robot" } });
  });
});
