import type { VfsNodeId } from "../../vfs/types";

export interface ArticleReaderOpenIntent {
  readonly type: "open-article-reader";
  readonly nodeId: VfsNodeId;
}

export const createArticleReaderOpenIntent = (nodeId: VfsNodeId): ArticleReaderOpenIntent => ({
  type: "open-article-reader",
  nodeId,
});

export const isArticleReaderOpenIntent = (value: unknown): value is ArticleReaderOpenIntent =>
  typeof value === "object" && value !== null &&
  (value as { readonly type?: unknown }).type === "open-article-reader" &&
  typeof (value as { readonly nodeId?: unknown }).nodeId === "string" &&
  (value as { readonly nodeId: string }).nodeId.length > 0;
