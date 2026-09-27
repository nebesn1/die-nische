# die Nische — Release Legal & Provenance Audit

## 1. Audit Scope

This audit verifies the committed repository at `98b8355` against the
approved Phase 5.139 / 5.139 F1 licensing matrix and Phase 5.140 legal-identity
policy, then records the Phase 5.141 F1 identity-separation remediation. It
covers repository provenance, licensing boundaries, bundled and runtime assets,
dependency evidence, generated build output, in-app notices, localization
parity, and source/deployment boundaries.

This is a legal/provenance release-readiness gate. It is not a claim that the
overall product is feature-complete, stable, or generally production-ready.
No external legal or web research was used. Existing historical audit sections
are treated as historical records rather than current policy.

## 2. Release Baseline

- HEAD: `98b8355 Phase 5.140 — Legal Identity & In-App Notices`
- Branch: `master`
- Initial Phase 5.141 baseline worktree: clean; no staged, unstaged, or
  untracked files.
- Tracked files: 921.
- `git diff -- content`: empty.
- F1 changes are limited to About identity routing/presentations, related
  tests/localization, architecture documentation, the stale notice wording,
  and this audit document. `content/`, `public/`, package metadata,
  dependencies, and assets remain unchanged.

## 3. Project Identity

The current policy is consistent on the primary identity:

- Project: `die Nische`
- Description: A KDE 3-inspired web desktop.
- Status: independent / unofficial.
- KDE relationship: historical/design inspiration only; no affiliation,
  endorsement, sponsorship, or other association with KDE e.V. or the KDE
  Community.
- Recreated applications: browser-based or historical-interface recreations,
  not the original KDE applications.
- VFS: browser-based virtual/simulated filesystem, not the user's real
  operating-system filesystem unless a feature explicitly says otherwise.

`index.html`, `package.json`, README, `LEGAL.md`, project identity constants,
and the in-app identity strings use this boundary. The favicon and project
About use `public/branding/die-nische-mark.svg`.

## 4. Licensing Matrix Verification

The locked matrix is reflected by README, `LEGAL.md`, `docs/licensing.md`, the
About Licenses panel, and the asset register:

| Material | Treatment |
| --- | --- |
| Original production source, tests, scripts, and project/build configuration | MIT |
| Original technical/project documentation | CC-BY-4.0 |
| `Welcome.md`, `Notes.txt`, and future Blog/ARG authored content | All Rights Reserved by default |
| `nische-archway-*.svg` and corresponding PNG derivatives | CC-BY-4.0 |
| `die Nische` name and project mark | Reserved; excluded from MIT and CC-BY grants |
| Third-party dependencies and notices | Respective upstream licenses |

No current document claims that the entire repository is MIT. VFS metadata is
treated as narrow technical metadata under the documented software framework;
that treatment does not claim rights over facts such as timestamps or sizes.

## 5. Legal / Non-Affiliation Verification

`LEGAL.md` contains the required independent/unofficial, non-affiliation,
non-endorsement, non-sponsorship, recreation, and simulated-filesystem
notices. The approved trademark statement is limited to:

> KDE® and the K Desktop Environment® logo are registered trademarks of KDE e.V.

No current claim was found that Konqueror, Konsole, KWrite, KCalc, or KFind is
a registered trademark. The project mark has no unsupported registration claim.

## 6. Asset Provenance Verification

The tracked release assets are:

- `public/branding/die-nische-mark.svg`: original project mark, reserved.
- `src/branding/assets/nische-archway-01.svg` through `03.svg`: original
  project artwork, CC-BY-4.0.
- `content/home/user/Pictures/nische-archway-01.png` through `03.png`:
  corresponding runtime PNG derivatives, CC-BY-4.0.

The names, source/derivative relationship, and license classifications match
`docs/ASSET_PROVENANCE.md` and `docs/licensing.md`. No tracked fonts, audio,
video, wallpaper, JPEG, GIF, WebP, ICO, or unknown public asset exists.

