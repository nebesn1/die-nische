import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInitialVfsState } from "./initialState";
import { resolveVfsPath } from "./queries";
import { mergeRepositoryContentManifest } from "./repositoryContentSeed";
import type { GeneratedVfsContentManifest } from "./repositoryContentManifest";
import { getKonquerorAdjacentImageNodeId, getKonquerorImageSiblingNodeIds } from "../apps/konqueror/imagePreviewModel";

type VfsContentGenerator = {
  readonly buildVfsContentManifest: (options?: { readonly contentRoot?: string }) => Promise<GeneratedVfsContentManifest>;
  readonly getRepositoryContentNodeId: (virtualPath: string) => string;
  readonly getRepositoryContentTextMimeType: (name: string) => string | null;
  readonly getRepositoryContentAssetMimeType: (name: string) => string | null;
  readonly renderVfsContentManifestModule: (manifest: unknown) => string;
  readonly generateVfsContentManifest: (options?: { readonly contentRoot?: string; readonly outputPath?: string }) => Promise<unknown>;
};

const generator = (await import(new URL("../../scripts/generate-vfs-content-manifest.mjs", import.meta.url).href)) as VfsContentGenerator;
const temporaryRoots: string[] = [];

const createContentRoot = async (): Promise<string> => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "kde3-vfs-content-"));
  const contentRoot = join(temporaryRoot, "content", "home", "user");
  temporaryRoots.push(temporaryRoot);
  await mkdir(contentRoot, { recursive: true });
  return contentRoot;
};

const writeFixture = async (contentRoot: string, relativePath: string, content: string | Uint8Array): Promise<void> => {
  const target = join(contentRoot, relativePath);
  await mkdir(join(target, ".."), { recursive: true });
  await writeFile(target, content);
};

const writeMetadata = async (contentRoot: string, directory: string, metadata: unknown): Promise<void> => {
  await writeFixture(contentRoot, `${directory}/.kde3-meta.json`, `${JSON.stringify(metadata, null, 2)}\n`);
};

const getEntry = async (contentRoot: string, virtualPath: string) => {
  const manifest = await generator.buildVfsContentManifest({ contentRoot });
  const entry = manifest.entries.find((candidate) => candidate.virtualPath === virtualPath);

  if (!entry) {
    throw new Error(`Expected generated entry '${virtualPath}'.`);
  }

  return entry;
};

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((temporaryRoot) => rm(temporaryRoot, { recursive: true, force: true })));
});

