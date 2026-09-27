import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  applyPublicationFrontMatterMigration,
  createPublicationFrontMatterMigrationPlan,
  formatPublicationFrontMatterMigrationReport,
} from "./migrate-publication-frontmatter.mjs";
import { buildVfsContentManifest } from "./generate-vfs-content-manifest.mjs";

const roots = [];
const created = "2026-09-01T00:00:00.000Z";
const modified = "2026-09-02T00:00:00.000Z";
const publishedAt = "2026-09-03T00:00:00.000Z";

const createFixture = async () => {
  const root = await mkdtemp(join(tmpdir(), "kde3-publication-migration-"));
  roots.push(root);
  await mkdir(join(root, "Documents"));
  return root;
};

const resolveContentPath = (root, relativePath) => join(root, "Documents", relativePath);
const writeFileFixture = async (root, relativePath, source) => {
  const filePath = resolveContentPath(root, relativePath);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, source, "utf8");
};
const writeArticle = (root, name, source) => writeFileFixture(root, name, source);
const writeSidecarAt = async (root, relativeDirectory, entries, version = 6) => {
  const directory = resolveContentPath(root, relativeDirectory);
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, ".kde3-meta.json"), `${JSON.stringify({ version, entries }, null, 2)}\n`, "utf8");
};
const writeSidecar = (root, entries, version = 6) => writeSidecarAt(root, ".", entries, version);
const writeUnversionedSidecar = async (root, entries) => {
  const directory = resolveContentPath(root, ".");
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, ".kde3-meta.json"), `${JSON.stringify({ entries }, null, 2)}\n`, "utf8");
};
const readArticle = (root, name) => readFile(resolveContentPath(root, name), "utf8");
const readSidecarAt = (root, relativeDirectory = ".") => readFile(join(resolveContentPath(root, relativeDirectory), ".kde3-meta.json"), "utf8");
const readSidecar = (root) => readSidecarAt(root);
const getGeneratedEntry = (manifest, virtualPath) => manifest.entries.find((entry) => entry.virtualPath === virtualPath);