The historical `badge_katie.png`, `badge_konqi.png`, and `badge_kori.png`
files are absent from the tracked tree, source references, content sidecars,
and build output. The two KDE reference screenshots under `docs/references/`
are ignored, untracked local references and are absent from the source release,
public directory, VFS, and build output.

## 7. Dependency License Verification

`package.json`, `package-lock.json`, and
`docs/dependency-license-inventory.md` agree on the current lockfile:

- 296 `node_modules` paths.
- 294 unique package/version pairs.
- 4 production-capable pairs.
- 290 development-only pairs.
- 52 optional pairs.
- 0 `peer: true` lock entries.
- 50 optional, development-only platform entries without a local installed
  manifest on this host.

The three direct production declarations are React, React DOM, and YAML;
Scheduler is the React runtime transitive package. The browser bundle imports
React/React DOM. YAML is used by repository scripts and is not imported by
`src/`. Build/test tooling is development-only.

## 8. Source Release Boundary

The effective source release set is `git ls-files` and contains:

- MIT-covered original software, tests, scripts, and configuration;
- CC-BY-4.0 technical/project documentation, including this audit;
- canonical license texts in `LICENSES/`, which retain their own terms;
- third-party notices and package metadata, which do not relicense upstream
  packages;
- reserved authored seed content (`Welcome.md`, `Notes.txt`);
- CC-BY-4.0 archway artwork and its runtime derivatives;
- the reserved die Nische name and project mark;
- technical VFS metadata and repository content inputs.

Ignored `dist/`, `coverage/`, `node_modules/`, generated VFS output, and local
reference material are not source-release inputs. No obvious credential-like,
temporary, phase-acceptance, or generated file is tracked.

## 9. Static Deployment Boundary

The static deployment contains the generated HTML, JS, CSS, favicon/project
mark, and emitted archway PNG runtime assets. Root Markdown legal documents
are not assumed to be served as deployment routes; the legal identity and
license matrix are available in the bundled About Legal/Licenses UI. Build
output contains no old badge, ignored screenshot, or temporary audit fixture.

The production build emitted only `index.html`, one JS bundle, one CSS bundle,
the die Nische mark, and the three archway PNGs. The JS bundle has no
standalone `@license` or `@preserve` comment. Repository-level
`THIRD_PARTY_NOTICES.md` and `LICENSES/` remain the designed source/notice
mechanism; no Vite configuration change was made.

## 10. Build Output Audit

`npm run build` passed with 576 modules transformed. The output was:

- `dist/index.html`
- `dist/branding/die-nische-mark.svg`
- `dist/assets/index-*.js`
- `dist/assets/index-*.css`
- the three `dist/assets/nische-archway-*.png` files

The existing Vite advisory for a JavaScript chunk larger than 500 kB remains
non-blocking. `dist/` remains ignored and untracked.

## 11. Localization / In-App Notice Audit

The en, `zh-CN`, and de legal strings preserve the required meaning for
independence, unofficial status, non-affiliation, non-endorsement,
non-sponsorship, historical recreation, simulated VFS, MIT, CC BY 4.0,
reserved content/mark, and upstream licenses. Product identifiers remain
untranslated where required.

The current in-app project About implementation exposes Overview, Legal, and
Licenses views under the separate `about-die-nische` identity. Historical
`about-kde` exposes KDE 3 context without the project mark or project tabs. The
Konqueror start page contains the subtle browser-based recreation notice.
`sysinfo:/` reports `die Nische` and `KDE 3-inspired browser desktop`; K Menu
uses `KDE 3`; Control Center reports KDE version `3` and environment
`die Nische`.

The responsive implementation has a scrollable project About surface and no
new legal-specific desktop/mobile layout authority.

## 12. Findings

