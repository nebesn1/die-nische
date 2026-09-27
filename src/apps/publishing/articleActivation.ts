import type { MouseEvent } from "react";
import type { ApplicationLauncherContextValue } from "../../application-runtime/useApplicationLauncher";
import type { PublishedContentCatalogEntry } from "../../vfs/publishedContentCatalog";
import { formatPublishedArticleHash } from "../../vfs/publishingRoutes";
import { createArticleReaderOpenIntent } from "../article-reader/launchIntent";

type ArticleReaderLauncher = Pick<ApplicationLauncherContextValue, "launchNewApplicationInstance">;

export function launchPublishedArticle(entry: PublishedContentCatalogEntry, { launchNewApplicationInstance }: ArticleReaderLauncher): void {
  launchNewApplicationInstance("article-reader", { intent: createArticleReaderOpenIntent(entry.nodeId) });
}

/** Leaves modified activation to the browser so canonical permalinks retain native new-tab behavior. */
export function activatePublishedArticlePermalink(
  event: MouseEvent<HTMLAnchorElement>,
  entry: PublishedContentCatalogEntry,
  launcher: ArticleReaderLauncher,
): void {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  if (entry.slug === undefined) return;

  event.preventDefault();
  window.history.pushState(null, "", formatPublishedArticleHash(entry.slug));
  launchPublishedArticle(entry, launcher);
}
