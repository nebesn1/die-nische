import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createInitialVfsState } from "./initialState";
import { mergeRepositoryContentManifest } from "./repositoryContentSeed";
import { resolveVfsPath } from "./queries";
import * as generator from "../../scripts/generate-vfs-content-manifest.mjs";

const roots: string[] = [];
const publishedAt = "2026-09-26T12:00:00.000Z";
const publication = { status: "published", slug: "front-matter-article", publishedAt, summary: "Summary", tags: ["Qt", "KDE"] };

const rootWithDocuments = async () => {
  const root = await mkdtemp(join(tmpdir(), "kde3-front-matter-"));
  roots.push(root);
  await mkdir(join(root, "Documents"));
  return root;
};

const writeFileFixture = async (root: string, name: string, content: string) => {
  await writeFile(join(root, "Documents", name), content, "utf8");
};

const writeMetadata = async (root: string, entries: Record<string, unknown>, version = 6) => {
  await writeFile(join(root, "Documents", ".kde3-meta.json"), `${JSON.stringify({ version, entries }, null, 2)}\n`, "utf8");
};

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("repository content Markdown front matter", () => {
  it("uses front matter as the effective display name/publication while retaining raw source text", async () => {
    const root = await rootWithDocuments();
    const source = `---\ntitle: "Portable Article"\npublication:\n  status: published\n  slug: portable-article\n  publishedAt: "${publishedAt}"\n  summary: "Portable summary"\n  tags:\n    - Qt\n---\n\n# Portable Article\n\nBody\n`;
    await writeFileFixture(root, "article.md", source);

    const manifest = await generator.buildVfsContentManifest({ contentRoot: root });
    const article = manifest.entries.find((entry) => entry.virtualPath === "/home/user/Documents/article.md");

    expect(article).toMatchObject({
      displayName: "Portable Article",
      publication: { status: "published", slug: "portable-article", publishedAt, summary: "Portable summary", tags: ["Qt"] },
      source: { kind: "text", text: source },
    });

    const seeded = mergeRepositoryContentManifest(createInitialVfsState(), manifest);
    const resolved = resolveVfsPath(seeded, "/home/user/Documents/article.md");
    expect(resolved.ok && resolved.value.kind === "file" ? resolved.value : null).toMatchObject({
      displayName: "Portable Article",
      publication: { slug: "portable-article", status: "published" },
    });
  });

  it("accepts an identical legacy sidecar during transition and rejects field mixing conflicts", async () => {
    const root = await rootWithDocuments();
    const source = `---\ntitle: "Portable Article"\npublication:\n  status: published\n  slug: front-matter-article\n  publishedAt: "${publishedAt}"\n  summary: "Summary"\n  tags:\n    - Qt\n    - KDE\n---\nBody`;
    await writeFileFixture(root, "article.md", source);
    await writeMetadata(root, { "article.md": { displayName: "Portable Article", publication } });

    await expect(generator.buildVfsContentManifest({ contentRoot: root })).resolves.toMatchObject({ entries: expect.any(Array) });

    await writeMetadata(root, { "article.md": { displayName: "Portable Article", publication: { ...publication, slug: "different-route" } } });
    await expect(generator.buildVfsContentManifest({ contentRoot: root })).rejects.toThrow(/publication conflicts.*slug/);

    await writeMetadata(root, { "article.md": { displayName: "Different title", publication } });
    await expect(generator.buildVfsContentManifest({ contentRoot: root })).rejects.toThrow(/title .* conflicts with legacy displayName/);
  });

  it("checks route-token uniqueness across front matter and legacy sidecar sources", async () => {
    const root = await rootWithDocuments();
    await writeFileFixture(root, "front.md", `---\ntitle: Front\npublication:\n  status: draft\n  slug: shared-route\n---\nFront`);
    await writeFileFixture(root, "legacy.md", "Legacy");
    await writeMetadata(root, { "legacy.md": { publication: { status: "draft", slug: "shared-route" } } });

    await expect(generator.buildVfsContentManifest({ contentRoot: root })).rejects.toThrow(/slug 'shared-route' conflicts/);
  });

  it("supports a front-matter publication after a virtual move without a publication sidecar", async () => {
    const root = await rootWithDocuments();
    const source = `---\ntitle: Moved Article\npublication:\n  status: published\n  slug: moved-article\n  publishedAt: "${publishedAt}"\n---\nBody`;
    await mkdir(join(root, "Documents", "Nested"));
    await writeFileFixture(root, "Nested-placeholder.md", "placeholder");
    await writeFile(join(root, "Documents", "Nested", "article.md"), source, "utf8");

    const manifest = await generator.buildVfsContentManifest({ contentRoot: root });
    expect(manifest.entries.find((entry) => entry.virtualPath === "/home/user/Documents/Nested/article.md")).toMatchObject({
      displayName: "Moved Article",
      publication: { slug: "moved-article", status: "published", publishedAt },
    });
    expect(await readFile(join(root, "Documents", "Nested", "article.md"), "utf8")).toBe(source);
  });
});
