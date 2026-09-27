/* global Buffer, console, process */

import { createHash } from "node:crypto";
import { lstat, mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  getPublicationDifferences,
  normalizeMarkdownPublication,
  parseMarkdownFrontMatter,
  resolveMarkdownFrontMatter,
} from "../src/vfs/markdownFrontMatterShared.mjs";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const defaultContentRoot = resolve(projectRoot, "content/home/user");
export const defaultOutputPath = resolve(projectRoot, "src/generated/vfsContentManifest.generated.ts");
const virtualRoot = "/home/user";
export const repositoryContentDefaultTimestamp = "2026-08-30T12:00:00.000Z";
const idNamespace = "kde3-web-desktop:vfs-content:v1:";
export const repositoryContentMetadataFileName = ".kde3-meta.json";
/** Missing version is permanently pinned to the historical v6 semantics. */
export const UNVERSIONED_REPOSITORY_CONTENT_METADATA_VERSION = 6;
const supportedRepositoryContentMetadataVersions = new Set([1, 2, 3, 4, 5, 6]);
const repositoryContentMountPaths = new Set([
  virtualRoot,
  "/home/user/Desktop",
  "/home/user/Documents",
  "/home/user/Downloads",
  "/home/user/Music",
  "/home/user/Pictures",
  "/home/user/Videos",
]);
const explicitIdPattern = /^vfs-content-[A-Za-z0-9._-]+$/;
const utcTimestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const publicationSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const hasUnsafePlainTextCharacter = (value) => [...value].some((character) => {
  const codePoint = character.codePointAt(0);
  return codePoint !== undefined && (codePoint <= 0x1F || codePoint === 0x7F);
});

const compareCodePoints = (left, right) => (left < right ? -1 : left > right ? 1 : 0);

export const getRepositoryContentNodeId = (virtualPath) =>
  `vfs-content-${createHash("sha256").update(`${idNamespace}${virtualPath}`).digest("hex").slice(0, 24)}`;

export const getRepositoryContentTextMimeType = (fileName) => {
  const extension = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();

  switch (extension) {
    case ".txt":
      return "text/plain";
    case ".md":
    case ".markdown":
      return "text/markdown";
    case ".html":
    case ".htm":
      return "text/html";
    default:
      return null;
  }
};

export const getRepositoryContentAssetMimeType = (fileName) => {
  const extension = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();

  switch (extension) {
    case ".png": return "image/png";
    case ".jpg":
    case ".jpeg": return "image/jpeg";
    case ".gif": return "image/gif";
    case ".webp": return "image/webp";
    case ".bmp": return "image/bmp";
    case ".mp3": return "audio/mpeg";
    case ".ogg":
    case ".oga": return "audio/ogg";
    case ".wav": return "audio/wav";
    case ".mp4": return "video/mp4";
    case ".webm": return "video/webm";
    case ".ogv": return "video/ogg";
    default: return null;
  }
};

export const shouldIgnoreRepositoryContentEntry = (name) =>
  name === ".gitkeep" || name === ".DS_Store" || name === "Thumbs.db" || name.startsWith(".kde3-");

export const getRepositoryContentMetadataValidationError = ({ childName, childVirtualPath, metadata, visibleChildNames }) => {
  if (!visibleChildNames.has(childName)) {
    return `entry '${childName}' does not target a visible immediate child.`;
  }

  if (repositoryContentMountPaths.has(childVirtualPath)
    && (metadata.id !== undefined || metadata.order !== undefined || metadata.displayName !== undefined || metadata.publication !== undefined)) {
    return `entry '${childName}' may only set created or modified for platform-owned mount '${childVirtualPath}'.`;
  }

  return null;
};

const fail = (message) => {
  throw new Error(`VFS content generator: ${message}`);
};

const relativeLabel = (contentRoot, physicalPath) => {
  const relativePath = relative(contentRoot, physicalPath).replaceAll("\\", "/");
  return relativePath.length === 0 ? "content/home/user" : `content/home/user/${relativePath}`;
};

