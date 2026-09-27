# Licensing Policy

This is the authoritative repository licensing policy for die Nische. It
records the approved Phase 5.139 F1 matrix. It does not grant rights in
third-party material, ignored local references, or historical product names
and marks beyond the scopes stated here.

Repository-level attribution uses:

Copyright (c) 2026 die Nische contributors

No personal or legal name is inferred from Git, account, environment, or
machine metadata.

## Approved License Matrix

| Material | License or policy | Scope |
| --- | --- | --- |
| Original die Nische software | MIT | Original production source, tests, scripts, project configuration, and build/configuration code authored for die Nische |
| Original technical documentation | CC-BY-4.0 | README, architecture/development/VFS/shell/visual documentation, whitepapers, history, provenance, licensing, and dependency inventory |
| Bundled authored prose and seed documents | All Rights Reserved by default | Welcome.md, Notes.txt, and future Blog/ARG prose unless an individual work explicitly states another license |
| Nische archway source artwork | CC-BY-4.0 | src/branding/assets/nische-archway-01.svg, nische-archway-02.svg, and nische-archway-03.svg |
| Nische archway runtime derivatives | CC-BY-4.0 | Corresponding content/home/user/Pictures/nische-archway-*.png files |
| Die Nische name and project mark | Copyright reserved | public/branding/die-nische-mark.svg and project brand identity; excluded from MIT and CC-BY-4.0 grants |
| Third-party dependencies | Upstream licenses | npm packages and any future third-party components; die Nische does not relicense them |

Canonical license texts are stored in LICENSES/. The top-level LICENSE is the
primary MIT grant for original software. The package.json MIT field describes
the original software/package portion only and does not make the whole
repository MIT.

## Software Scope: MIT

MIT applies to original die Nische software, including:

- src/ source, TSX, TypeScript, JavaScript, and CSS, except the separately
  licensed nische archway SVG artwork listed below.
- Tests and test helpers authored for the project.
- scripts/ and build or development tooling authored for the project.
- Project configuration such as Vite and TypeScript configuration.
- Other original executable or configuration material where its role is
  software rather than documentation, content, or artwork.

The exception is explicit: src/branding/assets/nische-archway-*.svg is
original artwork under CC-BY-4.0, not MIT software. The project mark under
public/branding/die-nische-mark.svg is reserved and is not covered by the
software grant.

## Technical Documentation: CC-BY-4.0

Original technical and project documentation is licensed under CC-BY-4.0 with
attribution to die Nische contributors. This includes, where the content is
original project material:

- README.md
- docs/architecture.md
- docs/development.md
- docs/visual-specification.md
- docs/phase-0-whitepaper.md
- docs/provenance-audit.md
- docs/dependency-license-inventory.md
- docs/licensing.md
- LEGAL.md
- Other authored technical, design, or provenance documentation in docs/

Quoted third-party material, copied notices, canonical license texts, and
ignored local reference screenshots retain their own status and are not
relicensed by this documentation policy.

The preferred attribution for the licensed project documentation is:

"die Nische contributors"

## Bundled Content: All Rights Reserved

The following authored seed prose remains All Rights Reserved unless an
individual work explicitly states another license:

- content/home/user/Documents/Welcome.md
- content/home/user/Documents/Notes.txt
- Future bundled Blog articles and other editorial prose.

The software license and CC-BY-4.0 documentation/artwork license do not apply
to these content files merely because they are stored in the repository or
served by the VFS. No license metadata is added to the VFS files in this
phase.

## Future Blog and ARG Policy

Future Blog content is All Rights Reserved by default unless a specific
article explicitly declares a different license. Future ARG content is also
All Rights Reserved by default, including story, dialogue, puzzle text,
narrative assets, artwork, music, and sound.

Markdown front matter publication metadata does not grant a license. This
phase does not add a front-matter license field and does not implement ARG
content.

## Nische Archway Artwork: CC-BY-4.0

The following source artwork is original die Nische artwork created during
Phase 5.138, with no external source:

