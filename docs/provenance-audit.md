# Phase 5.138 - Provenance Remediation & Independent Branding Assets

> **Working audit only.** This document records repository evidence for engineering follow-up. It is not a final legal notice, a final software license, or a complete third-party license inventory. No final license choice is made here.

## A. Baseline

- HEAD: `ab0f3f2 Phase 5.137 — Repository provenance and license audit`
- Branch: `master`
- Starting worktree: clean; no staged files and no untracked files.
- `git diff -- content`: empty.
- Phase 5.137 F3's Welcome metadata repair is part of the current HEAD baseline; Phase 5.138 starts with `git diff -- content` empty.

## B. Audit Method

The audit used the tracked file list, ignored-file rules, source and documentation searches, Git history and blame, binary type/size/hash inspection, `package.json`, `package-lock.json`, and locally installed package manifests. Visual resemblance is not treated as provenance or license evidence. Package-declared license fields are recorded as dependency metadata, not as a compatibility decision for die Nische.

Evidence labels used below:

- **CONFIRMED**: directly established by a repository file or history record.
- **STRONG EVIDENCE**: multiple local signals support the conclusion, but it is not a legal authorship determination.
- **PARTIAL / NEEDS VERIFICATION**: useful evidence exists, but an upstream or author record is missing.
- **UNKNOWN**: the repository does not establish the fact.

No external license research was used to convert an unknown into a license conclusion.

## Timestamp Baseline Triage and Repair (Phase 5.137 F1-F3)

The smallest pre-repair reproduction was:

`npm run test:run -- src/vfs/initialState.test.ts src/vfs/repositoryContentGenerator.test.ts`

It reproduced exactly two deterministic failures:

| File / assertion | Expected by test | Actual generated value | Source |
| --- | --- | --- | --- |
| `src/vfs/initialState.test.ts:139`, `mounts canonical repository-owned Welcome Markdown and Notes text files into the existing Documents directory` | `modifiedAt: 2026-09-26T14:19:27.801Z` | `modifiedAt: 2026-08-30T12:00:00.000Z` | `content/home/user/Documents/.kde3-meta.json` `Welcome.md.modified` |
| `src/vfs/repositoryContentGenerator.test.ts:797`, `includes canonical Welcome Markdown and Notes source files without fixing the global content count` | `modified: 2026-09-26T14:19:27.801Z` | `modified: 2026-08-30T12:00:00.000Z` | Same Welcome file sidecar entry |

F2 reviewed the timestamp-authoring reconciler and its complete test suite. Existing byte-change tests require a changed file's `modified` timestamp to update while preserving `created`, and require the parent activity timestamp to update separately. The F1 test-only correction therefore matched stale committed metadata rather than the established authoring semantics.

F3 applies the accepted historical repair. The resulting authoritative metadata is:

- `content/home/user/Documents/Welcome.md`: the die Nische Markdown text.
- `content/home/user/Documents/.kde3-meta.json`: `Welcome.md.created` remains `2026-08-30T12:00:00.000Z`; `Welcome.md.modified` is repaired to `2026-09-26T14:19:27.801Z`.
- `content/home/user/.kde3-meta.json`: `Documents.modified` is `2026-09-26T14:19:27.876Z`; this is the parent directory activity timestamp, not the Welcome file timestamp.
- Before F1, the parent directory activity value was `2026-09-25T16:08:54.473Z`; the Welcome file sidecar timestamp remained the project epoch.
- Current worktree content is byte-equivalent to HEAD; `git diff -- content` is empty.

The generator takes the file value from `childMetadata.modified` at `scripts/generate-vfs-content-manifest.mjs:467`, falling back to `repositoryContentDefaultTimestamp` at line 18. `src/vfs/repositoryContentSeed.ts:141-142` copies the generated entry to `createdAt`/`modifiedAt`. The repaired `.801Z` value is the best available contemporaneous authoring timestamp evidence: it appears in the Phase 5.136 F1 report and both test expectations committed in `3dce143`, and precedes the committed parent activity value `.876Z` by 75 ms. Git does not independently prove the original physical `mtime`.

**Root cause classification: CASE B - COMMITTED CONTENT METADATA ERROR.** The file sidecar required one historical metadata correction; no production reconciler change was required.

## Audit Summary

