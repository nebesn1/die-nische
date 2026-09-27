/* global console, process */

import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, relative, resolve } from "node:path";
import {
  defaultContentRoot,
  getRepositoryContentAssetMimeType,
  getRepositoryContentTextMimeType,
  readRepositoryContentDirectoryMetadata,
  renderRepositoryContentDirectoryMetadata,
  repositoryContentMetadataFileName,
  shouldIgnoreRepositoryContentEntry,
} from "./generate-vfs-content-manifest.mjs";

const timestampFrom = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) && date.getTime() > 0 ? date.toISOString() : null;
};

const currentTimestamp = (clock) => {
  const timestamp = timestampFrom(clock());

  if (!timestamp) {
    throw new Error("VFS timestamp authoring: clock did not produce a valid timestamp.");
  }

  return timestamp;
};

export const getRepositoryContentCreatedTimestamp = (fileStat, clock = () => new Date()) =>
  timestampFrom(fileStat.birthtimeMs) ?? timestampFrom(fileStat.birthtime) ?? timestampFrom(fileStat.mtimeMs) ?? timestampFrom(fileStat.mtime) ?? currentTimestamp(clock);

export const getRepositoryContentModifiedTimestamp = (fileStat, clock = () => new Date()) =>
  timestampFrom(fileStat.mtimeMs) ?? timestampFrom(fileStat.mtime) ?? currentTimestamp(clock);

const getFingerprint = (content) => createHash("sha256").update(content).digest("hex");

const isSupportedRepositoryContentFile = (name) =>
  getRepositoryContentTextMimeType(name) !== null || getRepositoryContentAssetMimeType(name) !== null;

const repositoryRelativePath = (contentRoot, physicalPath) => {
  const value = relative(contentRoot, physicalPath).replaceAll("\\", "/");
  return value.length === 0 ? "content/home/user" : `content/home/user/${value}`;
};

const isAutoOnlyEntry = (entry) => entry.id === undefined
  && entry.order === undefined
  && entry.displayName === undefined
  && entry.publication === undefined;

const canRemoveDeletedMetadataEntry = (metadataVersion, entry) =>
  metadataVersion === 6 || isAutoOnlyEntry(entry);

const sameEntry = (left, right) =>
  left?.id === right?.id
  && left?.created === right?.created
  && left?.modified === right?.modified
  && left?.order === right?.order;

/**
 * Node-only authoring reconciler. The snapshot is deliberately in memory only;
 * committed sidecars, not filesystem metadata, remain the deterministic build input.
 */
