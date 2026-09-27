import type { CSSProperties, MouseEvent, RefObject } from "react";
import { getVfsTextFileContent } from "../../vfs/fileContent";
import { getVfsNodeDisplayName } from "../../vfs/presentation";
import type { VfsFileNode } from "../../vfs/types";
import { formatVfsByteSize, formatVfsModifiedTime } from "./formatters";
import { TextFileIcon } from "./icons";
import { useI18n } from "../../i18n/useI18n";

type KonquerorFileViewProps = {
  readonly file: VfsFileNode;
  readonly zoomLevel?: number;
  readonly previewSurfaceRef?: RefObject<HTMLElement | null>;
  readonly onOpenContextMenu?: (clientX: number, clientY: number) => void;
};

export function KonquerorFileView({ file, onOpenContextMenu, previewSurfaceRef, zoomLevel = 100 }: KonquerorFileViewProps) {
  const { locale, t } = useI18n();
  const text = getVfsTextFileContent(file);
  const displayName = getVfsNodeDisplayName(file);
  const handleContextMenu = (event: MouseEvent<HTMLElement>) => {
    if (!onOpenContextMenu) {
      return;
    }

    event.preventDefault();
    onOpenContextMenu(event.clientX, event.clientY);
  };

  return (
    <article
      ref={previewSurfaceRef}
      className="konqueror-file-view"
      data-content-zoom={zoomLevel}
      aria-label={t("konqueror.preview.text", { name: displayName })}
      tabIndex={-1}
      onContextMenu={handleContextMenu}
      style={{ "--konqueror-content-zoom": zoomLevel / 100 } as CSSProperties}
    >
      <header className="konqueror-file-view__header">
        <TextFileIcon className="konqueror-file-view__icon" aria-hidden="true" focusable="false" />
        <div>
          <h2>{displayName}</h2>
          <p>
            {file.mimeType} - {formatVfsByteSize(file.size)} - {t("konqueror.status.modified")} {formatVfsModifiedTime(file.modifiedAt, { locale })}
          </p>
        </div>
      </header>
      <pre className="konqueror-file-view__content">{text ?? t("konqueror.preview.notReadable")}</pre>
    </article>
  );
}