- Confirmed directly ported KDE/Qt source: **none**.
- Confirmed vendored third-party source: **none**.
- True unresolved tracked runtime asset provenance: the three badge PNGs only.
- Bundled fonts, audio, video, and wallpaper: **none**.
- Local-only reference material: the two ignored files under `docs/references/`.
- Dependency license metadata gaps: **yes**, as a compliance inventory gap, not a provenance unknown.
- Pending license-policy decisions: **yes**, intentionally deferred.

## C. Repository Inventory

| Area | Actual inventory | Finding |
| --- | --- | --- |
| `src/` | 865 tracked paths, including tests | **STRONG EVIDENCE** of the main first-party implementation tree |
| `scripts/` | 9 tracked paths | **STRONG EVIDENCE** of project-owned VFS/build tooling |
| `content/` | 12 tracked paths: sidecars, two text documents, and three PNG files | Bundled repository seed content; content provenance is audited separately below |
| `docs/` | 7 tracked documents | Project engineering/design/policy documentation |
| `public/` | No directory present | No public asset tree found |
| root/config | `README.md`, `index.html`, `package.json`, `package-lock.json`, TypeScript/Vite/ESLint config | Project configuration and identity material |
| generated/build | `dist/`, `coverage/`, `node_modules/`, and `src/generated/vfsContentManifest.generated.ts` are ignored | Build/install/generated artifacts, not tracked release source |

Tracked source has no vendored `vendor/`, `third_party/`, `external/`, or standalone `lib/` tree. No separate `tests/` tree is present; tests are colocated under `src/`.

Asset inventory from the repository and source search:

- Tracked binary visual assets: the three independent `content/home/user/Pictures/nische-archway-*.png` samples.
- Tracked SVG sources: `public/branding/die-nische-mark.svg` plus three auditable sample-artwork sources under `src/branding/assets/`. Eight other source files explicitly contain inline `<svg>` elements; those are reviewed below as functional UI geometry rather than imported assets.
- Bundled font files: none (`ttf`, `otf`, `woff`, `woff2`, `eot` all absent outside installs/build output).
- Tracked audio, video, wallpaper, splash, favicon, GIF, JPEG, WebP, and ICO assets: none.
- Production base64/data image assets: none found. Data URLs occur in tests that exercise rejection or controlled preview behavior; the generator explicitly rejects/does not emit embedded base64 assets.
- The two ignored local reference images under `docs/references/` are not tracked and are not release assets. They are recorded under Local Reference Material.

## D. Original die Nische Code

**Classification: STRONG EVIDENCE, license unspecified.**

The desktop shell, window manager, Kicker, Control Center, Konqueror, Konsole, KWrite, KCalc, KFind, Blog/search/publishing, VFS/content tooling, responsive/mobile behavior, and tests are represented by a long incremental sequence of phase commits beginning at `b5d217e Initial commit`. Searches found no copyright or SPDX headers, copied-source comments, KDE/Qt source paths, upstream C++ blocks, `ported from`, `copied from`, or `adapted from` markers in production source and scripts.

This supports repository-authored implementation, but does not prove every line was independently authored or select a license. Product and application names such as KDE and Konqueror are behavior/design references, not evidence of source-code copying.

The source boundary is therefore:

- **NO DIRECT THIRD-PARTY SOURCE DERIVATION EVIDENCE FOUND** in the repository for the desktop/window manager, application implementations, VFS/scripts, responsive/mobile work, or localization consumers.
- **UNKNOWN** for authorship of any individual unannotated line where Git history alone cannot establish it.
- No source-code license is selected in this phase.

## E. Potential Third-Party / Ported Code

No imported third-party source tree, minified standalone library, vendor directory, or preserved upstream source path was found. The project deliberately recreates KDE 3 concepts and labels, but local evidence does not establish direct code derivation from KDE, Qt, React95, Windows93, OS.js, 98.js, Stack Overflow, CodePen, or another web-desktop project.

The absence of an attribution marker is not proof that no external snippet exists. A future author-level review remains appropriate before a final release license is published.

## F. KDE-Derived Asset Findings

The eight source files that explicitly contain inline `<svg>` are classified as follows. These are source families, not imported SVG asset files.

