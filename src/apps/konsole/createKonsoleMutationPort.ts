import type { ShellMutationPort } from "../../shell";
import type { VfsContextValue } from "../../vfs/VfsContext";

export function createKonsoleMutationPort(vfs: VfsContextValue): ShellMutationPort {
  return {
    createDirectory: vfs.createDirectory,
    createTextFile: vfs.createTextFile,
    appendTextFile: vfs.appendTextFile,
    copyNode: vfs.copyNode,
    moveNode: vfs.moveNode,
    moveNodeToTrash: vfs.moveNodeToTrash,
    restoreNodeFromTrash: vfs.restoreNodeFromTrash,
    deleteNodePermanently: vfs.deleteNodePermanently,
    emptyTrash: vfs.emptyTrash,
  };
}