const assertSafeName = (name, physicalPath, contentRoot) => {
  if (name === "." || name === ".." || name.includes("/") || name.includes("\\") || name.includes("\0")) {
    fail(`Unsupported repository content path segment '${relativeLabel(contentRoot, physicalPath)}'.`);
  }
};

const failMetadata = (contentRoot, metadataPath, message) => {
  fail(`Metadata '${relativeLabel(contentRoot, metadataPath)}': ${message}`);
};

const isPlainObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

const isSafePlainText = (value) => typeof value === "string"
  && value.length > 0
  && value.trim() === value
  && !hasUnsafePlainTextCharacter(value);

export const isStrictRepositoryContentUtcTimestamp = (value) => {
  if (typeof value !== "string" || !utcTimestampPattern.test(value)) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
};

/** One authored route-token grammar shared by canonical publication slugs and historical aliases. */
export const isStrictPublicationRouteToken = (value) =>
  typeof value === "string" && publicationSlugPattern.test(value);

export const getEffectiveRepositoryContentMetadataVersion = (rawVersion) =>
  rawVersion === undefined ? UNVERSIONED_REPOSITORY_CONTENT_METADATA_VERSION : rawVersion;

const parsePublicationMetadata = (contentRoot, metadataPath, version, childName, value) => {
  try {
    return normalizeMarkdownPublication(value, `entry '${childName}' publication`, version);
  } catch (error) {
    failMetadata(contentRoot, metadataPath, error instanceof Error ? error.message : String(error));
  }
};

const parseMetadataEntry = (contentRoot, metadataPath, version, childName, value) => {
  if (childName === "." || childName === ".." || childName.includes("/") || childName.includes("\\") || childName.includes("\0")) {
    failMetadata(contentRoot, metadataPath, `entry key '${childName}' must name an immediate child.`);
  }

  if (!isPlainObject(value)) {
    failMetadata(contentRoot, metadataPath, `entry '${childName}' must be an object.`);
  }

  const allowedFields = version === 1
    ? new Set(["id", "modified", "order"])
    : version === 2
      ? new Set(["id", "created", "modified", "order"])
      : version === 3
        ? new Set(["id", "created", "modified", "order", "displayName"])
        : new Set(["id", "created", "modified", "order", "displayName", "publication"]);
  const unknownField = Object.keys(value).find((field) => !allowedFields.has(field));

  if (unknownField) {
    failMetadata(contentRoot, metadataPath, `entry '${childName}' has unknown field '${unknownField}'.`);
  }

  if ("id" in value && (typeof value.id !== "string" || !explicitIdPattern.test(value.id))) {
    failMetadata(contentRoot, metadataPath, `entry '${childName}' has invalid id '${String(value.id)}'.`);
  }

  if ("created" in value && !isStrictRepositoryContentUtcTimestamp(value.created)) {
    failMetadata(contentRoot, metadataPath, `entry '${childName}' has invalid created timestamp '${String(value.created)}'.`);
  }

  if ("modified" in value) {
    if (!isStrictRepositoryContentUtcTimestamp(value.modified)) {
      failMetadata(contentRoot, metadataPath, `entry '${childName}' has invalid modified timestamp '${String(value.modified)}'.`);
    }
  }

  if ("order" in value && (typeof value.order !== "number" || !Number.isSafeInteger(value.order))) {
    failMetadata(contentRoot, metadataPath, `entry '${childName}' has invalid order '${String(value.order)}'.`);
  }

  if ("displayName" in value && !isSafePlainText(value.displayName)) {
    failMetadata(contentRoot, metadataPath, `entry '${childName}' has invalid displayName.`);
  }

  return {
    ...(typeof value.id === "string" ? { id: value.id } : {}),
    ...(typeof value.created === "string" ? { created: value.created } : {}),
    ...(typeof value.modified === "string" ? { modified: value.modified } : {}),
    ...(typeof value.order === "number" ? { order: value.order } : {}),
    ...(typeof value.displayName === "string" ? { displayName: value.displayName } : {}),
    ...("publication" in value ? { publication: parsePublicationMetadata(contentRoot, metadataPath, version, childName, value.publication) } : {}),
  };
};