describe("repository content manifest generator", () => {
  it("maps the physical tree to ordered POSIX virtual paths, including empty directories", async () => {
    const contentRoot = await createContentRoot();
    await writeFixture(contentRoot, "Documents/A.txt", "A");
    await writeFixture(contentRoot, "Documents/Nested/B.md", "# B");
    await writeFixture(contentRoot, "Documents/Empty/.gitkeep", "");
    await writeFixture(contentRoot, "Pictures/C.html", "<p>C</p>");
    await writeFixture(contentRoot, ".gitkeep", "");

    const manifest = await generator.buildVfsContentManifest({ contentRoot });

    expect(manifest.entries.map((entry) => entry.virtualPath)).toEqual([
      "/home/user",
      "/home/user/Documents",
      "/home/user/Documents/A.txt",
      "/home/user/Documents/Empty",
      "/home/user/Documents/Nested",
      "/home/user/Documents/Nested/B.md",
      "/home/user/Pictures",
      "/home/user/Pictures/C.html",
    ]);
    expect(manifest.entries.every((entry) => !entry.virtualPath.includes("\\") && !entry.virtualPath.includes("content"))).toBe(true);
  });

  it("reads supported UTF-8 text with deterministic MIME, byte-size, metadata, and uppercase extension handling", async () => {
    const contentRoot = await createContentRoot();
    await writeFixture(contentRoot, "Documents/Plain.TXT", "A你好");
    await writeFixture(contentRoot, "Documents/Article.MD", "# Article");
    await writeFixture(contentRoot, "Documents/Page.HTM", "<h1>Page</h1>");
    await writeFixture(contentRoot, "Documents/.profile.txt", "visible hidden file");

    await expect(getEntry(contentRoot, "/home/user/Documents/Plain.TXT")).resolves.toMatchObject({
      kind: "file",
      mimeType: "text/plain",
      size: 7,
      modified: "2026-08-30T12:00:00.000Z",
      source: { kind: "text", text: "A你好" },
    });
    await expect(getEntry(contentRoot, "/home/user/Documents/Article.MD")).resolves.toMatchObject({ mimeType: "text/markdown" });
    await expect(getEntry(contentRoot, "/home/user/Documents/Page.HTM")).resolves.toMatchObject({ mimeType: "text/html" });
    await expect(getEntry(contentRoot, "/home/user/Documents/.profile.txt")).resolves.toMatchObject({ kind: "file" });
    expect(generator.getRepositoryContentTextMimeType("unknown.bin")).toBeNull();
  });

  it("emits supported image files as deterministic Vite asset URLs with original binary sizes", async () => {
    const contentRoot = await createContentRoot();
    const fixtures = [
      ["A.PNG", "image/png"],
      ["B.jpg", "image/jpeg"],
      ["C.JPEG", "image/jpeg"],
      ["D.gif", "image/gif"],
      ["E.WEBP", "image/webp"],
      ["F.bmp", "image/bmp"],
    ] as const;

    await Promise.all(fixtures.map(async ([name], index) =>
      writeFixture(contentRoot, `Pictures/${name}`, new Uint8Array([index, 1, 2, 3, 4])),
    ));

    const manifest = await generator.buildVfsContentManifest({ contentRoot });

    fixtures.forEach(([name, mimeType], index) => {
      const entry = manifest.entries.find((candidate) => candidate.virtualPath === `/home/user/Pictures/${name}`);
      expect(entry).toMatchObject({
        kind: "file",
        mimeType,
        size: 5,
        source: { kind: "asset-url", url: `content/home/user/Pictures/${name}` },
      });
      if (!entry || entry.kind !== "file" || entry.source.kind !== "asset-url") throw new Error("Expected generated image asset entry");
      expect(entry.source.url).not.toContain("data:");
      expect(index).toBeGreaterThanOrEqual(0);
    });
    expect(generator.getRepositoryContentAssetMimeType("photo.JpEg")).toBe("image/jpeg");
    expect(generator.getRepositoryContentAssetMimeType("unknown.bin")).toBeNull();

    const output = generator.renderVfsContentManifestModule(manifest);
    expect(output).toContain('from "../../content/home/user/Pictures/A.PNG?url&no-inline"');
    expect(output).toContain('"kind": "asset-url"');
    expect(output).toContain('"url": asset_');
    expect(output).not.toContain("data:");
  });

  it("emits supported audio files as deterministic no-inline assets with original binary sizes", async () => {
    const contentRoot = await createContentRoot();
    const fixtures = [
      ["Song.MP3", "audio/mpeg"],
      ["Voice.OGG", "audio/ogg"],
      ["Sample.OgA", "audio/ogg"],
      ["Alert.WAV", "audio/wav"],
    ] as const;

    await Promise.all(fixtures.map(async ([name], index) =>
      writeFixture(contentRoot, `Music/${name}`, new Uint8Array([index, 1, 2, 3, 4, 5, 6])),
    ));

    const manifest = await generator.buildVfsContentManifest({ contentRoot });
    fixtures.forEach(([name, mimeType]) => {
      expect(manifest.entries.find((entry) => entry.virtualPath === `/home/user/Music/${name}`)).toMatchObject({
        kind: "file",
        mimeType,
        size: 7,
        source: { kind: "asset-url", url: `content/home/user/Music/${name}` },
      });
    });

    expect(generator.getRepositoryContentAssetMimeType("track.Mp3")).toBe("audio/mpeg");
    expect(generator.getRepositoryContentAssetMimeType("track.oGa")).toBe("audio/ogg");
    expect(generator.getRepositoryContentAssetMimeType("track.WAV")).toBe("audio/wav");
    const output = generator.renderVfsContentManifestModule(manifest);
    expect(output).toContain('from "../../content/home/user/Music/Song.MP3?url&no-inline"');
    expect(output).toContain('from "../../content/home/user/Music/Voice.OGG?url&no-inline"');
    expect(output).not.toContain("data:");
  });

  it("emits supported video files as deterministic no-inline assets with original binary sizes", async () => {
    const contentRoot = await createContentRoot();
    const fixtures = [
      ["Clip.MP4", "video/mp4"],
      ["Demo.WEBM", "video/webm"],
      ["Capture.OGV", "video/ogg"],
    ] as const;

    await Promise.all(fixtures.map(async ([name], index) =>
      writeFixture(contentRoot, `Documents/${name}`, new Uint8Array([index, 1, 2, 3, 4, 5, 6, 7, 8])),
    ));

    const manifest = await generator.buildVfsContentManifest({ contentRoot });
    fixtures.forEach(([name, mimeType]) => {
      expect(manifest.entries.find((entry) => entry.virtualPath === `/home/user/Documents/${name}`)).toMatchObject({
        kind: "file",
        mimeType,
        size: 9,
        source: { kind: "asset-url", url: `content/home/user/Documents/${name}` },
      });
    });

    expect(generator.getRepositoryContentAssetMimeType("movie.mp4")).toBe("video/mp4");
    expect(generator.getRepositoryContentAssetMimeType("movie.Mp4")).toBe("video/mp4");
    expect(generator.getRepositoryContentAssetMimeType("movie.webM")).toBe("video/webm");
    expect(generator.getRepositoryContentAssetMimeType("movie.OGV")).toBe("video/ogg");

    const output = generator.renderVfsContentManifestModule(manifest);
    expect(output).toContain('from "../../content/home/user/Documents/Clip.MP4?url&no-inline"');
    expect(output).toContain('from "../../content/home/user/Documents/Demo.WEBM?url&no-inline"');
    expect(output).toContain('from "../../content/home/user/Documents/Capture.OGV?url&no-inline"');
    expect(output).not.toContain("data:");
  });

  it("ignores only repository housekeeping files, preserves deterministic IDs, and is byte-for-byte repeatable", async () => {
    const contentRoot = await createContentRoot();
    await writeFixture(contentRoot, "Documents/A.txt", "A");
    await writeFixture(contentRoot, "Documents/.gitkeep", "");
    await writeFixture(contentRoot, "Documents/.DS_Store", "");
    await writeFixture(contentRoot, "Documents/Thumbs.db", "");
    await writeFixture(contentRoot, "Documents/.kde3-cache.json", "{}");

    const first = await generator.buildVfsContentManifest({ contentRoot });
    const firstOutput = generator.renderVfsContentManifestModule(first);
    const existingId = first.entries.find((entry) => entry.virtualPath === "/home/user/Documents/A.txt")?.id;

    await writeFixture(contentRoot, "Music/Z.txt", "Z");
    const second = await generator.buildVfsContentManifest({ contentRoot });
    const secondOutput = generator.renderVfsContentManifestModule(second);
    const repeated = await generator.buildVfsContentManifest({ contentRoot });

    expect(first.entries.map((entry) => entry.name)).not.toContain(".gitkeep");
    expect(first.entries.map((entry) => entry.name)).not.toContain(".DS_Store");
    expect(first.entries.map((entry) => entry.name)).not.toContain("Thumbs.db");
    expect(first.entries.map((entry) => entry.name)).not.toContain(".kde3-cache.json");
    expect(second.entries.find((entry) => entry.virtualPath === "/home/user/Documents/A.txt")?.id).toBe(existingId);
    expect(generator.renderVfsContentManifestModule(repeated)).toBe(secondOutput);
    expect(firstOutput).not.toContain(contentRoot);
  });

  it("fails clearly for unsupported files and symbolic links without following them", async () => {
    const contentRoot = await createContentRoot();
    await writeFixture(contentRoot, "Pictures/Unsupported.bin", new Uint8Array([137, 80, 78, 71]));

    await expect(generator.buildVfsContentManifest({ contentRoot })).rejects.toThrow("Unsupported repository content file type");

    const symlinkRoot = await createContentRoot();
    await writeFixture(symlinkRoot, "Documents/Target.txt", "target");
    await symlink(join(symlinkRoot, "Documents", "Target.txt"), join(symlinkRoot, "Documents", "Alias.txt"));

    await expect(generator.buildVfsContentManifest({ contentRoot: symlinkRoot })).rejects.toThrow("Symbolic links are not supported");
  });

  it("keeps the last valid generated module intact when a later content scan fails", async () => {
    const contentRoot = await createContentRoot();
    const outputPath = join(contentRoot, "..", "generated.ts");
    await writeFixture(contentRoot, "Documents/Valid.txt", "valid");
    await generator.generateVfsContentManifest({ contentRoot, outputPath });
    const lastValidOutput = await readFile(outputPath, "utf8");
    await writeFixture(contentRoot, "Documents/Unsupported.pdf", new Uint8Array([1, 2, 3]));

    await expect(generator.generateVfsContentManifest({ contentRoot, outputPath })).rejects.toThrow("Unsupported repository content file type");
    await expect(readFile(outputPath, "utf8")).resolves.toBe(lastValidOutput);

    await rm(join(contentRoot, "Documents", "Unsupported.pdf"));
    await expect(generator.generateVfsContentManifest({ contentRoot, outputPath })).resolves.toBeDefined();
  });

  it("keeps the last valid generated module intact when metadata becomes malformed and recovers after repair", async () => {
    const contentRoot = await createContentRoot();
    const outputPath = join(contentRoot, "..", "generated.ts");
    await writeFixture(contentRoot, "Documents/Valid.md", "# Valid");
    await generator.generateVfsContentManifest({ contentRoot, outputPath });
    const lastValidOutput = await readFile(outputPath, "utf8");
    await writeFixture(contentRoot, "Documents/.kde3-meta.json", "{");

    await expect(generator.generateVfsContentManifest({ contentRoot, outputPath })).rejects.toThrow("content/home/user/Documents/.kde3-meta.json");
    await expect(readFile(outputPath, "utf8")).resolves.toBe(lastValidOutput);

    await writeMetadata(contentRoot, "Documents", { version: 1, entries: { "Valid.md": { id: "vfs-content-valid" } } });
    await expect(generator.generateVfsContentManifest({ contentRoot, outputPath })).resolves.toMatchObject({
      manifest: { entries: expect.arrayContaining([expect.objectContaining({ id: "vfs-content-valid" })]) },
    });
  });

  it("applies validated directory-local metadata without making the sidecar a VFS entry", async () => {
    const contentRoot = await createContentRoot();
    await writeFixture(contentRoot, "Documents/Article.md", "# Article");
    await writeFixture(contentRoot, "Documents/Default.md", "# Default");
    await writeMetadata(contentRoot, "Documents", {
      version: 1,
      entries: {
        "Article.md": {
          id: "vfs-content-article",
          modified: "2026-09-13T12:00:00.000Z",
          order: 10,
        },
      },
    });

    const manifest = await generator.buildVfsContentManifest({ contentRoot });
    const article = manifest.entries.find((entry) => entry.virtualPath === "/home/user/Documents/Article.md");
    const defaultEntry = manifest.entries.find((entry) => entry.virtualPath === "/home/user/Documents/Default.md");

    expect(article).toMatchObject({
      id: "vfs-content-article",
      modified: "2026-09-13T12:00:00.000Z",
      order: 10,
      mimeType: "text/markdown",
      source: { kind: "text", text: "# Article" },
    });
    expect(defaultEntry).toMatchObject({
      id: generator.getRepositoryContentNodeId("/home/user/Documents/Default.md"),
      modified: "2026-08-30T12:00:00.000Z",
    });
    expect(manifest.entries.map((entry) => entry.virtualPath)).not.toContain("/home/user/Documents/.kde3-meta.json");
    expect(resolveVfsPath(mergeRepositoryContentManifest(createInitialVfsState(), manifest), "/home/user/Documents/Article.md")).toMatchObject({
      ok: true,
      value: {
        id: "vfs-content-article",
        createdAt: "2026-08-30T12:00:00.000Z",
        modifiedAt: "2026-09-13T12:00:00.000Z",
      },
    });
    expect(generator.renderVfsContentManifestModule(await generator.buildVfsContentManifest({ contentRoot }))).toBe(
      generator.renderVfsContentManifestModule(manifest),
    );
  });

  it("keeps v1 exact while v2 maps independently validated created and modified timestamps into VFS nodes", async () => {
    const contentRoot = await createContentRoot();
    await writeFixture(contentRoot, "Documents/Article.md", "# Article");
    await writeMetadata(contentRoot, "Documents", {
      version: 2,
      entries: {
        "Article.md": {
          id: "vfs-content-article",
          created: "2026-09-13T11:00:00.000Z",
          modified: "2026-09-13T10:00:00.000Z",
        },
      },
    });

    const manifest = await generator.buildVfsContentManifest({ contentRoot });
    expect(manifest.entries.find((entry) => entry.virtualPath === "/home/user/Documents/Article.md")).toMatchObject({
      created: "2026-09-13T11:00:00.000Z",
      modified: "2026-09-13T10:00:00.000Z",
    });
    expect(resolveVfsPath(mergeRepositoryContentManifest(createInitialVfsState(), manifest), "/home/user/Documents/Article.md")).toMatchObject({
      ok: true,
      value: { createdAt: "2026-09-13T11:00:00.000Z", modifiedAt: "2026-09-13T10:00:00.000Z" },
    });

    await writeMetadata(contentRoot, "Documents", { version: 1, entries: { "Article.md": { created: "2026-09-13T11:00:00.000Z" } } });
    await expect(generator.buildVfsContentManifest({ contentRoot })).rejects.toThrow("unknown field 'created'");
  });

  it("retains canonical timestamps for v2 metadata that has no timestamp fields", async () => {
    const contentRoot = await createContentRoot();
    await writeFixture(contentRoot, "Documents/Article.md", "# Article");
    await writeMetadata(contentRoot, "Documents", { version: 2, entries: { "Article.md": { id: "vfs-content-article" } } });

    await expect(getEntry(contentRoot, "/home/user/Documents/Article.md")).resolves.toMatchObject({
      created: "2026-08-30T12:00:00.000Z",
      modified: "2026-08-30T12:00:00.000Z",
    });
  });

  it("keeps an explicit ID across repository rename and move while unannotated renames retain path-derived IDs", async () => {
    const renamedRoot = await createContentRoot();
    await writeFixture(renamedRoot, "Documents/Article.md", "# Article");
    await writeMetadata(renamedRoot, "Documents", { version: 1, entries: { "Article.md": { id: "vfs-content-article" } } });
    const beforeRename = await getEntry(renamedRoot, "/home/user/Documents/Article.md");
    await rm(join(renamedRoot, "Documents", "Article.md"));
    await writeFixture(renamedRoot, "Documents/Post.md", "# Article");
    await writeMetadata(renamedRoot, "Documents", { version: 1, entries: { "Post.md": { id: "vfs-content-article" } } });
    const afterRename = await getEntry(renamedRoot, "/home/user/Documents/Post.md");

    const movedRoot = await createContentRoot();
    await writeFixture(movedRoot, "Documents/Article.md", "# Article");
    await writeMetadata(movedRoot, "Documents", { version: 1, entries: { "Article.md": { id: "vfs-content-article" } } });
    await rm(join(movedRoot, "Documents", "Article.md"));
    await writeFixture(movedRoot, "Documents/Projects/Article.md", "# Article");
    await writeMetadata(movedRoot, "Documents", { version: 1, entries: {} });
    await writeMetadata(movedRoot, "Documents/Projects", { version: 1, entries: { "Article.md": { id: "vfs-content-article" } } });
    const afterMove = await getEntry(movedRoot, "/home/user/Documents/Projects/Article.md");

    const defaultRoot = await createContentRoot();
    await writeFixture(defaultRoot, "Documents/Article.md", "# Article");
    const defaultBeforeRename = await getEntry(defaultRoot, "/home/user/Documents/Article.md");
    await rm(join(defaultRoot, "Documents", "Article.md"));
    await writeFixture(defaultRoot, "Documents/Post.md", "# Article");
    const defaultAfterRename = await getEntry(defaultRoot, "/home/user/Documents/Post.md");

    expect(beforeRename.id).toBe("vfs-content-article");
    expect(afterRename.id).toBe(beforeRename.id);
    expect(afterMove.id).toBe(beforeRename.id);
    expect(defaultAfterRename.id).not.toBe(defaultBeforeRename.id);
  });

  it("orders repository siblings by metadata order then code-point name without relying on filesystem order", async () => {
    const contentRoot = await createContentRoot();
    await Promise.all([
      writeFixture(contentRoot, "Documents/A.md", "A"),
      writeFixture(contentRoot, "Documents/B.md", "B"),
      writeFixture(contentRoot, "Documents/C.md", "C"),
      writeFixture(contentRoot, "Documents/D.md", "D"),
      writeFixture(contentRoot, "Documents/Folder/.gitkeep", ""),
    ]);
    await writeMetadata(contentRoot, "Documents", {
      version: 1,
      entries: {
        "A.md": { order: 20 },
        "C.md": { order: 10 },
        "D.md": { order: 10 },
        Folder: { id: "vfs-content-folder", order: 5 },
      },
    });

    const manifest = await generator.buildVfsContentManifest({ contentRoot });

    expect(manifest.entries.filter((entry) => entry.parentVirtualPath === "/home/user/Documents").map((entry) => entry.name)).toEqual([
      "Folder",
      "C.md",
      "D.md",
      "A.md",
      "B.md",
    ]);
    expect(manifest.entries.find((entry) => entry.virtualPath === "/home/user/Documents/Folder")).toMatchObject({
      kind: "directory",
      id: "vfs-content-folder",
      order: 5,
    });
  });

  it("feeds metadata image ordering into raw sibling previous and next navigation", async () => {
    const contentRoot = await createContentRoot();
    await Promise.all([
      writeFixture(contentRoot, "Pictures/A.png", new Uint8Array([1])),
      writeFixture(contentRoot, "Pictures/B.png", new Uint8Array([2])),
      writeFixture(contentRoot, "Pictures/C.png", new Uint8Array([3])),
      writeFixture(contentRoot, "Pictures/note.txt", "not an image"),
    ]);
    await writeMetadata(contentRoot, "Pictures", {
      version: 1,
      entries: {
        "A.png": { order: 20 },
        "B.png": { order: 10 },
      },
    });

    const initial = createInitialVfsState();
    const pictures = initial.nodesById[initial.specialLocations.pictures];

    if (!pictures || pictures.kind !== "directory") throw new Error("Pictures mount missing");

    const state = mergeRepositoryContentManifest(
      { ...initial, nodesById: { ...initial.nodesById, [pictures.id]: { ...pictures, childIds: [] } } },
      await generator.buildVfsContentManifest({ contentRoot }),
    );
    const a = resolveVfsPath(state, "/home/user/Pictures/A.png");
    const b = resolveVfsPath(state, "/home/user/Pictures/B.png");
    const c = resolveVfsPath(state, "/home/user/Pictures/C.png");

    if (!a.ok || !b.ok || !c.ok || a.value.kind !== "file" || b.value.kind !== "file" || c.value.kind !== "file") {
      throw new Error("Expected isolated image fixture files.");
    }

    expect(getKonquerorImageSiblingNodeIds(state, b.value)).toEqual([b.value.id, a.value.id, c.value.id]);
    expect(getKonquerorAdjacentImageNodeId(state, b.value, "next")).toBe(a.value.id);
    expect(getKonquerorAdjacentImageNodeId(state, a.value, "next")).toBe(c.value.id);
  });

  it("fails clearly for invalid or stale metadata rather than treating it as ordinary ignored content", async () => {
    const invalidCases = [
      [{ version: 0, entries: {} }, "requires version 1, 2, 3, 4, 5, or 6"],
      [{ version: 1, entry: {} }, "unknown top-level field 'entry'"],
      [{ version: 1, entries: [] }, "requires an object 'entries' field"],
      [{ version: 1, entries: { "Article.md": { modifed: "2026-09-13T12:00:00.000Z" } } }, "unknown field 'modifed'"],
      [{ version: 1, entries: { "Article.md": { id: "vfs-node-article" } } }, "invalid id"],
      [{ version: 1, entries: { "Article.md": { id: "" } } }, "invalid id"],
      [{ version: 1, entries: { "Article.md": { id: "hello world" } } }, "invalid id"],
      [{ version: 1, entries: { "Article.md": { id: "../article" } } }, "invalid id"],
      [{ version: 1, entries: { "Article.md": { id: "vfs-documents" } } }, "invalid id"],
      [{ version: 1, entries: { "Article.md": { modified: "2026-09-13" } } }, "invalid modified timestamp"],
      [{ version: 2, entries: { "Article.md": { created: "2026-09-13" } } }, "invalid created timestamp"],
      [{ version: 2, entries: { "Article.md": { createdAt: "2026-09-13T12:00:00.000Z" } } }, "unknown field 'createdAt'"],
      [{ version: 1, entries: { "Article.md": { displayName: "Article" } } }, "unknown field 'displayName'"],
      [{ version: 2, entries: { "Article.md": { displayName: "Article" } } }, "unknown field 'displayName'"],
      [{ version: 3, entries: { "Article.md": { displayName: "" } } }, "invalid displayName"],
      [{ version: 3, entries: { "Article.md": { displayName: " Article" } } }, "invalid displayName"],
      [{ version: 3, entries: { "Article.md": { displayName: "Article\nTwo" } } }, "invalid displayName"],
      [{ version: 3, entries: { "Article.md": { displayName: "Article\u0000" } } }, "invalid displayName"],
      [{ version: 3, entries: { "Article.md": { displayName: 1 } } }, "invalid displayName"],
      [{ version: 1, entries: { "Article.md": { order: 1.5 } } }, "invalid order"],
      [{ version: 1, entries: { "Missing.md": {} } }, "does not target a visible immediate child"],
      [{ version: 1, entries: { "Projects/Article.md": {} } }, "must name an immediate child"],
      [{ version: 1, entries: { "../Article.md": {} } }, "must name an immediate child"],
      [{ version: 1, entries: { ".gitkeep": {} } }, "does not target a visible immediate child"],
    ] as const;

    for (const [metadata, expectedMessage] of invalidCases) {
      const contentRoot = await createContentRoot();
      await writeFixture(contentRoot, "Documents/Article.md", "# Article");
      await writeMetadata(contentRoot, "Documents", metadata);
      await expect(generator.buildVfsContentManifest({ contentRoot })).rejects.toThrow(expectedMessage);
    }

    const malformedRoot = await createContentRoot();
    await writeFixture(malformedRoot, "Documents/Article.md", "# Article");
    await writeFixture(malformedRoot, "Documents/.kde3-meta.json", "{");
    await expect(generator.buildVfsContentManifest({ contentRoot: malformedRoot })).rejects.toThrow("content/home/user/Documents/.kde3-meta.json");
  });

  it("flows v3 displayName through the deterministic manifest without changing canonical identity or paths", async () => {
    const contentRoot = await createContentRoot();
    await writeFixture(contentRoot, "Documents/article.md", "# Article");
    await writeMetadata(contentRoot, "Documents", { version: 3, entries: { "article.md": { displayName: "Open Robot Studio — 机器人项目" } } });

    const first = await generator.buildVfsContentManifest({ contentRoot });
    const second = await generator.buildVfsContentManifest({ contentRoot });
    const entry = first.entries.find((candidate) => candidate.virtualPath === "/home/user/Documents/article.md");
    expect(entry).toMatchObject({
      id: generator.getRepositoryContentNodeId("/home/user/Documents/article.md"),
      name: "article.md",
      displayName: "Open Robot Studio — 机器人项目",
      created: "2026-08-30T12:00:00.000Z",
      modified: "2026-08-30T12:00:00.000Z",
    });
    expect(generator.renderVfsContentManifestModule(first)).toBe(generator.renderVfsContentManifestModule(second));

    await writeMetadata(contentRoot, "Documents", { version: 3, entries: { "article.md": { displayName: "Updated Article" } } });
    expect((await getEntry(contentRoot, "/home/user/Documents/article.md")).id).toBe(entry?.id);
  });

  it("validates and flows v4 publication metadata only for repository text files", async () => {
    const contentRoot = await createContentRoot();
    await writeFixture(contentRoot, "Documents/article.md", "# Article");
    await writeFixture(contentRoot, "Pictures/photo.png", new Uint8Array([1, 2, 3]));
    await writeMetadata(contentRoot, "Documents", {
      version: 4,
      entries: {
        "article.md": {
          id: "vfs-content-article",
          displayName: "Open Robot Studio",
          created: "2026-09-01T10:00:00.000Z",
          modified: "2026-09-12T11:00:00.000Z",
          order: 10,
          publication: {
            status: "published",
            publishedAt: "2026-09-10T08:00:00.000Z",
            summary: "Robotics notes — 机器人项目。",
            tags: ["KDE 3", "Web", "React"],
          },
        },
      },
    });

    const manifest = await generator.buildVfsContentManifest({ contentRoot });
    const article = manifest.entries.find((entry) => entry.virtualPath === "/home/user/Documents/article.md");
    expect(article).toMatchObject({
      id: "vfs-content-article",
      displayName: "Open Robot Studio",
      created: "2026-09-01T10:00:00.000Z",
      modified: "2026-09-12T11:00:00.000Z",
      publication: {
        status: "published",
        publishedAt: "2026-09-10T08:00:00.000Z",
        summary: "Robotics notes — 机器人项目。",
        tags: ["KDE 3", "Web", "React"],
      },
    });
    expect(generator.renderVfsContentManifestModule(manifest)).toContain('"publication"');

    await writeMetadata(contentRoot, "Documents", { version: 4, entries: { "article.md": { publication: { status: "draft" } } } });
    expect((await getEntry(contentRoot, "/home/user/Documents/article.md"))).toMatchObject({ publication: { status: "draft" } });

    await writeMetadata(contentRoot, "Documents", { version: 4, entries: { "article.md": {} } });
    expect((await getEntry(contentRoot, "/home/user/Documents/article.md") as { publication?: unknown }).publication).toBeUndefined();

    const invalidCases = [
      [{ version: 1, entries: { "article.md": { publication: { status: "draft" } } } }, "unknown field 'publication'"],
      [{ version: 2, entries: { "article.md": { publication: { status: "draft" } } } }, "unknown field 'publication'"],
      [{ version: 3, entries: { "article.md": { publication: { status: "draft" } } } }, "unknown field 'publication'"],
      [{ version: 4, entries: { "article.md": { publication: { status: "published", publishedAt: "2026-09-10T08:00:00.000Z", author: "A" } } } }, "publication has unknown field 'author'"],
      [{ version: 4, entries: { "article.md": { publication: { summary: "Missing status" } } } }, "requires status"],
      [{ version: 4, entries: { "article.md": { publication: { status: "Published" } } } }, "requires status"],
      [{ version: 4, entries: { "article.md": { publication: { status: "published" } } } }, "requires a valid publishedAt"],
      [{ version: 4, entries: { "article.md": { publication: { status: "draft", publishedAt: "2026-09-10T08:00:00.000Z" } } } }, "draft publication must not set publishedAt"],
      [{ version: 4, entries: { "article.md": { publication: { status: "published", publishedAt: "2026-09-10" } } } }, "requires a valid publishedAt"],
      [{ version: 4, entries: { "article.md": { publication: { status: "draft", summary: " padded " } } } }, "invalid summary"],
      [{ version: 4, entries: { "article.md": { publication: { status: "draft", summary: "One\nTwo" } } } }, "invalid summary"],
      [{ version: 4, entries: { "article.md": { publication: { status: "draft", tags: [] } } } }, "invalid tags"],
      [{ version: 4, entries: { "article.md": { publication: { status: "draft", tags: ["Qt", "Qt"] } } } }, "duplicate tags"],
      [{ version: 4, entries: { "article.md": { publication: { status: "draft", tags: ["Qt", " qt"] } } } }, "invalid tags"],
      [{ version: 4, entries: { "article.md": { publication: { status: "draft", tags: ["Qt\u0000"] } } } }, "invalid tags"],
    ] as const;

    for (const [metadata, expectedMessage] of invalidCases) {
      await writeMetadata(contentRoot, "Documents", metadata);
      await expect(generator.buildVfsContentManifest({ contentRoot })).rejects.toThrow(expectedMessage);
    }

    await writeMetadata(contentRoot, "Documents", { version: 4, entries: { "article.md": { publication: { status: "draft" } } } });
    await writeMetadata(contentRoot, "Pictures", { version: 4, entries: { "photo.png": { publication: { status: "draft" } } } });
    await expect(generator.buildVfsContentManifest({ contentRoot })).rejects.toThrow("may only set publication on a supported text file");

    await writeMetadata(contentRoot, "Pictures", { version: 4, entries: {} });
    await writeFixture(contentRoot, "Music/song.mp3", new Uint8Array([4, 5, 6]));
    await writeMetadata(contentRoot, "Music", { version: 4, entries: { "song.mp3": { publication: { status: "draft" } } } });
    await expect(generator.buildVfsContentManifest({ contentRoot })).rejects.toThrow("may only set publication on a supported text file");

    await writeMetadata(contentRoot, "Music", { version: 4, entries: {} });
    await writeFixture(contentRoot, "Documents/movie.mp4", new Uint8Array([7, 8, 9]));
    await writeMetadata(contentRoot, "Documents", { version: 4, entries: { "movie.mp4": { publication: { status: "draft" } } } });
    await expect(generator.buildVfsContentManifest({ contentRoot })).rejects.toThrow("may only set publication on a supported text file");

    await writeMetadata(contentRoot, "Pictures", { version: 4, entries: {} });
    await writeMetadata(contentRoot, ".", { version: 4, entries: { Documents: { publication: { status: "draft" } } } });
    await expect(generator.buildVfsContentManifest({ contentRoot })).rejects.toThrow("may only set created or modified for platform-owned mount");
  });

  it("accepts strict v5 authored publication slugs, preserves their field order, and rejects global collisions", async () => {
    const contentRoot = await createContentRoot();
    await writeFixture(contentRoot, "Documents/article.md", "# Article");
    await writeFixture(contentRoot, "Documents/Nested/second.md", "# Second");
    await writeMetadata(contentRoot, "Documents", {
      version: 5,
      entries: {
        "article.md": { publication: { status: "published", slug: "article-routing", publishedAt: "2026-09-10T08:00:00.000Z", summary: "Summary", tags: ["KDE"] } },
      },
    });
    await writeMetadata(contentRoot, "Documents/Nested", {
      version: 5,
      entries: { "second.md": { publication: { status: "draft", slug: "reserved-draft" } } },
    });

    const manifest = await generator.buildVfsContentManifest({ contentRoot });
    expect(manifest.entries.find((entry) => entry.virtualPath === "/home/user/Documents/article.md")).toMatchObject({
      publication: { status: "published", slug: "article-routing", publishedAt: "2026-09-10T08:00:00.000Z", summary: "Summary", tags: ["KDE"] },
    });
    expect(generator.renderVfsContentManifestModule(manifest)).toMatch(/"status": "published",\s+"slug": "article-routing",\s+"publishedAt"/);

    const invalidSlugs = ["", "Uppercase", "two--hyphens", "-leading", "trailing-", "has_space", "has space", "has/slash", "has%25"];
    for (const slug of invalidSlugs) {
      await writeMetadata(contentRoot, "Documents", { version: 5, entries: { "article.md": { publication: { status: "draft", slug } } } });
      await expect(generator.buildVfsContentManifest({ contentRoot })).rejects.toThrow("invalid slug");
    }

    await writeMetadata(contentRoot, "Documents", { version: 5, entries: { "article.md": { publication: { status: "published", publishedAt: "2026-09-10T08:00:00.000Z" } } } });
    await expect(generator.buildVfsContentManifest({ contentRoot })).rejects.toThrow("requires a slug");

    await writeMetadata(contentRoot, "Documents", { version: 5, entries: { "article.md": { publication: { status: "draft", slug: "shared-slug" } } } });
    await writeMetadata(contentRoot, "Documents/Nested", { version: 5, entries: { "second.md": { publication: { status: "draft", slug: "shared-slug" } } } });
    await expect(generator.buildVfsContentManifest({ contentRoot })).rejects.toThrow("slug 'shared-slug' conflicts with slug on '/home/user/Documents/Nested/second.md'");

    for (const version of [1, 2, 3]) {
      await writeMetadata(contentRoot, "Documents", { version, entries: { "article.md": { publication: { status: "draft", slug: "not-supported" } } } });
      await expect(generator.buildVfsContentManifest({ contentRoot })).rejects.toThrow("unknown field 'publication'");
    }
    await writeMetadata(contentRoot, "Documents", { version: 4, entries: { "article.md": { publication: { status: "draft", slug: "not-supported" } } } });
    await expect(generator.buildVfsContentManifest({ contentRoot })).rejects.toThrow("unknown field 'slug'");
  });

  it("accepts v6 explicit aliases while keeping earlier versions strict and reserving one global route-token namespace", async () => {
    const contentRoot = await createContentRoot();
    await writeFixture(contentRoot, "Documents/article.md", "# Article");
    await writeFixture(contentRoot, "Documents/Nested/second.md", "# Second");
    const publishedAt = "2026-09-10T08:00:00.000Z";
    await writeMetadata(contentRoot, "Documents", {
      version: 6,
      entries: {
        "article.md": {
          publication: {
            status: "published",
            slug: "current-name",
            aliases: ["old-name", "original-name"],
            publishedAt,
            summary: "Summary",
            tags: ["KDE"],
          },
        },
      },
    });
    await writeMetadata(contentRoot, "Documents/Nested", {
      version: 6,
      entries: { "second.md": { publication: { status: "draft", slug: "reserved-name", aliases: ["reserved-old"] } } },
    });

    const manifest = await generator.buildVfsContentManifest({ contentRoot });
    expect(manifest.entries.find((entry) => entry.virtualPath === "/home/user/Documents/article.md")).toMatchObject({
      publication: { status: "published", slug: "current-name", aliases: ["old-name", "original-name"], publishedAt, summary: "Summary", tags: ["KDE"] },
    });
    expect(generator.renderVfsContentManifestModule(manifest)).toMatch(/"status": "published",\s+"slug": "current-name",\s+"aliases": \[\s+"old-name",\s+"original-name"\s+\],\s+"publishedAt"/);

    for (const version of [1, 2, 3]) {
      await writeMetadata(contentRoot, "Documents", {
        version,
        entries: { "article.md": { publication: { status: "draft", slug: "current-name", aliases: ["old-name"] } } },
      });
      await expect(generator.buildVfsContentManifest({ contentRoot })).rejects.toThrow("unknown field 'publication'");
    }
    for (const version of [4, 5]) {
      await writeMetadata(contentRoot, "Documents", {
        version,
        entries: { "article.md": { publication: { status: "draft", aliases: ["old-name"] } } },
      });
      await expect(generator.buildVfsContentManifest({ contentRoot })).rejects.toThrow("unknown field 'aliases'");
    }

    await writeMetadata(contentRoot, "Documents", { version: 6, entries: { "article.md": { publication: { status: "draft", aliases: ["old-name"] } } } });
    await expect(generator.buildVfsContentManifest({ contentRoot })).rejects.toThrow("aliases require a slug");
    await writeMetadata(contentRoot, "Documents", { version: 6, entries: { "article.md": { publication: { status: "draft", slug: "same-name", aliases: ["same-name"] } } } });
    await expect(generator.buildVfsContentManifest({ contentRoot })).rejects.toThrow("alias must differ from slug");
    await writeMetadata(contentRoot, "Documents", { version: 6, entries: { "article.md": { publication: { status: "draft", slug: "current-name", aliases: [] } } } });
    await expect(generator.buildVfsContentManifest({ contentRoot })).rejects.toThrow("invalid aliases");

    for (const alias of ["", "Old-Name", "old_name", "old name", "-old", "old-", "old--name", "old/name", "old\\name", "old.name", "old%20name", "../old", "机器人"] as const) {
      await writeMetadata(contentRoot, "Documents", { version: 6, entries: { "article.md": { publication: { status: "draft", slug: "current-name", aliases: [alias] } } } });
      await expect(generator.buildVfsContentManifest({ contentRoot })).rejects.toThrow("invalid aliases");
    }

    await writeMetadata(contentRoot, "Documents", { version: 6, entries: { "article.md": { publication: { status: "draft", slug: "current-name", aliases: ["duplicate", "duplicate"] } } } });
    await expect(generator.buildVfsContentManifest({ contentRoot })).rejects.toThrow("duplicate aliases");
    await writeMetadata(contentRoot, "Documents", { version: 6, entries: { "article.md": { publication: { status: "draft", slug: "current-name", aliases: ["shared-token"] } } } });
    await writeMetadata(contentRoot, "Documents/Nested", { version: 5, entries: { "second.md": { publication: { status: "draft", slug: "shared-token" } } } });
    await expect(generator.buildVfsContentManifest({ contentRoot })).rejects.toThrow("alias 'shared-token' conflicts with slug on '/home/user/Documents/Nested/second.md'");

    await writeMetadata(contentRoot, "Documents", { version: 5, entries: { "article.md": { publication: { status: "draft", slug: "shared-token" } } } });
    await writeMetadata(contentRoot, "Documents/Nested", { version: 6, entries: { "second.md": { publication: { status: "draft", slug: "another-name", aliases: ["shared-token"] } } } });
    await expect(generator.buildVfsContentManifest({ contentRoot })).rejects.toThrow("slug 'shared-token' conflicts with alias on '/home/user/Documents/Nested/second.md'");
  });

  it("accepts publication for every supported repository text classification", async () => {
    const contentRoot = await createContentRoot();
    const files = ["plain.txt", "article.md", "long.markdown", "page.html", "legacy.htm"];
    await Promise.all(files.map((name) => writeFixture(contentRoot, `Documents/${name}`, "text")));
    await writeMetadata(contentRoot, "Documents", {
      version: 4,
      entries: Object.fromEntries(files.map((name) => [name, { publication: { status: "draft", tags: ["Qt", "qt", "C++", "机器人"] } }])),
    });

    const manifest = await generator.buildVfsContentManifest({ contentRoot });
    files.forEach((name) => {
      expect(manifest.entries.find((entry) => entry.virtualPath === `/home/user/Documents/${name}`)).toMatchObject({
        source: { kind: "text" },
        publication: { status: "draft", tags: ["Qt", "qt", "C++", "机器人"] },
      });
    });
  });

  it("rejects duplicate explicit IDs and metadata attempts to target platform mounts", async () => {
    const duplicateRoot = await createContentRoot();
    await writeFixture(duplicateRoot, "Documents/A.md", "A");
    await writeFixture(duplicateRoot, "Documents/B.md", "B");
    await writeMetadata(duplicateRoot, "Documents", {
      version: 1,
      entries: { "A.md": { id: "vfs-content-duplicate" }, "B.md": { id: "vfs-content-duplicate" } },
    });
    await expect(generator.buildVfsContentManifest({ contentRoot: duplicateRoot })).rejects.toThrow("already used by '/home/user/Documents/A.md'");

    const fallbackCollisionRoot = await createContentRoot();
    await writeFixture(fallbackCollisionRoot, "Documents/A.md", "A");
    await writeFixture(fallbackCollisionRoot, "Documents/B.md", "B");
    await writeMetadata(fallbackCollisionRoot, "Documents", {
      version: 1,
      entries: { "A.md": { id: generator.getRepositoryContentNodeId("/home/user/Documents/B.md") } },
    });
    await expect(generator.buildVfsContentManifest({ contentRoot: fallbackCollisionRoot })).rejects.toThrow("already used by '/home/user/Documents/A.md'");

    const platformRoot = await createContentRoot();
    await writeFixture(platformRoot, "Documents/Article.md", "# Article");
    await writeMetadata(platformRoot, ".", { version: 1, entries: { Documents: { id: "vfs-content-documents" } } });
    await expect(generator.buildVfsContentManifest({ contentRoot: platformRoot })).rejects.toThrow("may only set created or modified for platform-owned mount '/home/user/Documents'");
  });

  it("allows timestamp-only root metadata for platform mounts without changing their identity or ordering authority", async () => {
    const contentRoot = await createContentRoot();
    await writeFixture(contentRoot, "Documents/Article.md", "# Article");
    await writeMetadata(contentRoot, ".", { version: 2, entries: { Documents: { created: "2026-09-13T10:00:00.000Z", modified: "2026-09-13T11:00:00.000Z" } } });

    const manifest = await generator.buildVfsContentManifest({ contentRoot });
    expect(manifest.entries.map((entry) => entry.virtualPath)).not.toContain("/home/user/.kde3-meta.json");
    expect(manifest.entries.find((entry) => entry.virtualPath === "/home/user/Documents")).toMatchObject({
      id: generator.getRepositoryContentNodeId("/home/user/Documents"),
      created: "2026-09-13T10:00:00.000Z",
      modified: "2026-09-13T11:00:00.000Z",
    });
    const state = mergeRepositoryContentManifest(createInitialVfsState(), manifest);
    expect(resolveVfsPath(state, "/home/user/Documents")).toMatchObject({
      ok: true,
      value: { id: state.specialLocations.documents, createdAt: "2026-09-13T10:00:00.000Z", modifiedAt: "2026-09-13T11:00:00.000Z" },
    });

    await writeMetadata(contentRoot, ".", { version: 2, entries: { Documents: { order: 1 } } });
    await expect(generator.buildVfsContentManifest({ contentRoot })).rejects.toThrow("may only set created or modified");

    await writeMetadata(contentRoot, ".", { version: 3, entries: { Documents: { displayName: "My Documents" } } });
    await expect(generator.buildVfsContentManifest({ contentRoot })).rejects.toThrow("may only set created or modified");
  });

  it("includes canonical Welcome Markdown and Notes source files without fixing the global content count", async () => {
    const manifest = await generator.buildVfsContentManifest();
    const welcome = manifest.entries.find((entry) => entry.virtualPath === "/home/user/Documents/Welcome.md");
    const notes = manifest.entries.find((entry) => entry.virtualPath === "/home/user/Documents/Notes.txt");

    expect(welcome).toMatchObject({
      id: "vfs-content-76cff3ce17d8a853403179f1",
      mimeType: "text/markdown",
      size: 111,
      created: "2026-08-30T12:00:00.000Z",
      modified: "2026-09-26T14:19:27.801Z",
      source: { kind: "text", text: "# Welcome to die Nische\n\ndie Nische is a KDE 3-inspired web desktop.\n\nThis is a virtual in-memory file system.\n" },
    });
    expect(notes).toMatchObject({
      id: "vfs-content-e594a065214576326cb903a5",
      mimeType: "text/plain",
      size: 59,
      created: "2026-08-30T12:00:00.000Z",
      modified: "2026-08-30T12:00:00.000Z",
      source: { kind: "text", text: "Notes.txt lives only in browser memory for this prototype.\n" },
    });
    expect(manifest.entries.some((entry) => entry.virtualPath === "/home/user/Documents/Welcome.txt")).toBe(false);
  });

  it("includes repository-owned images as no-inline Vite assets without fixing a filename or image count", async () => {
    const manifest = await generator.buildVfsContentManifest();
    const image = manifest.entries
      .filter((entry): entry is Extract<GeneratedVfsContentManifest["entries"][number], { readonly kind: "file" }> => entry.kind === "file")
      .find((entry) => entry.source.kind === "asset-url" && entry.virtualPath.startsWith("/home/user/Pictures/"));
    const output = generator.renderVfsContentManifestModule(manifest);
    const imageSource = image?.source;
    if (!imageSource || imageSource.kind !== "asset-url") throw new Error("Repository image manifest entry missing");

    expect(image).toMatchObject({
      mimeType: "image/png",
      source: { kind: "asset-url" },
    });
    expect(output).toContain(`from "../../${imageSource.url}?url&no-inline"`);
    expect(output).not.toContain("data:image/png;base64");
  });
});
