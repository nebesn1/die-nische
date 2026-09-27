export interface BlogTagsOpenIntent {
  readonly type: "open-blog-tags";
  readonly selectedTag?: string;
}

export function createBlogTagsOpenIntent(options: { readonly selectedTag?: string } = {}): BlogTagsOpenIntent {
  return {
    type: "open-blog-tags",
    ...(options.selectedTag === undefined ? {} : { selectedTag: options.selectedTag }),
  };
}

export const isBlogTagsOpenIntent = (value: unknown): value is BlogTagsOpenIntent =>
  typeof value === "object" && value !== null &&
  (value as { readonly type?: unknown }).type === "open-blog-tags" &&
  (!("selectedTag" in value) || typeof (value as { readonly selectedTag?: unknown }).selectedTag === "string");