| Source family | Current use | Classification | Evidence / follow-up |
| --- | --- | --- |
| `src/apps/konqueror/KonquerorMediaControls.tsx` | Play, pause, previous, next, speaker | A. Generic UI geometry | Inline JSX paths; no upstream source marker. No provenance unknown retained. |
| `src/apps/konqueror/icons.tsx` | Konqueror navigation, toolbar, file-operation icons | C. Mixed/uncertain family | Many generic task glyphs with no individual source records; keep for Phase 5.138 review, but no direct-copy evidence. |
| `src/desktop/DesktopWindowLayer.test.tsx` | Test-only titlebar icon markup assertions | A. Test fixture | Not a distributed runtime asset. |
| `src/icons/IconComponents.tsx` | Trash, Home, Konqueror, Konsole, KCalc, KWrite, Calendar, K Menu and shell icons | A/B. Generic functional geometry and independently reconstructed historical UI identities | Project JSX geometry; Git history identifies incremental project commits, with no external source, URL, header, or asset import. Historical names and shell identity are retained; no project-brand dependency. **CLOSED — independent project geometry.** |
| `src/kicker/DigitalClock/DigitalClock.tsx` | Seven-segment clock face and separators | A. Generic UI geometry | Project JSX geometry; no upstream source marker. |
| `src/kicker/k-menu/KMenuIcon.tsx` | K Menu category icons | A/B. Generic category geometry for historical K Menu presentation | Project JSX paths introduced in the K Menu phases; no KDE logo, mascot, Crystal file, external source, or project-mark reference. **CLOSED — independent category geometry.** |
| `src/window-manager/WindowControls.tsx` | Minimize/maximize/close caption glyphs | A. Generic UI geometry | Simple caption primitives; no upstream source marker. |
| `src/window-manager/window-menu/WindowMenuIcon.tsx` | Minimize/maximize/close/desktop-grid system glyphs | A. Generic UI geometry | Simple system-menu primitives; no upstream source marker. |

The Crystal/Crystal SVG special case was also checked: no tracked Crystal SVG files, Crystal asset directory, upstream URL, or source attribution was found. Whether any visual reference was used is **UNKNOWN**, but no confirmed Crystal asset is currently inventoried.

No dedicated official KDE logo or binary KDE artwork was found in tracked assets. This is an inventory result, not a trademark/legal conclusion.

`docs/licensing.md` already states that unclear KDE resources must not enter a release package, but that policy is not provenance proof for the three PNGs.

## G. Other Third-Party Assets

No other bundled third-party visual, audio, video, wallpaper, splash, favicon, or stock asset was confirmed. The ignored screenshots below may be historical KDE reference material, but their source and redistribution status are **UNKNOWN** and they are excluded by `.gitignore`.

## H. Fonts

No font files are bundled. CSS uses system stacks such as the project KDE font token, `Courier New`, `Liberation Mono`, `Georgia`, `Times New Roman`, and generic families. This is **CONFIRMED** from the tracked file inventory and CSS search. System-installed fonts are outside the repository and are not assigned a project license here.

## I. Translations

The UI dictionaries are `src/i18n/messages/en.ts`, `zh-CN.ts`, and `de.ts` (2,972 lines total). No `.po`, `.pot`, `.mo`, KDE translation import path, or bulk upstream translation attribution was found. Git history records their project addition in `2d654a7 Phase 5.120 + Phase 5.120 F1`.

Classification: **STRONG EVIDENCE** of project-authored typed locale dictionaries; exact authorship of every sentence is not independently proven, and no translation license is selected. Common UI vocabulary shared with KDE is not treated as copied text without source evidence.

## J. Documentation

`docs/architecture.md`, `development.md`, `licensing.md`, `phase-0-whitepaper.md`, `shell.md`, `vfs.md`, and `visual-specification.md` are project engineering, design, history, and policy documents. No copied KDE documentation, external attribution block, or source URL for their prose was found. Classification: **STRONG EVIDENCE** project-authored documentation; not a license grant.

`docs/licensing.md` is an existing asset policy. It requires source/author/license/attribution records for new assets and prohibits unclear KDE resources from release packaging. It does not choose MIT, GPL, LGPL, Apache, or another die Nische license.

## K. Bundled Content

