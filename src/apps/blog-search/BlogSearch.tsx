import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { useApplicationLauncher } from "../../application-runtime/useApplicationLauncher";
import type { ApplicationLaunchRequest } from "../../application-runtime/types";
import { formatTimestampForLocalDisplay } from "../../time/formatLocalDateTime";
import { buildPublishedContentCatalog } from "../../vfs/publishedContentCatalog";
import { searchPublishedContentDocuments } from "../../vfs/publishedContentSearch";
import { formatPublishedArticleHash } from "../../vfs/publishingRoutes";
import { useVfs } from "../../vfs/useVfs";
import { canonicalizePublishedSearchQuery, formatPublishedSearchHash, parsePublishedSearchHash } from "../../vfs/publishedSearchRoutes";
import { activatePublishedArticlePermalink, launchPublishedArticle } from "../publishing/articleActivation";
import { buildPublishedContentSearchDocuments } from "./publishedContentSearchDocuments";
import { isBlogSearchOpenIntent } from "./launchIntent";
import { buildPublishedSearchMatchPresentation, type SearchTextRange } from "./publishedSearchMatchPresentation";
import { useI18n } from "../../i18n/useI18n";

const getResultCountLabel = (count: number, t: ReturnType<typeof useI18n>["t"]): string =>
  t(count === 1 ? "blogSearch.resultOne" : "blogSearch.resultMany", { count });

const renderHighlightedText = (text: string, ranges: readonly SearchTextRange[]): ReactNode => {
  if (ranges.length === 0) return text;

  const parts: ReactNode[] = [];
  let offset = 0;
  ranges.forEach((range, index) => {
    if (offset < range.start) parts.push(text.slice(offset, range.start));
    parts.push(<span key={`${range.start}-${range.end}-${index}`} className="blog-search__match">{text.slice(range.start, range.end)}</span>);
    offset = range.end;
  });
  if (offset < text.length) parts.push(text.slice(offset));
  return parts;
};

interface BlogSearchProps {
  readonly launchRequest?: ApplicationLaunchRequest | null;
}

const getRequestedSearchQuery = (launchRequest: ApplicationLaunchRequest | null): string | undefined =>
  launchRequest !== null && isBlogSearchOpenIntent(launchRequest.intent) ? launchRequest.intent.query : undefined;

const synchronizeSearchQueryHash = (query: string): void => {
  const canonicalQuery = canonicalizePublishedSearchQuery(query);
  const currentRoute = parsePublishedSearchHash(window.location.hash);
  if (canonicalQuery === undefined) {
    if (currentRoute !== undefined) {
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}`);
    }
    return;
  }

  const canonicalHash = formatPublishedSearchHash(canonicalQuery);
  if (canonicalHash === undefined || window.location.hash === canonicalHash) return;

  if (currentRoute === undefined) {
    window.history.pushState(window.history.state, "", canonicalHash);
  } else {
    window.history.replaceState(window.history.state, "", canonicalHash);
  }
};

export function BlogSearch({ launchRequest = null }: BlogSearchProps) {
  const { locale, t } = useI18n();
  const vfs = useVfs();
  const { launchNewApplicationInstance } = useApplicationLauncher();
  const [query, setQuery] = useState(() => getRequestedSearchQuery(launchRequest) ?? "");
  const lastHandledLaunchRequestIdRef = useRef<number | null>(launchRequest?.requestId ?? null);
  const catalog = useMemo(() => buildPublishedContentCatalog(vfs.state), [vfs.state]);
  const documents = useMemo(() => buildPublishedContentSearchDocuments(catalog, vfs.state), [catalog, vfs.state]);
  const results = useMemo(() => searchPublishedContentDocuments(documents, query), [documents, query]);
  const presentedResults = useMemo(
    () => results.map((document) => ({ document, presentation: buildPublishedSearchMatchPresentation(document, query) })),
    [query, results],
  );
  const isInactive = query.trim().length === 0;

  useEffect(() => {
    if (
      launchRequest === null ||
      launchRequest.requestId === lastHandledLaunchRequestIdRef.current ||
      !isBlogSearchOpenIntent(launchRequest.intent)
    ) return;

    lastHandledLaunchRequestIdRef.current = launchRequest.requestId;
    setQuery(launchRequest.intent.query);
  }, [launchRequest]);

  const handleQueryChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextQuery = event.target.value;
    setQuery(nextQuery);
    synchronizeSearchQueryHash(nextQuery);
  };

  return (
    <main className="blog-search" aria-label={t("blogSearch.label")}>
      <header className="blog-search__heading"><h1>{t("blogSearch.heading")}</h1></header>
      <form className="blog-search__query" onSubmit={(event) => event.preventDefault()}>
        <label htmlFor="blog-search-query">{t("blogSearch.searchPublished")}</label>
        <span>
          <input id="blog-search-query" type="text" value={query} onChange={handleQueryChange} autoFocus />
          <button type="button" onClick={() => {
            setQuery("");
            synchronizeSearchQueryHash("");
          }} disabled={isInactive}>{t("blogSearch.clear")}</button>
        </span>
      </form>
      <section className="blog-search__content" aria-live="polite" aria-label={t("blogSearch.results")}>
        {isInactive ? (
          <p className="blog-search__prompt" role="status">{t("blogSearch.enterTerm")}</p>
        ) : results.length === 0 ? (
          <p className="blog-search__empty" role="status">{t("blogSearch.noMatches")}</p>
        ) : (
          <>
            <p className="blog-search__count">{getResultCountLabel(results.length, t)}</p>
            <ol className="blog-search__list">
              {presentedResults.map(({ document, presentation }) => {
                const { entry } = document;
                return (
                  <li key={entry.nodeId} className="blog-search__result" data-blog-search-node-id={entry.nodeId}>
                    {entry.slug === undefined ? (
                      <button type="button" className="blog-search__article-title" onClick={() => launchPublishedArticle(entry, { launchNewApplicationInstance })}>{renderHighlightedText(entry.title, presentation.titleHighlights)}</button>
                    ) : (
                      <a className="blog-search__article-title" href={formatPublishedArticleHash(entry.slug)} onClick={(event) => activatePublishedArticlePermalink(event, entry, { launchNewApplicationInstance })}>{renderHighlightedText(entry.title, presentation.titleHighlights)}</a>
                    )}
                    <time className="blog-search__article-date" dateTime={entry.publishedAt}>{t("blog.published")} {formatTimestampForLocalDisplay(entry.publishedAt, { locale })}</time>
                    {entry.summary === undefined ? null : <p className="blog-search__summary">{renderHighlightedText(entry.summary, presentation.summaryHighlights)}</p>}
                    {presentation.matchingTags.length === 0 ? null : (
                      <p className="blog-search__matched-tags">{t("blogSearch.matchedTags")} {presentation.matchingTags.map(({ tag, highlights }, index) => (
                        <span key={`${tag}-${index}`} className="blog-search__matched-tag">
                          {index === 0 ? null : ", "}{renderHighlightedText(tag, highlights)}
                        </span>
                      ))}</p>
                    )}
                    {presentation.bodySnippet === undefined ? null : (
                      <p className="blog-search__snippet">
                        {presentation.bodySnippet.prefixEllipsis ? "…" : null}
                        {renderHighlightedText(presentation.bodySnippet.text, presentation.bodySnippet.highlights)}
                        {presentation.bodySnippet.suffixEllipsis ? "…" : null}
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </section>
    </main>
  );
}