export function createVfsContentTimestampReconciler({
  contentRoot = defaultContentRoot,
  clock = () => new Date(),
  logger = console,
  onMetadataWrite,
} = {}) {
  const resolvedContentRoot = resolve(contentRoot);
  let snapshot = { files: new Map(), directories: new Set() };

  const scan = async () => {
    const files = new Map();
    const directories = new Map();

    const scanDirectory = async (physicalPath) => {
      const children = await readdir(physicalPath, { withFileTypes: true });
      const metadata = await readRepositoryContentDirectoryMetadata(resolvedContentRoot, physicalPath, children);
      const directory = { physicalPath, metadata, entries: new Map(metadata.entries), changed: false };
      directories.set(physicalPath, directory);

      for (const child of children) {
        if (child.name === repositoryContentMetadataFileName || shouldIgnoreRepositoryContentEntry(child.name)) continue;

        const childPath = resolve(physicalPath, child.name);
        const childStat = await lstat(childPath);

        if (childStat.isSymbolicLink()) continue;

        if (childStat.isDirectory()) {
          await scanDirectory(childPath);
          continue;
        }

        if (!childStat.isFile() || !isSupportedRepositoryContentFile(child.name)) continue;

        const content = await readFile(childPath);
        const fileStat = await stat(childPath);
        const relativePath = repositoryRelativePath(resolvedContentRoot, childPath);
        files.set(relativePath, {
          relativePath,
          physicalPath: childPath,
          directoryPath: physicalPath,
          name: child.name,
          fingerprint: getFingerprint(content),
          fileStat,
        });
      }
    };

    await scanDirectory(resolvedContentRoot);
    return { files, directories };
  };

  const writeMetadata = async (directory) => {
    const metadataPath = resolve(directory.physicalPath, repositoryContentMetadataFileName);
    const temporaryPath = `${metadataPath}.${process.pid}.${Date.now()}.tmp`;
    const version = directory.metadata.exists
      ? Math.max(directory.metadata.version, 2)
      : 6;
    const content = renderRepositoryContentDirectoryMetadata({ version, entries: directory.entries });
    onMetadataWrite?.(metadataPath);

    try {
      await mkdir(dirname(metadataPath), { recursive: true });
      await writeFile(temporaryPath, content, "utf8");
      await rename(temporaryPath, metadataPath);
    } finally {
      await rm(temporaryPath, { force: true }).catch(() => undefined);
    }
  };

  const reconcile = async () => {
    const { files, directories } = await scan();
    const changedPaths = [];
    const hadSnapshot = snapshot.directories.size > 0;
    const activityDirectories = new Set();
    const recordActivity = (directoryPath) => {
      let startingDirectory = directoryPath;

      while (startingDirectory !== resolvedContentRoot && !directories.has(startingDirectory)) {
        startingDirectory = dirname(startingDirectory);
      }

      for (let current = startingDirectory; current !== resolvedContentRoot; current = dirname(current)) {
        activityDirectories.add(current);
      }
    };

    for (const file of files.values()) {
      const directory = directories.get(file.directoryPath);
      const entry = directory.entries.get(file.name);
      const before = snapshot.files.get(file.relativePath);

      if (!entry) {
        directory.entries.set(file.name, {
          created: getRepositoryContentCreatedTimestamp(file.fileStat, clock),
          modified: getRepositoryContentModifiedTimestamp(file.fileStat, clock),
        });
        directory.changed = true;
        changedPaths.push({ type: "initialized", path: file.relativePath });
        recordActivity(file.directoryPath);
        continue;
      }

      if (before && before.fingerprint !== file.fingerprint) {
        const next = {
          ...entry,
          ...(entry.created === undefined ? { created: getRepositoryContentCreatedTimestamp(file.fileStat, clock) } : {}),
          modified: getRepositoryContentModifiedTimestamp(file.fileStat, clock),
        };

        if (!sameEntry(entry, next)) {
          directory.entries.set(file.name, next);
          directory.changed = true;
          changedPaths.push({ type: "modified", path: file.relativePath });
          recordActivity(file.directoryPath);
        }
      }
    }

    for (const previous of snapshot.files.values()) {
      if (files.has(previous.relativePath)) continue;

      const directory = directories.get(previous.directoryPath);
      const entry = directory?.entries.get(previous.name);

      if (directory && entry && canRemoveDeletedMetadataEntry(directory.metadata.version, entry)) {
        directory.entries.delete(previous.name);
        directory.changed = true;
        changedPaths.push({ type: "removed", path: previous.relativePath });
      }

      recordActivity(previous.directoryPath);
    }

    for (const directoryPath of directories.keys()) {
      if (!hadSnapshot || snapshot.directories.has(directoryPath) || directoryPath === resolvedContentRoot) continue;
      recordActivity(dirname(directoryPath));
    }

    for (const previousDirectoryPath of snapshot.directories) {
      if (directories.has(previousDirectoryPath) || previousDirectoryPath === resolvedContentRoot) continue;
      const parent = directories.get(dirname(previousDirectoryPath));
      const name = basename(previousDirectoryPath);
      const entry = parent?.entries.get(name);

      if (parent && entry && canRemoveDeletedMetadataEntry(parent.metadata.version, entry)) {
        parent.entries.delete(name);
        parent.changed = true;
      }

      recordActivity(dirname(previousDirectoryPath));
    }

    if (activityDirectories.size > 0) {
      const activityTimestamp = currentTimestamp(clock);

      for (const directoryPath of activityDirectories) {
        const parent = directories.get(dirname(directoryPath));
        const name = basename(directoryPath);

        if (!parent) continue;
        const entry = parent.entries.get(name) ?? {};
        const next = { ...entry, modified: activityTimestamp };

        if (!sameEntry(entry, next)) {
          parent.entries.set(name, next);
          parent.changed = true;
        }
      }
    }

    const changedDirectories = [...directories.values()].filter((directory) => directory.changed);
    await Promise.all(changedDirectories.map(writeMetadata));

    snapshot = {
      files: new Map([...files.values()].map((file) => [file.relativePath, {
        relativePath: file.relativePath,
        directoryPath: file.directoryPath,
        name: file.name,
        fingerprint: file.fingerprint,
      }])),
      directories: new Set(directories.keys()),
    };

    changedPaths.forEach(({ type, path }) => logger.info?.(`[vfs-content] ${type === "initialized" ? "initialized timestamps for" : type === "modified" ? "updated modified timestamp for" : "removed automatic timestamps for"} ${path}`));
    return { changed: changedDirectories.length > 0, changedPaths };
  };

  return { reconcile, getSnapshot: () => ({ files: new Map(snapshot.files), directories: new Set(snapshot.directories) }) };
}
