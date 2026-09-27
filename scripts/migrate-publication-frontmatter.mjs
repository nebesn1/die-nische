/* global process */

import { lstat, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { TextDecoder } from "node:util";
import { fileURLToPath } from "node:url";
import {
  defaultContentRoot,
  getRepositoryContentAssetMimeType,
  getRepositoryContentMetadataValidationError,
  getRepositoryContentTextMimeType,
  readRepositoryContentDirectoryMetadata,
  renderRepositoryContentDirectoryMetadata,
  repositoryContentMetadataFileName,
  shouldIgnoreRepositoryContentEntry,
} from "./generate-vfs-content-manifest.mjs";
import {
  getPublicationDifferences,
  isSafeMarkdownFrontMatterText,
  parseMarkdownFrontMatter,
  resolveMarkdownFrontMatter,
  serializeMarkdownFrontMatterDocument,
  serializeMarkdownFrontMatterValue,
} from "../src/vfs/markdownFrontMatterShared.mjs";

const virtualRoot = "/home/user";

const relativeLabel = (contentRoot, physicalPath) => {
  const value = relative(contentRoot, physicalPath).replaceAll("\\", "/");
  return value.length === 0 ? "content/home/user" : `content/home/user/${value}`;
};

const decodeUtf8 = (buffer, label) => {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch (error) {
    throw new Error(`${label} is not valid UTF-8 (${error instanceof Error ? error.message : String(error)}).`);
  }
};

const readTextFile = async (filePath, label) => decodeUtf8(await readFile(filePath), label);

const withFrontMatter = (parsed, values) => {
  const lineEnding = parsed.lineEnding;
  const bom = parsed.hasBom ? "\uFEFF" : "";
  let yamlSource;
  if (parsed.hasFrontMatter) {
    parsed.document.set("title", values.title);
    parsed.document.set("publication", values.publication);
    yamlSource = serializeMarkdownFrontMatterDocument(parsed.document, lineEnding);
  } else {
    yamlSource = serializeMarkdownFrontMatterValue(values, lineEnding);
  }
  const normalizedYaml = yamlSource.endsWith(lineEnding) ? yamlSource : `${yamlSource}${lineEnding}`;
  return `${bom}---${lineEnding}${normalizedYaml}---${lineEnding}${parsed.body}`;
};

const removeLegacyArticleFields = (entry) => {
  const remaining = { ...entry };
  delete remaining.displayName;
  delete remaining.publication;
  return remaining;
};

const clonePublication = (publication) => publication === undefined ? undefined : {
  status: publication.status,
  ...(publication.slug === undefined ? {} : { slug: publication.slug }),
  ...(publication.aliases === undefined ? {} : { aliases: [...publication.aliases] }),
  ...(publication.publishedAt === undefined ? {} : { publishedAt: publication.publishedAt }),
  ...(publication.summary === undefined ? {} : { summary: publication.summary }),
  ...(publication.tags === undefined ? {} : { tags: [...publication.tags] }),
};

const getFrontMatterValues = (resolved) => ({
  title: resolved.title,
  publication: clonePublication(resolved.publication),
});

const createEmptyPlan = (contentRoot) => ({
  contentRoot: resolve(contentRoot),
  discovered: 0,
  alreadyAuthoritative: 0,
  eligible: 0,
  unsupportedPublicationTargets: 0,
  orphanPublicationEntries: 0,
  conflicts: 0,
  duplicateRoutes: 0,
  blockers: [],
  contentChanges: [],
  sidecarChanges: [],
  routeTokens: [],
});

const addBlocker = (plan, path, message) => {
  plan.blockers.push({ path, message });
};

const addUnsupportedPublicationTarget = (plan, path, message) => {
  plan.unsupportedPublicationTargets += 1;
  addBlocker(plan, path, message);
};

const addOrphanPublicationEntry = (plan, path, message) => {
  plan.orphanPublicationEntries += 1;
  addBlocker(plan, path, message);
};

const addConflict = (plan, path, message) => {
  plan.conflicts += 1;
  addBlocker(plan, path, message);
};

const routeRecords = (plan, publication, path) => {
  if (publication?.slug !== undefined) plan.routeTokens.push({ token: publication.slug, role: "slug", path });
  publication?.aliases?.forEach((alias) => plan.routeTokens.push({ token: alias, role: "alias", path }));
};

const validateRouteTokens = (plan) => {
  const records = [...plan.routeTokens].sort((left, right) => left.token.localeCompare(right.token) || left.path.localeCompare(right.path) || left.role.localeCompare(right.role));
  records.forEach((record, index) => {
    const prior = records[index - 1];
    if (prior?.token === record.token) {
      plan.duplicateRoutes += 1;
      addBlocker(plan, record.path, `route token '${record.token}' conflicts with ${prior.role} on '${prior.path}'.`);
    }
  });
};

const classifyPublicationTarget = (childName, childStat) => {
  if (childStat.isDirectory()) return { kind: "directory" };
  if (!childStat.isFile()) return { kind: "unsupported" };

  const textMimeType = getRepositoryContentTextMimeType(childName);
  if (textMimeType === "text/markdown") return { kind: "markdown", mimeType: textMimeType };
  if (textMimeType !== null) return { kind: "other-text", mimeType: textMimeType };

  const assetMimeType = getRepositoryContentAssetMimeType(childName);
  if (assetMimeType !== null) return { kind: "asset", mimeType: assetMimeType };
  return { kind: "unsupported" };
};

const describeUnsupportedPublicationTarget = (childName, target) => {
  if (target.kind === "directory") {
    return `publication entry '${childName}' targets a directory; publication migration requires a Markdown file.`;
  }

  if (target.kind === "other-text") {
    if (target.mimeType === "text/html") {
      return `publication entry '${childName}' targets HTML, but this migration has no HTML front matter destination; migration supports Markdown only.`;
    }
    return `publication entry '${childName}' targets ${target.mimeType}, but migration supports Markdown only.`;
  }

  if (target.kind === "asset") {
    return `publication entry '${childName}' targets unsupported publication asset ${target.mimeType}; migration supports Markdown only.`;
  }

  return `publication entry '${childName}' targets an unsupported file type; migration supports Markdown only.`;
};

const createMetadataChange = (physicalPath, version, entries, nextEntries) => ({
  physicalPath,
  before: renderRepositoryContentDirectoryMetadata({ version, entries }),
  after: renderRepositoryContentDirectoryMetadata({ version, entries: nextEntries }),
});

/** Builds a complete, no-write migration plan for a repository content tree. */
export async function createPublicationFrontMatterMigrationPlan({ contentRoot = defaultContentRoot } = {}) {
  const plan = createEmptyPlan(contentRoot);
  const directories = [];
  const files = [];

  const scanDirectory = async (physicalPath, virtualPath) => {
    let children;
    try {
      children = await readdir(physicalPath, { withFileTypes: true });
    } catch (error) {
      addBlocker(plan, relativeLabel(plan.contentRoot, physicalPath), `cannot read directory (${error instanceof Error ? error.message : String(error)}).`);
      return;
    }

    let metadata;
    try {
      metadata = await readRepositoryContentDirectoryMetadata(plan.contentRoot, physicalPath, children);
    } catch (error) {
      addBlocker(plan, relativeLabel(plan.contentRoot, resolve(physicalPath, repositoryContentMetadataFileName)), error instanceof Error ? error.message : String(error));
      metadata = { version: 6, entries: new Map(), exists: false };
    }

    const directory = { physicalPath, virtualPath, children, metadata, targets: new Map() };
    directories.push(directory);

    const visibleChildNames = new Set(children
      .map((child) => child.name)
      .filter((name) => name !== repositoryContentMetadataFileName && !shouldIgnoreRepositoryContentEntry(name)));

    metadata.entries.forEach((entry, childName) => {
      if (entry.publication !== undefined) return;
      const validationError = getRepositoryContentMetadataValidationError({
        childName,
        childVirtualPath: `${virtualPath}/${childName}`,
        metadata: entry,
        visibleChildNames,
      });

      if (validationError !== null) {
        addBlocker(plan, relativeLabel(plan.contentRoot, resolve(physicalPath, repositoryContentMetadataFileName)), validationError);
      }
    });

    for (const child of children) {
      if (child.name === repositoryContentMetadataFileName || shouldIgnoreRepositoryContentEntry(child.name)) continue;
      const childPath = resolve(physicalPath, child.name);
      const childVirtualPath = `${virtualPath}/${child.name}`;
      let childStat;
      try {
        childStat = await lstat(childPath);
      } catch (error) {
        addBlocker(plan, relativeLabel(plan.contentRoot, childPath), `cannot inspect entry (${error instanceof Error ? error.message : String(error)}).`);
        continue;
      }

      const target = {
        physicalPath: childPath,
        virtualPath: childVirtualPath,
        name: child.name,
        ...classifyPublicationTarget(child.name, childStat),
      };
      directory.targets.set(child.name, target);

      if (childStat.isSymbolicLink()) {
        addBlocker(plan, relativeLabel(plan.contentRoot, childPath), "symbolic links are not supported.");
        continue;
      }
      if (childStat.isDirectory()) {
        await scanDirectory(childPath, childVirtualPath);
        continue;
      }
      if (!childStat.isFile()) continue;
      if (getRepositoryContentTextMimeType(child.name) !== "text/markdown") continue;
      files.push({ physicalPath: childPath, virtualPath: childVirtualPath, name: child.name, directory, metadataEntry: metadata.entries.get(child.name) });
    }
  };

  const rootStat = await lstat(plan.contentRoot).catch((error) => {
    addBlocker(plan, "content/home/user", `cannot read content root (${error instanceof Error ? error.message : String(error)}).`);
    return null;
  });
  if (rootStat && !rootStat.isDirectory()) addBlocker(plan, "content/home/user", "content root is not a directory.");
  if (!rootStat || plan.blockers.length > 0 && !rootStat.isDirectory()) return plan;

  await scanDirectory(plan.contentRoot, virtualRoot);

  for (const directory of directories) {
    for (const [childName, entry] of directory.metadata.entries) {
      if (entry.publication === undefined) continue;
      const sidecarPath = relativeLabel(plan.contentRoot, resolve(directory.physicalPath, repositoryContentMetadataFileName));
      const target = directory.targets.get(childName);
      if (target === undefined) {
        addOrphanPublicationEntry(plan, sidecarPath, `publication entry '${childName}' references a missing or invisible target.`);
        continue;
      }
      if (target.kind !== "markdown") {
        addUnsupportedPublicationTarget(plan, sidecarPath, describeUnsupportedPublicationTarget(childName, target));
      }
    }
  }

  for (const file of files) {
    plan.discovered += file.metadataEntry?.publication === undefined ? 0 : 1;
    let source;
    try {
      source = await readTextFile(file.physicalPath, relativeLabel(plan.contentRoot, file.physicalPath));
    } catch (error) {
      addBlocker(plan, relativeLabel(plan.contentRoot, file.physicalPath), error instanceof Error ? error.message : String(error));
      continue;
    }

    let parsed;
    let resolvedFrontMatter;
    try {
      parsed = parseMarkdownFrontMatter(source, relativeLabel(plan.contentRoot, file.physicalPath));
      resolvedFrontMatter = parsed.hasFrontMatter
        ? resolveMarkdownFrontMatter(parsed.frontMatter, `${relativeLabel(plan.contentRoot, file.physicalPath)} front matter`)
        : { title: undefined, publication: undefined };
    } catch (error) {
      addBlocker(plan, relativeLabel(plan.contentRoot, file.physicalPath), error instanceof Error ? error.message : String(error));
      continue;
    }

    const legacyPublication = file.metadataEntry?.publication;
    const frontPublication = resolvedFrontMatter.publication;
    if (frontPublication !== undefined && legacyPublication !== undefined) {
      const differences = getPublicationDifferences(frontPublication, legacyPublication);
      if (differences.length > 0) {
        addConflict(plan, relativeLabel(plan.contentRoot, file.physicalPath), `front matter and legacy publication conflict in fields: ${differences.join(", ")}.`);
        continue;
      }
    }

    const legacyTitle = file.metadataEntry?.displayName ?? file.name;
    if (resolvedFrontMatter.title !== undefined
      && (file.metadataEntry?.displayName !== undefined || file.metadataEntry?.publication !== undefined)
      && resolvedFrontMatter.title !== legacyTitle) {
      addConflict(plan, relativeLabel(plan.contentRoot, file.physicalPath), `front matter title '${resolvedFrontMatter.title}' conflicts with legacy effective title '${legacyTitle}'.`);
      continue;
    }
    if (!isSafeMarkdownFrontMatterText(legacyTitle)) {
      addBlocker(plan, relativeLabel(plan.contentRoot, file.physicalPath), "legacy effective title cannot be represented safely in YAML front matter.");
      continue;
    }

    const publication = frontPublication ?? legacyPublication;
    routeRecords(plan, publication, file.virtualPath);
    if (publication === undefined) continue;

    const directory = file.directory;
    const nextEntries = new Map(directory.pendingEntries ?? directory.metadata.entries);
    const nextEntry = removeLegacyArticleFields(file.metadataEntry ?? {});
    const needsSidecarCleanup = file.metadataEntry?.displayName !== undefined || file.metadataEntry?.publication !== undefined;

    if (frontPublication !== undefined) {
      plan.alreadyAuthoritative += 1;
      if (needsSidecarCleanup) {
        nextEntries.set(file.name, nextEntry);
        directory.pendingEntries = nextEntries;
      }
      if (file.metadataEntry?.publication !== undefined || file.metadataEntry?.displayName !== undefined) {
        plan.sidecarChanges.push({ file: relativeLabel(plan.contentRoot, file.physicalPath), action: "remove legacy displayName/publication" });
      }
      continue;
    }

    plan.eligible += 1;
    const values = getFrontMatterValues({
      title: resolvedFrontMatter.title ?? legacyTitle,
      publication,
    });
    const migratedSource = withFrontMatter(parsed, values);
    plan.contentChanges.push({
      physicalPath: file.physicalPath,
      file: relativeLabel(plan.contentRoot, file.physicalPath),
      before: source,
      after: migratedSource,
      title: values.title,
      publication,
    });
    nextEntries.set(file.name, nextEntry);
    directory.pendingEntries = nextEntries;
    plan.sidecarChanges.push({ file: relativeLabel(plan.contentRoot, file.physicalPath), action: "remove legacy displayName/publication" });
  }

  validateRouteTokens(plan);
  for (const directory of directories) {
    if (!directory.pendingEntries) continue;
    const before = directory.metadata.entries;
    const after = directory.pendingEntries;
    const sidecarPath = resolve(directory.physicalPath, repositoryContentMetadataFileName);
    plan.sidecarWrites ??= [];
    plan.sidecarWrites.push(createMetadataChange(sidecarPath, directory.metadata.version, before, after));
  }
  return plan;
}

const writeAtomically = async (physicalPath, content) => {
  const temporaryPath = `${physicalPath}.${process.pid}.${Date.now()}.tmp`;
  await mkdir(dirname(physicalPath), { recursive: true });
  try {
    await writeFile(temporaryPath, content, "utf8");
    await rename(temporaryPath, physicalPath);
  } finally {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
  }
};

/** Applies only a fully validated plan. No writes are attempted when blockers exist. */
export async function applyPublicationFrontMatterMigration(plan) {
  if (plan.blockers.length > 0) throw new Error("Publication front matter migration has blockers; no files were written.");
  for (const change of plan.contentChanges) await writeAtomically(change.physicalPath, change.after);
  for (const change of plan.sidecarWrites ?? []) {
    if (change.before !== change.after) await writeAtomically(change.physicalPath, change.after);
  }
}

export const formatPublicationFrontMatterMigrationReport = (plan, write = false) => {
  const lines = [
    `Publication front matter migration (${write ? "write" : "dry-run"})`,
    `Legacy Markdown publications: ${plan.discovered}`,
    `Already front-matter authoritative: ${plan.alreadyAuthoritative}`,
    `Eligible legacy articles: ${plan.eligible}`,
    `Unsupported publication targets: ${plan.unsupportedPublicationTargets}`,
    `Orphan/stale publication entries: ${plan.orphanPublicationEntries}`,
    `Conflicts: ${plan.conflicts}`,
    `Duplicate route tokens: ${plan.duplicateRoutes}`,
    `Content files to change: ${plan.contentChanges.length}`,
    `Sidecars to change: ${(plan.sidecarWrites ?? []).filter((change) => change.before !== change.after).length}`,
    `Blockers: ${plan.blockers.length}`,
  ];
  if (plan.contentChanges.length > 0) {
    lines.push("Planned files:");
    plan.contentChanges.forEach((change) => lines.push(`  ${change.file} | legacy-sidecar -> frontmatter | ${change.title} | ${change.publication?.slug ?? "(no slug)"} | migrate | OK`));
  }
  if (plan.sidecarChanges.length > 0) {
    lines.push("Sidecar cleanup:");
    plan.sidecarChanges.forEach((change) => lines.push(`  ${change.file} | ${change.action}`));
  }
  if (plan.blockers.length > 0) {
    lines.push("Blockers:");
    plan.blockers.forEach((blocker) => lines.push(`  ${blocker.path}: ${blocker.message}`));
  }
  return `${lines.join("\n")}\n`;
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const write = process.argv.slice(2).includes("--write");
  const plan = await createPublicationFrontMatterMigrationPlan();
  process.stdout.write(formatPublicationFrontMatterMigrationReport(plan, write));
  if (write) {
    if (plan.blockers.length > 0) process.exitCode = 1;
    else await applyPublicationFrontMatterMigration(plan);
  }
}
