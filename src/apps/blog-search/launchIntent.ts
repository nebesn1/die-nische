export interface BlogSearchOpenIntent {
  readonly type: "open-blog-search";
  readonly query: string;
}

export function createBlogSearchOpenIntent(query: string): BlogSearchOpenIntent {
  return { type: "open-blog-search", query };
}

export const isBlogSearchOpenIntent = (value: unknown): value is BlogSearchOpenIntent =>
  typeof value === "object" && value !== null &&
  (value as { readonly type?: unknown }).type === "open-blog-search" &&
  typeof (value as { readonly query?: unknown }).query === "string";
