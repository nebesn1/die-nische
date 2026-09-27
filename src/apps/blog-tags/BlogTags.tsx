import { useEffect, useMemo, useRef, useState } from "react";
import type { ApplicationLaunchRequest } from "../../application-runtime/types";
import { useApplicationLauncher } from "../../application-runtime/useApplicationLauncher";
import { formatTimestampForLocalDisplay } from "../../time/formatLocalDateTime";
import { buildPublishedArticleTagIndex } from "../../vfs/publishedArticleTags";
import { buildPublishedContentCatalog } from "../../vfs/publishedContentCatalog";
import { formatPublishedArticleHash } from "../../vfs/publishingRoutes";
import { formatPublishedTagHash } from "../../vfs/publishedTagRoutes";
import { useVfs } from "../../vfs/useVfs";
import { activatePublishedArticlePermalink, launchPublishedArticle } from "../publishing/articleActivation";
import { activatePublishedTagPermalink } from "../publishing/tagActivation";
import { isBlogTagsOpenIntent } from "./launchIntent";
import { useI18n } from "../../i18n/useI18n";

const getArticleCountLabel = (count: number, t: ReturnType<typeof useI18n>["t"]): string =>
  t(count === 1 ? "blogTags.articleOne" : "blogTags.articleMany", { count });

type BlogTagsProps = {
  readonly launchRequest?: ApplicationLaunchRequest | null;
};

const getRequestedTag = (launchRequest: ApplicationLaunchRequest | null): string | undefined =>
  launchRequest !== null && isBlogTagsOpenIntent(launchRequest.intent) ? launchRequest.intent.selectedTag : undefined;

export function BlogTags({ launchRequest = null }: BlogTagsProps) {
  const { locale, t } = useI18n();
  const vfs = useVfs();
  const { launchNewApplicationInstance } = useApplicationLauncher();
  const [selectedTag, setSelectedTag] = useState<string | undefined>(() => getRequestedTag(launchRequest));
  const lastHandledLaunchRequestIdRef = useRef<number | null>(launchRequest?.requestId ?? null);
  const catalog = useMemo(() => buildPublishedContentCatalog(vfs.state), [vfs.state]);
  const tagIndex = useMemo(() => buildPublishedArticleTagIndex(catalog), [catalog]);
  const selectedGroup = selectedTag === undefined ? undefined : tagIndex.find((group) => group.tag === selectedTag);

  useEffect(() => {
    if (selectedTag !== undefined && selectedGroup === undefined) {
      setSelectedTag(undefined);
    }
  }, [selectedGroup, selectedTag]);

  useEffect(() => {
    if (
      launchRequest === null
      || launchRequest.requestId === lastHandledLaunchRequestIdRef.current
      || !isBlogTagsOpenIntent(launchRequest.intent)
      || launchRequest.intent.selectedTag === undefined
    ) return;

    lastHandledLaunchRequestIdRef.current = launchRequest.requestId;
    setSelectedTag(launchRequest.intent.selectedTag);
  }, [launchRequest]);

  return (
    <main className="blog-tags" aria-label={t("blogTags.label")}>
      <header className="blog-tags__heading"><h1>{t("blogTags.heading")}</h1></header>
      {tagIndex.length === 0 ? <p className="blog-tags__empty" role="status">{t("blogTags.noTags")}</p> : <div className="blog-tags__split">
        <nav className="blog-tags__master" aria-label={t("blogTags.publishedTags")}>
          <ol className="blog-tags__list">
            {tagIndex.map((group) => (
              <li key={group.tag}>
                <a
                  className="blog-tags__tag-button"
                  aria-current={selectedTag === group.tag ? "page" : undefined}
                  href={formatPublishedTagHash(group.tag)}
                  onClick={(event) => activatePublishedTagPermalink(event, group.tag, setSelectedTag)}
                >
                  <span>{group.tag}</span><span>{getArticleCountLabel(group.entries.length, t)}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <section className="blog-tags__detail" aria-label={t("blogTags.articlesByTag")}>
          {selectedGroup === undefined ? (
            <p className="blog-tags__selection-prompt" role="status">{t("blogTags.selectTag")}</p>
          ) : (
            <>
              <header className="blog-tags__detail-heading"><h2>{t("blogTags.tagHeading", { tag: selectedGroup.tag })}</h2><p>{getArticleCountLabel(selectedGroup.entries.length, t)}</p></header>
              <ol className="blog-tags__article-list">
                {selectedGroup.entries.map((entry) => (
                  <li key={entry.nodeId} className="blog-tags__article" data-blog-tag-node-id={entry.nodeId}>
                    {entry.slug === undefined ? (
                      <button type="button" className="blog-tags__article-title" onClick={() => launchPublishedArticle(entry, { launchNewApplicationInstance })}>{entry.title}</button>
                    ) : (
                      <a className="blog-tags__article-title" href={formatPublishedArticleHash(entry.slug)} onClick={(event) => activatePublishedArticlePermalink(event, entry, { launchNewApplicationInstance })}>{entry.title}</a>
                    )}
                    <time className="blog-tags__article-date" dateTime={entry.publishedAt}>{t("blog.published")} {formatTimestampForLocalDisplay(entry.publishedAt, { locale })}</time>
                  </li>
                ))}
              </ol>
            </>
          )}
        </section>
      </div>}
    </main>
  );
}
