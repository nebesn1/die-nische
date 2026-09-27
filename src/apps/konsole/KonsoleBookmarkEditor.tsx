import { BookmarkEditor } from "../konqueror/BookmarkEditor";
import { KonquerorBookmarksContext } from "../konqueror/konquerorBookmarksContext";
import { useKonsoleBookmarks } from "./useKonsoleBookmarks";

/** The shared editor presentation rendered against Konsole's independent bookmark authority. */
export function KonsoleBookmarkEditor({ onRequestClose }: { readonly onRequestClose: () => void }) {
  const bookmarks = useKonsoleBookmarks();

  return (
    <KonquerorBookmarksContext.Provider value={bookmarks}>
      <BookmarkEditor onRequestClose={onRequestClose} rootLabel="Konsole Bookmarks" />
    </KonquerorBookmarksContext.Provider>
  );
}