| Content | Evidence | Classification |
| --- | --- | --- |
| `content/home/user/Documents/Welcome.md` | Current die Nische welcome text; migrated from `Welcome.txt` in Phase 5.136 F1; SHA-256 `ff63954f3917d46dda166af072a4c6364f043319e5172d5d3c29d14bfea799da` | **STRONG EVIDENCE** project-authored seed content; content license unspecified |
| `content/home/user/Documents/Notes.txt` | Project sample document; SHA-256 `17096b70384c7a6ff422f937abfb801ef3177e70a76b05283b79e93220dc3b16` | **STRONG EVIDENCE** project-authored seed content; content license unspecified |
| `content/home/user/Pictures/nische-archway-01.png`, `nische-archway-02.png`, `nische-archway-03.png` | Tracked and generated into the runtime VFS as ordinary Pictures assets; listable in Konqueror and openable through the existing PNG image path/viewer. | **CONFIRMED original die Nische project artwork**, derived from the three local SVG sources under `src/branding/assets/`; no external source used; final content license remains unspecified. |
| Blog/ARG/user publication content | No current Blog article asset was found in tracked `content/` | No bundled content identified in this category |

The three replacement PNGs are 1000x1000 generated raster derivatives. The old unknown files were removed from runtime distribution; their historical hashes remain only in the remediation record below.

## L. npm Dependencies

The project is private and declares only registry-style semver dependencies. No Git, file, or vendored dependency is declared. The following are the installed package versions and license fields found in local package manifests; ranges come from `package.json`.

### Direct production dependencies

| Package | Declared range | Installed | Declared license |
| --- | --- | --- | --- |
| `react` | `^19.1.0` | `19.2.8` | MIT |
| `react-dom` | `^19.1.0` | `19.2.8` | MIT |
| `yaml` | `^2.9.1` | `2.9.1` | ISC |

### Direct development dependencies

| Package | Declared range | Installed | Declared license |
| --- | --- | --- | --- |
| `@eslint/js` | `^9.32.0` | `9.39.5` | MIT |
| `@types/node` | `^24.1.0` | `24.13.3` | MIT |
| `@types/react` | `^19.1.0` | `19.2.18` | MIT |
| `@types/react-dom` | `^19.1.0` | `19.2.4` | MIT |
| `@vitejs/plugin-react` | `^5.0.0` | `5.2.0` | MIT |
| `eslint` | `^9.32.0` | `9.39.5` | MIT |
| `eslint-plugin-react-hooks` | `^5.2.0` | `5.2.0` | MIT |
| `eslint-plugin-react-refresh` | `^0.4.20` | `0.4.26` | MIT |
| `jsdom` | `^30.0.1` | `30.0.1` | MIT |
| `typescript` | `^5.9.0` | `5.9.3` | Apache-2.0 |
| `typescript-eslint` | `^8.38.0` | `8.65.0` | MIT |
| `vite` | `^7.0.0` | `7.3.6` | MIT |
| `vitest` | `^3.2.0` | `3.2.7` | MIT |

The lockfile has 296 `node_modules/` entries. A rough local scan of package manifests reported these declared-license counts: MIT 195, Apache-2.0 17, ISC 14, BSD-2-Clause 8, BSD-3-Clause 3, BlueOak-1.0.0 4, MIT-0 2, CC-BY-4.0 1, CC0-1.0 1, and Python-2.0 1. Twenty package manifests in that scan had no license field. A second comparison against installed metadata found 50 lockfile/subpath or optional-platform entries without directly readable license metadata. These are scan limitations and likely include package subpaths and platform artifacts; they are not a completed transitive license inventory and require a dedicated follow-up before release.

No compatibility conclusion is made for any dependency license in this phase.

## M. Existing License / Attribution Material

The repository contains no tracked root `LICENSE*`, `COPYING*`, `NOTICE*`, `AUTHORS`, `COPYRIGHT`, `THIRD_PARTY_NOTICES`, `LICENSES/`, or SPDX header set. `docs/licensing.md` is the only existing licensing/asset-policy document. `README.md` identifies die Nische as an independent KDE 3-inspired project and states that it is not affiliated with, endorsed by, sponsored by, or otherwise associated with KDE e.V. or the KDE Community; this is identity/disclaimer material, not a software license.

## N. Unknown Provenance Register

| ID | Exact item | Tracked/distributed | Current use | Origin/license evidence | First addition / hash | Priority / next action |
| --- | --- | --- | --- | --- | --- | --- |
| PROV-001 | Historical `badge_katie.png`, `badge_konqi.png`, `badge_kori.png` | Removed from tracked/runtime distribution in Phase 5.138 | Replaced bundled Pictures samples; no old path is referenced by production code or persistence | Source/license could not be established; no license was guessed. | `10bfbf5`; old hashes recorded in the remediation record below | **RESOLVED BY REPLACEMENT** with original die Nische artwork |