| ID | CATEGORY | INITIAL SEVERITY | EVIDENCE | IMPACT | F1 STATUS / REMEDIATION | BLOCKS CURRENT RELEASE? |
| --- | --- | --- | --- | --- | --- | --- |
| REL-UI-001 | About identity separation | BLOCKER | Initial audit: `about-kde` rendered the project mark and Overview/Legal/Licenses. F1 now registers `about-kde` as historical KDE context and adds `about-die-nische` for the project surface. | The initial user-visible identity conflation was material; the current two identities are distinct. | RESOLVED. `about-kde` ID is preserved; project About uses `about-die-nische`; registry, K Menu, render, coexistence, and localization tests cover the split. | NO |
| REL-DOC-001 | Third-party notice document freshness | MEDIUM | Initial audit: `THIRD_PARTY_NOTICES.md:99-106` deferred broader wording to Phase 5.140. F1 now references current identity/non-affiliation/trademark context in `LEGAL.md`. | The stale sentence is removed without changing dependency notices or policy. | RESOLVED. Only the stale deferral language changed. | NO |
| DEP-LIC-001-A/B/C/D | Dependency evidence follow-ups | INFO | The current inventory names 50 optional/dev-only platform paths without local manifests and 13 dev-only packages without a root license/copying file. | These are bounded development/install-tree evidence limitations, not unresolved production-browser license gaps. | BOUNDED INFO FOLLOW-UP. Verify from reproducible package archives before distributing an install tree or dependency bundle. | NO |

No unknown tracked/runtime asset, old badge, ignored screenshot, unresolved
production dependency-license gap, unsupported application-name trademark
claim, or project-license scope contradiction was found. The initial About
separation blocker and stale notice finding are resolved by F1.

## 13. Release Gate

Initial gate result (Phase 5.141 before F1): `RELEASE GATE: FAIL`.

Current gate result after F1: `RELEASE GATE: PASS`. `REL-UI-001` and
`REL-DOC-001` are resolved; the repository remains cleanly licensed and
provenance-audited, and the bounded dependency evidence items remain
non-blocking follow-ups.

This result is legal/provenance release readiness only; it does not certify or
reject overall product completeness.

## 14. Follow-Up Items

1. `REL-UI-001` is resolved without renaming `about-kde` or changing the
   established project legal wording.
2. `REL-DOC-001` is resolved by replacing only the stale Phase 5.140 deferral
   with the current `LEGAL.md` reference.
3. Verify `DEP-LIC-001-A/B/C/D` from reproducible package archives before any
   release distributes an install tree or dependency bundle.
4. Do not infer a release
   label such as v1.0, beta, stable, or production-ready from this document.

## F1 Remediation and Re-audit

- Historical Git review found no separate pre-existing project About identity;
  the old `about-kde` presentation was a generic KDE 3 Web Desktop shell. F1
  therefore introduced the narrowly justified stable `about-die-nische` ID.
- `about-kde` remains the historical singleton and no longer renders the
  project mark, Overview, Legal, or Licenses tabs.
- `about-die-nische` is a separate singleton rendering the existing Phase
  5.140 project mark, Overview, Legal, and Licenses content.
- Existing visible `About KDE` callers remain historical. The K Menu now also
  exposes localized `About die Nische`; it is excluded from Most Used so the
  existing usage projection is unchanged.
- `THIRD_PARTY_NOTICES.md` now points to `LEGAL.md` for current identity,
  non-affiliation, and trademark context.
- No content, asset, package, dependency, timestamp, or sidecar change was
  made.

## Audit Verification Record

Focused F1 identity/routing suites:

- 12 test files passed.
- 192 tests passed.

Canonical verification:

- `npm run test:run`: 378 test files passed; 2524 tests passed.
- `npm run lint`: passed; one pre-existing warning at
  `src/apps/konqueror/KonquerorMediaView.tsx:62` for missing
  `mediaViewState.muted` and `mediaViewState.volume` dependencies.
- `npm run typecheck`: passed.
- `npm run build`: passed; 576 modules transformed; existing >500 kB advisory.
- `git diff --check`: passed.
- `git diff -- content`: empty.

The accepted timestamp baseline remains intact: `Welcome.md.created` is
`2026-08-30T12:00:00.000Z`, `Welcome.md.modified` is
`2026-09-26T14:19:27.801Z`, and the Documents parent activity timestamp is
`2026-09-26T14:19:27.876Z`. Current content sidecars remain unversioned; no
sidecar contains a `version` field.

RELEASE GATE: PASS
