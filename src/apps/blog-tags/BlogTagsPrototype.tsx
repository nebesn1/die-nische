import type { ApplicationLaunchRequest } from "../../application-runtime/types";
import { BlogTags } from "./BlogTags";

type BlogTagsPrototypeProps = {
  readonly launchRequest?: ApplicationLaunchRequest | null;
};

export function BlogTagsPrototype({ launchRequest = null }: BlogTagsPrototypeProps) {
  return <BlogTags launchRequest={launchRequest} />;
}