This register contains material origin questions only. It does not contain licensing policy decisions, dependency metadata gaps, local references, or generic residual risk.

## Local Reference Material

| Path | Git/build/runtime/deployment status | Evidence and relationship |
| --- | --- | --- |
| `docs/references/KDE_3.0n.jpeg` | Untracked, ignored, not imported by source, not emitted by the current build, not part of the runtime VFS | Local visual reference. JPEG comment identifies an XV tool/version, but not the image author or redistribution permission. No derivative relationship to a tracked asset was established. |
| `docs/references/Kde_3_3_screengrab.png` | Untracked, ignored, not imported by source, not emitted by the current build, not part of the runtime VFS | Local visual reference only. No Git history, author, license, or derivative relationship was found. |

These files are not described as redistributed project assets. They must remain outside a release archive unless their source and permission are separately established.

## Dependency License Inventory Gaps (Phase 5.138 Baseline)

| ID | Scope | Why incomplete | Production shipment status | Next action |
| --- | --- | --- | --- | --- |
| DEP-LIC-001 | Transitive lockfile packages, especially optional platform artifacts and package subpaths | At the Phase 5.138 baseline, the scan was not a package-by-package lockfile report | Direct production dependencies are browser inputs; the missing optional/platform entries were not established as browser-shipped code | Superseded by the exact Phase 5.139 inventory and anomaly register below |

This is a dependency license/compliance inventory gap, not an unknown origin of project source or assets. No compatibility decision was made.

## Pending Licensing Decisions

| ID | Decision | Status |
| --- | --- | --- |
| LICDEC-001 | License for original die Nische software source | Intentionally not selected; defer to Phase 5.139 |
| LICDEC-002 | Policy/license treatment for bundled seed content and images | Intentionally not selected; keep separate from software licensing |

These are deliberate policy decisions, not provenance unknowns.

## Code-Derivation Review

| ID | Concrete candidate | Reason for review | Evidence so far |
| --- | --- | --- | --- |
| CODE-REVIEW-001 | `src/icons/IconComponents.tsx` shell/application icon family; `src/kicker/k-menu/KMenuIcon.tsx` K Menu category family | Distinguish functional/historical UI geometry from project branding and recognizable unverified assets | Separate source audit found project-authored JSX geometry, incremental history, and no upstream source/URL/header or external asset import. The formerly K-shaped `KMenuIcon` path was replaced with independent menu/app-grid geometry; the independent project mark is not used as a replacement for historical UI icons. **RESOLVED — independent generic/reconstructed geometry; concrete replacement completed where required.** |

No vague unidentified source-snippet placeholder remains. No concrete copied-source candidate was found in the source audit.

## O. Remediation Queue

### P0

- None established by this audit. This is not a release approval.

### P1

- Keep the local reference screenshots out of release archives unless their source/permission is established.

### P2

- Review the exact optional-platform and missing-license-file anomalies recorded by Phase 5.139 before any dependency bundle redistribution.

### P3

- Resolve `LICDEC-001` and `LICDEC-002` after provenance remediation.

## P. die Nische Branding Asset Status

The canonical independent die Nische mark is `public/branding/die-nische-mark.svg`; `index.html` references it through `%BASE_URL%branding/die-nische-mark.svg` as the favicon, and the project-level About window uses the same runtime URL. The mark is original geometric alcove/recess artwork, contains no localized text variant, and is not derived from KDE, Crystal, Konqueror, or a mascot. K Menu and shell icons remain historical UI artwork and are not presented as the project mark.

## Q. Content / Software Boundary

The TypeScript/TSX source, scripts, and configuration are software. `content/` contains runtime VFS seed documents, metadata sidecars, and user-facing sample images. Documentation and translations are separate authored materials. A future software license decision must not silently be treated as a content or image license; each boundary needs its own evidence and decision.

## R. Phase 5.138 Remediation Record

### PROV-001 reference audit

The old paths were bundled sample content, not stable compatibility identifiers. `rg` found them only in the previous Pictures sidecar, the generated-initial-state ID assertions, and this audit; no production resolver, route, persisted user setting, or application contract used the raw names. Their old path-derived IDs were:

