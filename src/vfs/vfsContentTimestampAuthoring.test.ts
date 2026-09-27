import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, rename, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildVfsContentManifest } from "../../scripts/generate-vfs-content-manifest.mjs";
import {
  createVfsContentTimestampReconciler,
  getRepositoryContentCreatedTimestamp,
  getRepositoryContentModifiedTimestamp,
} from "../../scripts/vfsContentTimestampAuthoring.mjs";

const roots: string[] = [];
const clock = () => new Date("2026-09-13T09:00:00.000Z");

const createRoot = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "kde3-vfs-timestamps-"));
  const contentRoot = join(root, "content", "home", "user");
  roots.push(root);
  await mkdir(contentRoot, { recursive: true });
  return contentRoot;
};

const write = async (contentRoot: string, relativePath: string, content: string | Uint8Array): Promise<void> => {
  const path = join(contentRoot, relativePath);
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, content);
};

const metadata = async (contentRoot: string, directory = "Documents") =>
  JSON.parse(await readFile(join(contentRoot, directory, ".kde3-meta.json"), "utf8")) as {
    version?: number;
    entries: Record<string, { id?: string; created?: string; modified?: string; order?: number; displayName?: string; publication?: unknown }>;
  };

const sequenceClock = (...timestamps: string[]) => () => new Date(timestamps.shift() ?? "2026-09-13T09:00:00.000Z");

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("VFS content timestamp authoring", () => {
  it("captures creation and modification timestamps through birthtime, mtime, and clock fallbacks", () => {
    expect(getRepositoryContentCreatedTimestamp({ birthtimeMs: Date.parse("2026-09-13T01:00:00.000Z"), mtimeMs: Date.parse("2026-09-13T02:00:00.000Z") }, clock)).toBe("2026-09-13T01:00:00.000Z");
    expect(getRepositoryContentCreatedTimestamp({ birthtimeMs: 0, mtimeMs: Date.parse("2026-09-13T02:00:00.000Z") }, clock)).toBe("2026-09-13T02:00:00.000Z");
    expect(getRepositoryContentCreatedTimestamp({ birthtimeMs: 0, mtimeMs: 0 }, clock)).toBe("2026-09-13T09:00:00.000Z");
    expect(getRepositoryContentModifiedTimestamp({ mtimeMs: Date.parse("2026-09-13T03:00:00.000Z") }, clock)).toBe("2026-09-13T03:00:00.000Z");
    expect(getRepositoryContentModifiedTimestamp({ mtimeMs: 0 }, clock)).toBe("2026-09-13T09:00:00.000Z");
  });

  it("initializes an untracked supported file at startup without explicit identity or order metadata", async () => {
    const contentRoot = await createRoot();
    await write(contentRoot, "Documents/New.md", "# New");
    await createVfsContentTimestampReconciler({ contentRoot, clock, logger: { info: () => undefined } }).reconcile();

    const result = await metadata(contentRoot);
    expect(result.version).toBeUndefined();
    expect(result.entries["New.md"]).toMatchObject({ created: expect.any(String), modified: expect.any(String) });
    expect(result.entries["New.md"]?.id).toBeUndefined();
    expect(result.entries["New.md"]?.order).toBeUndefined();
  });

  it("writes current stable metadata without a version for unversioned and explicit v6 sidecars", async () => {
    for (const metadataSource of [
      { entries: { "Article.md": { created: "2026-09-13T01:00:00.000Z", modified: "2026-09-13T01:00:00.000Z" } } },
      { version: 6, entries: { "Article.md": { created: "2026-09-13T01:00:00.000Z", modified: "2026-09-13T01:00:00.000Z" } } },
    ]) {
      const contentRoot = await createRoot();
      const changed = "2026-09-13T02:00:00.000Z";
      await write(contentRoot, "Documents/Article.md", "one");
      await write(contentRoot, "Documents/.kde3-meta.json", `${JSON.stringify(metadataSource, null, 2)}\n`);
      const reconciler = createVfsContentTimestampReconciler({ contentRoot, clock, logger: { info: () => undefined } });
      await reconciler.reconcile();

      await write(contentRoot, "Documents/Article.md", "two");
      await utimes(join(contentRoot, "Documents", "Article.md"), new Date(changed), new Date(changed));
      await reconciler.reconcile();

      expect(await metadata(contentRoot)).toEqual({ entries: {
        "Article.md": { created: "2026-09-13T01:00:00.000Z", modified: changed },
      } });
    }
  });

  it("updates only modified for real text byte changes while preserving created, id, and order", async () => {
    const contentRoot = await createRoot();
    const initial = "2026-09-13T01:00:00.000Z";
    const changed = "2026-09-13T02:00:00.000Z";
    await write(contentRoot, "Documents/Article.md", "one");
    await write(contentRoot, "Documents/.kde3-meta.json", `${JSON.stringify({ version: 2, entries: { "Article.md": { id: "vfs-content-article", created: initial, modified: initial, order: 4 } } }, null, 2)}\n`);
    const reconciler = createVfsContentTimestampReconciler({ contentRoot, clock, logger: { info: () => undefined } });
    await reconciler.reconcile();
    await write(contentRoot, "Documents/Article.md", "two");
    await utimes(join(contentRoot, "Documents", "Article.md"), new Date(changed), new Date(changed));
    await reconciler.reconcile();

    expect((await metadata(contentRoot)).entries["Article.md"]).toEqual({ id: "vfs-content-article", created: initial, modified: changed, order: 4 });
    expect((await metadata(contentRoot, ".")).entries.Documents).toEqual({ modified: "2026-09-13T09:00:00.000Z" });
  });

  it("does not update metadata for a touch-only event with identical bytes", async () => {
    const contentRoot = await createRoot();
    const timestamp = "2026-09-13T01:00:00.000Z";
    await write(contentRoot, "Documents/Article.md", "same");
    await write(contentRoot, "Documents/.kde3-meta.json", `${JSON.stringify({ version: 2, entries: { "Article.md": { created: timestamp, modified: timestamp } } }, null, 2)}\n`);
    const reconciler = createVfsContentTimestampReconciler({ contentRoot, clock, logger: { info: () => undefined } });
    await reconciler.reconcile();
    await utimes(join(contentRoot, "Documents", "Article.md"), new Date("2026-09-13T03:00:00.000Z"), new Date("2026-09-13T03:00:00.000Z"));
    await reconciler.reconcile();

    expect((await metadata(contentRoot)).entries["Article.md"]).toEqual({ created: timestamp, modified: timestamp });
    await expect(readFile(join(contentRoot, ".kde3-meta.json"), "utf8")).rejects.toThrow();
  });

  it("keeps existing semantic timestamps through clean-checkout filesystem time drift, restart, and sibling activity", async () => {
    const contentRoot = await createRoot();
    const semanticTimestamp = "2026-09-13T01:00:00.000Z";
    const filesystemTimestamp = "2026-09-17T02:00:00.000Z";
    await write(contentRoot, "Documents/Existing.md", "unchanged");
    await write(contentRoot, "Documents/.kde3-meta.json", `${JSON.stringify({ version: 2, entries: {
      "Existing.md": { created: semanticTimestamp, modified: semanticTimestamp },
    } }, null, 2)}\n`);
    await utimes(join(contentRoot, "Documents", "Existing.md"), new Date(filesystemTimestamp), new Date(filesystemTimestamp));

    const reconciler = createVfsContentTimestampReconciler({ contentRoot, clock, logger: { info: () => undefined } });
    await reconciler.reconcile();
    await createVfsContentTimestampReconciler({ contentRoot, clock, logger: { info: () => undefined } }).reconcile();

    await write(contentRoot, "Documents/Temporary.md", "temporary");
    await reconciler.reconcile();
    await rm(join(contentRoot, "Documents", "Temporary.md"));
    await reconciler.reconcile();

    expect((await metadata(contentRoot)).entries).toEqual({
      "Existing.md": { created: semanticTimestamp, modified: semanticTimestamp },
    });
    await buildVfsContentManifest({ contentRoot });
    expect((await metadata(contentRoot)).entries["Existing.md"]).toEqual({ created: semanticTimestamp, modified: semanticTimestamp });
  });

  it("updates images by bytes and upgrades a changed v1 entry without losing its author fields", async () => {
    const contentRoot = await createRoot();
    const initial = "2026-09-13T01:00:00.000Z";
    const changed = "2026-09-13T04:00:00.000Z";
    await write(contentRoot, "Pictures/Image.png", new Uint8Array([1, 2]));
    await write(contentRoot, "Pictures/.kde3-meta.json", `${JSON.stringify({ version: 1, entries: { "Image.png": { id: "vfs-content-image", modified: initial, order: 8 } } }, null, 2)}\n`);
    const reconciler = createVfsContentTimestampReconciler({ contentRoot, clock, logger: { info: () => undefined } });
    await reconciler.reconcile();
    await write(contentRoot, "Pictures/Image.png", new Uint8Array([2, 3]));
    await utimes(join(contentRoot, "Pictures", "Image.png"), new Date(changed), new Date(changed));
    await reconciler.reconcile();

    expect(await metadata(contentRoot, "Pictures")).toEqual({
      version: 2,
      entries: { "Image.png": { id: "vfs-content-image", created: expect.any(String), modified: changed, order: 8 } },
    });
  });

  it("authors audio add, ignores touch-only changes, updates byte changes, and removes deleted v6 entries", async () => {
    const contentRoot = await createRoot();
    const initial = "2026-09-13T01:00:00.000Z";
    const changed = "2026-09-13T04:00:00.000Z";
    await write(contentRoot, "Music/Song.mp3", new Uint8Array([1, 2]));
    await write(contentRoot, "Music/.kde3-meta.json", `${JSON.stringify({ version: 6, entries: {
      "Song.mp3": { id: "vfs-content-song", created: initial, modified: initial, order: 2 },
    } }, null, 2)}\n`);
    const reconciler = createVfsContentTimestampReconciler({ contentRoot, clock, logger: { info: () => undefined } });
    await reconciler.reconcile();
    expect(await metadata(contentRoot, "Music")).toEqual({ version: 6, entries: {
      "Song.mp3": { id: "vfs-content-song", created: initial, modified: initial, order: 2 },
    } });

    await utimes(join(contentRoot, "Music", "Song.mp3"), new Date("2026-09-13T03:00:00.000Z"), new Date("2026-09-13T03:00:00.000Z"));
    await reconciler.reconcile();
    expect((await metadata(contentRoot, "Music")).entries["Song.mp3"]?.modified).toBe(initial);

    await write(contentRoot, "Music/Song.mp3", new Uint8Array([1, 2, 3]));
    await utimes(join(contentRoot, "Music", "Song.mp3"), new Date(changed), new Date(changed));
    await reconciler.reconcile();
    expect(await metadata(contentRoot, "Music")).toEqual({ entries: {
      "Song.mp3": { id: "vfs-content-song", created: initial, modified: changed, order: 2 },
    } });

    await rm(join(contentRoot, "Music", "Song.mp3"));
    await reconciler.reconcile();
    expect(await metadata(contentRoot, "Music")).toEqual({ entries: {} });
    await expect(buildVfsContentManifest({ contentRoot })).resolves.toBeDefined();
  });

  it("authors video add, updates byte changes, and removes deleted v6 entries", async () => {
    const contentRoot = await createRoot();
    const initial = "2026-09-13T01:00:00.000Z";
    const changed = "2026-09-13T04:00:00.000Z";
    await write(contentRoot, "Documents/Clip.webm", new Uint8Array([1, 2]));
    await write(contentRoot, "Documents/.kde3-meta.json", `${JSON.stringify({ version: 6, entries: {
      "Clip.webm": { id: "vfs-content-clip", created: initial, modified: initial, order: 3 },
    } }, null, 2)}\n`);
    const reconciler = createVfsContentTimestampReconciler({ contentRoot, clock, logger: { info: () => undefined } });
    await reconciler.reconcile();
    expect(await metadata(contentRoot)).toEqual({ version: 6, entries: {
      "Clip.webm": { id: "vfs-content-clip", created: initial, modified: initial, order: 3 },
    } });

    await write(contentRoot, "Documents/Clip.webm", new Uint8Array([1, 2, 3]));
    await utimes(join(contentRoot, "Documents", "Clip.webm"), new Date(changed), new Date(changed));
    await reconciler.reconcile();
    expect(await metadata(contentRoot)).toEqual({ entries: {
      "Clip.webm": { id: "vfs-content-clip", created: initial, modified: changed, order: 3 },
    } });

    await rm(join(contentRoot, "Documents", "Clip.webm"));
    await reconciler.reconcile();
    expect(await metadata(contentRoot)).toEqual({ entries: {} });
    await expect(buildVfsContentManifest({ contentRoot })).resolves.toBeDefined();
  });

  it("removes only auto-managed metadata after deletion while preserving explicit stale metadata for generator diagnostics", async () => {
    const contentRoot = await createRoot();
    await write(contentRoot, "Documents/Auto.md", "auto");
    await write(contentRoot, "Documents/Explicit.md", "explicit");
    await write(contentRoot, "Documents/.kde3-meta.json", `${JSON.stringify({ version: 2, entries: {
      "Auto.md": { created: "2026-09-13T01:00:00.000Z", modified: "2026-09-13T01:00:00.000Z" },
      "Explicit.md": { id: "vfs-content-explicit", created: "2026-09-13T01:00:00.000Z", modified: "2026-09-13T01:00:00.000Z" },
    } }, null, 2)}\n`);
    const reconciler = createVfsContentTimestampReconciler({ contentRoot, clock, logger: { info: () => undefined } });
    await reconciler.reconcile();
    await rm(join(contentRoot, "Documents", "Auto.md"));
    await rm(join(contentRoot, "Documents", "Explicit.md"));
    await reconciler.reconcile();

    expect((await metadata(contentRoot)).entries).toEqual({
      "Explicit.md": { id: "vfs-content-explicit", created: "2026-09-13T01:00:00.000Z", modified: "2026-09-13T01:00:00.000Z" },
    });
    expect((await metadata(contentRoot, ".")).entries.Documents).toEqual({ modified: "2026-09-13T09:00:00.000Z" });
    await expect(buildVfsContentManifest({ contentRoot })).rejects.toThrow("does not target a visible immediate child");
  });

  it("persists one logical activity timestamp for a new file and its platform parent", async () => {
    const contentRoot = await createRoot();
    const activity = "2026-09-13T10:00:00.000Z";
    await write(contentRoot, "Documents/New.md", "new");
    await createVfsContentTimestampReconciler({ contentRoot, clock: sequenceClock(activity), logger: { info: () => undefined } }).reconcile();

    expect((await metadata(contentRoot)).entries["New.md"]).toMatchObject({ created: expect.any(String), modified: expect.any(String) });
    expect((await metadata(contentRoot, ".")).entries.Documents).toEqual({ modified: activity });
  });

  it("propagates nested byte changes and deletion to each affected ancestor without touch noise", async () => {
    const contentRoot = await createRoot();
    const first = "2026-09-13T10:00:00.000Z";
    const second = "2026-09-13T11:00:00.000Z";
    const third = "2026-09-13T12:00:00.000Z";
    await write(contentRoot, "Documents/Projects/Post.md", "one");
    const reconciler = createVfsContentTimestampReconciler({ contentRoot, clock: sequenceClock(first, second, third), logger: { info: () => undefined } });
    await reconciler.reconcile();
    await utimes(join(contentRoot, "Documents", "Projects", "Post.md"), new Date(second), new Date(second));
    await reconciler.reconcile();
    expect((await metadata(contentRoot, "Documents")).entries.Projects).toEqual({ modified: first });
    await write(contentRoot, "Documents/Projects/Post.md", "two");
    await reconciler.reconcile();
    expect((await metadata(contentRoot, "Documents")).entries.Projects).toEqual({ modified: second });
    expect((await metadata(contentRoot, ".")).entries.Documents).toEqual({ modified: second });
    await rm(join(contentRoot, "Documents", "Projects", "Post.md"));
    await reconciler.reconcile();
    expect((await metadata(contentRoot, ".")).entries.Documents).toEqual({ modified: third });
  });

  it("propagates a cross-parent move to both direct platform mounts with one activity timestamp", async () => {
    const contentRoot = await createRoot();
    const activity = "2026-09-13T13:00:00.000Z";
    await write(contentRoot, "Documents/A.md", "A");
    await mkdir(join(contentRoot, "Desktop"), { recursive: true });
    await write(contentRoot, "Documents/.kde3-meta.json", `${JSON.stringify({ version: 2, entries: { "A.md": { created: "2026-09-13T01:00:00.000Z", modified: "2026-09-13T01:00:00.000Z" } } }, null, 2)}\n`);
    const reconciler = createVfsContentTimestampReconciler({ contentRoot, clock: sequenceClock(activity), logger: { info: () => undefined } });
    await reconciler.reconcile();
    await rename(join(contentRoot, "Documents", "A.md"), join(contentRoot, "Desktop", "A.md"));
    await reconciler.reconcile();

    expect((await metadata(contentRoot)).entries).toEqual({});
    expect((await metadata(contentRoot, "Desktop")).entries["A.md"]).toMatchObject({ created: expect.any(String), modified: expect.any(String) });
    expect((await metadata(contentRoot, ".")).entries).toEqual({
      Desktop: { modified: activity },
      Documents: { modified: activity },
    });
  });

  it("deduplicates nested move propagation while preserving authored directory metadata", async () => {
    const contentRoot = await createRoot();
    const initial = "2026-09-13T01:00:00.000Z";
    const activity = "2026-09-13T14:00:00.000Z";
    await write(contentRoot, "Documents/Projects/A.md", "A");
    await mkdir(join(contentRoot, "Documents", "Archive"), { recursive: true });
    await write(contentRoot, "Documents/.kde3-meta.json", `${JSON.stringify({ version: 2, entries: {
      Projects: { id: "vfs-content-projects", created: initial, modified: initial, order: 4 },
      Archive: { id: "vfs-content-archive", created: initial, modified: initial, order: 8 },
    } }, null, 2)}\n`);
    await write(contentRoot, "Documents/Projects/.kde3-meta.json", `${JSON.stringify({ version: 2, entries: { "A.md": { created: initial, modified: initial } } }, null, 2)}\n`);
    const reconciler = createVfsContentTimestampReconciler({ contentRoot, clock: sequenceClock(activity), logger: { info: () => undefined } });
    await reconciler.reconcile();
    await rename(join(contentRoot, "Documents", "Projects", "A.md"), join(contentRoot, "Documents", "Archive", "A.md"));
    await reconciler.reconcile();

    expect((await metadata(contentRoot)).entries).toEqual({
      Projects: { id: "vfs-content-projects", created: initial, modified: activity, order: 4 },
      Archive: { id: "vfs-content-archive", created: initial, modified: activity, order: 8 },
    });
    expect((await metadata(contentRoot, ".")).entries.Documents).toEqual({ modified: activity });
  });

  it("treats directory additions and deletions as parent activity without retaining deleted automatic entries", async () => {
    const contentRoot = await createRoot();
    const added = "2026-09-13T15:00:00.000Z";
    const removed = "2026-09-13T16:00:00.000Z";
    await mkdir(join(contentRoot, "Documents"), { recursive: true });
    const reconciler = createVfsContentTimestampReconciler({ contentRoot, clock: sequenceClock(added, removed), logger: { info: () => undefined } });
    await reconciler.reconcile();
    await mkdir(join(contentRoot, "Documents", "Projects"));
    await reconciler.reconcile();
    expect((await metadata(contentRoot, ".")).entries.Documents).toEqual({ modified: added });

    await rm(join(contentRoot, "Documents", "Projects"), { recursive: true });
    await reconciler.reconcile();
    expect((await metadata(contentRoot, ".")).entries.Documents).toEqual({ modified: removed });
    await expect(readFile(join(contentRoot, "Documents", ".kde3-meta.json"), "utf8")).rejects.toThrow();
  });

  it("does not treat metadata-only edits as repository content activity", async () => {
    const contentRoot = await createRoot();
    await write(contentRoot, "Documents/Article.md", "same");
    await write(contentRoot, "Documents/.kde3-meta.json", `${JSON.stringify({ version: 2, entries: { "Article.md": { created: "2026-09-13T01:00:00.000Z", modified: "2026-09-13T01:00:00.000Z" } } }, null, 2)}\n`);
    const reconciler = createVfsContentTimestampReconciler({ contentRoot, clock: sequenceClock("2026-09-13T17:00:00.000Z"), logger: { info: () => undefined } });
    await reconciler.reconcile();
    await write(contentRoot, "Documents/.kde3-meta.json", `${JSON.stringify({ version: 2, entries: { "Article.md": { created: "2026-09-13T01:00:00.000Z", modified: "2026-09-13T18:00:00.000Z" } } }, null, 2)}\n`);
    await reconciler.reconcile();

    await expect(readFile(join(contentRoot, ".kde3-meta.json"), "utf8")).rejects.toThrow();
  });

  it("preserves v3 displayName and version while updating only a real byte change", async () => {
    const contentRoot = await createRoot();
    const initial = "2026-09-13T01:00:00.000Z";
    const changed = "2026-09-13T18:00:00.000Z";
    await write(contentRoot, "Documents/Article.md", "one");
    await write(contentRoot, "Documents/.kde3-meta.json", `${JSON.stringify({ version: 3, entries: { "Article.md": { displayName: "My Article", created: initial, modified: initial } } }, null, 2)}\n`);
    const reconciler = createVfsContentTimestampReconciler({ contentRoot, clock: sequenceClock("2026-09-13T19:00:00.000Z"), logger: { info: () => undefined } });
    await reconciler.reconcile();
    await write(contentRoot, "Documents/Article.md", "two");
    await utimes(join(contentRoot, "Documents", "Article.md"), new Date(changed), new Date(changed));
    await reconciler.reconcile();

    expect(await metadata(contentRoot)).toEqual({ version: 3, entries: { "Article.md": { displayName: "My Article", created: initial, modified: changed } } });
  });

  it("does not treat a v3 displayName-only edit as file or directory activity", async () => {
    const contentRoot = await createRoot();
    const timestamp = "2026-09-13T01:00:00.000Z";
    await write(contentRoot, "Documents/Article.md", "same");
    await write(contentRoot, "Documents/.kde3-meta.json", `${JSON.stringify({ version: 3, entries: { "Article.md": { displayName: "First", created: timestamp, modified: timestamp } } }, null, 2)}\n`);
    const reconciler = createVfsContentTimestampReconciler({ contentRoot, clock: sequenceClock("2026-09-13T20:00:00.000Z"), logger: { info: () => undefined } });
    await reconciler.reconcile();
    await write(contentRoot, "Documents/.kde3-meta.json", `${JSON.stringify({ version: 3, entries: { "Article.md": { displayName: "Second", created: timestamp, modified: timestamp } } }, null, 2)}\n`);
    await reconciler.reconcile();

    expect(await metadata(contentRoot)).toEqual({ version: 3, entries: { "Article.md": { displayName: "Second", created: timestamp, modified: timestamp } } });
    await expect(readFile(join(contentRoot, ".kde3-meta.json"), "utf8")).rejects.toThrow();
  });

  it("preserves v4 publication metadata and version across byte changes and metadata-only publication edits", async () => {
    const contentRoot = await createRoot();
    const initial = "2026-09-13T01:00:00.000Z";
    const changed = "2026-09-13T21:00:00.000Z";
    const publication = { status: "published", publishedAt: "2026-09-10T08:00:00.000Z", summary: "Initial summary", tags: ["KDE 3", "Web"] };
    await write(contentRoot, "Documents/Article.md", "one");
    await write(contentRoot, "Documents/.kde3-meta.json", `${JSON.stringify({ version: 4, entries: { "Article.md": { displayName: "My Article", created: initial, modified: initial, publication } } }, null, 2)}\n`);
    const reconciler = createVfsContentTimestampReconciler({ contentRoot, clock: sequenceClock("2026-09-13T22:00:00.000Z"), logger: { info: () => undefined } });
    await reconciler.reconcile();
    await write(contentRoot, "Documents/Article.md", "two");
    await utimes(join(contentRoot, "Documents", "Article.md"), new Date(changed), new Date(changed));
    await reconciler.reconcile();

    expect(await metadata(contentRoot)).toEqual({ version: 4, entries: { "Article.md": { displayName: "My Article", created: initial, modified: changed, publication } } });
    const rootAfterByteChange = await readFile(join(contentRoot, ".kde3-meta.json"), "utf8");

    const revisedPublication = { ...publication, summary: "Revised summary", tags: ["KDE 3", "Web", "React"] };
    await write(contentRoot, "Documents/.kde3-meta.json", `${JSON.stringify({ version: 4, entries: { "Article.md": { displayName: "My Article", created: initial, modified: changed, publication: revisedPublication } } }, null, 2)}\n`);
    await reconciler.reconcile();
    expect(await metadata(contentRoot)).toEqual({ version: 4, entries: { "Article.md": { displayName: "My Article", created: initial, modified: changed, publication: revisedPublication } } });
    expect(await readFile(join(contentRoot, ".kde3-meta.json"), "utf8")).toBe(rootAfterByteChange);
  });

  it("keeps an existing v4 sidecar when adding automatic timestamp-only entries", async () => {
    const contentRoot = await createRoot();
    await write(contentRoot, "Documents/Published.md", "published");
    await write(contentRoot, "Documents/New.md", "new");
    await write(contentRoot, "Documents/.kde3-meta.json", `${JSON.stringify({ version: 4, entries: {
      "Published.md": { publication: { status: "published", publishedAt: "2026-09-10T08:00:00.000Z" } },
    } }, null, 2)}\n`);

    await createVfsContentTimestampReconciler({ contentRoot, clock, logger: { info: () => undefined } }).reconcile();
    const result = await metadata(contentRoot);
    expect(result.version).toBe(4);
    expect(result.entries["Published.md"]?.publication).toEqual({ status: "published", publishedAt: "2026-09-10T08:00:00.000Z" });
    expect(result.entries["New.md"]).toEqual({ created: expect.any(String), modified: expect.any(String) });
  });

  it("preserves v5 publication slugs and does not treat slug-only authoring edits as content activity", async () => {
    const contentRoot = await createRoot();
    const timestamp = "2026-09-13T01:00:00.000Z";
    await write(contentRoot, "Documents/Article.md", "same");
    await write(contentRoot, "Documents/.kde3-meta.json", `${JSON.stringify({ version: 5, entries: {
      "Article.md": { created: timestamp, modified: timestamp, publication: { status: "published", slug: "first-slug", publishedAt: "2026-09-10T08:00:00.000Z" } },
    } }, null, 2)}\n`);
    const reconciler = createVfsContentTimestampReconciler({ contentRoot, clock, logger: { info: () => undefined } });
    await reconciler.reconcile();
    await write(contentRoot, "Documents/.kde3-meta.json", `${JSON.stringify({ version: 5, entries: {
      "Article.md": { created: timestamp, modified: timestamp, publication: { status: "published", slug: "second-slug", publishedAt: "2026-09-10T08:00:00.000Z" } },
    } }, null, 2)}\n`);
    await reconciler.reconcile();

    expect(await metadata(contentRoot)).toEqual({ version: 5, entries: {
      "Article.md": { created: timestamp, modified: timestamp, publication: { status: "published", slug: "second-slug", publishedAt: "2026-09-10T08:00:00.000Z" } },
    } });
  });

  it("preserves v6 aliases and metadata-only alias edits without changing repository timestamps", async () => {
    const contentRoot = await createRoot();
    const timestamp = "2026-09-13T01:00:00.000Z";
    const publication = {
      status: "published",
      slug: "current-name",
      aliases: ["old-name", "original-name"],
      publishedAt: "2026-09-10T08:00:00.000Z",
      summary: "Summary",
      tags: ["KDE"],
    };
    await write(contentRoot, "Documents/Article.md", "one");
    await write(contentRoot, "Documents/.kde3-meta.json", `${JSON.stringify({ version: 6, entries: {
      "Article.md": { created: timestamp, modified: timestamp, publication },
    } }, null, 2)}\n`);
    const reconciler = createVfsContentTimestampReconciler({ contentRoot, clock, logger: { info: () => undefined } });
    await reconciler.reconcile();

    const revisedPublication = { ...publication, aliases: ["old-name", "older-name"] };
    await write(contentRoot, "Documents/.kde3-meta.json", `${JSON.stringify({ version: 6, entries: {
      "Article.md": { created: timestamp, modified: timestamp, publication: revisedPublication },
    } }, null, 2)}\n`);
    await reconciler.reconcile();
    expect(await metadata(contentRoot)).toEqual({ version: 6, entries: {
      "Article.md": { created: timestamp, modified: timestamp, publication: revisedPublication },
    } });

    await write(contentRoot, "Documents/Article.md", "two");
    await reconciler.reconcile();
    expect((await metadata(contentRoot)).version).toBeUndefined();
    expect((await metadata(contentRoot)).entries["Article.md"]?.publication).toEqual(revisedPublication);
  });

  it("removes every stale v6 entry while preserving live siblings and supports an empty final sidecar", async () => {
    const contentRoot = await createRoot();
    const timestamp = "2026-09-13T01:00:00.000Z";
    const article = {
      id: "vfs-content-article",
      displayName: "Published Article",
      created: timestamp,
      modified: timestamp,
      order: 1,
      publication: {
        status: "published",
        slug: "current-article",
        aliases: ["old-article"],
        publishedAt: "2026-09-10T08:00:00.000Z",
        summary: "A published article.",
        tags: ["KDE"],
      },
    };
    const image = {
      id: "vfs-content-image",
      displayName: "Article Image",
      created: timestamp,
      modified: timestamp,
      order: 2,
    };
    const live = {
      id: "vfs-content-live",
      displayName: "Live Article",
      created: timestamp,
      modified: timestamp,
      order: 3,
      publication: { status: "draft", slug: "live-article", aliases: ["live-draft"] },
    };
    await write(contentRoot, "Documents/Article.md", "article");
    await write(contentRoot, "Documents/Image.png", new Uint8Array([1, 2]));
    await write(contentRoot, "Documents/Live.md", "live");
    await write(contentRoot, "Documents/.kde3-meta.json", `${JSON.stringify({ version: 6, entries: {
      "Article.md": article,
      "Image.png": image,
      "Live.md": live,
    } }, null, 2)}\n`);
    const reconciler = createVfsContentTimestampReconciler({ contentRoot, clock, logger: { info: () => undefined } });
    await reconciler.reconcile();
    await rm(join(contentRoot, "Documents", "Article.md"));
    await rm(join(contentRoot, "Documents", "Image.png"));
    await reconciler.reconcile();

    expect(await metadata(contentRoot)).toEqual({ entries: { "Live.md": live } });
    await expect(buildVfsContentManifest({ contentRoot })).resolves.toBeDefined();

    await rm(join(contentRoot, "Documents", "Live.md"));
    await reconciler.reconcile();
    expect(await metadata(contentRoot)).toEqual({ entries: {} });
  });

  it("keeps unmodified v1 through v5 sidecar bytes intact during read-only reconciliation", async () => {
    const timestamp = "2026-09-13T01:00:00.000Z";
    const sidecars = [
      { version: 1, entries: { "V1.md": { id: "vfs-content-v1", modified: timestamp, order: 1 } } },
      { version: 2, entries: { "V2.md": { id: "vfs-content-v2", created: timestamp, modified: timestamp, order: 2 } } },
      { version: 3, entries: { "V3.md": { displayName: "Version Three", created: timestamp, modified: timestamp } } },
      { version: 4, entries: { "V4.md": { publication: { status: "draft", summary: "Version four." } } } },
      { version: 5, entries: { "V5.md": { publication: { status: "draft", slug: "version-five" } } } },
    ] as const;

    for (const sidecar of sidecars) {
      const contentRoot = await createRoot();
      await write(contentRoot, `Documents/V${sidecar.version}.md`, `v${sidecar.version}`);
      await write(contentRoot, "Documents/.kde3-meta.json", `${JSON.stringify(sidecar, null, 2)}\n`);
      const before = await readFile(join(contentRoot, "Documents", ".kde3-meta.json"), "utf8");

      await createVfsContentTimestampReconciler({ contentRoot, clock, logger: { info: () => undefined } }).reconcile();
      await buildVfsContentManifest({ contentRoot });

      await expect(readFile(join(contentRoot, "Documents", ".kde3-meta.json"), "utf8")).resolves.toBe(before);
    }
  });

  it("retains deleted v4 publication metadata for the generator's stale-entry diagnostic", async () => {
    const contentRoot = await createRoot();
    await write(contentRoot, "Documents/Article.md", "article");
    await write(contentRoot, "Documents/.kde3-meta.json", `${JSON.stringify({ version: 4, entries: {
      "Article.md": { publication: { status: "draft", summary: "Keep this author intent." } },
    } }, null, 2)}\n`);
    const reconciler = createVfsContentTimestampReconciler({ contentRoot, clock, logger: { info: () => undefined } });
    await reconciler.reconcile();
    await rm(join(contentRoot, "Documents", "Article.md"));
    await reconciler.reconcile();

    expect((await metadata(contentRoot)).entries["Article.md"]?.publication).toEqual({ status: "draft", summary: "Keep this author intent." });
    await expect(buildVfsContentManifest({ contentRoot })).rejects.toThrow("does not target a visible immediate child");
  });
});
