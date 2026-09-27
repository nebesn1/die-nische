import type { ShellError } from "./errors";
import type { VfsResult } from "../vfs/result";
import type { VfsDeleteResult, VfsDirectoryNode, VfsNode, VfsNodeId, VfsState, VfsTextFileNode } from "../vfs/types";

export interface ShellToken {
  readonly value: string;
  readonly quoted: boolean;
}

export interface ShellCommandInvocation {
  readonly commandName: string;
  readonly args: readonly string[];
  readonly rawInput: string;
}

export type ShellOutputStream = "stdout" | "stderr" | "system";

export interface ShellOutputChunk {
  readonly stream: ShellOutputStream;
  readonly text: string;
}

export interface ShellCommandExecution {
  readonly exitCode: number;
  readonly cwdNodeId: VfsNodeId;
  readonly output: readonly ShellOutputChunk[];
  readonly clearTranscript: boolean;
}

export interface ShellMutationPort {
  createDirectory(
    parentPath: string,
    name: string,
    options: {
      readonly now: string;
    },
  ): VfsResult<VfsDirectoryNode>;

  createTextFile(
    parentPath: string,
    name: string,
    content: string,
    options: {
      readonly now: string;
      readonly mimeType?: string;
    },
  ): VfsResult<VfsTextFileNode>;

  appendTextFile(
    path: string,
    text: string,
    options: {
      readonly now: string;
    },
  ): VfsResult<VfsTextFileNode>;

  copyNode(
    sourcePath: string,
    destinationDirectoryPath: string,
    options: {
      readonly now: string;
      readonly newName?: string;
    },
  ): VfsResult<VfsNode>;

  moveNode(
    sourcePath: string,
    destinationDirectoryPath: string,
    options: {
      readonly now: string;
      readonly newName?: string;
    },
  ): VfsResult<VfsNode>;

  moveNodeToTrash(
    sourcePath: string,
    options: {
      readonly now: string;
    },
  ): VfsResult<VfsNode>;

  restoreNodeFromTrash(
    nodeId: VfsNodeId,
    options: {
      readonly now: string;
    },
  ): VfsResult<VfsNode>;

  deleteNodePermanently(
    nodeId: VfsNodeId,
    options: {
      readonly now: string;
    },
  ): VfsResult<VfsDeleteResult>;

  emptyTrash(options: { readonly now: string }): VfsResult<VfsDeleteResult>;
}

export interface ShellExecutionEnvironment {
  readonly mutations?: ShellMutationPort;
  readonly now?: () => string;
}

export interface ShellTranscriptEntry {
  readonly id: number;
  readonly input: string;
  readonly cwdPath: string;
  readonly output: readonly ShellOutputChunk[];
  readonly exitCode: number;
}

export interface ShellSessionState {
  readonly cwdNodeId: VfsNodeId;
  readonly transcript: readonly ShellTranscriptEntry[];
  readonly commandHistory: readonly string[];
  readonly nextTranscriptEntryId: number;
}

export interface ShellCommandContext {
  readonly vfsState: VfsState;
  readonly cwdNodeId: VfsNodeId;
  readonly cwdPath: string;
  /** History snapshot from before the current invocation is appended. */
  readonly commandHistory: readonly string[];
  readonly invocation: ShellCommandInvocation;
  readonly environment: ShellExecutionEnvironment;
}

export interface ShellCommandDefinition {
  readonly name: string;
  readonly usage: string;
  readonly description: string;
  execute(context: ShellCommandContext): ShellCommandExecution;
}

export interface ShellInputExecutionResult {
  readonly session: ShellSessionState;
  readonly execution: ShellCommandExecution | null;
}

export interface ShellCwdValidation {
  readonly cwdNodeId: VfsNodeId;
  readonly cwdPath: string;
  readonly warning: ShellOutputChunk | null;
  readonly error: ShellError | null;
}