- `badge_katie.png` -> `vfs-content-e97383f9377cf52db78efa8a`
- `badge_konqi.png` -> `vfs-content-cdc0a5f80f28e133d4b7ab87`
- `badge_kori.png` -> `vfs-content-b3799f6348b3e373b294396d`

They were removed rather than preserved as compatibility aliases because the filenames exposed the unresolved KDE-character provenance problem. The three intentional replacement paths have new path-derived IDs:

- `nische-archway-01.png` -> `vfs-content-dbc47b8602c48a237b93b7f3`
- `nische-archway-02.png` -> `vfs-content-d46f415f60a19c2171c00db3`
- `nische-archway-03.png` -> `vfs-content-04495288b28825854d06111e`

No persisted product contract depends on the old sample IDs.

### Old badge disposition

| Old path | Status | Replacement | Runtime result |
| --- | --- | --- | --- |
| `content/home/user/Pictures/badge_katie.png` | Removed; hash `0902f54c7dee681702c3278a0bf7759bebdcc0d5beef37320b529d7ffac2ee5b` | `nische-archway-01.png` | No old path is generated or visible |
| `content/home/user/Pictures/badge_konqi.png` | Removed; hash `e05c995d66eb18324202c0db171328e36d06e2b8507a63f636cb465a096ff60a` | `nische-archway-02.png` | No old path is generated or visible |
| `content/home/user/Pictures/badge_kori.png` | Removed; hash `678683d8d2a3055a45beebd41b430c2b09feb1a39bc8347358b4e71ccb658eaf` | `nische-archway-03.png` | No old path is generated or visible |

### New sample artwork

The SVG files under `src/branding/assets/` are hand-authored geometric compositions. ImageMagick generated 1000x1000 PNG derivatives for the existing PNG-only repository VFS/image-viewer boundary. No external source, download, stock pack, KDE asset, Crystal asset, mascot, or screenshot was used. These are original die Nische project artwork; their final content license policy remains pending Phase 5.139.

### CODE-REVIEW-001 detailed result

| Component family | Usage | Classification | Git/source evidence | Action / status |
| --- | --- | --- | --- | --- |
| `TrashIcon`, `FullTrashIcon`, `DiscIcon`, `FloppyIcon`, `HomeIcon`, `HomeOpenIcon`, `MyComputerIcon`, `ShowDesktopIcon`, `PanelSettingsIcon`, `TrayLockIcon`, `TrayNetworkIcon`, `ClipboardIcon`, `EndSessionIcon`, `StarIcon`, `GearIcon` | Generic shell, device, status, and command glyphs | Generic functional geometry | Local JSX paths; no external asset import or source marker | Retained; **CLOSED — independent generic geometry** |
| `KonquerorIcon`, `KonquerorOpenIcon`, `KonsoleIcon`, `KCalcIcon`, `KWriteIcon`, `CalendarIcon` | Historical application/window identity | Independently reconstructed historical-style geometry | Introduced through project commits including `3b08b94`, `293ca94`, and `3c0c321`; no upstream source/URL/header | Retained to preserve application identity; **CLOSED — independent project geometry** |
| `KMenuIcon` in `src/icons/IconComponents.tsx` | Historical K Menu launcher identity | Independent functional launcher geometry, not project branding | Phase 5.138 replaces the former K-shaped path with a hand-authored menu/app grid; no KDE logo asset, Crystal source, or project-mark reference | Retained with independent geometry; **RESOLVED — original replacement** |
| `KMenuSettingsIcon`, `KMenuUtilitiesIcon`, `KMenuControlCenterIcon`, `KMenuFindFilesIcon`, `KMenuHelpIcon`, `KMenuLogoutIcon`, `KMenuQuickBrowserIcon` | K Menu category/application affordances | Generic category geometry | Introduced in `83e61c4`/K Menu phases; no external import or recognizable mascot/logo path | Retained; **CLOSED — independent category geometry** |

The formerly K-shaped `KMenuIcon` path was replaced with independent menu/app-grid geometry. The project mark is deliberately a separate public SVG and is not substituted into historical KDE-style controls or application icons.

## S. Independent Project Brand

