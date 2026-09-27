import { useCallback, useEffect, useRef } from "react";
import { useApplicationLauncher } from "../application-runtime/useApplicationLauncher";
import { createBlogSearchOpenIntent } from "../apps/blog-search/launchIntent";
import { formatPublishedSearchHash, parsePublishedSearchHash } from "../vfs/publishedSearchRoutes";

/** One Desktop-level bridge from syntactically valid Search permalinks into the Blog Search singleton. */
export function PublishedSearchRouteController() {
  const { launchApplication } = useApplicationLauncher();
  const lastOpenedRouteRef = useRef<string | null>(null);
  const launchApplicationRef = useRef(launchApplication);
  launchApplicationRef.current = launchApplication;

  const openCurrentRoute = useCallback(() => {
    const route = parsePublishedSearchHash(window.location.hash);
    if (route === undefined) {
      lastOpenedRouteRef.current = null;
      return;
    }

    const canonicalHash = formatPublishedSearchHash(route.query);
    if (canonicalHash === undefined) return;
    if (window.location.hash !== canonicalHash) {
      window.history.replaceState(window.history.state, "", canonicalHash);
    }
    if (lastOpenedRouteRef.current === canonicalHash) return;

    lastOpenedRouteRef.current = canonicalHash;
    launchApplicationRef.current("blog-search", { intent: createBlogSearchOpenIntent(route.query) });
  }, []);

  useEffect(() => {
    openCurrentRoute();
  }, [openCurrentRoute]);

  useEffect(() => {
    const handleHistoryNavigation = () => openCurrentRoute();
    window.addEventListener("hashchange", handleHistoryNavigation);
    window.addEventListener("popstate", handleHistoryNavigation);
    return () => {
      window.removeEventListener("hashchange", handleHistoryNavigation);
      window.removeEventListener("popstate", handleHistoryNavigation);
    };
  }, [openCurrentRoute]);

  return null;
}