- src/branding/assets/nische-archway-01.svg
- src/branding/assets/nische-archway-02.svg
- src/branding/assets/nische-archway-03.svg

Attribution: die Nische contributors. License: CC-BY-4.0.

The following PNG files are derived runtime representations of the
corresponding SVG sources and use the same CC-BY-4.0 license. They are not
independently sourced artwork:

- content/home/user/Pictures/nische-archway-01.png
- content/home/user/Pictures/nische-archway-02.png
- content/home/user/Pictures/nische-archway-03.png

The source and PNG files were not regenerated or modified in Phase 5.139 F1.

## Die Nische Name and Project Mark

The die Nische name and project identity are reserved. The canonical mark is:

- public/branding/die-nische-mark.svg

Copyright (c) 2026 die Nische contributors. All Rights Reserved.

The name and mark are explicitly excluded from the MIT software grant and the
CC-BY-4.0 documentation/artwork grant unless separately permitted. No
software or documentation license grants trademark, branding, endorsement,
or name rights. This policy makes no trademark-registration claim and does
not add a TM or registered-trademark symbol.

Historical KDE application identities and names are not die Nische property.
The project is independent and is not affiliated with, endorsed by,
sponsored by, or otherwise associated with KDE e.V. or the KDE Community.

## VFS Metadata

The .kde3-meta.json files primarily encode technical VFS metadata such as
stable IDs, timestamps, sizes, and content classifications. They are not
treated as a separate artistic or prose license category.

Where copyright applies, project-generated technical metadata is treated under
the software framework. This statement does not claim copyright over facts,
timestamps, file sizes, or other uncopyrightable data. The metadata files are
not modified by this licensing phase.

## Generated Output and References

The generated VFS manifest, dist/, coverage/, and derived bundles do not
receive an independent license merely because they are generated. Their
contents remain governed by the source materials and applicable third-party
terms from which they derive. Generated output is not committed by this
phase.

The files under docs/references/ are ignored local-only screenshots. They are
not part of the repository runtime, build, or release and are not assigned a
project license here.

## Third-Party Components

npm dependencies retain their upstream licenses. The project does not
relicense, replace, or merge those terms into the MIT grant. Package-level
evidence, versions, metadata sources, optional platform packages, peer edges,
and bounded anomalies are recorded in:

- docs/dependency-license-inventory.md
- THIRD_PARTY_NOTICES.md

The exact canonical license texts retained for current runtime or direct
dependency evidence are in:

- LICENSES/MIT.txt
- LICENSES/CC-BY-4.0.txt
- LICENSES/ISC.txt
- LICENSES/Apache-2.0.txt

Those generic texts do not replace package-specific copyright notices or
upstream attribution obligations.

## License and Attribution Files

- LICENSE: primary MIT grant for original software.
- LEGAL.md: canonical project identity and non-affiliation notice, classified
  as original technical/project documentation under CC-BY-4.0.
- LICENSES/: canonical reusable license texts relevant to this repository's
  approved software, documentation/artwork, and audited dependency scope.
- THIRD_PARTY_NOTICES.md: package-level dependency and historical-reference
  notice record; it does not relicense third-party material.
- docs/ASSET_PROVENANCE.md: maintainable provenance register for project mark,
  archway artwork, removed unknown badges, and ignored references.

All Rights Reserved is a scope policy, not a separate license file. It is
recorded here, in README.md, and in the asset provenance register where
needed.

## SPDX / REUSE Status

This phase intentionally does not add hundreds of per-file SPDX headers or
introduce REUSE metadata. The centralized policy and path-specific exceptions
are authoritative for the current repository. A future REUSE/SPDX enhancement
may be added only after its path semantics are reviewed against source,
content, artwork, generated output, and third-party boundaries.

## Legal Identity

The canonical project identity, non-affiliation, historical KDE 3 inspiration,
recreated-application, virtual-filesystem, and narrow trademark wording are
recorded in LEGAL.md. This identity notice is separate from the license grants
and third-party dependency terms documented above.
