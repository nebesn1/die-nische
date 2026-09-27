import type { ApplicationLaunchRequest } from "../../application-runtime/types";
import { BlogSearch } from "./BlogSearch";

export function BlogSearchPrototype({ launchRequest = null }: { readonly launchRequest?: ApplicationLaunchRequest | null }) {
  return <BlogSearch launchRequest={launchRequest} />;
}
