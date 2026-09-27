import type { VfsError } from "../../vfs/errors";
import type { VfsFileNode, VfsNode } from "../../vfs/types";
import { getVfsNodeDisplayName } from "../../vfs/presentation";
import { formatKonquerorNavigationError } from "./navigationController";
import { formatVfsByteSize, getKonquerorNodeTypeLabel } from "./formatters";
import { getSingleKonquerorSelectedNodeId, type KonquerorSelectedNodeIds } from "./selectionModel";
import { useI18n } from "../../i18n/useI18n";
import { translateKonquerorAvailabilityText, translateKonquerorNodeTypeLabel } from "./konquerorI18n";

type KonquerorStatusBarProps = {
  readonly directoryChildren: readonly VfsNode[] | null;
  readonly file: VfsFileNode | null;
  readonly selectedNodeIds: KonquerorSelectedNodeIds;
  readonly error: VfsError | null;
  readonly operationStatus?: string | null;
  readonly editorStatus?: "clean" | "dirty" | null;
  readonly editorDraftSize?: number | null;
  readonly pageStatus?: string | null;
};

const formatItemCount = (count: number, item: string, items: string): string => `${count} ${count === 1 ? item : items}`;

export function KonquerorStatusBar({
  directoryChildren,
  editorDraftSize = null,
  editorStatus = null,
  error,
  file,
  operationStatus = null,
  pageStatus = null,
  selectedNodeIds,
}: KonquerorStatusBarProps) {
  const { t } = useI18n();
  let status = t("konqueror.status.ready");

  if (pageStatus) {
    status = pageStatus;
  } else if (error) {
    status = formatKonquerorNavigationError(error);
  } else if (operationStatus) {
    status = translateKonquerorAvailabilityText(t, operationStatus);
  } else if (file) {
    if (editorStatus === "dirty") {
      status = `${getVfsNodeDisplayName(file)} - ${t("konqueror.status.modified")} - ${formatVfsByteSize(editorDraftSize ?? file.size)}`;
    } else if (editorStatus === "clean") {
      status = `${getVfsNodeDisplayName(file)} - ${t("konqueror.status.editing")} - ${formatVfsByteSize(file.size)}`;
    } else {
      status = `${getVfsNodeDisplayName(file)} - ${file.mimeType} - ${formatVfsByteSize(file.size)}`;
    }
  } else if (directoryChildren) {
    const selectedNodeId = getSingleKonquerorSelectedNodeId(selectedNodeIds);
    const selectedNode = directoryChildren.find((node) => node.id === selectedNodeId);

    status = selectedNode
      ? `${getVfsNodeDisplayName(selectedNode)} - ${translateKonquerorNodeTypeLabel(t, getKonquerorNodeTypeLabel(selectedNode))}${
          selectedNode.kind === "file" ? ` - ${formatVfsByteSize(selectedNode.size)}` : ""
        }`
      : formatItemCount(directoryChildren.length, t("konqueror.status.item"), t("konqueror.status.items"));
  }

  return <footer className="konqueror-statusbar">{status}</footer>;
}
