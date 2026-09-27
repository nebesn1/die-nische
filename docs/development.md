# Development

## Responsive Layout Development

Responsive behavior uses the existing logical geometry boundary rather than user-agent strings, `devicePixelRatio`, or a second browser-zoom calculation. `ResponsiveLayoutProvider` and `useResponsiveLayout` expose the current logical viewport, Kicker-reserved work area, `mobile`/`desktop` mode, geometry-derived orientation, and safe-area insets. The inclusive mobile boundary is `480` logical pixels. The configured/requested `--kde-ui-scale` remains `1.4`, while rendered-to-logical conversion reads the browser-applied computed `.desktop-shell` CSS `zoom` after mount (falling back to the requested value during bootstrap). The model measures the unzoomed `#root` used geometry and divides by that effective scale; it falls back to `window.innerWidth`/`innerHeight` only when the root is unavailable or unusable. `ResizeObserver` is the primary used-size invalidation source when available; `visualViewport.resize` and `window.resize` are additional coalesced triggers.

The root `.desktop-shell` publishes `data-layout-mode` and `data-orientation`. After measuring `#root`, the provider publishes the effective scale, logical viewport/work-area dimensions, and logical safe-area variables back to the root CSS scope; shell, Kicker, popup, and application CSS therefore consume the same snapshot as WindowManager. The stylesheet formula is only a requested-scale bootstrap fallback before the shell can be measured. Safe-area `env()` values are bridged at the unzoomed root and converted once to logical pixels, but are not yet applied as window edge padding. Do not add UA detection, viewport meta zoom restrictions, per-component breakpoints, or `key`-based remounts. Future mobile phases should consume the shared provider rather than recomputing viewport geometry.

Validate rotation as one mounted-session transition: exercise `390x844 -> 844x390 -> 390x844` and verify that the provider changes mode/orientation and Work Area without changing window IDs, active desktop/window, z-order, launcher metadata, application state, or the saved desktop/mobile geometry profiles. Pointer capture consumers must treat both `pointercancel` and `lostpointercapture` as cancellation boundaries; they must release transient state without dispatching the last pending drag or resize frame.

The mobile Kicker consumer uses only `.desktop-shell[data-layout-mode="mobile"]`: it hides nonessential mounted controls, keeps Start and the actual pager adjacent in the left flow, gives the Clock the remaining right edge through normal flex layout, preserves Pager/DigitalClock state, and keeps the panel at `46px`. Popup cleanup belongs to the owner of each hidden surface, so switching desktop/mobile does not remount the shell or reset WindowManager, application, locale, theme, or clipboard history state. Mobile K Menu width uses the existing logical viewport token; do not add a second media-query or user-agent breakpoint.

WindowManager consumes the same responsive snapshot and keeps runtime-only normal and maximize-restore profiles for `desktop` and `mobile` separately. Mobile visible windows default to the exact current Work Area presentation while retaining their user normal/maximized state for desktop restoration; the stable `calendar` application ID is the only exception. The existing Clock launcher passes logical `initialBounds`, so Calendar opens above the Kicker anchor on both modes, clamps its right and bottom edges to the usable Work Area, and keeps its compact dimensions when the viewport expands; an unanchored launch still uses the registry preferred size. Minimized windows remain minimized and mobile maximize/restore, drag, and resize requests are guarded; Calendar keeps the same mobile disabled Minimize/Maximize policy and enabled Close action. Returning to a mode restores that mode's profile, and a Work Area change reapplies the policy-specific mobile presentation without allowing Calendar to become partially clipped. WindowFrame bounds are outer-frame bounds and are applied through WorkArea-relative edges, so fractional UI-scale viewport widths do not create an extra border pixel at the right or bottom edge. The desktop recovery rules remain the default outside mobile mode.

K Menu mobile availability is derived in one semantic policy from stable application IDs, submenu IDs, and command IDs. Configure Panel, KCalc, Find Files, Bookmarks, Quick Browser, and Run Command stay visible but disabled on mobile, including dynamic Most Used rows; their desktop entries and ranking behavior are unchanged.