- Canonical source: `public/branding/die-nische-mark.svg`.
- Design: nested architectural recess/alcove geometry with a small warm doorway; no principal `K`, gear, mascot, KDE logo, Crystal tracing, or localized text.
- Favicon: `index.html` uses `%BASE_URL%branding/die-nische-mark.svg`, so the same source remains correct under a Vite base path.
- Project integration: only the existing project-level `about-kde` About presentation displays the mark. `about-konqueror` and other historical application About windows remain separate.
- Accessibility: the adjacent visible project name is authoritative; the decorative mark uses empty `alt` and `aria-hidden="true"`.
- Provenance: original die Nische project artwork, hand-authored SVG, no external source used; license policy pending Phase 5.139.

## T. Content Metadata and VFS Boundary

The replacement sidecar was authored by the existing two-pass timestamp reconciler, not by manually invented timestamps. The current `Pictures/.kde3-meta.json` remains unversioned and records the three new PNG entries with `created`/`modified` `2026-09-26T16:25:23.646Z`; the parent `Pictures` activity entry is `2026-09-26T16:25:23.711Z`. Existing file/image semantics are unchanged: PNG MIME, original byte size, external Vite `?url&no-inline` asset URLs, and the existing Konqueror image viewer.

No VFS MIME, image-viewer, audio, video, metadata schema, or content-generation implementation was expanded. SVG is source material only because the current VFS generator and image viewer do not support SVG repository files.

## U. Evidence Appendix

- Phase baseline: `ab0f3f2`, `master`, clean before remediation.
- Old PNG first addition: `10bfbf5`; old hashes and disposition are recorded above; no source/license evidence existed.
- New source assets: `src/branding/assets/nische-archway-01.svg`, `nische-archway-02.svg`, and `nische-archway-03.svg`.
- Canonical project mark: `public/branding/die-nische-mark.svg`.
- Existing policy at the Phase 5.138 baseline: `docs/licensing.md`; no final software or content license had yet been selected.
- Ignored references remain excluded by `.gitignore`: `docs/references/KDE_3.0n.jpeg` and `docs/references/Kde_3_3_screengrab.png`.
- Git history for code artwork: `IconComponents.tsx` and `KMenuIcon.tsx` are incremental project files; the relevant K Menu icon differentiation commit is `83e61c4`. No external asset-provenance URL, KDE source URL, Qt source reference, copyright header, SPDX header, or copied-source marker was found.

## V. Verification

- Focused `npm run test:run -- src/branding/projectIdentity.test.ts src/application-runtime/ApplicationHost.test.tsx src/vfs/initialState.test.ts src/apps/konqueror/imagePreviewModel.test.ts src/icons/IconComponents.test.tsx src/kicker/k-menu/KMenu.dom.test.tsx`: **PASS**, 6 files / 49 tests.
- `npm run test:run`: **PASS**, 375 test files / 2,512 tests.
- `npm run lint`: **PASS**, with the one existing `react-hooks/exhaustive-deps` warning in `src/apps/konqueror/KonquerorMediaView.tsx:62` (`mediaViewState.muted` and `mediaViewState.volume`).
- `npm run typecheck`: **PASS**.
- `npm run build`: **PASS**; 575 modules transformed and the three small PNG derivatives emitted. The existing post-minification 1,146.70 kB JavaScript chunk advisory remains non-blocking.
- `git diff --check`: **PASS**.
- `git diff -- content`: **PASS, expected Pictures-only replacement diff**: three old unknown PNG deletions, three new independent PNG additions, the Pictures child sidecar replacement, and the Pictures parent activity timestamp. No Welcome, Blog, or unrelated content metadata change.

## W. Files Changed

Phase 5.138 changes are limited to the independent mark/favicon/About integration, replacement Pictures artwork and its legitimate sidecars, focused tests, and this provenance audit. No package configuration, generated manifest, `dist/`, translations, VFS behavior, or unrelated application logic is changed. The ignored generated manifest and `dist/` were regenerated only by validation and are not tracked.

## X. Scope and Pending Decisions

- **PROV-001: RESOLVED BY REPLACEMENT.** Unknown old runtime assets are no longer distributed; no license was guessed.
- **CODE-REVIEW-001: RESOLVED.** Reviewed icon families are generic or independently reconstructed project UI geometry; no concrete unverified imported artwork remains in the reviewed files.
- **DEP-LIC-001: OPEN AT THE PHASE 5.138 BASELINE.** Phase 5.139 closes the broad inventory gap and records bounded follow-ups below.
- **LICDEC-001: OPEN AT THE PHASE 5.138 BASELINE.** No final software license had yet been selected.
- **LICDEC-002: OPEN AT THE PHASE 5.138 BASELINE.** No final content/image license had yet been selected.
- At the Phase 5.138 baseline, no `LICENSE`, `LEGAL.md`, `THIRD_PARTY_NOTICES.md`, or final asset-provenance legal notice had been created.
- No generated VFS manifest or ignored reference image is distributed.

