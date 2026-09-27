export type RepositoryContentClock = () => Date | string | number;

export type RepositoryContentTimestampFileStat = {
  birthtime?: Date;
  birthtimeMs?: number;
  mtime?: Date;
  mtimeMs?: number;
};

export function getRepositoryContentCreatedTimestamp(fileStat: RepositoryContentTimestampFileStat, clock?: RepositoryContentClock): string;
export function getRepositoryContentModifiedTimestamp(fileStat: RepositoryContentTimestampFileStat, clock?: RepositoryContentClock): string;

export function createVfsContentTimestampReconciler(options?: {
  contentRoot?: string;
  clock?: RepositoryContentClock;
  logger?: { info?: (message: string) => void };
  onMetadataWrite?: (metadataPath: string) => void;
}): {
  reconcile(): Promise<{
    changed: boolean;
    changedPaths: readonly { type: "initialized" | "modified" | "removed"; path: string }[];
  }>;
  getSnapshot(): {
    files: Map<string, unknown>;
    directories: Set<string>;
  };
};