export const readRepositoryContentDirectoryMetadata = async (contentRoot, physicalPath, children) => {
  const metadataEntry = children.find((child) => child.name === repositoryContentMetadataFileName);

  if (!metadataEntry) return { version: 2, rawVersion: undefined, isUnversioned: false, entries: new Map(), exists: false };

  const metadataPath = resolve(physicalPath, repositoryContentMetadataFileName);
  const metadataStat = await lstat(metadataPath);

  if (metadataStat.isSymbolicLink() || !metadataStat.isFile()) {
    failMetadata(contentRoot, metadataPath, "must be a regular JSON file.");
  }

  let parsed;

  try {
    parsed = JSON.parse(await readFile(metadataPath, "utf8"));
  } catch (error) {
    failMetadata(contentRoot, metadataPath, `contains invalid JSON (${error instanceof Error ? error.message : String(error)}).`);
  }

  if (!isPlainObject(parsed)) {
    failMetadata(contentRoot, metadataPath, "top level must be an object.");
  }

  const unknownTopLevelField = Object.keys(parsed).find((field) => field !== "version" && field !== "entries");

  if (unknownTopLevelField) {
    failMetadata(contentRoot, metadataPath, `has unknown top-level field '${unknownTopLevelField}'.`);
  }

  const hasVersion = Object.prototype.hasOwnProperty.call(parsed, "version");
  const rawVersion = hasVersion ? parsed.version : undefined;

  if (hasVersion && !supportedRepositoryContentMetadataVersions.has(rawVersion)) {
    failMetadata(contentRoot, metadataPath, `requires version 1, 2, 3, 4, 5, or 6, or an omitted version for the stable v6 baseline (received '${String(rawVersion)}').`);
  }

  if (!isPlainObject(parsed.entries)) {
    failMetadata(contentRoot, metadataPath, "requires an object 'entries' field.");
  }

  const version = getEffectiveRepositoryContentMetadataVersion(rawVersion);

  return {
    version,
    rawVersion,
    isUnversioned: !hasVersion,
    entries: new Map(Object.entries(parsed.entries).map(([childName, value]) => [
      childName,
      parseMetadataEntry(contentRoot, metadataPath, version, childName, value),
    ])),
    exists: true,
  };
};

export const renderRepositoryContentDirectoryMetadata = ({ version = UNVERSIONED_REPOSITORY_CONTENT_METADATA_VERSION, entries }) => {
  if (version !== 2 && version !== 3 && version !== 4 && version !== 5 && version !== 6) {
    throw new Error(`VFS content generator: Metadata writer requires version 2, 3, 4, 5, or 6 (received '${String(version)}').`);
  }

  const serializedEntries = Object.fromEntries([...entries.entries()]
    .sort(([left], [right]) => compareCodePoints(left, right))
    .map(([name, entry]) => [name, version === 4 || version === 5 || version === 6
      ? {
        ...(entry.id === undefined ? {} : { id: entry.id }),
        ...(entry.displayName === undefined ? {} : { displayName: entry.displayName }),
        ...(entry.created === undefined ? {} : { created: entry.created }),
        ...(entry.modified === undefined ? {} : { modified: entry.modified }),
        ...(entry.order === undefined ? {} : { order: entry.order }),
        ...(entry.publication === undefined ? {} : { publication: {
          status: entry.publication.status,
          ...(version === 5 || version === 6 ? entry.publication.slug === undefined ? {} : { slug: entry.publication.slug } : {}),
          ...(version === 6 && entry.publication.aliases === undefined ? {} : version === 6 ? { aliases: entry.publication.aliases } : {}),
          ...(entry.publication.publishedAt === undefined ? {} : { publishedAt: entry.publication.publishedAt }),
          ...(entry.publication.summary === undefined ? {} : { summary: entry.publication.summary }),
          ...(entry.publication.tags === undefined ? {} : { tags: entry.publication.tags }),
        } }),
      }
      : {
        ...(entry.id === undefined ? {} : { id: entry.id }),
        ...(entry.created === undefined ? {} : { created: entry.created }),
        ...(entry.modified === undefined ? {} : { modified: entry.modified }),
        ...(entry.order === undefined ? {} : { order: entry.order }),
        ...(entry.displayName === undefined ? {} : { displayName: entry.displayName }),
      }]));

  return `${JSON.stringify({
    ...(version < UNVERSIONED_REPOSITORY_CONTENT_METADATA_VERSION ? { version } : {}),
    entries: serializedEntries,
  }, null, 2)}\n`;
};

