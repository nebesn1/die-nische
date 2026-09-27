import { Fragment, type ReactNode } from "react";
import { getVfsTextFileContent } from "../../vfs/fileContent";
import { parseMarkdownDocument } from "../../vfs/markdownFrontMatter";
import type { VfsTextFileNode, VfsState } from "../../vfs/types";
import { getKonquerorDocumentImageSource, getKonquerorDocumentResourceSource, resolveDocumentResourceReference } from "./documentResourceResolver";
import { parseSafeHtmlPreview, type SafeHtmlPreviewNode, type SafeHtmlTag } from "./htmlPreviewModel";
import { parseMarkdownPreview, type MarkdownInlineNode } from "./markdownPreviewModel";
import { getDefaultKonquerorPreviewer } from "./previewModel";
import { useI18n } from "../../i18n/useI18n";

type SafeVfsDocumentBodyProps = {
  readonly file: VfsTextFileNode;
  readonly vfsState?: VfsState;
  readonly documentPath: string;
  readonly onNavigate?: (location: string) => boolean | void;
};

type NavigationCallback = ((location: string) => boolean | void) | null;

const getStringAttribute = (attributes: Readonly<Record<string, string | boolean>>, name: string): string | undefined => {
  const value = attributes[name];
  return typeof value === "string" && value.length > 0 ? value : undefined;
};

const hasBooleanAttribute = (attributes: Readonly<Record<string, string | boolean>>, name: string): boolean => attributes[name] === true;

const getDimensionAttribute = (attributes: Readonly<Record<string, string | boolean>>, name: string): number | undefined => {
  const value = getStringAttribute(attributes, name);
  if (value === undefined || !/^\d+$/.test(value)) return undefined;
  const dimension = Number(value);
  return Number.isSafeInteger(dimension) && dimension > 0 ? dimension : undefined;
};

const renderHtmlNode = (
  node: SafeHtmlPreviewNode,
  key: number,
  state: VfsState | null,
  documentPath: string,
  onNavigate: NavigationCallback,
): ReactNode => {
  if (node.type === "text") return node.value;
  if (node.type === "image") {
    const source = state === null ? null : getKonquerorDocumentImageSource(state, documentPath, node.src);
    return source === null ? <span key={key} className="konqueror-preview-image-placeholder">[Image: {node.alt}]</span> : <img key={key} src={source} alt={node.alt} />;
  }

  if (node.tag === "source") {
    const source = getKonquerorDocumentResourceSource(state, documentPath, getStringAttribute(node.attributes, "src") ?? "");
    if (source === null) return null;
    const type = getStringAttribute(node.attributes, "type");
    const media = getStringAttribute(node.attributes, "media");
    return <source key={key} src={source} type={type} media={media} />;
  }

  const children = node.children.map((child, childKey) => renderHtmlNode(child, childKey, state, documentPath, onNavigate));
  if (node.tag === "a") {
    const reference = node.href === null || onNavigate === null
      ? { kind: "unsupported" as const }
      : resolveDocumentResourceReference(documentPath, node.href);
    return reference.kind === "vfs" || reference.kind === "external"
      ? <a key={key} href={reference.kind === "vfs" ? reference.path : reference.url} onClick={(event) => { event.preventDefault(); onNavigate?.(reference.kind === "vfs" ? reference.path : reference.url); }}>{children}</a>
      : <span key={key} className="konqueror-preview-link" title={node.href ?? undefined}>{children}</span>;
  }

  const tag: SafeHtmlTag = node.tag;
  if (tag === "br") return <br key={key} />;
  if (tag === "hr") return <hr key={key} />;
  if (tag === "video" || tag === "audio") {
    const source = getKonquerorDocumentResourceSource(state, documentPath, getStringAttribute(node.attributes, "src") ?? "");
    const commonProps = {
      src: source ?? undefined,
      controls: hasBooleanAttribute(node.attributes, "controls"),
      preload: getStringAttribute(node.attributes, "preload"),
      loop: hasBooleanAttribute(node.attributes, "loop"),
      muted: hasBooleanAttribute(node.attributes, "muted"),
    };
    if (tag === "audio") return <audio key={key} {...commonProps}>{children}</audio>;
    const poster = getKonquerorDocumentResourceSource(state, documentPath, getStringAttribute(node.attributes, "poster") ?? "");
    return <video key={key} {...commonProps} poster={poster ?? undefined} playsInline={hasBooleanAttribute(node.attributes, "playsinline")} width={getDimensionAttribute(node.attributes, "width")} height={getDimensionAttribute(node.attributes, "height")}>{children}</video>;
  }
  const Element = tag;
  return <Element key={key}>{children}</Element>;
};

