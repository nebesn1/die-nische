import { useCallback, useEffect, useMemo, useRef } from "react";
import { useApplicationLauncher } from "../application-runtime/useApplicationLauncher";
import { createArticleReaderOpenIntent } from "../apps/article-reader/launchIntent";
import { buildPublishedContentCatalog } from "../vfs/publishedContentCatalog";
import { formatPublishedArticleHash, parsePublishedContentRoute, resolvePublishedContentRoute } from "../vfs/publishingRoutes";
import { useVfs } from "../vfs/useVfs";

/** One Desktop-level bridge from browser history into nodeId-based Article Reader instances. */
export function PublishedArticleRouteController() {
  const vfs = useVfs();
  const { launchNewApplicationInstance } = useApplicationLauncher();
  const catalog = useMemo(() => buildPublishedContentCatalog(vfs.state), [vfs.state]);
  const lastOpenedRouteRef = useRef<string | null>(null);
  const launchNewApplicationInstanceRef = useRef(launchNewApplicationInstance);
  launchNewApplicationInstanceRef.current = launchNewApplicationInstance;

  const openCurrentRoute = useCallback(() => {
    const route = parsePublishedContentRoute(window.location.hash);
    const resolution = route === undefined ? undefined : resolvePublishedContentRoute(catalog, route);

    if (resolution === undefined) {
      lastOpenedRouteRef.current = null;
      return;
    }

    const routeKey = `${window.location.hash}\u0000${resolution.entry.nodeId}`;
    if (lastOpenedRouteRef.current === routeKey) return;

    if (resolution.kind === "alias") {
      window.history.replaceState(window.history.state, "", formatPublishedArticleHash(resolution.entry.slug!));
    }

    lastOpenedRouteRef.current = routeKey;
    launchNewApplicationInstanceRef.current("article-reader", { intent: createArticleReaderOpenIntent(resolution.entry.nodeId) });
  }, [catalog]);

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
