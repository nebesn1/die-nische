export type RepositoryPublication = {
  readonly status: "draft" | "published";
  readonly slug?: string;
  readonly aliases?: readonly string[];
  readonly publishedAt?: string;
  readonly summary?: string;
  readonly tags?: readonly string[];
};

export type GeneratedVfsContentDirectoryEntry = {
  readonly kind: "directory";
  readonly id: string;
  readonly virtualPath: string;
  readonly parentVirtualPath: string | null;
  readonly name: string;
  readonly displayName?: string;
  readonly created: string;
  readonly modified: string;
  readonly order?: number;
};

export type GeneratedVfsContentTextSource = { readonly kind: "text"; readonly text: string };
export type GeneratedVfsContentAssetUrlSource = { readonly kind: "asset-url"; readonly url: string };

export type GeneratedVfsContentTextFileEntry = {
  readonly kind: "file";
  readonly id: string;
  readonly virtualPath: string;
  readonly parentVirtualPath: string;
  readonly name: string;
  readonly displayName?: string;
  readonly created: string;
  readonly modified: string;
  readonly mimeType: string;
  readonly size: number;
  readonly order?: number;
  readonly publication?: RepositoryPublication;
  readonly source: GeneratedVfsContentTextSource;
};

export type GeneratedVfsContentAssetFileEntry = {
  readonly kind: "file";
  readonly id: string;
  readonly virtualPath: string;
  readonly parentVirtualPath: string;
  readonly name: string;
  readonly displayName?: string;
  readonly created: string;
  readonly modified: string;
  readonly mimeType: string;
  readonly size: number;
  readonly order?: number;
  readonly source: GeneratedVfsContentAssetUrlSource;
};

export type GeneratedVfsContentEntry =
  | GeneratedVfsContentDirectoryEntry
  | GeneratedVfsContentTextFileEntry
  | GeneratedVfsContentAssetFileEntry;

export type GeneratedVfsContentManifest = { readonly entries: readonly GeneratedVfsContentEntry[] };
export type RepositoryContentManifest = GeneratedVfsContentManifest;

export const defaultContentRoot: string;
export const defaultOutputPath: string;
export const repositoryContentDefaultTimestamp: string;
export const repositoryContentMetadataFileName: string;
export const UNVERSIONED_REPOSITORY_CONTENT_METADATA_VERSION: 6;

export type RepositoryContentMetadataVersion = 1 | 2 | 3 | 4 | 5 | 6;
export function getEffectiveRepositoryContentMetadataVersion(rawVersion?: RepositoryContentMetadataVersion): RepositoryContentMetadataVersion;
export type RepositoryContentMetadataEntry = {
  readonly id?: string;
  readonly created?: string;
  readonly modified?: string;
  readonly order?: number;
  readonly displayName?: string;
  readonly publication?: RepositoryPublication;
};
export type RepositoryContentDirectoryMetadata = {
  readonly version: RepositoryContentMetadataVersion;
  readonly rawVersion?: RepositoryContentMetadataVersion;
  readonly isUnversioned: boolean;
  readonly entries: ReadonlyMap<string, RepositoryContentMetadataEntry>;
  readonly exists: boolean;
};

export function getRepositoryContentNodeId(virtualPath: string): string;
export function getRepositoryContentTextMimeType(fileName: string): string | null;
export function getRepositoryContentAssetMimeType(fileName: string): string | null;
export function shouldIgnoreRepositoryContentEntry(name: string): boolean;
export function getRepositoryContentMetadataValidationError(options: {
  childName: string;
  childVirtualPath: string;
  metadata: {
    readonly id?: string;
    readonly order?: number;
    readonly displayName?: string;
    readonly publication?: RepositoryPublication;
  };
  visibleChildNames: ReadonlySet<string>;
}): string | null;
export function readRepositoryContentDirectoryMetadata(
  contentRoot: string,
  physicalPath: string,
  children: readonly { readonly name: string }[],
): Promise<RepositoryContentDirectoryMetadata>;
export function renderRepositoryContentDirectoryMetadata(options: {
  readonly version?: 2 | 3 | 4 | 5 | 6;
  readonly entries: ReadonlyMap<string, RepositoryContentMetadataEntry>;
}): string;
export function buildVfsContentManifest(options?: { contentRoot?: string }): Promise<GeneratedVfsContentManifest>;
export function renderVfsContentManifestModule(manifest: GeneratedVfsContentManifest): string;
export function generateVfsContentManifest(options?: { contentRoot?: string; outputPath?: string }): Promise<{ manifest: GeneratedVfsContentManifest; output: string }>;
