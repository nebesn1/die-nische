import type { ApplicationLaunchRequest } from "../../application-runtime/types";
import { ArticleReader } from "./ArticleReader";

type ArticleReaderPrototypeProps = {
  readonly launchRequest?: ApplicationLaunchRequest | null;
  readonly onSetWindowTitle?: (title: string) => void;
};

export function ArticleReaderPrototype({ launchRequest = null, onSetWindowTitle }: ArticleReaderPrototypeProps) {
  return <ArticleReader launchRequest={launchRequest} onSetWindowTitle={onSetWindowTitle} />;
}
