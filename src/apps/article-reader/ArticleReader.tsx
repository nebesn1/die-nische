import { Fragment, useEffect, useMemo, type MouseEvent } from "react";
import type { ApplicationLaunchRequest } from "../../application-runtime/types";
import { useApplicationLauncher } from "../../application-runtime/useApplicationLauncher";
import { formatTimestampForLocalDisplay } from "../../time/formatLocalDateTime";
import { isVfsTextFile } from "../../vfs/fileContent";
import { buildPublishedContentCatalog } from "../../vfs/publishedContentCatalog";
import { getPublishedArticleNeighbors } from "../../vfs/publishedArticleNavigation";
import { formatPublishedArticleHash } from "../../vfs/publishingRoutes";
import { formatPublishedTagHash } from "../../vfs/publishedTagRoutes";
import { getVfsNodeById } from "../../vfs/queries";
import { useVfs } from "../../vfs/useVfs";
import { createKonquerorOpenDirectoryIntent, createKonquerorOpenExternalWebIntent, createKonquerorOpenFileIntent } from "../konqueror/launchIntent";
import { resolveKonquerorAbsoluteLocationTarget } from "../konqueror/navigationController";
import { SafeVfsDocumentBody } from "../konqueror/SafeVfsDocumentBody";
import { isArticleReaderOpenIntent } from "./launchIntent";
import { activatePublishedArticlePermalink, launchPublishedArticle } from "../publishing/articleActivation";
import { activatePublishedTagPermalink } from "../publishing/tagActivation";
import { createBlogTagsOpenIntent } from "../blog-tags/launchIntent";
import { useI18n } from "../../i18n/useI18n";

type ArticleReaderProps = {
  readonly launchRequest?: ApplicationLaunchRequest | null;
  readonly onSetWindowTitle?: (title: string) => void;
};

type ArticleNavigationControlProps = {
  readonly direction: "previous" | "next";
  readonly entry?: ReturnType<typeof getPublishedArticleNeighbors>["previous"];
  readonly onActivatePermalink: (event: MouseEvent<HTMLAnchorElement>, target: NonNullable<ArticleNavigationControlProps["entry"]>) => void;
  readonly onLaunch: (target: NonNullable<ArticleNavigationControlProps["entry"]>) => void;
};

function ArticleNavigationControl({ direction, entry, onActivatePermalink, onLaunch, t }: ArticleNavigationControlProps & { readonly t: ReturnType<typeof useI18n>["t"] }) {
  const label = t(direction === "previous" ? "articleReader.previous" : "articleReader.next");
  const className = `article-reader__navigation-action article-reader__navigation-action--${direction}`;

  if (entry === undefined) {
    return <span className={`${className} article-reader__navigation-action--unavailable`} aria-disabled="true">{t(direction === "previous" ? "articleReader.unavailablePrevious" : "articleReader.unavailableNext")}</span>;
  }

  const accessibleLabel = t(direction === "previous" ? "articleReader.previousArticle" : "articleReader.nextArticle", { title: entry.title });

  if (entry.slug === undefined) {
    return <button type="button" className={className} aria-label={accessibleLabel} onClick={() => onLaunch(entry)}>{label}: {entry.title}</button>;
  }

  return <a className={className} href={formatPublishedArticleHash(entry.slug)} aria-label={accessibleLabel} onClick={(event) => onActivatePermalink(event, entry)}>{label}: {entry.title}</a>;
}

