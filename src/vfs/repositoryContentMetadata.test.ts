import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

type RepositoryContentMetadata = {
  readonly version: 1 | 2 | 3 | 4 | 5 | 6;
  readonly rawVersion?: 1 | 2 | 3 | 4 | 5 | 6;
  readonly isUnversioned: boolean;
  readonly entries: Map<string, unknown>;
  readonly exists: boolean;
};

type RepositoryContentGenerator = {
  readonly buildVfsContentManifest: (options?: { readonly contentRoot?: string }) => Promise<unknown>;
  readonly getEffectiveRepositoryContentMetadataVersion: (rawVersion?: 1 | 2 | 3 | 4 | 5 | 6) => 1 | 2 | 3 | 4 | 5 | 6;
  readonly readRepositoryContentDirectoryMetadata: (contentRoot: string, physicalPath: string, children: readonly unknown[]) => Promise<RepositoryContentMetadata>;
  readonly renderRepositoryContentDirectoryMetadata: (options: { readonly version?: 1 | 2 | 3 | 4 | 5 | 6; readonly entries: Map<string, unknown> }) => string;
};

const generator = (await import(new URL("../../scripts/generate-vfs-content-manifest.mjs", import.meta.url).href)) as RepositoryContentGenerator;
const temporaryRoots: string[] = [];

const createContentRoot = async (): Promise<string> => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "kde3-vfs-metadata-version-"));
  const contentRoot = join(temporaryRoot, "content", "home", "user");
  temporaryRoots.push(temporaryRoot);
  await mkdir(contentRoot, { recursive: true });
  return contentRoot;
};

const writeFixture = async (contentRoot: string, relativePath: string, content: string): Promise<void> => {
  const target = join(contentRoot, relativePath);
  await mkdir(join(target, ".."), { recursive: true });
  await writeFile(target, content, "utf8");
};

const writeMetadata = async (contentRoot: string, directory: string, metadata: unknown): Promise<void> => {
  await writeFixture(contentRoot, `${directory}/.kde3-meta.json`, `${JSON.stringify(metadata, null, 2)}\n`);
};

const readMetadata = async (contentRoot: string, directory = "Documents"): Promise<RepositoryContentMetadata> => {
  const physicalPath = join(contentRoot, directory);
  const children = await readdir(physicalPath, { withFileTypes: true });
  return generator.readRepositoryContentDirectoryMetadata(contentRoot, physicalPath, children);
};

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((temporaryRoot) => rm(temporaryRoot, { recursive: true, force: true })));
});

describe("repository content metadata version contract", () => {
  it("treats an omitted version as pinned v6 semantics and equivalent to explicit v6", async () => {
    const unversionedRoot = await createContentRoot();
    const explicitV6Root = await createContentRoot();
    const entries = {
      "Article.md": {
        id: "vfs-content-article",
        created: "2026-09-13T10:00:00.000Z",
        modified: "2026-09-13T11:00:00.000Z",
        publication: {
          status: "draft",
          slug: "article",
          aliases: ["old-article"],
        },
      },
    };

    await writeFixture(unversionedRoot, "Documents/Article.md", "# Article");
    await writeFixture(explicitV6Root, "Documents/Article.md", "# Article");
    await writeMetadata(unversionedRoot, "Documents", { entries });
    await writeMetadata(explicitV6Root, "Documents", { version: 6, entries });

    await expect(readMetadata(unversionedRoot)).resolves.toMatchObject({
      version: 6,
      rawVersion: undefined,
      isUnversioned: true,
      exists: true,
    });
    await expect(readMetadata(explicitV6Root)).resolves.toMatchObject({
      version: 6,
      rawVersion: 6,
      isUnversioned: false,
      exists: true,
    });
    expect(generator.getEffectiveRepositoryContentMetadataVersion()).toBe(6);
    expect(generator.getEffectiveRepositoryContentMetadataVersion(6)).toBe(6);
    await expect(generator.buildVfsContentManifest({ contentRoot: unversionedRoot })).resolves.toEqual(
      await generator.buildVfsContentManifest({ contentRoot: explicitV6Root }),
    );
  });

  it("keeps explicit v1 through v6 as distinct historical effective versions", async () => {
    for (const version of [1, 2, 3, 4, 5, 6] as const) {
      const contentRoot = await createContentRoot();
      await writeFixture(contentRoot, "Documents/Article.md", "# Article");
      await writeMetadata(contentRoot, "Documents", { version, entries: {} });

      await expect(readMetadata(contentRoot)).resolves.toMatchObject({
        version,
        rawVersion: version,
        isUnversioned: false,
      });
    }
  });

  it.each([0, -1, 7, "6", null, 6.5])("rejects explicit invalid metadata version %p", async (version) => {
    const contentRoot = await createContentRoot();
    await writeFixture(contentRoot, "Documents/Article.md", "# Article");
    await writeMetadata(contentRoot, "Documents", { version, entries: {} });

    await expect(generator.buildVfsContentManifest({ contentRoot })).rejects.toThrow("requires version 1, 2, 3, 4, 5, or 6");
  });

  it("validates unversioned metadata with v6 fields rather than guessing an older shape", async () => {
    const contentRoot = await createContentRoot();
    await writeFixture(contentRoot, "Documents/Article.md", "# Article");
    await writeMetadata(contentRoot, "Documents", {
      entries: {
        "Article.md": { publication: { status: "draft", slug: "article", aliases: ["old-article"] } },
      },
    });

    await expect(generator.buildVfsContentManifest({ contentRoot })).resolves.toMatchObject({
      entries: expect.arrayContaining([
        expect.objectContaining({
          virtualPath: "/home/user/Documents/Article.md",
          publication: { status: "draft", slug: "article", aliases: ["old-article"] },
        }),
      ]),
    });
  });

  it("omits the version field for stable output while retaining explicit legacy versions", () => {
    const entries = new Map([["Article.md", { created: "2026-09-13T10:00:00.000Z" }]]);

    expect(JSON.parse(generator.renderRepositoryContentDirectoryMetadata({ entries }))).toEqual({
      entries: { "Article.md": { created: "2026-09-13T10:00:00.000Z" } },
    });
    expect(JSON.parse(generator.renderRepositoryContentDirectoryMetadata({ version: 6, entries }))).toEqual({
      entries: { "Article.md": { created: "2026-09-13T10:00:00.000Z" } },
    });
    expect(JSON.parse(generator.renderRepositoryContentDirectoryMetadata({ version: 5, entries }))).toEqual({
      version: 5,
      entries: { "Article.md": { created: "2026-09-13T10:00:00.000Z" } },
    });
  });
});