const compareRepositoryChildren = (metadata) => (left, right) => {
  const leftOrder = metadata.get(left.name)?.order;
  const rightOrder = metadata.get(right.name)?.order;

  if (leftOrder !== undefined && rightOrder !== undefined && leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }

  if (leftOrder !== undefined && rightOrder === undefined) return -1;
  if (leftOrder === undefined && rightOrder !== undefined) return 1;
  return compareCodePoints(left.name, right.name);
};

const appendEntry = (entries, paths, ids, entry) => {
  if (paths.has(entry.virtualPath)) {
    fail(`Duplicate virtual path '${entry.virtualPath}'.`);
  }

  const priorPath = ids.get(entry.id);

  if (priorPath) {
    fail(`Generated ID collision for '${entry.virtualPath}' (${entry.id}); already used by '${priorPath}'.`);
  }

  paths.add(entry.virtualPath);
  ids.set(entry.id, entry.virtualPath);
  entries.push(entry);
};

export async function buildVfsContentManifest({ contentRoot = defaultContentRoot } = {}) {
  const resolvedContentRoot = resolve(contentRoot);
  const entries = [];
  const paths = new Set();
  const ids = new Map();
  const publicationRouteTokens = [];
  const rootStat = await lstat(resolvedContentRoot).catch((error) => {
    fail(`Cannot read content root '${resolvedContentRoot}': ${error.message}`);
  });

  if (rootStat.isSymbolicLink()) {
    fail(`Symbolic links are not supported: '${relativeLabel(resolvedContentRoot, resolvedContentRoot)}'.`);
  }

  if (!rootStat.isDirectory()) {
    fail(`Content root '${resolvedContentRoot}' must be a directory.`);
  }

  const scanDirectory = async (physicalPath, virtualPath, parentVirtualPath, metadata = {}) => {
    appendEntry(entries, paths, ids, {
      kind: "directory",
      id: metadata.id ?? getRepositoryContentNodeId(virtualPath),
      virtualPath,
      parentVirtualPath,
      name: virtualPath === virtualRoot ? "user" : virtualPath.slice(virtualPath.lastIndexOf("/") + 1),
      created: metadata.created ?? repositoryContentDefaultTimestamp,
      modified: metadata.modified ?? repositoryContentDefaultTimestamp,
      ...(metadata.order === undefined ? {} : { order: metadata.order }),
      ...(metadata.displayName === undefined ? {} : { displayName: metadata.displayName }),
    });

    const children = await readdir(physicalPath, { withFileTypes: true });
    const directoryMetadata = await readRepositoryContentDirectoryMetadata(resolvedContentRoot, physicalPath, children);
    const visibleChildNames = new Set(children
      .map((child) => child.name)
      .filter((name) => name !== repositoryContentMetadataFileName && !shouldIgnoreRepositoryContentEntry(name)));

    directoryMetadata.entries.forEach((_metadata, childName) => {
      const childVirtualPath = `${virtualPath}/${childName}`;
      const validationError = getRepositoryContentMetadataValidationError({
        childName,
        childVirtualPath,
        metadata: _metadata,
        visibleChildNames,
      });

      if (validationError !== null) {
        failMetadata(resolvedContentRoot, resolve(physicalPath, repositoryContentMetadataFileName), validationError);
      }
    });

    children.sort(compareRepositoryChildren(directoryMetadata.entries));

    for (const child of children) {
      const childPhysicalPath = resolve(physicalPath, child.name);
      assertSafeName(child.name, childPhysicalPath, resolvedContentRoot);

      if (child.name === repositoryContentMetadataFileName) {
        continue;
      }

      if (shouldIgnoreRepositoryContentEntry(child.name)) {
        continue;
      }

      const childStat = await lstat(childPhysicalPath);
      const childVirtualPath = `${virtualPath}/${child.name}`;
      const childMetadata = directoryMetadata.entries.get(child.name) ?? {};

      if (childStat.isSymbolicLink()) {
        fail(`Symbolic links are not supported: '${relativeLabel(resolvedContentRoot, childPhysicalPath)}'.`);
      }

      if (childStat.isDirectory()) {
        if (childMetadata.publication !== undefined) {
          failMetadata(resolvedContentRoot, resolve(physicalPath, repositoryContentMetadataFileName), `entry '${child.name}' may only set publication on a supported text file.`);
        }
        await scanDirectory(childPhysicalPath, childVirtualPath, virtualPath, childMetadata);
        continue;
      }

      if (!childStat.isFile()) {
        fail(`Unsupported repository content entry: '${relativeLabel(resolvedContentRoot, childPhysicalPath)}'.`);
      }

      const mimeType = getRepositoryContentTextMimeType(child.name);

      if (mimeType) {
        const text = await readFile(childPhysicalPath, "utf8");
        let frontMatter = { title: undefined, publication: undefined };

        if (mimeType === "text/markdown") {
          const sourceLabel = relativeLabel(resolvedContentRoot, childPhysicalPath);
          let parsedFrontMatter;

          try {
            parsedFrontMatter = parseMarkdownFrontMatter(text, sourceLabel);
            frontMatter = parsedFrontMatter.hasFrontMatter
              ? resolveMarkdownFrontMatter(parsedFrontMatter.frontMatter, `${sourceLabel} front matter`)
              : frontMatter;
          } catch (error) {
            fail(`${sourceLabel}: ${error instanceof Error ? error.message : String(error)}`);
          }

          if (frontMatter.publication !== undefined && childMetadata.publication !== undefined) {
            const differences = getPublicationDifferences(frontMatter.publication, childMetadata.publication);

            if (differences.length > 0) {
              fail(`${sourceLabel} publication conflicts with legacy metadata fields: ${differences.join(", ")}.`);
            }
          }

          if (frontMatter.title !== undefined
            && childMetadata.displayName !== undefined
            && frontMatter.title !== childMetadata.displayName) {
            fail(`${sourceLabel} title '${frontMatter.title}' conflicts with legacy displayName '${childMetadata.displayName}'.`);
          }
        }

        const effectiveDisplayName = frontMatter.title ?? childMetadata.displayName;
        const effectivePublication = frontMatter.publication ?? childMetadata.publication;
        const registerPublicationRouteToken = (token, role) => {
          publicationRouteTokens.push({
            token,
            role,
            path: childVirtualPath,
            metadataPath: resolve(physicalPath, repositoryContentMetadataFileName),
            childName: child.name,
          });
        };

        if (effectivePublication?.slug !== undefined) {
          registerPublicationRouteToken(effectivePublication.slug, "slug");
        }
        effectivePublication?.aliases?.forEach((alias) => registerPublicationRouteToken(alias, "alias"));

        appendEntry(entries, paths, ids, {
          kind: "file",
          id: childMetadata.id ?? getRepositoryContentNodeId(childVirtualPath),
          virtualPath: childVirtualPath,
          parentVirtualPath: virtualPath,
          name: child.name,
          mimeType,
          size: Buffer.byteLength(text, "utf8"),
          created: childMetadata.created ?? repositoryContentDefaultTimestamp,
          modified: childMetadata.modified ?? repositoryContentDefaultTimestamp,
          ...(childMetadata.order === undefined ? {} : { order: childMetadata.order }),
          ...(effectiveDisplayName === undefined ? {} : { displayName: effectiveDisplayName }),
          ...(effectivePublication === undefined ? {} : { publication: effectivePublication }),
          source: { kind: "text", text },
        });
        continue;
      }

      const assetMimeType = getRepositoryContentAssetMimeType(child.name);

      if (!assetMimeType) {
        fail(
          `Unsupported repository content file type: '${relativeLabel(resolvedContentRoot, childPhysicalPath)}'.`,
        );
      }

      if (childMetadata.publication !== undefined) {
        failMetadata(resolvedContentRoot, resolve(physicalPath, repositoryContentMetadataFileName), `entry '${child.name}' may only set publication on a supported text file.`);
      }

      appendEntry(entries, paths, ids, {
        kind: "file",
        id: childMetadata.id ?? getRepositoryContentNodeId(childVirtualPath),
        virtualPath: childVirtualPath,
        parentVirtualPath: virtualPath,
        name: child.name,
        mimeType: assetMimeType,
        size: childStat.size,
        created: childMetadata.created ?? repositoryContentDefaultTimestamp,
        modified: childMetadata.modified ?? repositoryContentDefaultTimestamp,
        ...(childMetadata.order === undefined ? {} : { order: childMetadata.order }),
        ...(childMetadata.displayName === undefined ? {} : { displayName: childMetadata.displayName }),
        source: { kind: "asset-url", url: `content/home/user${childVirtualPath.slice(virtualRoot.length)}` },
      });
    }
  };

  await scanDirectory(resolvedContentRoot, virtualRoot, null);
  publicationRouteTokens
    .sort((left, right) => compareCodePoints(left.token, right.token)
      || compareCodePoints(left.path, right.path)
      || compareCodePoints(left.role, right.role))
    .forEach((record, index, records) => {
      const prior = records[index - 1];
      if (prior?.token !== record.token) return;

      failMetadata(
        resolvedContentRoot,
        record.metadataPath,
        `entry '${record.childName}' publication ${record.role} '${record.token}' conflicts with ${prior.role} on '${prior.path}'.`,
      );
    });
  return { entries };
}