export function ArticleReader({ launchRequest = null, onSetWindowTitle = () => undefined }: ArticleReaderProps) {
  const { locale, t } = useI18n();
  const vfs = useVfs();
  const { launchApplication, launchNewApplicationInstance } = useApplicationLauncher();
  const nodeId = launchRequest !== null && isArticleReaderOpenIntent(launchRequest.intent) ? launchRequest.intent.nodeId : null;
  const catalog = useMemo(() => buildPublishedContentCatalog(vfs.state), [vfs.state]);
  const entry = nodeId === null ? undefined : catalog.find((candidate) => candidate.nodeId === nodeId);
  const neighbors = nodeId === null ? {} : getPublishedArticleNeighbors(catalog, nodeId);
  const resolvedNode = nodeId === null ? null : getVfsNodeById(vfs.state, nodeId);
  const file = entry !== undefined && resolvedNode?.ok && isVfsTextFile(resolvedNode.value) ? resolvedNode.value : null;

  useEffect(() => {
    onSetWindowTitle(entry === undefined ? t("articleReader.label") : `${entry.title} - ${t("articleReader.label")}`);
  }, [entry, onSetWindowTitle, t]);

  const openDocumentReference = (location: string): boolean => {
    const target = resolveKonquerorAbsoluteLocationTarget(vfs.state, location);
    if (!target.ok) return false;

    const intent = target.value.target.type === "external-web"
      ? createKonquerorOpenExternalWebIntent(target.value.target.canonicalUrl)
      : target.value.target.type === "directory"
      ? createKonquerorOpenDirectoryIntent(target.value.target.nodeId)
      : target.value.target.type === "file"
      ? createKonquerorOpenFileIntent(target.value.target.nodeId)
      : null;
    if (intent === null) return false;

    launchNewApplicationInstance("konqueror", {
      intent,
    });
    return true;
  };

  if (entry === undefined || file === null) {
    return <main className="article-reader" aria-label={t("articleReader.label")}><p className="article-reader__unavailable" role="status">{t("articleReader.unavailable")}</p></main>;
  }

  return (
    <main className="article-reader" aria-label={t("articleReader.label")}>
      <header className="article-reader__header">
        <h1>{entry.title}</h1>
        <p className="article-reader__published">{t("blog.published")} {formatTimestampForLocalDisplay(entry.publishedAt, { locale })}</p>
        {entry.summary === undefined ? null : <p className="article-reader__summary">{entry.summary}</p>}
        {entry.tags.length === 0 ? null : (
          <p className="article-reader__tags">{t("blog.tagsLabel")} {entry.tags.map((tag, index) => (
            <Fragment key={tag}>
              {index === 0 ? null : ", "}
              <a href={formatPublishedTagHash(tag)} onClick={(event) => activatePublishedTagPermalink(event, tag, (selectedTag) => launchApplication("blog-tags", { intent: createBlogTagsOpenIntent({ selectedTag }) }))}>{tag}</a>
            </Fragment>
          ))}</p>
        )}
        <p className="article-reader__source">{t("konqueror.labels.source")} {entry.canonicalPath}</p>
        {entry.slug === undefined ? null : <p className="article-reader__permalink">{t("articleReader.permalink")} <a href={formatPublishedArticleHash(entry.slug)}>{formatPublishedArticleHash(entry.slug)}</a></p>}
      </header>
      <div className="article-reader__separator" aria-hidden="true" />
      <article className="article-reader__body" data-article-node-id={entry.nodeId}>
        <SafeVfsDocumentBody file={file} vfsState={vfs.state} documentPath={entry.canonicalPath} onNavigate={openDocumentReference} />
      </article>
      <footer className="article-reader__navigation" aria-label={t("articleReader.navigation")}>
        <ArticleNavigationControl
          direction="previous"
          entry={neighbors.previous}
          onActivatePermalink={(event, target) => activatePublishedArticlePermalink(event, target, { launchNewApplicationInstance })}
          onLaunch={(target) => launchPublishedArticle(target, { launchNewApplicationInstance })}
          t={t}
        />
        <ArticleNavigationControl
          direction="next"
          entry={neighbors.next}
          onActivatePermalink={(event, target) => activatePublishedArticlePermalink(event, target, { launchNewApplicationInstance })}
          onLaunch={(target) => launchPublishedArticle(target, { launchNewApplicationInstance })}
          t={t}
        />
      </footer>
    </main>
  );
}
