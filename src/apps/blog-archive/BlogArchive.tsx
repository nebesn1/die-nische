import { useMemo } from "react";
import { useApplicationLauncher } from "../../application-runtime/useApplicationLauncher";
import { formatTimestampForLocalDisplay } from "../../time/formatLocalDateTime";
import { buildPublishedArticleArchive } from "../../vfs/publishedArticleArchive";
import { buildPublishedContentCatalog } from "../../vfs/publishedContentCatalog";
import { formatPublishedArticleHash } from "../../vfs/publishingRoutes";
import { useVfs } from "../../vfs/useVfs";
import { activatePublishedArticlePermalink, launchPublishedArticle } from "../publishing/articleActivation";
import { useI18n } from "../../i18n/useI18n";

const monthKeys = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] as const;
const getArticleCountLabel = (count: number, t: ReturnType<typeof useI18n>["t"]): string => t(count === 1 ? "blog.publishedOne" : "blog.publishedMany", { count });

export function BlogArchive() {
  const { locale, t } = useI18n();
  const vfs = useVfs();
  const { launchNewApplicationInstance } = useApplicationLauncher();
  const catalog = useMemo(() => buildPublishedContentCatalog(vfs.state), [vfs.state]);
  const archive = useMemo(() => buildPublishedArticleArchive(catalog), [catalog]);

  return (
    <main className="blog-archive" aria-label={t("blogArchive.label")}>
      <header className="blog-archive__heading">
        <h1>{t("blogArchive.heading")}</h1>
        <p>{getArticleCountLabel(catalog.length, t)}</p>
      </header>
      <section className="blog-archive__content" aria-label={t("blogArchive.archive")}>
        {archive.length === 0 ? (
          <p className="blog-archive__empty" role="status">{t("blog.noArticles")}</p>
        ) : archive.map((yearGroup) => (
          <section key={yearGroup.year} className="blog-archive__year" aria-labelledby={`blog-archive-year-${yearGroup.year}`}>
            <h2 id={`blog-archive-year-${yearGroup.year}`}>{yearGroup.year}</h2>
            {yearGroup.months.map((monthGroup) => (
              <section key={`${monthGroup.year}-${monthGroup.month}`} className="blog-archive__month" aria-labelledby={`blog-archive-month-${monthGroup.year}-${monthGroup.month}`}>
                <h3 id={`blog-archive-month-${monthGroup.year}-${monthGroup.month}`}>{t(`blogArchive.month${monthKeys[monthGroup.month - 1]}` as const)}</h3>
                <ol className="blog-archive__article-list">
                  {monthGroup.entries.map((entry) => (
                    <li key={entry.nodeId} className="blog-archive__article" data-blog-archive-node-id={entry.nodeId}>
                      {entry.slug === undefined ? (
                        <button type="button" className="blog-archive__article-title" onClick={() => launchPublishedArticle(entry, { launchNewApplicationInstance })}>
                          {entry.title}
                        </button>
                      ) : (
                        <a className="blog-archive__article-title" href={formatPublishedArticleHash(entry.slug)} onClick={(event) => activatePublishedArticlePermalink(event, entry, { launchNewApplicationInstance })}>
                          {entry.title}
                        </a>
                      )}
                      <time className="blog-archive__article-date" dateTime={entry.publishedAt}>{t("blog.published")} {formatTimestampForLocalDisplay(entry.publishedAt, { locale })}</time>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </section>
        ))}
      </section>
    </main>
  );
}