export const renderVfsContentManifestModule = (manifest) => {
  const assetEntries = manifest.entries.filter((entry) => entry.kind === "file" && entry.source.kind === "asset-url");
  const imports = assetEntries.map((entry) => {
    const symbol = `asset_${getRepositoryContentNodeId(entry.virtualPath).replace("vfs-content-", "")}`;
    const specifier = `../../${entry.source.url}?url&no-inline`;
    return { symbol, specifier, marker: entry.source.url };
  });
  const serialized = JSON.stringify(manifest, null, 2);
  const runtimeManifest = imports.reduce(
    (output, asset) => output.replace(`"url": "${asset.marker}"`, `"url": ${asset.symbol}`),
    serialized,
  );
  const importLines = imports.map((asset) => `import ${asset.symbol} from ${JSON.stringify(asset.specifier)};`).join("\n");
  return `/* AUTO-GENERATED by scripts/generate-vfs-content-manifest.mjs. DO NOT EDIT. */
${importLines}${importLines.length > 0 ? "\n" : ""}import type { GeneratedVfsContentManifest } from "../vfs/repositoryContentManifest";

export const generatedVfsContentManifest = ${runtimeManifest} as const satisfies GeneratedVfsContentManifest;
`;
};

export async function generateVfsContentManifest({ contentRoot = defaultContentRoot, outputPath = defaultOutputPath } = {}) {
  const manifest = await buildVfsContentManifest({ contentRoot });
  const output = renderVfsContentManifestModule(manifest);
  await mkdir(dirname(outputPath), { recursive: true });
  const temporaryOutputPath = `${outputPath}.${process.pid}.${Date.now()}.tmp`;

  try {
    await writeFile(temporaryOutputPath, output, "utf8");
    await rename(temporaryOutputPath, outputPath);
  } finally {
    await rm(temporaryOutputPath, { force: true }).catch(() => undefined);
  }

  return { manifest, output };
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;

if (invokedPath === import.meta.url) {
  generateVfsContentManifest().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