const legacyPublication = {
  status: "published",
  slug: "legacy-article",
  publishedAt,
  summary: "Summary with : colon and 中文",
  tags: ["Qt", "KDE"],
};

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("publication front matter migration", () => {
  it("dry-runs without writing, preserves body/metadata, and is idempotent after apply", async () => {
    const root = await createFixture();
    const body = "# Legacy\n\n<video controls src=\"./clip.mp4\"></video>\n\n中文\n";
    await writeArticle(root, "article.md", body);
    await writeSidecar(root, {
      "article.md": { id: "vfs-content-article", displayName: "Legacy Article", created, modified, order: 4, publication: legacyPublication },
    });
    const beforeArticle = await readArticle(root, "article.md");
    const beforeSidecar = await readSidecar(root);

    const plan = await createPublicationFrontMatterMigrationPlan({ contentRoot: root });
    expect(plan.blockers).toHaveLength(0);
    expect(plan.discovered).toBe(1);
    expect(plan.eligible).toBe(1);
    expect(await readArticle(root, "article.md")).toBe(beforeArticle);
    expect(await readSidecar(root)).toBe(beforeSidecar);

    await applyPublicationFrontMatterMigration(plan);
    const migrated = await readArticle(root, "article.md");
    expect(migrated).toContain("title: Legacy Article");
    expect(migrated).toContain('summary: "Summary with : colon and 中文"');
    expect(migrated).toContain("<video controls src=\"./clip.mp4\"></video>");
    expect(await readSidecar(root)).toContain(`"created": "${created}"`);
    expect(await readSidecar(root)).toContain(`"modified": "${modified}"`);
    expect(await readSidecar(root)).toContain('"order": 4');
    expect(await readSidecar(root)).not.toContain("displayName");
    expect(await readSidecar(root)).not.toContain("publication");

    const secondPlan = await createPublicationFrontMatterMigrationPlan({ contentRoot: root });
    expect(secondPlan.blockers).toHaveLength(0);
    expect(secondPlan.eligible).toBe(0);
    expect(secondPlan.alreadyAuthoritative).toBe(1);
    expect(secondPlan.contentChanges).toHaveLength(0);
    expect(secondPlan.sidecarWrites ?? []).toHaveLength(0);
  });

  it("accepts the unversioned v6 baseline and keeps the migration write unversioned", async () => {
    const root = await createFixture();
    const frontMatter = `---\ntitle: Legacy Article\npublication:\n  status: published\n  slug: legacy-article\n  publishedAt: "${publishedAt}"\n  summary: "Summary with : colon and 中文"\n  tags:\n    - Qt\n    - KDE\n---\n\n# Article\n`;
    await writeArticle(root, "article.md", frontMatter);
    await writeUnversionedSidecar(root, {
      "article.md": { id: "vfs-content-article", displayName: "Legacy Article", created, modified, publication: legacyPublication },
    });

    const plan = await createPublicationFrontMatterMigrationPlan({ contentRoot: root });
    expect(plan.blockers).toHaveLength(0);
    expect(plan.alreadyAuthoritative).toBe(1);
    expect(plan.eligible).toBe(0);

    await applyPublicationFrontMatterMigration(plan);
    const migrated = JSON.parse(await readSidecar(root));
    expect(migrated).toEqual({ entries: {
      "article.md": { id: "vfs-content-article", created, modified },
    } });
  });

  it("preserves unrelated YAML front matter keys and line endings", async () => {
    const root = await createFixture();
    await writeArticle(root, "article.md", "---\r\nlayout: article\r\ncustom: \"保留: yes\"\r\n---\r\n\r\n# Body\r\n");
    await writeSidecar(root, { "article.md": { displayName: "Article", created, modified, publication: { ...legacyPublication, slug: "crlf-article" } } });

    await applyPublicationFrontMatterMigration(await createPublicationFrontMatterMigrationPlan({ contentRoot: root }));
    const migrated = await readArticle(root, "article.md");
    expect(migrated).toContain("layout: article\r\n");
    expect(migrated).toContain("custom: \"保留: yes\"\r\n");
    expect(migrated).toContain("title: Article\r\n");
    expect(migrated).toContain("# Body\r\n");
    expect(migrated).not.toContain("displayName");
  });

  it("blocks the complete write when any article has conflicting metadata", async () => {
    const root = await createFixture();
    await writeArticle(root, "valid.md", "Valid");
    await writeArticle(root, "conflict.md", "---\ntitle: Front Title\n---\nConflict");
    await writeSidecar(root, {
      "valid.md": { displayName: "Valid", publication: { ...legacyPublication, slug: "valid-article" } },
      "conflict.md": { displayName: "Legacy Title", publication: { ...legacyPublication, slug: "conflict-article" } },
    });
    const beforeValid = await readArticle(root, "valid.md");
    const beforeConflict = await readArticle(root, "conflict.md");
    const plan = await createPublicationFrontMatterMigrationPlan({ contentRoot: root });

    expect(plan.blockers.some((blocker) => blocker.path.endsWith("conflict.md"))).toBe(true);
    expect(plan.conflicts).toBe(1);
    await expect(applyPublicationFrontMatterMigration(plan)).rejects.toThrow(/blockers/);
    expect(await readArticle(root, "valid.md")).toBe(beforeValid);
    expect(await readArticle(root, "conflict.md")).toBe(beforeConflict);
  });

  it("reports missing source files and malformed YAML as blockers without fallback", async () => {
    const root = await createFixture();
    await writeArticle(root, "broken.md", "---\ntitle: [broken\n---\nBody");
    await writeSidecar(root, {
      "broken.md": { displayName: "Broken", publication: { ...legacyPublication, slug: "broken-article" } },
      "missing.md": { displayName: "Missing", publication: { ...legacyPublication, slug: "missing-article" } },
    });
    const plan = await createPublicationFrontMatterMigrationPlan({ contentRoot: root });
    expect(plan.blockers).toHaveLength(2);
    expect(plan.orphanPublicationEntries).toBe(1);
    expect(plan.blockers.map((blocker) => blocker.message).join(" ")).toMatch(/invalid YAML|no source file/);
    expect(plan.contentChanges).toHaveLength(0);
  });

  it("uses the canonical filename fallback when a legacy publication has no displayName", async () => {
    const root = await createFixture();
    await writeArticle(root, "filename-fallback.md", "Body");
    await writeSidecar(root, { "filename-fallback.md": { publication: { ...legacyPublication, slug: "filename-fallback" } } });

    const plan = await createPublicationFrontMatterMigrationPlan({ contentRoot: root });
    expect(plan.blockers).toHaveLength(0);
    expect(plan.eligible).toBe(1);

    await applyPublicationFrontMatterMigration(plan);
    expect(await readArticle(root, "filename-fallback.md")).toContain("title: filename-fallback.md");
  });

  it("preserves generic displayName metadata when no publication is present", async () => {
    const root = await createFixture();
    await writeArticle(root, "plain.md", "Plain");
    const sidecar = { "plain.md": { displayName: "Friendly Plain", created, modified } };
    await writeSidecar(root, sidecar);

    const plan = await createPublicationFrontMatterMigrationPlan({ contentRoot: root });
    expect(plan.blockers).toHaveLength(0);
    expect(plan.discovered).toBe(0);
    expect(plan.eligible).toBe(0);
    expect(plan.contentChanges).toHaveLength(0);
    expect(plan.sidecarChanges).toHaveLength(0);
    await applyPublicationFrontMatterMigration(plan);
    expect(JSON.parse(await readSidecar(root)).entries["plain.md"]).toEqual(sidecar["plain.md"]);
  });

  it("preserves unrelated generic displayName entries while migrating a valid article", async () => {
    const root = await createFixture();
    await writeArticle(root, "article.md", "Article");
    await writeArticle(root, "plain.md", "Plain");
    await writeSidecar(root, {
      "article.md": { displayName: "Article", publication: { ...legacyPublication, slug: "article" } },
      "plain.md": { displayName: "Unrelated Plain" },
    });

    const plan = await createPublicationFrontMatterMigrationPlan({ contentRoot: root });
    expect(plan.blockers).toHaveLength(0);
    expect(plan.eligible).toBe(1);
    await applyPublicationFrontMatterMigration(plan);

    const entries = JSON.parse(await readSidecar(root)).entries;
    expect(entries["article.md"]).not.toHaveProperty("displayName");
    expect(entries["article.md"]).not.toHaveProperty("publication");
    expect(entries["plain.md"]).toEqual({ displayName: "Unrelated Plain" });
  });

  it("blocks an orphan publication and writes nothing even when another article is eligible", async () => {
    const root = await createFixture();
    await writeArticle(root, "valid.md", "Valid");
    await writeSidecar(root, {
      "valid.md": { displayName: "Valid", publication: { ...legacyPublication, slug: "valid" } },
      "missing.md": { displayName: "Missing", publication: { ...legacyPublication, slug: "missing" } },
    });
    const beforeValid = await readArticle(root, "valid.md");
    const beforeSidecar = await readSidecar(root);

    const plan = await createPublicationFrontMatterMigrationPlan({ contentRoot: root });
    expect(plan.eligible).toBe(1);
    expect(plan.orphanPublicationEntries).toBe(1);
    expect(plan.blockers).toHaveLength(1);
    expect(plan.blockers[0]?.path).toContain(".kde3-meta.json");
    expect(formatPublicationFrontMatterMigrationReport(plan)).toContain("Orphan/stale publication entries: 1");
    await expect(applyPublicationFrontMatterMigration(plan)).rejects.toThrow(/no files were written/);
    expect(await readArticle(root, "valid.md")).toBe(beforeValid);
    expect(await readSidecar(root)).toBe(beforeSidecar);
  });

  it.each([
    ["photo.png", "image/png", "reject-publication"],
    ["song.mp3", "audio/mpeg", "reject-publication"],
    ["movie.mp4", "video/mp4", "reject-publication"],
    ["notes.txt", "text/plain", "accept"],
    ["page.html", "text/html", "accept"],
    ["unknown.bin", null, "reject-file"],
  ])("blocks publication migration for %s while matching generator target semantics", async (name, mimeType, generatorBehavior) => {
    const root = await createFixture();
    await writeFileFixture(root, name, "fixture");
    await writeSidecar(root, { [name]: { publication: { ...legacyPublication, slug: name.replaceAll(".", "-") } } });

    const plan = await createPublicationFrontMatterMigrationPlan({ contentRoot: root });
    expect(plan.unsupportedPublicationTargets).toBe(1);
    expect(plan.blockers).toHaveLength(1);
    expect(plan.blockers[0]?.message).toContain("migration supports Markdown only");

    if (generatorBehavior === "accept") {
      const manifest = await buildVfsContentManifest({ contentRoot: root });
      expect(getGeneratedEntry(manifest, `/home/user/Documents/${name}`)).toMatchObject({ mimeType, publication: { status: "published" } });
    } else if (generatorBehavior === "reject-publication") {
      await expect(buildVfsContentManifest({ contentRoot: root })).rejects.toThrow(/may only set publication on a supported text file/);
    } else {
      await expect(buildVfsContentManifest({ contentRoot: root })).rejects.toThrow(/Unsupported repository content file type/);
    }
  });

  it("blocks publication metadata attached to a directory", async () => {
    const root = await createFixture();
    await mkdir(resolveContentPath(root, "Folder"));
    await writeSidecar(root, { Folder: { publication: { ...legacyPublication, slug: "folder" } } });

    const plan = await createPublicationFrontMatterMigrationPlan({ contentRoot: root });
    expect(plan.unsupportedPublicationTargets).toBe(1);
    expect(plan.blockers[0]?.message).toMatch(/targets a directory/);
    await expect(buildVfsContentManifest({ contentRoot: root })).rejects.toThrow(/may only set publication on a supported text file/);
  });

  it("keeps sidecar publication association immediate across nested directories", async () => {
    const root = await createFixture();
    await writeArticle(root, "article.md", "Root");
    await writeArticle(root, "Nested/article.md", "Nested");
    await writeSidecar(root, { "article.md": { publication: { ...legacyPublication, slug: "root-article" } } });
    await writeSidecarAt(root, "Nested", { "article.md": { publication: { ...legacyPublication, slug: "nested-article" } } });

    const plan = await createPublicationFrontMatterMigrationPlan({ contentRoot: root });
    expect(plan.blockers).toHaveLength(0);
    expect(plan.eligible).toBe(2);
    expect(plan.contentChanges.map((change) => change.file).sort()).toEqual([
      "content/home/user/Documents/Nested/article.md",
      "content/home/user/Documents/article.md",
    ]);
  });

  it("blocks duplicate route tokens spanning legacy and front-matter publications", async () => {
    const root = await createFixture();
    await writeArticle(root, "legacy.md", "Legacy");
    await writeArticle(root, "Nested/front.md", `---\ntitle: Front\npublication:\n  status: published\n  slug: shared-route\n  publishedAt: "${publishedAt}"\n---\nFront`);
    await writeSidecar(root, { "legacy.md": { publication: { ...legacyPublication, slug: "shared-route" } } });

    const plan = await createPublicationFrontMatterMigrationPlan({ contentRoot: root });
    expect(plan.duplicateRoutes).toBe(1);
    expect(plan.blockers.some((blocker) => blocker.message.includes("shared-route"))).toBe(true);
    await expect(buildVfsContentManifest({ contentRoot: root })).rejects.toThrow(/shared-route/);
  });

  it("reports unsupported metadata versions without treating them as empty metadata", async () => {
    const root = await createFixture();
    await writeArticle(root, "article.md", "Article");
    await writeSidecar(root, { "article.md": { publication: { ...legacyPublication, slug: "unsupported-version" } } }, 7);

    const plan = await createPublicationFrontMatterMigrationPlan({ contentRoot: root });
    expect(plan.blockers).toHaveLength(1);
    expect(plan.blockers[0]?.message).toMatch(/requires version 1, 2, 3, 4, 5, or 6/);
    await expect(buildVfsContentManifest({ contentRoot: root })).rejects.toThrow(/requires version 1, 2, 3, 4, 5, or 6/);
  });
});