Persistent first-party application menubars use the shared `application-menubar` class. Mobile CSS hides only that persistent horizontal surface and reclaims its flex height; it does not match Kicker, titlebar system menus, popup menus, context menus, or dialog-owned menus. Konqueror, KWrite, Konsole, KCalc, and Control Center close their owner-local menubar state when entering mobile so a hidden trigger cannot leave a portal popup behind. Mode changes do not remount applications or reset their non-menu state. Apps without a persistent menubar receive no placeholder.

## Repository VFS Content

`content/home/user/**` supplies repository-owned baseline files for the in-memory VFS. A supported text source such as `content/home/user/Documents/My Article.md` maps to `/home/user/Documents/My Article.md`; a supported image such as `content/home/user/Pictures/photo.png` or audio source such as `content/home/user/Music/song.mp3` maps to the same `/home/user/**` path with the `content/` prefix removed.

The baseline project epoch is `2026-08-30T12:00:00.000Z`. It is the deterministic fallback for repository and platform VFS timestamps when no explicit metadata exists; in a UTC+8 UI it renders as `2026-08-30 20:00`. Explicit metadata and automatic authoring timestamps take precedence, while build/test/typecheck never consult live filesystem time.

Supported text files are UTF-8 `.txt`, `.md`, `.markdown`, `.html`, and `.htm`. Supported images are `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, and `.bmp`; supported audio is `.mp3`, `.ogg`, `.oga`, and `.wav`, all with case-insensitive extension matching. Text is generated as VFS text content. Images and audio are generated as static Vite `?url&no-inline` assets with their original binary byte size, so generated JavaScript does not embed base64 data. Audio has no repository metadata or playback layer; a future Amarok-style consumer must use the typed VFS asset URL rather than access the physical repository directly.

`npm run dev` first reconciles automatic timestamp sidecars, then generates the manifest, and then watches `content/home/user/**`. A new supported file with no metadata entry receives `created` and `modified` timestamps automatically. Later byte changes preserve `created` and update only `modified`; a touch-only event with identical bytes does not change metadata. Add, change, delete, rename, and directory changes are debounced into one reconcile/generate pass. After a successful pass, Vite performs a full page reload, so the initial VFS reflects the latest repository baseline. For example, save `content/home/user/Documents/My Article.md`, `content/home/user/Pictures/photo.png`, or `content/home/user/Music/song.mp3`; no development-server restart is required.

The full reload is intentional: it recreates the in-memory VFS and discards browser-session Save, Rename, Move, Delete, and Copy mutations. Invalid repository content, such as an unsupported `.pdf`, logs a concise development-terminal error, does not reload the current page, and leaves the prior valid manifest in place. Remove or fix the file and the next content event recovers normally.

`npm run generate:vfs-content` remains available for manual/debug generation. The generated manifest is ignored and is regenerated by one-shot development startup, build, test, typecheck, and lint commands. Build, test, lint, and typecheck do not start a persistent watcher and never rewrite author `.kde3-meta.json` sidecars.

Konqueror and KWrite Save, Rename, Move, Delete, and Copy only mutate browser-session VFS state. They never write repository content. Refreshing recreates the committed baseline. The currently committed example files include `Welcome.md`, `Notes.txt`, and the repository's current `Pictures/*.png` assets; authors should not rely on a fixed image filename.

### Repository Metadata Sidecars

Optional `.kde3-meta.json` files live beside the immediate children they describe. They are generator-only authoring files: they never appear in Konqueror, KFind, Konsole `ls`/`tree`, VFS paths, user-file counts, or generated browser runtime data. Other `.kde3-*` files remain ignored.

```json
{
  "entries": {
    "Post.md": {
      "id": "vfs-content-my-post",
      "created": "2026-09-13T10:00:00.000Z",
      "modified": "2026-09-13T12:00:00.000Z",
      "order": 10
    }
  }
}
```

The preferred current sidecar representation omits the top-level `version` field. An omitted version is permanently pinned to historical v6 semantics; it does not mean the latest supported schema. Explicit `version: 6` remains accepted and is semantically equivalent, while explicit versions 1 through 5 retain their historical meanings. Future breaking schemas must use a new explicit version number.

Metadata v1 remains readable with only optional `id`, `modified`, and `order`; it rejects `created`, `displayName`, and `publication`. Metadata v2 adds optional `created` and remains strict. Metadata v3 adds optional `displayName`, so its entry fields are `id`, `created`, `modified`, `order`, and `displayName`; v3 also rejects `publication`. Metadata v4 adds optional `publication` on supported text files only. Metadata v5 retains those entry fields and adds authored publication `slug`. Metadata v6 adds authored `publication.aliases` and remains supported as an explicit compatibility form; the preferred unversioned current format uses these effective v6 semantics. IDs must be globally unique and match `vfs-content-` plus a non-empty `[A-Za-z0-9._-]+` suffix. Both timestamps are canonical UTC `YYYY-MM-DDTHH:mm:ss.sssZ`: `created` maps only to VFS `createdAt` and `modified` maps only to VFS `modifiedAt`. Either omitted field uses the fixed deterministic repository baseline timestamp. `order` is a safe integer and orders raw repository siblings before unordered entries; ties and unordered entries use code-point lexical filename order. This raw baseline order can affect image previous/next navigation, but does not override a user-selected Konqueror Name/Size/Type/Modified sort.

Metadata is directory-local. A Documents sidecar can name `Post.md` or an immediate `Projects` directory, but not `Projects/Robot.md`; the nested directory owns its own sidecar. Every key must name a current non-ignored immediate child. Malformed JSON, unknown fields or versions, bad IDs/timestamps/orders, stale keys, and duplicate IDs fail generation without replacing the last valid manifest or reloading Vite. Fixing, adding, changing, or deleting a sidecar is watched just like content and recovers with the next successful full reload.

Metadata is optional. Without it, ordinary files retain path-derived IDs, lexical raw ordering, and the project epoch timestamp. During `npm run dev`, a supported file with no entry is initialized in a new unversioned sidecar whose effective semantics are v6, with no explicit `id` or `order`; creation uses the best available local filesystem birth time, then mtime, then the authoring clock, while a real byte change captures mtime or the clock fallback for `modified`. Those filesystem values are capture inputs only: once committed, sidecar values are portable across clones and builds. Existing v1-v5 sidecars remain readable and are not bulk-upgraded by read-only generation. A deleted v6-baseline immediate child removes its entire stale entry, including publication aliases, while legacy explicit metadata retains its established stale-entry diagnostic. To preserve an identity across a repository rename, rename the file and its metadata key together while retaining the same explicit ID. Runtime VFS Rename/Move already preserves in-memory node IDs, but never writes sidecars. The `/home/user` sidecar may target platform mounts (`Desktop`, `Documents`, `Downloads`, `Music`, or `Pictures`) only with `created` and `modified`; `id` and `order` remain prohibited. Do not use Git metadata, frontmatter, or a metadata editor.

Current stable metadata writes omit `version`, including writes that update an existing explicit-v6 sidecar. Existing explicit v1-v5 authoring retains its historical writer behavior; a legacy v1 write may continue its established upgrade to v2 rather than silently becoming unversioned v6.

Directory `modified` is persisted repository-content activity history, not POSIX inode mtime. A real supported-file add, byte edit, deletion, rename, or move updates its parent and repository ancestors in the same reconciliation; `Documents/Projects/Post.md` therefore updates `Projects` and `Documents`. Deleting a child does not revert its directory to the project epoch, the maximum remaining child `modified`, or a previous value: the deletion itself is the latest activity. A touch with identical bytes and a metadata-only sidecar edit do not count as activity. The root `.kde3-meta.json` may set only `created` and `modified` for platform mount directories; their stable IDs and order remain platform-owned.

### Manual Timestamp Testing Cleanup

Manual testing below `content/home/user/**` is real repository authoring activity. Creating `Phase569Test.md` updates `Documents.modified`; deleting it updates `Documents.modified` again because the deletion is newer activity. The temporary file being gone does not automatically roll the root sidecar back, and that is correct production behavior.

Before a manual timestamp test, record whether `content/home/user/.kde3-meta.json` exists and back up its exact contents if it does. Back up every parent sidecar the test is expected to change. After testing, stop or release the dev authoring watcher, remove temporary content, restore the saved parent/root sidecars, and remove a root sidecar created only by the test when none existed before. Then run the normal read-only manifest generation lifecycle and restart development if needed. This is test-environment rollback, never a production timestamp rule.

For the common clean baseline case, if no root sidecar existed before the test and it now contains `{ "Documents": { "modified": "<test activity time>" } }`, stop the watcher, remove `content/home/user/.kde3-meta.json`, and regenerate read-only. `/home/user/Documents` then falls back to `PROJECT_EPOCH_TIMESTAMP`, `2026-08-30T12:00:00.000Z`, which renders as `2026-08-30 20:00` in the current UTC+8 environment; other timezones retain the existing local rendering behavior.

Metadata v1 deliberately has no `displayName`; display labels require an explicit v3 sidecar entry.

### Repository Presentation Labels

Metadata v3 can add an optional plain-text `displayName` without changing the filename, canonical VFS path, node ID, MIME, size, or timestamps. It rejects empty, padded, line-break, NUL, and other control-character labels; Unicode and duplicate labels are valid. For example:

```json
{
  "version": 3,
  "entries": {
    "open-robot-studio.md": {
      "displayName": "Open Robot Studio"
    }
  }
}
```

Konqueror, KWrite document/recent presentation, and KFind result labels may show `Open Robot Studio`, while Location, Shell `ls`, KWrite Save As, Desktop Rename, KFind filename matching/path, relative links, Rename input, and filesystem operations remain `open-robot-studio.md`. KFind continues sorting and matching by canonical name. The current Desktop only has code-owned special launchers, not repository-backed Desktop file icons. There is no display-name path alias, frontmatter/title extraction, or metadata editor. Changing only `displayName` is metadata-only: it does not update file or directory activity timestamps, and timestamp authoring preserves v3 sidecars and their labels. A physical repository rename requires moving the sidecar key; an explicit ID and the display label may remain unchanged.

### Desktop i18n development rules

- Add user-facing shell text to the typed English message schema first, then provide the corresponding `zh-CN` and `de` entries. Use `useI18n().t(...)` at render boundaries rather than translating command IDs, VFS names, or authored content.
- Read the applied locale from `DesktopPreferences`; do not introduce a separate locale store or localStorage key. Control Center language edits remain draft-only until Apply, while Reset and Defaults continue to affect only the current draft.
- Keep interpolation named and explicit. Tests should cover locale normalization, English fallback, interpolation, persistence compatibility, live `document.documentElement.lang`, and no-remount switching where a component consumes the provider.
- Preserve brand names and canonical filesystem strings. CJK support relies on the shared system fallback font stack; do not add downloaded font assets for a translation-only change.

### Repository Publication Metadata

Use v4 when a supported `.txt`, `.md`, `.markdown`, `.html`, or `.htm` file needs publication intent without a public route. Use v5 only when that same file needs an authored permalink slug. Do not bulk-upgrade existing sidecars, and do not attach publication metadata to directories, platform mounts, or image assets.

```json
{
  "version": 4,
  "entries": {
    "article.md": {
      "displayName": "Open Robot Studio",
      "publication": {
        "status": "published",
        "publishedAt": "2026-09-13T12:00:00.000Z",
        "summary": "Development notes for the Open Robot Studio project.",
        "tags": ["KDE 3", "Web", "React"]
      }
    },
    "future.md": {
      "publication": {
        "status": "draft",
        "summary": "Work in progress.",
        "tags": ["Draft"]
      }
    }
  }
}
```

`publication` is closed to `status`, `slug`, `publishedAt`, `summary`, and `tags` in v5; v4 rejects `slug`. `status` is exactly `draft` or `published`; published v5 entries require both `slug` and `publishedAt`, while drafts may reserve an optional slug and must omit `publishedAt`. A slug is exact lowercase ASCII `^[a-z0-9]+(?:-[a-z0-9]+)*$`, is neither trimmed nor normalized, and is globally unique across all v5 authored publications, including drafts. Summaries and tags are non-empty, unpadded, single-line plain text; tags retain authored order and exact duplicates are rejected without case normalization. `publishedAt` is explicit intent and is never inferred from `created` or `modified`, never auto-updated on a byte edit, and may precede either timestamp. Publication-only sidecar edits, including slug changes, are metadata-only and do not advance file or directory activity. Runtime rename, move, Trash, Restore, and edit preserve publication; Copy and KWrite Save As create new logical identities without it. The code-owned singleton Blog launcher consumes the resulting catalog automatically: it displays the catalog title, published time, optional plain-text summary, and authored tags, then launches the multi-instance Article Reader with only the stable `nodeId`. A slugged entry is a native `#/blog/<slug>` link; normal activation updates that hash and launches once, while modifier activation keeps ordinary anchor behavior. The Desktop-level route controller parses only this exact hash form, resolves it through the current catalog, and launches a new Reader by node ID on initial load or browser history navigation. Invalid, stale, draft, or Trash routes do nothing. The Reader derives the current catalog entry and live VFS text body on every state update, so Trash, draft/unpublished metadata, or deletion produces an unavailable state while Restore or re-publication can recover the same window. It presents the canonical source path separately from the publication title and offers the same permalink only when the live entry has a slug. It shares Konqueror's safe Markdown/HTML parser, sanitizer, relative VFS resource resolver, and image-source boundary; internal document links launch normal canonical Konqueror opening, while safe HTTPS links retain the existing external-web behavior. Drafts remain visible to filesystem apps but are absent from Blog. There is no pathname routing, slug generation, alias/redirect, pagination, clickable tags, archive, RSS, or Reader history. Future publishing titles use `displayName ?? name`.

Blog and Article Reader are the publishing UIs currently exposed. Later feeds, tag filtering/pages, pagination, archive, RSS, and sitemap work must consume the pure `buildPublishedContentCatalog(vfsState)` selector instead of reimplementing VFS traversal or metadata rules. It derives live published text files under `/home/user`, excludes drafts, unmanaged files, non-Home special trees, and Trash descendants, and projects only stable node identity, canonical path/name, `displayName ?? name`, optional slug, `publishedAt`, optional summary, and ordered tags. Catalog order is always `publishedAt` descending, canonical path ascending, then node ID ascending; VFS sibling `order`, title, and `modifiedAt` do not affect it. The catalog is not stored or persisted, so normal VFS rename/move/trash/restore and metadata reloads naturally produce the current projection.

## Konqueror Document Resources

Markdown and local HTML previews resolve a relative reference from the current document's VFS parent directory. This is a virtual path rule, not a path on the developer's filesystem. For example, `/home/user/Documents/Post.md` can use `![Photo](../Pictures/photo.png)` and `[Notes](Notes.txt)`; `/home/user/Documents/Projects/2026/Post.md` can use `../../../Pictures/photo.png`. Absolute VFS references such as `/home/user/Pictures/photo.png` are also supported.

Internal file, directory, and image links use the same current-tab Konqueror navigation path as a Location Bar submission. Image references render only for current VFS image assets; missing paths, text files, and HTTPS image sources remain visible placeholders rather than browser requests. Explicit HTML5 `<video>` and `<audio>` blocks are the only embedded media surface in local HTML, Markdown, and Article Reader bodies: their `src`, `<source src>`, and video `poster` references use this same source-relative resolver and may resolve to VFS `asset-url` files or HTTPS URLs. Ordinary Markdown media links and bare URLs remain links/text. The sanitizer keeps native `controls` and safe playback attributes, removes autoplay/event-handler attributes, preserves fallback text, and adds no custom playback or codec layer. Local HTML stays sanitized: scripts, event handlers, iframes, and dangerous URI schemes are not executable. HTTPS document links retain the existing embedded external-web behavior, while `javascript:`, `data:`, `file:`, empty, and query-bearing VFS references are non-actionable. Heading fragments, query-string VFS semantics, CSS resources, and remote-image fetching remain deferred.

## Touch Interaction Development Contract

Use Pointer Events for shell drag, resize, marquee, and touch interaction boundaries. Keep `layoutMode` (`desktop`/`mobile`) independent from `event.pointerType` (`mouse`/`touch`/`pen`); never infer touch from a user agent. Pointer-captured interactions must release on `pointerup`, `pointercancel`, lost capture, and unmount.

Use `useLongPress` from `src/input/pointerInteraction.ts` for shell long press. Its centralized delay is `500ms` and its movement tolerance is `8` browser client pixels. A second pointer cancels the pending gesture, and a fired gesture consumes the follow-up click/context-menu event. Do not add app-internal long press to Konqueror rows, KWrite, KFind, Konsole, KCalc, Bookmark Editor, or Blog in this foundation phase.

Touch controls layer on existing click/action paths. Kicker Start, Pager, and Clock remain ordinary controls; K Menu tap opens submenus and activates leaves, while nested mobile submenus expose a localized Back row and retain native vertical scrolling. Desktop icons select on the first touch and open on the second; shell background/icon long press calls the existing context-menu model. Outside K Menu pointer dismissal uses capture-phase prevention to avoid click-through.

Mobile visible windows keep Close enabled and block newly requested Minimize and Maximize/Restore actions at the caption, system-menu, and reducer boundaries. Existing minimized state is preserved across entry into mobile mode. Desktop-layout touch titlebar drag and resize reuse the existing logical geometry and capture path; mobile enforced-maximized windows remain immovable and non-resizable. Keep browser pinch zoom available: do not add `user-scalable=no`, `maximum-scale=1`, or global `touch-action: none`.

Konqueror Phase 5.130 consumes the shared `layoutMode` rather than introducing an application breakpoint or a second mobile implementation. In mobile mode its persistent menubar is hidden, and its toolbar resolves only the stable `Up`, `Back`, `Forward`, `Home`, `Reload`, `Stop`, and New Konqueror Window actions with a flexible spacer; the Location Bar and tabs retain their separate tracks. Details owns its internal horizontal scroll while retaining all columns, and Icon View fits its existing items to the available width. The existing Tree hierarchy, navigation dispatcher, context-menu model, dialogs, Properties, Bookmark Editor, sysinfo/about, image/text viewers, and audio/video Player remain the semantic authorities; mobile changes are scoped to overflow, wrapping, stacking, and touch presentation.

Konqueror resource touch input uses the existing stable node IDs and callbacks: first tap selects, second tap on the selected node opens, a different node only replaces selection, and a stationary long press opens the existing item or background context menu. Movement cancels activation and consumes the follow-up click. Touch and pen input must not enter the mouse marquee or item-drag state machines; desktop mouse hit targets and behavior remain unchanged. The persistent Konqueror Bookmarks menubar is hidden on mobile, while its desktop model, shortcuts, and data remain intact; the separate mobile K Menu Bookmarks entry remains disabled. Other applications retain their internal desktop layout in this phase; only their persistent menubar presentation follows the shared policy.
## Markdown Publication Authoring

  Markdown publication articles may carry portable metadata at byte zero:

```markdown
  ---
  title: "Phase 5.81 Qt"
  publication:
    status: published
    slug: phase-5-81-qt
    publishedAt: "2026-09-16T07:00:00.000Z"
    summary: "Tests case-sensitive Qt tag routing."
    tags:
      - Qt
  ---

  # Phase 5.81 Qt

  ...
```

  The existing publication rules remain authoritative: title changes do not regenerate a slug; published requires an explicit valid slug and UTC publishedAt; draft may reserve a slug but must not set publishedAt; summary and ordered tags are plain text, and tag case/order are preserved. created and modified remain VFS metadata in .kde3-meta.json; they are not publication dates.

  Articles without publication front matter continue to use legacy sidecar metadata. If both sources exist, the complete publication objects and effective title must agree; there is no field-by-field source merge. Invalid or conflicting front matter is a build error. The normal generator, npm run build, and development reconciler never rewrite either source.

  To move legacy Markdown publication entries, run the read-only audit first:

```sh
  npm run migrate:publication-frontmatter
  npm run migrate:publication-frontmatter -- --write
```

  The second command is explicit write mode. It only runs after the complete plan has no blockers, preserves article body/line endings/unrelated YAML and generic sidecar fields, and removes only legacy displayName and publication fields. The migration is designed to be idempotent.
