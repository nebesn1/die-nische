import type { CSSProperties, MouseEvent, RefObject, SyntheticEvent } from "react";
import type { VfsFileNode } from "../../vfs/types";
import { getVfsNodeDisplayName } from "../../vfs/presentation";
import { getKonquerorImageSource } from "./imagePreviewModel";
import type { KonquerorImageViewState } from "./imageViewModel";
import { useI18n } from "../../i18n/useI18n";

type KonquerorImageViewProps = {
  readonly file: VfsFileNode;
  readonly imageViewState: KonquerorImageViewState;
  readonly previewSurfaceRef: RefObject<HTMLElement | null>;
  readonly onOpenContextMenu: (clientX: number, clientY: number) => void;
  readonly onLoad: (dimensions: { readonly width: number; readonly height: number }) => void;
  readonly onError: () => void;
};

export function KonquerorImageView({
  file,
  imageViewState,
  previewSurfaceRef,
  onOpenContextMenu,
  onLoad,
  onError,
}: KonquerorImageViewProps) {
  const { t } = useI18n();
  const source = getKonquerorImageSource(file);
  const displayName = getVfsNodeDisplayName(file);
  const numericZoom = typeof imageViewState.zoom === "number" ? imageViewState.zoom : null;
  const dimensions = imageViewState.dimensions;
  const imageStyle = numericZoom !== null && dimensions !== null
    ? {
      width: `${(dimensions.width * numericZoom) / 100}px`,
      height: `${(dimensions.height * numericZoom) / 100}px`,
      transform: `rotate(${imageViewState.rotation}deg)`,
    } as CSSProperties
    : { transform: `rotate(${imageViewState.rotation}deg)` } as CSSProperties;
  const className = `konqueror-image-view konqueror-image-view--${imageViewState.zoom}`;

  const handleContextMenu = (event: MouseEvent<HTMLElement>) => {
    event.preventDefault();
    onOpenContextMenu(event.clientX, event.clientY);
  };
  const handleLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    const { naturalHeight, naturalWidth } = event.currentTarget;
    if (naturalWidth > 0 && naturalHeight > 0) {
      onLoad({ width: naturalWidth, height: naturalHeight });
    } else {
      onError();
    }
  };

  if (source === null || imageViewState.status === "error") {
    return (
        <section ref={previewSurfaceRef} className="konqueror-image-view konqueror-image-view--error" aria-label={t("konqueror.preview.image", { name: displayName })} role="alert">
        {t("konqueror.error.fileUnavailable")}
      </section>
    );
  }

  if (imageViewState.status === "stopped") {
    return (
      <section ref={previewSurfaceRef} className="konqueror-image-view konqueror-image-view--stopped" aria-label={t("konqueror.preview.image", { name: displayName })}>
        {t("konqueror.error.loadingStopped")}
      </section>
    );
  }

  return (
    <section
      ref={previewSurfaceRef}
      className={className}
      data-image-zoom={imageViewState.zoom}
      data-image-rotation={imageViewState.rotation}
      aria-label={t("konqueror.preview.image", { name: displayName })}
      tabIndex={-1}
      onContextMenu={handleContextMenu}
    >
      <img
        className="konqueror-image-view__image"
        src={source}
        alt={displayName}
        draggable={false}
        style={imageStyle}
        onLoad={handleLoad}
        onError={onError}
      />
    </section>
  );
}
