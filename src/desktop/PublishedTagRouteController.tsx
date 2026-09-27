import { useCallback, useEffect, useMemo, useRef } from "react";
import { useApplicationLauncher } from "../application-runtime/useApplicationLauncher";
import { createBlogTagsOpenIntent } from "../apps/blog-tags/launchIntent";
import { buildPublishedArticleTagIndex } from "../vfs/publishedArticleTags";
import { buildPublishedContentCatalog } from "../vfs/publishedContentCatalog";
import { formatPublishedTagHash, parsePublishedTagHash, resolvePublishedTagRoute } from "../vfs/publishedTagRoutes";
import { useVfs } from "../vfs/useVfs";

/** One Desktop-level bridge from exact tag permalinks into the Blog Tags singleton. */
export function PublishedTagRouteController() {
  const vfs = useVfs();
  const { launchApplication } = useApplicationLauncher();
  const catalog = useMemo(() => buildPublishedContentCatalog(vfs.state), [vfs.state]);
  const tagIndex = useMemo(() => buildPublishedArticleTagIndex(catalog), [catalog]);
  const lastOpenedRouteRef = useRef<string | null>(null);
  const launchApplicationRef = useRef(launchApplication);
  launchApplicationRef.current = launchApplication;

  const openCurrentRoute = useCallback(() => {
    const route = parsePublishedTagHash(window.location.hash);
    const group = route === undefined ? undefined : resolvePublishedTagRoute(tagIndex, route);

    if (group === undefined) {
      lastOpenedRouteRef.current = null;
      return;
    }

    const canonicalHash = formatPublishedTagHash(group.tag);
    if (window.location.hash !== canonicalHash) {
      window.history.replaceState(window.history.state, "", canonicalHash);
    }

    const routeKey = `${canonicalHash}\u0000${group.tag}`;
    if (lastOpenedRouteRef.current === routeKey) return;

    lastOpenedRouteRef.current = routeKey;
    launchApplicationRef.current("blog-tags", { intent: createBlogTagsOpenIntent({ selectedTag: group.tag }) });
  }, [tagIndex]);

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
