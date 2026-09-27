import { getVfsNodeById, getVfsPathForNode, resolveVfsPath } from "../vfs/queries";
import type { VfsNodeId, VfsState } from "../vfs/types";
import { createShellError } from "./errors";
import { system } from "./formatting";
import type { ShellCwdValidation, ShellSessionState } from "./types";

const createSession = (cwdNodeId: VfsNodeId): ShellSessionState => ({
  cwdNodeId,
  transcript: [],
  commandHistory: [],
  nextTranscriptEntryId: 1,
});

const getValidDirectoryPath = (
  vfsState: VfsState,
  nodeId: VfsNodeId,
): { readonly nodeId: VfsNodeId; readonly path: string } | null => {
  const node = getVfsNodeById(vfsState, nodeId);

  if (!node.ok || node.value.kind !== "directory") {
    return null;
  }

  const path = getVfsPathForNode(vfsState, node.value.id);

  if (!path.ok) {
    return null;
  }

  return {
    nodeId: node.value.id,
    path: path.value,
  };
};

export function getShellFallbackCwd(vfsState: VfsState): { readonly nodeId: VfsNodeId; readonly path: string } {
  return (
    getValidDirectoryPath(vfsState, vfsState.specialLocations.home) ??
    getValidDirectoryPath(vfsState, vfsState.rootId) ?? {
      nodeId: vfsState.rootId,
      path: "/",
    }
  );
}

export function createInitialShellSession(vfsState: VfsState, initialWorkingDirectory?: string): ShellSessionState {
  if (initialWorkingDirectory !== undefined) {
    const requested = resolveVfsPath(vfsState, initialWorkingDirectory);

    if (requested.ok && requested.value.kind === "directory") {
      return createSession(requested.value.id);
    }
  }

  return createSession(getShellFallbackCwd(vfsState).nodeId);
}

export function clearShellTranscript(session: ShellSessionState): ShellSessionState {
  if (session.transcript.length === 0) {
    return session;
  }

  return {
    ...session,
    transcript: [],
  };
}

export function appendShellPromptOnlyTranscript(
  session: ShellSessionState,
  cwdPath: string,
): ShellSessionState {
  return {
    ...session,
    transcript: [
      ...session.transcript,
      {
        id: session.nextTranscriptEntryId,
        input: "",
        cwdPath,
        output: [],
        exitCode: 0,
      },
    ],
    nextTranscriptEntryId: session.nextTranscriptEntryId + 1,
  };
}

export function validateShellCwd(session: ShellSessionState, vfsState: VfsState): ShellCwdValidation {
  const current = getValidDirectoryPath(vfsState, session.cwdNodeId);

  if (current) {
    return {
      cwdNodeId: current.nodeId,
      cwdPath: current.path,
      warning: null,
      error: null,
    };
  }

  const fallback = getShellFallbackCwd(vfsState);
  const message = `shell: current directory is no longer available; returned to ${fallback.path}`;

  return {
    cwdNodeId: fallback.nodeId,
    cwdPath: fallback.path,
    warning: system(message),
    error: createShellError("CWD_UNAVAILABLE", message),
  };
}
