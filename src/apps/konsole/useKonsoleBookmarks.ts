import { useContext } from "react";
import type { KonquerorBookmarksContextValue } from "../konqueror/konquerorBookmarksContext";
import { KonsoleBookmarksContext } from "./konsoleBookmarksContext";

export function useKonsoleBookmarks(): KonquerorBookmarksContextValue {
  return useContext(KonsoleBookmarksContext);
}