const renderMarkdownInline = (
  node: MarkdownInlineNode,
  key: number,
  state: VfsState | null,
  documentPath: string,
  onNavigate: NavigationCallback,
): ReactNode => {
  switch (node.type) {
    case "text": return node.value;
    case "strong": return <strong key={key}>{node.value}</strong>;
    case "emphasis": return <em key={key}>{node.value}</em>;
    case "code": return <code key={key}>{node.value}</code>;
    case "image": {
      const source = state === null ? null : getKonquerorDocumentImageSource(state, documentPath, node.src);
      return source === null ? <span key={key} className="konqueror-preview-image-placeholder">[Image: {node.alt}]</span> : <img key={key} src={source} alt={node.alt} />;
    }
    case "link": {
      const reference = onNavigate === null ? { kind: "unsupported" as const } : resolveDocumentResourceReference(documentPath, node.href);
      return reference.kind === "vfs" || reference.kind === "external"
        ? <a key={key} href={reference.kind === "vfs" ? reference.path : reference.url} onClick={(event) => { event.preventDefault(); onNavigate?.(reference.kind === "vfs" ? reference.path : reference.url); }}>{node.label}</a>
        : <span key={key} className="konqueror-preview-link" title={node.href}>{node.label}</span>;
    }
  }
};

/** Shared safe document body for textual VFS content; parsing and resource resolution stay Konqueror-owned. */
export function SafeVfsDocumentBody({ file, vfsState, documentPath, onNavigate }: SafeVfsDocumentBodyProps) {
  const { t } = useI18n();
  const text = getVfsTextFileContent(file);
  const navigate = onNavigate ?? null;
  const state = vfsState ?? null;

  if (text === null) return <>{t("konqueror.error.fileUnavailable")}</>;

  switch (getDefaultKonquerorPreviewer(file)) {
    case "khtml":
      return <>{parseSafeHtmlPreview(text).map((node, key) => renderHtmlNode(node, key, state, documentPath, navigate))}</>;
    case "markdown":
      return <>{parseMarkdownPreview(parseMarkdownDocument(text, file.name).body).map((block, index) => {
        const content = "content" in block
          ? block.content.map((node, key) => renderMarkdownInline(node, key, state, documentPath, navigate))
          : null;
        switch (block.type) {
          case "heading": {
            const Element = `h${block.depth}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
            return <Element key={index}>{content}</Element>;
          }
          case "paragraph": return <p key={index}>{content}</p>;
          case "blockquote": return <blockquote key={index}>{content}</blockquote>;
          case "html-media": return <Fragment key={index}>{parseSafeHtmlPreview(block.value).map((node, key) => renderHtmlNode(node, key, state, documentPath, navigate))}</Fragment>;
          case "code": return <pre key={index}><code>{block.value}</code></pre>;
          case "rule": return <hr key={index} />;
          case "list": {
            const List = block.ordered ? "ol" : "ul";
            return <List key={index}>{block.items.map((item, itemIndex) => <li key={itemIndex}>{item.map((node, key) => renderMarkdownInline(node, key, state, documentPath, navigate))}</li>)}</List>;
          }
        }
      })}</>;
    default:
      return <pre className="safe-vfs-document-body__plain">{text}</pre>;
  }
}