## Y. Worktree

At the end of Phase 5.138, no commit was created and the worktree intentionally contained only the Phase 5.138 implementation, tests, independent assets, legitimate Pictures metadata changes, and that audit document; the pre-existing Phase 5.137 Welcome repair remained in HEAD.

## Phase 5.139 Licensing Gate Update

This section supersedes the Phase 5.138 dependency-inventory status while
preserving the historical audit above.

### Inventory Result

- Baseline: commit `fc68d4df33b04ad43f0f64b67a845be7742f381c`, branch `master`.
- The worktree was clean at audit start; `git diff -- content` was empty.
- `package-lock.json` contains 296 `node_modules/` paths and 294 unique
  package/version pairs after duplicate-path collapsing.
- The unique closure contains 4 production-capable packages, 290
  development-only packages, and 52 optional packages. No lockfile entry has
  `peer: true`; peer dependency edges declared by 37 installed manifests are
  contextual relationships, not a separate peer-only install class.
- All 16 direct dependencies have local manifest license metadata and a root
  license/copying file. The direct production declarations are `react`,
  `react-dom`, and `yaml`; `scheduler` is the production-capable React
  transitive runtime package.
- Fifty optional dev-only platform entries have no local installed manifest:
  25 `@esbuild/*` entries at 0.28.1, 24 `@rollup/rollup-*` entries at 4.62.3,
  and `fsevents` 2.3.3. The lockfile records MIT for these entries, but local
  package-file evidence is unavailable on this host.
- Thirteen installed dev-only packages declare a license in their local
  manifest but have no root license/copying file; the exact package list and
  license expressions are recorded in
  `docs/dependency-license-inventory.md`.
- No local manifest used `SEE LICENSE IN`, a multiple-license expression, or a
  custom/non-SPDX-looking license string. No installed package had a root
  `NOTICE*` file.

### Status Changes

- `DEP-LIC-001` is **CLOSED as a broad inventory gap**, narrowed to the four
  exact anomalies `DEP-LIC-001-A` through `DEP-LIC-001-D` in the dependency
  inventory. This is not a final redistribution or legal-compliance approval.
- At the decision-gate baseline, `LICDEC-001` was open: no software license
  had been selected.
- At the decision-gate baseline, `LICDEC-002` was open: no bundled
  content/image license policy had been selected.
- At the decision-gate baseline, the dependency inventory did not create a
  `LICENSE`, `LEGAL.md`, `THIRD_PARTY_NOTICES.md`, `LICENSES/`, `REUSE.toml`,
  SPDX headers, or an asset-provenance legal notice.
- At the decision-gate baseline, `package.json` had no `license` field.

The full direct and transitive evidence, metadata source paths, package roles,
homepage/repository fields, root license-file scan, and future verification
actions are maintained in `docs/dependency-license-inventory.md`.

## Phase 5.139 F1 Licensing Implementation

The approved licensing matrix is now implemented without source, asset,
content, or dependency-version changes.

- `PROV-001`: **RESOLVED** by the Phase 5.138 asset replacement.
- `CODE-REVIEW-001`: **RESOLVED** by the independent project geometry review
  and replacement record.
- `DEP-LIC-001`: **CLOSED AS A BROAD GAP**; bounded anomalies
  `DEP-LIC-001-A/B/C/D` remain explicitly recorded follow-ups in
  `docs/dependency-license-inventory.md` and `THIRD_PARTY_NOTICES.md`.
- `LICDEC-001`: **RESOLVED - MIT** for original die Nische software,
  including source, tests, scripts, and project configuration.
- `LICDEC-002`: **RESOLVED - approved matrix**: original technical
  documentation and nische archway artwork use CC-BY-4.0; bundled authored
  prose, future Blog/ARG content, and the die Nische name/project mark remain
  reserved as documented.

The top-level `LICENSE`, `LICENSES/`, `THIRD_PARTY_NOTICES.md`,
`docs/ASSET_PROVENANCE.md`, `package.json` MIT metadata, and README summary
are the implementation records. No `LEGAL.md` was created; broader legal and
trademark wording remains deferred to Phase 5.140.
