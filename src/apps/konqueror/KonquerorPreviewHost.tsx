import type { CSSProperties, MouseEvent, RefObject } from "react";
import { isVfsTextFile } from "../../vfs/fileContent";
import { getVfsPathForNode } from "../../vfs/queries";
import type { VfsFileNode, VfsState } from "../../vfs/types";
import { KonquerorFileView } from "./KonquerorFileView";
import { KonquerorImageView } from "./KonquerorImageView";
import { KonquerorMediaView } from "./KonquerorMediaView";
import type { KonquerorMediaCommand } from "./mediaCommandModel";
import { defaultKonquerorImageViewState, type KonquerorImageViewState } from "./imageViewModel";
import { defaultKonquerorMediaViewState, type KonquerorMediaViewAction, type KonquerorMediaViewState } from "./mediaViewModel";
import type { KonquerorPreviewerId } from "./previewModel";
import { SafeVfsDocumentBody } from "./SafeVfsDocumentBody";
import { useI18n } from "../../i18n/useI18n";

type KonquerorPreviewHostProps = {
  readonly file: VfsFileNode;
  readonly zoomLevel?: number;
  readonly previewerId: KonquerorPreviewerId;
  readonly previewSurfaceRef: RefObject<HTMLElement | null>;
  readonly onOpenContextMenu: (clientX: number, clientY: number) => void;
  readonly imageViewState?: KonquerorImageViewState;
  readonly onImageLoad?: (dimensions: { readonly width: number; readonly height: number }) => void;
  readonly onImageError?: () => void;
  readonly mediaViewState?: KonquerorMediaViewState;
  readonly onMediaAction?: (action: KonquerorMediaViewAction) => void;
  readonly hasPreviousMedia?: boolean;
  readonly hasNextMedia?: boolean;
  readonly onNavigateAdjacentMedia?: (direction: "previous" | "next") => void;
  readonly onRegisterMediaCommand?: (handler: ((command: KonquerorMediaCommand) => void) | null) => void;
  readonly vfsState?: VfsState;
  readonly onNavigate?: (location: string) => void;
};

const handleContextMenu = (event: MouseEvent<HTMLElement>, callback: (clientX: number, clientY: number) => void) => {
  event.preventDefault();
  callback(event.clientX, event.clientY);
};

function KhtmlPreview({ file, onOpenContextMenu, previewSurfaceRef, zoomLevel = 100, vfsState, onNavigate }: Omit<KonquerorPreviewHostProps, "previewerId">) {
  const { t } = useI18n();
  const path = vfsState ? getVfsPathForNode(vfsState, file.id) : null;
  return (
    <article ref={previewSurfaceRef} className="konqueror-preview-document konqueror-preview-document--khtml" data-content-zoom={zoomLevel} aria-label={t("konqueror.preview.khtml", { name: file.name })} tabIndex={-1} onContextMenu={(event) => handleContextMenu(event, onOpenContextMenu)} style={{ "--konqueror-content-zoom": zoomLevel / 100 } as CSSProperties}>
      <div className="konqueror-preview-document__canvas">{isVfsTextFile(file) ? <SafeVfsDocumentBody file={file} vfsState={vfsState} documentPath={path?.ok ? path.value : ""} onNavigate={onNavigate} /> : t("konqueror.preview.notReadable")}</div>
    </article>
  );
}

function MarkdownPreview({ file, onOpenContextMenu, previewSurfaceRef, zoomLevel = 100, vfsState, onNavigate }: Omit<KonquerorPreviewHostProps, "previewerId">) {
  const { t } = useI18n();
  const path = vfsState ? getVfsPathForNode(vfsState, file.id) : null;
  return (
    <article ref={previewSurfaceRef} className="konqueror-preview-document konqueror-preview-document--markdown" data-content-zoom={zoomLevel} aria-label={t("konqueror.preview.markdown", { name: file.name })} tabIndex={-1} onContextMenu={(event) => handleContextMenu(event, onOpenContextMenu)} style={{ "--konqueror-content-zoom": zoomLevel / 100 } as CSSProperties}>
      <div className="konqueror-preview-document__canvas">{isVfsTextFile(file) ? <SafeVfsDocumentBody file={file} vfsState={vfsState} documentPath={path?.ok ? path.value : ""} onNavigate={onNavigate} /> : t("konqueror.preview.notReadable")}</div>
    </article>
  );
}

export function KonquerorPreviewHost({
  file,
  onOpenContextMenu,
  previewSurfaceRef,
  previewerId,
  zoomLevel,
  imageViewState = defaultKonquerorImageViewState,
  onImageLoad = () => undefined,
  onImageError = () => undefined,
  mediaViewState = defaultKonquerorMediaViewState,
  onMediaAction = () => undefined,
  hasPreviousMedia = false,
  hasNextMedia = false,
  onNavigateAdjacentMedia = () => undefined,
  onRegisterMediaCommand = () => undefined,
  vfsState,
  onNavigate,
}: KonquerorPreviewHostProps) {
  switch (previewerId) {
    case "image":
      return <KonquerorImageView file={file} imageViewState={imageViewState} previewSurfaceRef={previewSurfaceRef} onOpenContextMenu={onOpenContextMenu} onLoad={onImageLoad} onError={onImageError} />;
    case "media-audio":
    case "media-video":
      return <KonquerorMediaView file={file} mediaViewState={mediaViewState} previewSurfaceRef={previewSurfaceRef} onOpenContextMenu={onOpenContextMenu} onAction={onMediaAction} hasPrevious={hasPreviousMedia} hasNext={hasNextMedia} onNavigateAdjacent={onNavigateAdjacentMedia} onRegisterMediaCommand={onRegisterMediaCommand} />;
    case "khtml":
      return <KhtmlPreview file={file} onOpenContextMenu={onOpenContextMenu} previewSurfaceRef={previewSurfaceRef} zoomLevel={zoomLevel} vfsState={vfsState} onNavigate={onNavigate} />;
    case "markdown":
      return <MarkdownPreview file={file} onOpenContextMenu={onOpenContextMenu} previewSurfaceRef={previewSurfaceRef} zoomLevel={zoomLevel} vfsState={vfsState} onNavigate={onNavigate} />;
    default:
      return <KonquerorFileView file={file} onOpenContextMenu={onOpenContextMenu} previewSurfaceRef={previewSurfaceRef} zoomLevel={zoomLevel} />;
  }
}
