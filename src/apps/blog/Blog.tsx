import { Fragment, useMemo } from "react";
import { useApplicationLauncher } from "../../application-runtime/useApplicationLauncher";
import { formatTimestampForLocalDisplay } from "../../time/formatLocalDateTime";
import { buildPublishedContentCatalog } from "../../vfs/publishedContentCatalog";
import { formatPublishedArticleHash } from "../../vfs/publishingRoutes";
import { formatPublishedTagHash } from "../../vfs/publishedTagRoutes";
import { useVfs } from "../../vfs/useVfs";
import { activatePublishedArticlePermalink, launchPublishedArticle } from "../publishing/articleActivation";
import { activatePublishedTagPermalink } from "../publishing/tagActivation";
import { createBlogTagsOpenIntent } from "../blog-tags/launchIntent";
import { useI18n } from "../../i18n/useI18n";

const getArticleCountLabel = (count: number, t: ReturnType<typeof useI18n>["t"]): string =>
  t(count === 1 ? "blog.publishedOne" : "blog.publishedMany", { count });

export function Blog() {
  const { locale, t } = useI18n();
  const vfs = useVfs();
  const { launchApplication, launchNewApplicationInstance } = useApplicationLauncher();
  const catalog = useMemo(() => buildPublishedContentCatalog(vfs.state), [vfs.state]);

  return (
    <main className="blog-app" aria-label={t("blog.label")}>
      <header className="blog-app__heading kde-chrome-surface">
        <h1>{t("blog.label")}</h1>
        <span className="blog-app__publishing-controls">
          <button type="button" className="kde-raised blog-app__archive-button" onClick={() => launchApplication("blog-archive")}>{t("blog.archive")}</button>
          <button type="button" className="kde-raised blog-app__tags-button" onClick={() => launchApplication("blog-tags")}>{t("blog.tags")}</button>
          <button type="button" className="kde-raised blog-app__search-button" onClick={() => launchApplication("blog-search")}>{t("blog.search")}</button>
        </span>
      </header>
      <section className="blog-app__content" aria-label={t("blog.publishedArticles")}>
        {catalog.length === 0 ? (
          <p className="blog-app__empty" role="status">{t("blog.noArticles")}</p>
        ) : (
          <ol className="blog-app__list">
            {catalog.map((entry) => (
              <li key={entry.nodeId} className="blog-article" data-blog-node-id={entry.nodeId}>
                {entry.slug === undefined ? (
                  <button type="button" className="blog-article__title" onClick={() => launchPublishedArticle(entry, { launchNewApplicationInstance })}>
                    {entry.title}
                  </button>
                ) : (
                  <a className="blog-article__title" href={formatPublishedArticleHash(entry.slug)} onClick={(event) => activatePublishedArticlePermalink(event, entry, { launchNewApplicationInstance })}>
                    {entry.title}
                  </a>
                )}
                <p className="blog-article__published">{t("blog.published")} {formatTimestampForLocalDisplay(entry.publishedAt, { locale })}</p>
                {entry.summary === undefined ? null : <p className="blog-article__summary">{entry.summary}</p>}
                {entry.tags.length === 0 ? null : (
                  <p className="blog-article__tags">{t("blog.tagsLabel")} {entry.tags.map((tag, index) => (
                    <Fragment key={tag}>
                      {index === 0 ? null : ", "}
                      <a href={formatPublishedTagHash(tag)} onClick={(event) => activatePublishedTagPermalink(event, tag, (selectedTag) => launchApplication("blog-tags", { intent: createBlogTagsOpenIntent({ selectedTag }) }))}>{tag}</a>
                    </Fragment>
                  ))}</p>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
      <footer className="blog-app__status" aria-live="polite">{getArticleCountLabel(catalog.length, t)}</footer>
    </main>
  );
}
