# die Nische

A KDE 3-inspired web desktop.

die Nische is an independent web desktop project inspired by the KDE 3 desktop
environment. It is not affiliated with, endorsed by, sponsored by, or
otherwise associated with KDE e.V. or the KDE Community.

The project was originally developed under the working title "KDE 3 Web
Desktop".

See [LEGAL.md](LEGAL.md) for the project's identity, independence, historical
KDE 3 inspiration, recreated-application, and virtual-filesystem notices.

## Licensing

Original die Nische software is licensed under the MIT License. Original
technical documentation and the nische archway sample artwork are licensed
under CC BY 4.0. The die Nische name and project mark, bundled authored
content, future Blog content, and future ARG content are not included in those
grants unless explicitly stated. Third-party components remain under their
respective upstream licenses.

See [LICENSE](LICENSE), [docs/licensing.md](docs/licensing.md),
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md), and
[docs/ASSET_PROVENANCE.md](docs/ASSET_PROVENANCE.md).

## Requirements

Use a current Node.js LTS release and npm compatible with the committed
`package-lock.json`. This package does not declare a project-specific `engines`
field; the current development toolchain is Node.js 24.18.0 with npm 12.0.2.

## Install

From a clean source checkout:

```sh
npm ci
```

## Development

Start the Vite development server with:

```sh
npm run dev
```

Vite prints the local URL it selected (normally `http://localhost:5173`). The
development startup reconciles repository-content timestamps, generates the
VFS manifest, and watches `content/home/user/**` for later authoring changes.

## Tests and Validation

The canonical project checks are:

```sh
npm run test:run
npm run lint
npm run typecheck
npm run build
```

The commands regenerate the ignored VFS manifest as needed. They do not start a
persistent content watcher or rewrite repository metadata sidecars.

## Production Build and Preview

Create the static production output with:

```sh
npm run build
```

The generated site is written to `dist/`. Preview that output locally with:

```sh
npm run preview
```

Vite prints the preview URL and selected port. `dist/` is build output and is
not tracked in the source repository.

## Repository Content Model

`content/home/user/**` is the authoring input for the browser-based virtual
filesystem. The generator scans the filesystem directly, so a file that is
present locally is included in a local development or production build even
when Git ignores its path. A fresh public source checkout therefore receives
only the intentionally distributed seed content, while a private local
checkout may contain additional authored site material.

The current public seed includes `Welcome.md`, `Notes.txt`, the required
`.kde3-meta.json` sidecars, and the three `nische-archway-*.png` sample
artworks. Future local Blog and ARG authoring directories under
`content/home/user/Documents/` are ignored by default so they can remain local
until they are deliberately reviewed for a public source snapshot. Ignoring a
file does not make its contents private: any file included in `dist/` is public
to website visitors. Never deploy passwords, credentials, private notes, or
unpublished sensitive information.

Repository content and developer/application source are separate concepts.
The public source repository contains only intentionally distributed VFS seed
content; it does not promise to contain every local site-authored document.

## Licensing and Legal References

The source-release legal and provenance policy remains in:

- [LICENSE](LICENSE)
- [LEGAL.md](LEGAL.md)
- [docs/licensing.md](docs/licensing.md)
- [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)
- [docs/ASSET_PROVENANCE.md](docs/ASSET_PROVENANCE.md)

This README does not change the scope of any license or the treatment of
project-authored content, the project mark, or third-party material.

## Deployment

The intended public release uses two separate Git repositories:

- **Source repository**: `die-nische`, containing source, tests, scripts,
  documentation, legal files, required assets, and intentionally public seed
  content.
- **Deployment repository**: a separate GitHub Pages repository, suggested as
  `die-nische-site`, containing the contents of `dist/` only.

The deployment repository must not contain `src/`, tests, `node_modules/`, raw
Markdown authoring files, private drafts, or the development repository's
history unless a file is intentionally emitted into `dist/`. Static output is
public website content; the deployment repository is not a secrecy boundary.

The safe initial workflow is local and manual:

1. Keep local authored content in the development checkout and review the
   source snapshot before publishing.
2. Install dependencies, run the validation commands, and build `dist/`.
3. Inspect `dist/` as the public artifact.
4. Copy the contents of `dist/` into a separate sibling deployment checkout.
5. Commit and push that deployment repository separately when it is ready.

For a sibling checkout, the copy operation can be:

```sh
rsync -a --delete --exclude '.git/' dist/ ../die-nische-site/
```

The `.git/` exclusion is mandatory: `--delete` removes stale deployed files,
but must never delete the deployment repository's Git metadata. Keep the
deployment checkout outside this source repository; do not create a nested Git
repository at `die-nische-site/` inside the project.

The initial deployment model is local build -> separate deployment repository
-> GitHub Pages branch publishing from the deployment repository's `main`
branch and repository root. No GitHub repository, Pages setting, push, or
GitHub Actions workflow is configured by this project yet. A source-repository
CI build is intentionally deferred because ignored local authored content
cannot be reproduced by public-source CI without a separate content supply.

### Vite deployment base

The Vite configuration reads `VITE_BASE_PATH` and normalizes it to a leading
and trailing slash. The default is `/`, which supports a root or user/organization
GitHub Pages site. A project-site build can use the final repository path
without changing source code, for example:

```sh
VITE_BASE_PATH=/die-nische-site/ npm run build
```

Do not bake a GitHub username or a temporary repository name into the source
configuration. The final source/deployment repository names and whether the
site is a root site or a project site remain owner decisions for a later phase.

## Public Source History

The complete local development history is not the intended public source
history. Earlier commits contain retired test fixtures and provenance-replaced
assets that are absent from the current source snapshot. If any excluded or
private material has ever been committed, `.gitignore` cannot remove it from
history. The public release should therefore be initialized from a sanitized
current snapshot in a new Git history; this local development repository must
remain intact and must not be rewritten for that purpose.
