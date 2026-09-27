# Third-Party Notices

This record identifies third-party software used by or to build die Nische.
It does not transfer ownership, relicense upstream material, or make the
project's MIT license apply to third-party components. Package versions and
local evidence are maintained in docs/dependency-license-inventory.md.

## Runtime Dependencies

The production-capable lockfile closure is limited to the following four
package/version pairs:

| Package | Version | License | Upstream package/repository | Local notice evidence | License text location |
| --- | --- | --- | --- | --- | --- |
| react | 19.2.8 | MIT | https://github.com/react/react.git, packages/react | Local package LICENSE; no local NOTICE file | LICENSES/MIT.txt and package-specific upstream LICENSE |
| react-dom | 19.2.8 | MIT | https://github.com/react/react.git, packages/react-dom | Local package LICENSE; no local NOTICE file | LICENSES/MIT.txt and package-specific upstream LICENSE |
| scheduler | 0.27.0 | MIT | React repository, packages/scheduler | Local package LICENSE; no local NOTICE file | LICENSES/MIT.txt and package-specific upstream LICENSE |
| yaml | 2.9.1 | ISC | https://github.com/eemeli/yaml | Local package LICENSE; no local NOTICE file | LICENSES/ISC.txt and package-specific upstream LICENSE |

React and React DOM are imported by the browser application. YAML is declared
as a production dependency and is used by repository scripts; it is not
imported by src/. Scheduler is the React runtime transitive package in the
production-capable closure.

The local package manifests declare the licenses shown above. Any release
that redistributes package code must retain the package-specific copyright and
license notices from the upstream package, not only the generic text stored in
LICENSES/.

## Development / Build Dependencies

The direct development dependencies are listed here with their resolved local
versions. The complete transitive lockfile path table, optional platform
variants, peer edges, manifest sources, and license-file scan are maintained in
docs/dependency-license-inventory.md.

| Package | Version | License |
| --- | --- | --- |
| @eslint/js | 9.39.5 | MIT |
| @types/node | 24.13.3 | MIT |
| @types/react | 19.2.18 | MIT |
| @types/react-dom | 19.2.4 | MIT |
| @vitejs/plugin-react | 5.2.0 | MIT |
| eslint | 9.39.5 | MIT |
| eslint-plugin-react-hooks | 5.2.0 | MIT |
| eslint-plugin-react-refresh | 0.4.26 | MIT |
| jsdom | 30.0.1 | MIT |
| typescript | 5.9.3 | Apache-2.0 |
| typescript-eslint | 8.65.0 | MIT |
| vite | 7.3.6 | MIT |
| vitest | 3.2.7 | MIT |

The development closure also contains BSD-2-Clause, BSD-3-Clause,
BlueOak-1.0.0, MIT-0, Python-2.0, CC-BY-4.0, CC0-1.0, and ISC package
metadata. These package-level terms remain upstream terms. Development
dependencies and node_modules are not bundled into the browser runtime by the
repository build; the inventory still records them for source/build
reproducibility.

## Dependency Inventory Notes

- package-lock.json contains 296 node_modules paths and 294 unique
  package/version pairs.
- Four unique pairs are production-capable, 290 are development-only, and 52
  are optional.
- No lockfile record has peer: true. Peer dependency declarations remain
  contextual edges in 37 installed manifests and are not separate installed
  packages.
- DEP-LIC-001-A: 25 optional dev-only @esbuild platform entries at 0.28.1
  have lockfile MIT fields but no local manifest/license file on this host.
- DEP-LIC-001-B: 24 optional dev-only @rollup platform entries at 4.62.3
  have lockfile MIT fields but no local manifest/license file on this host.
- DEP-LIC-001-C: optional dev-only fsevents 2.3.3 has a lockfile MIT field
  but no local manifest/license file on this non-macOS host.
- DEP-LIC-001-D: 13 installed development packages have manifest license
  fields but no root license/copying file; the exact names and expressions are
  listed in the inventory.

These four bounded anomalies do not establish an unlicensed project source or
a browser-runtime license conflict. Verify upstream package archives before a
future release distributes an install tree or dependency bundle.

## Third-Party Assets

Phase 5.138 removed the old badge_katie.png, badge_konqi.png, and
badge_kori.png runtime assets because their provenance could not be
established. They are not redistributed and are not present in the current
runtime content.

The files under docs/references/ are ignored, untracked local visual
references. They are not imported by source, emitted by the build, included in
the VFS, or part of a repository release. They are not project-licensed
assets.

The current bundled nische archway artwork is original die Nische artwork and
is documented separately in docs/ASSET_PROVENANCE.md under CC-BY-4.0. It is
not third-party material.

## Historical Product / Trademark References

The project references or reconstructs historical application identities such
as KDE, Konqueror, Konsole, KWrite, KCalc, and KFind. Those names and any
historical marks are not owned or relicensed by die Nische through this notice
or through the project MIT/CC-BY-4.0 grants. The repository's non-affiliation
statement remains in README.md; the current project identity, non-affiliation,
and trademark context is maintained in LEGAL.md.
