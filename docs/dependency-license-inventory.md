# Dependency License Inventory

Audit date: 2026-09-27
Repository: die-nische
Commit baseline: 1c378cae43a19adb7fe76e64ec7928dcf2409811
Branch: master

This is the package evidence inventory supporting the approved Phase 5.139 licensing framework. It is not a third-party notice file, license grant, legal opinion, or release approval. It records package metadata available from the repository lockfile and the installed dependency tree; it does not guess upstream terms where an installed manifest or license text was unavailable.

## Evidence Sources

- Direct dependency declarations: package.json.
- Resolved package paths, versions, dependency flags, and lockfile license fields: package-lock.json (lockfileVersion 3).
- Installed package metadata, homepage, repository, and root license/copying files: local node_modules/**/package.json and package directories at audit time.
- Browser dependency boundary: vite.config.ts, source imports, and the generated Vite build. Build tooling is not assumed to be browser runtime code.
- No network lookup or inferred license substitution was used.

## Direct Dependencies

The following table records every direct dependency declared in package.json. The manifest path and license-file column refer to the local installed package evidence.

| Package | Scope | Declared range | Installed | Manifest license | Metadata source | Root license/copying files | Homepage | Repository |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| react | production | ^19.1.0 | 19.2.8 | MIT | node_modules/react/package.json | LICENSE | https://react.dev/ | https://github.com/react/react.git; directory: packages/react |
| react-dom | production | ^19.1.0 | 19.2.8 | MIT | node_modules/react-dom/package.json | LICENSE | https://react.dev/ | https://github.com/react/react.git; directory: packages/react-dom |
| yaml | production | ^2.9.1 | 2.9.1 | ISC | node_modules/yaml/package.json | LICENSE | https://eemeli.org/yaml/ | github:eemeli/yaml |
| @eslint/js | development | ^9.32.0 | 9.39.5 | MIT | node_modules/@eslint/js/package.json | LICENSE | https://eslint.org | https://github.com/eslint/eslint.git; directory: packages/js |
| @types/node | development | ^24.1.0 | 24.13.3 | MIT | node_modules/@types/node/package.json | LICENSE | https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/node | https://github.com/DefinitelyTyped/DefinitelyTyped.git; directory: types/node |
| @types/react | development | ^19.1.0 | 19.2.18 | MIT | node_modules/@types/react/package.json | LICENSE | https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/react | https://github.com/DefinitelyTyped/DefinitelyTyped.git; directory: types/react |
| @types/react-dom | development | ^19.1.0 | 19.2.4 | MIT | node_modules/@types/react-dom/package.json | LICENSE | https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/react-dom | https://github.com/DefinitelyTyped/DefinitelyTyped.git; directory: types/react-dom |
| @vitejs/plugin-react | development | ^5.0.0 | 5.2.0 | MIT | node_modules/@vitejs/plugin-react/package.json | LICENSE | https://github.com/vitejs/vite-plugin-react/tree/main/packages/plugin-react#readme | git+https://github.com/vitejs/vite-plugin-react.git; directory: packages/plugin-react |
| eslint | development | ^9.32.0 | 9.39.5 | MIT | node_modules/eslint/package.json | LICENSE | https://eslint.org | eslint/eslint |
| eslint-plugin-react-hooks | development | ^5.2.0 | 5.2.0 | MIT | node_modules/eslint-plugin-react-hooks/package.json | LICENSE | https://react.dev/ | https://github.com/facebook/react.git; directory: packages/eslint-plugin-react-hooks |
| eslint-plugin-react-refresh | development | ^0.4.20 | 0.4.26 | MIT | node_modules/eslint-plugin-react-refresh/package.json | LICENSE | - | github:ArnaudBarre/eslint-plugin-react-refresh |
| jsdom | development | ^30.0.1 | 30.0.1 | MIT | node_modules/jsdom/package.json | LICENSE.txt | - | git+https://github.com/jsdom/jsdom.git |
| typescript | development | ^5.9.0 | 5.9.3 | Apache-2.0 | node_modules/typescript/package.json | LICENSE.txt | https://www.typescriptlang.org/ | https://github.com/microsoft/TypeScript.git |
| typescript-eslint | development | ^8.38.0 | 8.65.0 | MIT | node_modules/typescript-eslint/package.json | LICENSE | https://typescript-eslint.io/packages/typescript-eslint | https://github.com/typescript-eslint/typescript-eslint.git; directory: packages/typescript-eslint |
| vite | development | ^7.0.0 | 7.3.6 | MIT | node_modules/vite/package.json | LICENSE.md | https://vite.dev | git+https://github.com/vitejs/vite.git; directory: packages/vite |
| vitest | development | ^3.2.0 | 3.2.7 | MIT | node_modules/vitest/package.json | LICENSE.md | https://github.com/vitest-dev/vitest#readme | git+https://github.com/vitest-dev/vitest.git; directory: packages/vitest |

All 16 direct packages had a readable local manifest license and at least one root license/copying file at audit time. The three direct production declarations are React, React DOM, and YAML. YAML is used by repository scripts rather than imported by the browser source; it remains a production-capable package because it is declared under dependencies. React and React DOM are browser runtime inputs. Development declarations are tools, types, lint plugins, test infrastructure, and Vite build tooling.

## Lockfile Closure Summary

The lockfile contains 296 node_modules paths, representing 294 unique package/version pairs after collapsing duplicate paths. The roles below are based on lockfile flags and do not replace the path-level table.

| Classification | Count | Meaning |
| --- | ---: | --- |
| Production-capable unique package/version pairs | 4 | dev is false; includes the transitive React runtime package scheduler |
| Development-only unique package/version pairs | 290 | dev is true; not browser runtime evidence |
| Optional unique package/version pairs | 52 | Optional dependency variants; all missing local manifests are dev-only platform variants |
| Peer-only lock entries | 0 | Lockfile records with peer: true; peer edges still exist in manifests and are not a separate package license class |
| Entries without a local installed manifest | 50 | Optional platform packages absent from this host install |

There are 37 installed manifests with peer dependency declarations, including React DOM, Vite, plugin packages, ESLint plugins, and test packages. These are peer edges, not additional peer-only installed package records. The relevant packages are already included in the lockfile table with their own evidence.

### Local Manifest License Expression Counts

For unique package/version pairs with a local manifest, the exact manifest license values were counted without normalizing or silently rewriting them. The missing local manifest entries are kept separate from manifest values.

| Manifest/license evidence | Unique pairs |
| --- | ---: |
| MIT | 195 |
| missing local manifest | 50 |
| Apache-2.0 | 17 |
| ISC | 14 |
| BSD-2-Clause | 8 |
| BSD-3-Clause | 3 |
| BlueOak-1.0.0 | 2 |
| MIT-0 | 2 |
| Python-2.0 | 1 |
| CC-BY-4.0 | 1 |
| CC0-1.0 | 1 |

No local manifest used SEE LICENSE IN. No local manifest used a multiple-license expression containing OR, AND, +, or WITH. No custom/non-SPDX-looking expression was observed in the exact local manifest strings. These observations are inventory facts, not a compatibility decision.

## Missing Local Manifest Evidence

All 50 entries without a local package.json are optional, dev-only platform packages. The lockfile still declares MIT for these entries, but the corresponding package manifest and root license file were not present in this host installed tree. This is a bounded evidence limitation, not an unexplained transitive gap.

- **@esbuild platform packages**: 25 entries (@esbuild/aix-ppc64, @esbuild/android-arm, @esbuild/android-arm64, @esbuild/android-x64, @esbuild/darwin-arm64, @esbuild/darwin-x64, @esbuild/freebsd-arm64, @esbuild/freebsd-x64, @esbuild/linux-arm, @esbuild/linux-arm64, @esbuild/linux-ia32, @esbuild/linux-loong64, @esbuild/linux-mips64el, @esbuild/linux-ppc64, @esbuild/linux-riscv64, @esbuild/linux-s390x, @esbuild/netbsd-arm64, @esbuild/netbsd-x64, @esbuild/openbsd-arm64, @esbuild/openbsd-x64, @esbuild/openharmony-arm64, @esbuild/sunos-x64, @esbuild/win32-arm64, @esbuild/win32-ia32, @esbuild/win32-x64).
- **@rollup platform packages**: 24 entries (@rollup/rollup-android-arm-eabi, @rollup/rollup-android-arm64, @rollup/rollup-darwin-arm64, @rollup/rollup-darwin-x64, @rollup/rollup-freebsd-arm64, @rollup/rollup-freebsd-x64, @rollup/rollup-linux-arm-gnueabihf, @rollup/rollup-linux-arm-musleabihf, @rollup/rollup-linux-arm64-gnu, @rollup/rollup-linux-arm64-musl, @rollup/rollup-linux-loong64-gnu, @rollup/rollup-linux-loong64-musl, @rollup/rollup-linux-ppc64-gnu, @rollup/rollup-linux-ppc64-musl, @rollup/rollup-linux-riscv64-gnu, @rollup/rollup-linux-riscv64-musl, @rollup/rollup-linux-s390x-gnu, @rollup/rollup-linux-x64-musl, @rollup/rollup-openbsd-x64, @rollup/rollup-openharmony-arm64, @rollup/rollup-win32-arm64-msvc, @rollup/rollup-win32-ia32-msvc, @rollup/rollup-win32-x64-gnu, @rollup/rollup-win32-x64-msvc).
- **fsevents**: 1 entries (fsevents).

The next release-oriented audit should verify these package manifests/license texts from the reproducible install or package archives before redistributing a dependency bundle. They are not evidence that any browser-shipped project source is unlicensed.

## Installed Packages Without a Root License File

13 installed unique package/version pairs had a license field in their local manifest but no root file matching the license/copying/notice filename patterns used by this audit:

@esbuild/linux-x64@0.28.1 (MIT; dev, optional), @humanfs/types@0.15.0 (Apache-2.0; dev), @rollup/rollup-linux-x64-gnu@4.62.3 (MIT; dev, optional), decimal.js@10.6.0 (MIT; dev), esrecurse@4.3.0 (BSD-2-Clause; dev), imurmurhash@0.1.4 (MIT; dev), keyv@4.5.4 (MIT; dev), natural-compare@1.4.0 (MIT; dev), saxes@6.0.0 (ISC; dev), stackback@0.0.2 (MIT; dev), std-env@3.10.0 (MIT; dev), tinyrainbow@2.0.0 (MIT; dev), tinyspy@4.0.4 (MIT; dev).

These are all development-only packages in the current tree. Their manifest license fields are recorded evidence; the absence of a root file is a notice-inventory follow-up, not a license conflict. If a future release distributes an install tree or a notice bundle covering them, verify the upstream package archive and include the required text or attribution according to the selected release policy.

No installed package had a root NOTICE file. This does not prove that no notice text is required; it only records the local directory scan.

## Runtime and Distribution Boundary

The Vite configuration has React and the repository VFS plugin but no external-package or manual-chunk license handling. Source imports show React/React DOM in the browser application. YAML is imported by repository scripts and is not imported by src/. Vite, Rollup, esbuild, ESLint, TypeScript, Vitest, jsdom, and their platform variants are development/build/test dependencies, not browser runtime imports.

The generated Vite JavaScript currently contains no standalone @license, @preserve, or leading license-comment markers found by the local scan. No conclusion is drawn from that about required notices. A future release plan must decide whether static bundle distribution is accompanied by a third-party notice document and which runtime packages it covers.

## Anomaly Register

| ID | Exact scope | Evidence | Classification | Follow-up |
| --- | --- | --- | --- | --- |
| DEP-LIC-001-A | 25 @esbuild platform entries, version 0.28.1 | Lockfile paths are present and declare MIT; local manifests/license files are absent because this host did not install those platforms | Bounded optional/dev platform evidence gap | Verify from the reproducible package archive before any dependency bundle redistribution |
| DEP-LIC-001-B | 24 @rollup/rollup-* platform entries, version 4.62.3 | Lockfile paths are present and declare MIT; local manifests/license files are absent because this host did not install those platforms | Bounded optional/dev platform evidence gap | Verify from the reproducible package archive before any dependency bundle redistribution |
| DEP-LIC-001-C | fsevents@2.3.3 | Lockfile path declares MIT; local manifest/license file is absent on this non-macOS install | Bounded optional/dev platform evidence gap | Verify from the reproducible package archive if this optional package is ever redistributed |
| DEP-LIC-001-D | The 13 installed dev packages listed above | Local manifests declare exact license values but no root license/copying file was found | Notice-file evidence follow-up; not a license conflict | Verify upstream archives and include required notices if the release process distributes them |

No direct production dependency has a missing local manifest, missing local license field, or missing local root license file in this audit. No broad unexplained unknown-license count remains; the residual cases are named and bounded above.

## Maintenance Rules

- Re-run this inventory when package.json or package-lock.json changes.
- Keep package names, versions, exact license expressions, metadata source, and license-file presence separate; do not collapse them into a guessed SPDX summary.
- Treat a new optional platform package as a new anomaly until its local or archive evidence is recorded.
- Keep this document separate from the eventual THIRD_PARTY_NOTICES.md, LICENSES/, and project LICENSE files.
- Keep project source/content/brand decisions separate from upstream package terms.

## Decision Status

DEP-LIC-001 is CLOSED as a broad inventory gap and narrowed to the four specific anomalies above. The approved framework resolves LICDEC-001 as MIT for original software and LICDEC-002 as the documented CC-BY-4.0, All Rights Reserved, and reserved-brand matrix. This inventory does not relicense third-party packages.

## Exhaustive Lockfile Path Table

The following table preserves every lockfile package path from the local install. A repeated package/version at a nested path remains a separate row so that the lockfile topology is not silently discarded.

| Lockfile path | Package | Version | Role/flags | Local manifest | License | License evidence source | Root license/copying files |
| --- | --- | --- | --- | --- | --- | --- | --- |
| node_modules/@asamuzakjp/css-color | @asamuzakjp/css-color | 6.0.7 | dev | yes | MIT | node_modules/@asamuzakjp/css-color/package.json | LICENSE |
| node_modules/@asamuzakjp/css-color/node_modules/lru-cache | lru-cache | 11.5.2 | dev | yes | BlueOak-1.0.0 | node_modules/@asamuzakjp/css-color/node_modules/lru-cache/package.json | LICENSE.md |
| node_modules/@asamuzakjp/dom-selector | @asamuzakjp/dom-selector | 8.3.2 | dev | yes | MIT | node_modules/@asamuzakjp/dom-selector/package.json | LICENSE |
| node_modules/@asamuzakjp/dom-selector/node_modules/lru-cache | lru-cache | 11.5.2 | dev | yes | BlueOak-1.0.0 | node_modules/@asamuzakjp/dom-selector/node_modules/lru-cache/package.json | LICENSE.md |
| node_modules/@babel/code-frame | @babel/code-frame | 7.29.7 | dev | yes | MIT | node_modules/@babel/code-frame/package.json | LICENSE |
| node_modules/@babel/compat-data | @babel/compat-data | 7.29.7 | dev | yes | MIT | node_modules/@babel/compat-data/package.json | LICENSE |
| node_modules/@babel/core | @babel/core | 7.29.7 | dev | yes | MIT | node_modules/@babel/core/package.json | LICENSE |
| node_modules/@babel/generator | @babel/generator | 7.29.8 | dev | yes | MIT | node_modules/@babel/generator/package.json | LICENSE |
| node_modules/@babel/helper-compilation-targets | @babel/helper-compilation-targets | 7.29.7 | dev | yes | MIT | node_modules/@babel/helper-compilation-targets/package.json | LICENSE |
| node_modules/@babel/helper-globals | @babel/helper-globals | 7.29.7 | dev | yes | MIT | node_modules/@babel/helper-globals/package.json | LICENSE |
| node_modules/@babel/helper-module-imports | @babel/helper-module-imports | 7.29.7 | dev | yes | MIT | node_modules/@babel/helper-module-imports/package.json | LICENSE |
| node_modules/@babel/helper-module-transforms | @babel/helper-module-transforms | 7.29.7 | dev | yes | MIT | node_modules/@babel/helper-module-transforms/package.json | LICENSE |
| node_modules/@babel/helper-plugin-utils | @babel/helper-plugin-utils | 7.29.7 | dev | yes | MIT | node_modules/@babel/helper-plugin-utils/package.json | LICENSE |
| node_modules/@babel/helper-string-parser | @babel/helper-string-parser | 7.29.7 | dev | yes | MIT | node_modules/@babel/helper-string-parser/package.json | LICENSE |
| node_modules/@babel/helper-validator-identifier | @babel/helper-validator-identifier | 7.29.7 | dev | yes | MIT | node_modules/@babel/helper-validator-identifier/package.json | LICENSE |
| node_modules/@babel/helper-validator-option | @babel/helper-validator-option | 7.29.7 | dev | yes | MIT | node_modules/@babel/helper-validator-option/package.json | LICENSE |
| node_modules/@babel/helpers | @babel/helpers | 7.29.7 | dev | yes | MIT | node_modules/@babel/helpers/package.json | LICENSE |
| node_modules/@babel/parser | @babel/parser | 7.29.8 | dev | yes | MIT | node_modules/@babel/parser/package.json | LICENSE |
| node_modules/@babel/plugin-transform-react-jsx-self | @babel/plugin-transform-react-jsx-self | 7.29.7 | dev | yes | MIT | node_modules/@babel/plugin-transform-react-jsx-self/package.json | LICENSE |
| node_modules/@babel/plugin-transform-react-jsx-source | @babel/plugin-transform-react-jsx-source | 7.29.7 | dev | yes | MIT | node_modules/@babel/plugin-transform-react-jsx-source/package.json | LICENSE |
| node_modules/@babel/template | @babel/template | 7.29.7 | dev | yes | MIT | node_modules/@babel/template/package.json | LICENSE |
| node_modules/@babel/traverse | @babel/traverse | 7.29.8 | dev | yes | MIT | node_modules/@babel/traverse/package.json | LICENSE |
| node_modules/@babel/types | @babel/types | 7.29.8 | dev | yes | MIT | node_modules/@babel/types/package.json | LICENSE |
| node_modules/@bramus/specificity | @bramus/specificity | 2.4.2 | dev | yes | MIT | node_modules/@bramus/specificity/package.json | LICENSE |
| node_modules/@csstools/color-helpers | @csstools/color-helpers | 6.1.1 | dev | yes | MIT-0 | node_modules/@csstools/color-helpers/package.json | LICENSE.md |
| node_modules/@csstools/css-calc | @csstools/css-calc | 3.3.0 | dev | yes | MIT | node_modules/@csstools/css-calc/package.json | LICENSE.md |
| node_modules/@csstools/css-color-parser | @csstools/css-color-parser | 4.2.1 | dev | yes | MIT | node_modules/@csstools/css-color-parser/package.json | LICENSE.md |
| node_modules/@csstools/css-parser-algorithms | @csstools/css-parser-algorithms | 4.0.0 | dev | yes | MIT | node_modules/@csstools/css-parser-algorithms/package.json | LICENSE.md |
| node_modules/@csstools/css-syntax-patches-for-csstree | @csstools/css-syntax-patches-for-csstree | 1.1.9 | dev | yes | MIT-0 | node_modules/@csstools/css-syntax-patches-for-csstree/package.json | LICENSE.md |
| node_modules/@csstools/css-tokenizer | @csstools/css-tokenizer | 4.0.0 | dev | yes | MIT | node_modules/@csstools/css-tokenizer/package.json | LICENSE.md |
| node_modules/@esbuild/aix-ppc64 | @esbuild/aix-ppc64 | 0.28.1 | dev, optional | no | MIT | package-lock.json | none |
| node_modules/@esbuild/android-arm | @esbuild/android-arm | 0.28.1 | dev, optional | no | MIT | package-lock.json | none |
| node_modules/@esbuild/android-arm64 | @esbuild/android-arm64 | 0.28.1 | dev, optional | no | MIT | package-lock.json | none |
| node_modules/@esbuild/android-x64 | @esbuild/android-x64 | 0.28.1 | dev, optional | no | MIT | package-lock.json | none |
| node_modules/@esbuild/darwin-arm64 | @esbuild/darwin-arm64 | 0.28.1 | dev, optional | no | MIT | package-lock.json | none |
| node_modules/@esbuild/darwin-x64 | @esbuild/darwin-x64 | 0.28.1 | dev, optional | no | MIT | package-lock.json | none |
| node_modules/@esbuild/freebsd-arm64 | @esbuild/freebsd-arm64 | 0.28.1 | dev, optional | no | MIT | package-lock.json | none |
| node_modules/@esbuild/freebsd-x64 | @esbuild/freebsd-x64 | 0.28.1 | dev, optional | no | MIT | package-lock.json | none |
| node_modules/@esbuild/linux-arm | @esbuild/linux-arm | 0.28.1 | dev, optional | no | MIT | package-lock.json | none |
| node_modules/@esbuild/linux-arm64 | @esbuild/linux-arm64 | 0.28.1 | dev, optional | no | MIT | package-lock.json | none |
| node_modules/@esbuild/linux-ia32 | @esbuild/linux-ia32 | 0.28.1 | dev, optional | no | MIT | package-lock.json | none |
| node_modules/@esbuild/linux-loong64 | @esbuild/linux-loong64 | 0.28.1 | dev, optional | no | MIT | package-lock.json | none |
| node_modules/@esbuild/linux-mips64el | @esbuild/linux-mips64el | 0.28.1 | dev, optional | no | MIT | package-lock.json | none |
| node_modules/@esbuild/linux-ppc64 | @esbuild/linux-ppc64 | 0.28.1 | dev, optional | no | MIT | package-lock.json | none |
| node_modules/@esbuild/linux-riscv64 | @esbuild/linux-riscv64 | 0.28.1 | dev, optional | no | MIT | package-lock.json | none |
| node_modules/@esbuild/linux-s390x | @esbuild/linux-s390x | 0.28.1 | dev, optional | no | MIT | package-lock.json | none |
| node_modules/@esbuild/linux-x64 | @esbuild/linux-x64 | 0.28.1 | dev, optional | yes | MIT | node_modules/@esbuild/linux-x64/package.json | none |
| node_modules/@esbuild/netbsd-arm64 | @esbuild/netbsd-arm64 | 0.28.1 | dev, optional | no | MIT | package-lock.json | none |
| node_modules/@esbuild/netbsd-x64 | @esbuild/netbsd-x64 | 0.28.1 | dev, optional | no | MIT | package-lock.json | none |
| node_modules/@esbuild/openbsd-arm64 | @esbuild/openbsd-arm64 | 0.28.1 | dev, optional | no | MIT | package-lock.json | none |
| node_modules/@esbuild/openbsd-x64 | @esbuild/openbsd-x64 | 0.28.1 | dev, optional | no | MIT | package-lock.json | none |
| node_modules/@esbuild/openharmony-arm64 | @esbuild/openharmony-arm64 | 0.28.1 | dev, optional | no | MIT | package-lock.json | none |
| node_modules/@esbuild/sunos-x64 | @esbuild/sunos-x64 | 0.28.1 | dev, optional | no | MIT | package-lock.json | none |
| node_modules/@esbuild/win32-arm64 | @esbuild/win32-arm64 | 0.28.1 | dev, optional | no | MIT | package-lock.json | none |
| node_modules/@esbuild/win32-ia32 | @esbuild/win32-ia32 | 0.28.1 | dev, optional | no | MIT | package-lock.json | none |
| node_modules/@esbuild/win32-x64 | @esbuild/win32-x64 | 0.28.1 | dev, optional | no | MIT | package-lock.json | none |
| node_modules/@eslint-community/eslint-utils | @eslint-community/eslint-utils | 4.10.1 | dev | yes | MIT | node_modules/@eslint-community/eslint-utils/package.json | LICENSE |
| node_modules/@eslint-community/eslint-utils/node_modules/eslint-visitor-keys | eslint-visitor-keys | 3.4.3 | dev | yes | Apache-2.0 | node_modules/@eslint-community/eslint-utils/node_modules/eslint-visitor-keys/package.json | LICENSE |
| node_modules/@eslint-community/regexpp | @eslint-community/regexpp | 4.12.2 | dev | yes | MIT | node_modules/@eslint-community/regexpp/package.json | LICENSE |
| node_modules/@eslint/config-array | @eslint/config-array | 0.21.2 | dev | yes | Apache-2.0 | node_modules/@eslint/config-array/package.json | LICENSE |
| node_modules/@eslint/config-helpers | @eslint/config-helpers | 0.4.2 | dev | yes | Apache-2.0 | node_modules/@eslint/config-helpers/package.json | LICENSE |
| node_modules/@eslint/core | @eslint/core | 0.17.0 | dev | yes | Apache-2.0 | node_modules/@eslint/core/package.json | LICENSE |
| node_modules/@eslint/eslintrc | @eslint/eslintrc | 3.3.6 | dev | yes | MIT | node_modules/@eslint/eslintrc/package.json | LICENSE |
| node_modules/@eslint/js | @eslint/js | 9.39.5 | dev | yes | MIT | node_modules/@eslint/js/package.json | LICENSE |
| node_modules/@eslint/object-schema | @eslint/object-schema | 2.1.7 | dev | yes | Apache-2.0 | node_modules/@eslint/object-schema/package.json | LICENSE |
| node_modules/@eslint/plugin-kit | @eslint/plugin-kit | 0.4.1 | dev | yes | Apache-2.0 | node_modules/@eslint/plugin-kit/package.json | LICENSE |
| node_modules/@exodus/bytes | @exodus/bytes | 1.15.1 | dev | yes | MIT | node_modules/@exodus/bytes/package.json | LICENSE |
| node_modules/@humanfs/core | @humanfs/core | 0.19.2 | dev | yes | Apache-2.0 | node_modules/@humanfs/core/package.json | LICENSE |
| node_modules/@humanfs/node | @humanfs/node | 0.16.8 | dev | yes | Apache-2.0 | node_modules/@humanfs/node/package.json | LICENSE |
| node_modules/@humanfs/types | @humanfs/types | 0.15.0 | dev | yes | Apache-2.0 | node_modules/@humanfs/types/package.json | none |
| node_modules/@humanwhocodes/module-importer | @humanwhocodes/module-importer | 1.0.1 | dev | yes | Apache-2.0 | node_modules/@humanwhocodes/module-importer/package.json | LICENSE |
| node_modules/@humanwhocodes/retry | @humanwhocodes/retry | 0.4.3 | dev | yes | Apache-2.0 | node_modules/@humanwhocodes/retry/package.json | LICENSE |
| node_modules/@jridgewell/gen-mapping | @jridgewell/gen-mapping | 0.3.13 | dev | yes | MIT | node_modules/@jridgewell/gen-mapping/package.json | LICENSE |
| node_modules/@jridgewell/remapping | @jridgewell/remapping | 2.3.5 | dev | yes | MIT | node_modules/@jridgewell/remapping/package.json | LICENSE |
| node_modules/@jridgewell/resolve-uri | @jridgewell/resolve-uri | 3.1.2 | dev | yes | MIT | node_modules/@jridgewell/resolve-uri/package.json | LICENSE |
| node_modules/@jridgewell/sourcemap-codec | @jridgewell/sourcemap-codec | 1.5.5 | dev | yes | MIT | node_modules/@jridgewell/sourcemap-codec/package.json | LICENSE |
| node_modules/@jridgewell/trace-mapping | @jridgewell/trace-mapping | 0.3.31 | dev | yes | MIT | node_modules/@jridgewell/trace-mapping/package.json | LICENSE |
| node_modules/@rolldown/pluginutils | @rolldown/pluginutils | 1.0.0-rc.3 | dev | yes | MIT | node_modules/@rolldown/pluginutils/package.json | LICENSE |
| node_modules/@rollup/rollup-android-arm-eabi | @rollup/rollup-android-arm-eabi | 4.62.3 | dev, optional | no | MIT | package-lock.json | none |
| node_modules/@rollup/rollup-android-arm64 | @rollup/rollup-android-arm64 | 4.62.3 | dev, optional | no | MIT | package-lock.json | none |
| node_modules/@rollup/rollup-darwin-arm64 | @rollup/rollup-darwin-arm64 | 4.62.3 | dev, optional | no | MIT | package-lock.json | none |
| node_modules/@rollup/rollup-darwin-x64 | @rollup/rollup-darwin-x64 | 4.62.3 | dev, optional | no | MIT | package-lock.json | none |
| node_modules/@rollup/rollup-freebsd-arm64 | @rollup/rollup-freebsd-arm64 | 4.62.3 | dev, optional | no | MIT | package-lock.json | none |
| node_modules/@rollup/rollup-freebsd-x64 | @rollup/rollup-freebsd-x64 | 4.62.3 | dev, optional | no | MIT | package-lock.json | none |
| node_modules/@rollup/rollup-linux-arm-gnueabihf | @rollup/rollup-linux-arm-gnueabihf | 4.62.3 | dev, optional | no | MIT | package-lock.json | none |
| node_modules/@rollup/rollup-linux-arm-musleabihf | @rollup/rollup-linux-arm-musleabihf | 4.62.3 | dev, optional | no | MIT | package-lock.json | none |
| node_modules/@rollup/rollup-linux-arm64-gnu | @rollup/rollup-linux-arm64-gnu | 4.62.3 | dev, optional | no | MIT | package-lock.json | none |
| node_modules/@rollup/rollup-linux-arm64-musl | @rollup/rollup-linux-arm64-musl | 4.62.3 | dev, optional | no | MIT | package-lock.json | none |
| node_modules/@rollup/rollup-linux-loong64-gnu | @rollup/rollup-linux-loong64-gnu | 4.62.3 | dev, optional | no | MIT | package-lock.json | none |
| node_modules/@rollup/rollup-linux-loong64-musl | @rollup/rollup-linux-loong64-musl | 4.62.3 | dev, optional | no | MIT | package-lock.json | none |
| node_modules/@rollup/rollup-linux-ppc64-gnu | @rollup/rollup-linux-ppc64-gnu | 4.62.3 | dev, optional | no | MIT | package-lock.json | none |
| node_modules/@rollup/rollup-linux-ppc64-musl | @rollup/rollup-linux-ppc64-musl | 4.62.3 | dev, optional | no | MIT | package-lock.json | none |
| node_modules/@rollup/rollup-linux-riscv64-gnu | @rollup/rollup-linux-riscv64-gnu | 4.62.3 | dev, optional | no | MIT | package-lock.json | none |
| node_modules/@rollup/rollup-linux-riscv64-musl | @rollup/rollup-linux-riscv64-musl | 4.62.3 | dev, optional | no | MIT | package-lock.json | none |
| node_modules/@rollup/rollup-linux-s390x-gnu | @rollup/rollup-linux-s390x-gnu | 4.62.3 | dev, optional | no | MIT | package-lock.json | none |
| node_modules/@rollup/rollup-linux-x64-gnu | @rollup/rollup-linux-x64-gnu | 4.62.3 | dev, optional | yes | MIT | node_modules/@rollup/rollup-linux-x64-gnu/package.json | none |
| node_modules/@rollup/rollup-linux-x64-musl | @rollup/rollup-linux-x64-musl | 4.62.3 | dev, optional | no | MIT | package-lock.json | none |
| node_modules/@rollup/rollup-openbsd-x64 | @rollup/rollup-openbsd-x64 | 4.62.3 | dev, optional | no | MIT | package-lock.json | none |
| node_modules/@rollup/rollup-openharmony-arm64 | @rollup/rollup-openharmony-arm64 | 4.62.3 | dev, optional | no | MIT | package-lock.json | none |
| node_modules/@rollup/rollup-win32-arm64-msvc | @rollup/rollup-win32-arm64-msvc | 4.62.3 | dev, optional | no | MIT | package-lock.json | none |
| node_modules/@rollup/rollup-win32-ia32-msvc | @rollup/rollup-win32-ia32-msvc | 4.62.3 | dev, optional | no | MIT | package-lock.json | none |
| node_modules/@rollup/rollup-win32-x64-gnu | @rollup/rollup-win32-x64-gnu | 4.62.3 | dev, optional | no | MIT | package-lock.json | none |
| node_modules/@rollup/rollup-win32-x64-msvc | @rollup/rollup-win32-x64-msvc | 4.62.3 | dev, optional | no | MIT | package-lock.json | none |
| node_modules/@types/babel__core | @types/babel__core | 7.20.5 | dev | yes | MIT | node_modules/@types/babel__core/package.json | LICENSE |
| node_modules/@types/babel__generator | @types/babel__generator | 7.27.0 | dev | yes | MIT | node_modules/@types/babel__generator/package.json | LICENSE |
| node_modules/@types/babel__template | @types/babel__template | 7.4.4 | dev | yes | MIT | node_modules/@types/babel__template/package.json | LICENSE |
| node_modules/@types/babel__traverse | @types/babel__traverse | 7.28.0 | dev | yes | MIT | node_modules/@types/babel__traverse/package.json | LICENSE |
| node_modules/@types/chai | @types/chai | 5.2.3 | dev | yes | MIT | node_modules/@types/chai/package.json | LICENSE |
| node_modules/@types/deep-eql | @types/deep-eql | 4.0.2 | dev | yes | MIT | node_modules/@types/deep-eql/package.json | LICENSE |
| node_modules/@types/estree | @types/estree | 1.0.9 | dev | yes | MIT | node_modules/@types/estree/package.json | LICENSE |
| node_modules/@types/json-schema | @types/json-schema | 7.0.15 | dev | yes | MIT | node_modules/@types/json-schema/package.json | LICENSE |
| node_modules/@types/node | @types/node | 24.13.3 | dev | yes | MIT | node_modules/@types/node/package.json | LICENSE |
| node_modules/@types/react | @types/react | 19.2.18 | dev | yes | MIT | node_modules/@types/react/package.json | LICENSE |
| node_modules/@types/react-dom | @types/react-dom | 19.2.4 | dev | yes | MIT | node_modules/@types/react-dom/package.json | LICENSE |
| node_modules/@typescript-eslint/eslint-plugin | @typescript-eslint/eslint-plugin | 8.65.0 | dev | yes | MIT | node_modules/@typescript-eslint/eslint-plugin/package.json | LICENSE |
| node_modules/@typescript-eslint/eslint-plugin/node_modules/ignore | ignore | 7.0.6 | dev | yes | MIT | node_modules/@typescript-eslint/eslint-plugin/node_modules/ignore/package.json | LICENSE-MIT |
| node_modules/@typescript-eslint/parser | @typescript-eslint/parser | 8.65.0 | dev | yes | MIT | node_modules/@typescript-eslint/parser/package.json | LICENSE |
| node_modules/@typescript-eslint/project-service | @typescript-eslint/project-service | 8.65.0 | dev | yes | MIT | node_modules/@typescript-eslint/project-service/package.json | LICENSE |
| node_modules/@typescript-eslint/scope-manager | @typescript-eslint/scope-manager | 8.65.0 | dev | yes | MIT | node_modules/@typescript-eslint/scope-manager/package.json | LICENSE |
| node_modules/@typescript-eslint/tsconfig-utils | @typescript-eslint/tsconfig-utils | 8.65.0 | dev | yes | MIT | node_modules/@typescript-eslint/tsconfig-utils/package.json | LICENSE |
| node_modules/@typescript-eslint/type-utils | @typescript-eslint/type-utils | 8.65.0 | dev | yes | MIT | node_modules/@typescript-eslint/type-utils/package.json | LICENSE |
| node_modules/@typescript-eslint/types | @typescript-eslint/types | 8.65.0 | dev | yes | MIT | node_modules/@typescript-eslint/types/package.json | LICENSE |
| node_modules/@typescript-eslint/typescript-estree | @typescript-eslint/typescript-estree | 8.65.0 | dev | yes | MIT | node_modules/@typescript-eslint/typescript-estree/package.json | LICENSE |
| node_modules/@typescript-eslint/typescript-estree/node_modules/balanced-match | balanced-match | 4.0.4 | dev | yes | MIT | node_modules/@typescript-eslint/typescript-estree/node_modules/balanced-match/package.json | LICENSE.md |
| node_modules/@typescript-eslint/typescript-estree/node_modules/brace-expansion | brace-expansion | 5.0.9 | dev | yes | MIT | node_modules/@typescript-eslint/typescript-estree/node_modules/brace-expansion/package.json | LICENSE |
| node_modules/@typescript-eslint/typescript-estree/node_modules/minimatch | minimatch | 10.2.6 | dev | yes | BlueOak-1.0.0 | node_modules/@typescript-eslint/typescript-estree/node_modules/minimatch/package.json | LICENSE.md |
| node_modules/@typescript-eslint/typescript-estree/node_modules/semver | semver | 7.8.5 | dev | yes | ISC | node_modules/@typescript-eslint/typescript-estree/node_modules/semver/package.json | LICENSE |
| node_modules/@typescript-eslint/utils | @typescript-eslint/utils | 8.65.0 | dev | yes | MIT | node_modules/@typescript-eslint/utils/package.json | LICENSE |
| node_modules/@typescript-eslint/visitor-keys | @typescript-eslint/visitor-keys | 8.65.0 | dev | yes | MIT | node_modules/@typescript-eslint/visitor-keys/package.json | LICENSE |
| node_modules/@typescript-eslint/visitor-keys/node_modules/eslint-visitor-keys | eslint-visitor-keys | 5.0.1 | dev | yes | Apache-2.0 | node_modules/@typescript-eslint/visitor-keys/node_modules/eslint-visitor-keys/package.json | LICENSE |
| node_modules/@vitejs/plugin-react | @vitejs/plugin-react | 5.2.0 | dev | yes | MIT | node_modules/@vitejs/plugin-react/package.json | LICENSE |
| node_modules/@vitest/expect | @vitest/expect | 3.2.7 | dev | yes | MIT | node_modules/@vitest/expect/package.json | LICENSE |
| node_modules/@vitest/mocker | @vitest/mocker | 3.2.7 | dev | yes | MIT | node_modules/@vitest/mocker/package.json | LICENSE |
| node_modules/@vitest/pretty-format | @vitest/pretty-format | 3.2.7 | dev | yes | MIT | node_modules/@vitest/pretty-format/package.json | LICENSE |
| node_modules/@vitest/runner | @vitest/runner | 3.2.7 | dev | yes | MIT | node_modules/@vitest/runner/package.json | LICENSE |
| node_modules/@vitest/snapshot | @vitest/snapshot | 3.2.7 | dev | yes | MIT | node_modules/@vitest/snapshot/package.json | LICENSE |
| node_modules/@vitest/spy | @vitest/spy | 3.2.7 | dev | yes | MIT | node_modules/@vitest/spy/package.json | LICENSE |
| node_modules/@vitest/utils | @vitest/utils | 3.2.7 | dev | yes | MIT | node_modules/@vitest/utils/package.json | LICENSE |
| node_modules/acorn | acorn | 8.18.0 | dev | yes | MIT | node_modules/acorn/package.json | LICENSE |
| node_modules/acorn-jsx | acorn-jsx | 5.3.2 | dev | yes | MIT | node_modules/acorn-jsx/package.json | LICENSE |
| node_modules/ajv | ajv | 6.15.0 | dev | yes | MIT | node_modules/ajv/package.json | LICENSE |
| node_modules/ansi-styles | ansi-styles | 4.3.0 | dev | yes | MIT | node_modules/ansi-styles/package.json | license |
| node_modules/argparse | argparse | 2.0.1 | dev | yes | Python-2.0 | node_modules/argparse/package.json | LICENSE |
| node_modules/assertion-error | assertion-error | 2.0.1 | dev | yes | MIT | node_modules/assertion-error/package.json | LICENSE |
| node_modules/balanced-match | balanced-match | 1.0.2 | dev | yes | MIT | node_modules/balanced-match/package.json | LICENSE.md |
| node_modules/baseline-browser-mapping | baseline-browser-mapping | 2.11.8 | dev | yes | Apache-2.0 | node_modules/baseline-browser-mapping/package.json | LICENSE.txt |
| node_modules/bidi-js | bidi-js | 1.0.3 | dev | yes | MIT | node_modules/bidi-js/package.json | LICENSE.txt |
| node_modules/brace-expansion | brace-expansion | 1.1.18 | dev | yes | MIT | node_modules/brace-expansion/package.json | LICENSE |
| node_modules/browserslist | browserslist | 4.28.7 | dev | yes | MIT | node_modules/browserslist/package.json | LICENSE |
| node_modules/cac | cac | 6.7.14 | dev | yes | MIT | node_modules/cac/package.json | LICENSE |
| node_modules/callsites | callsites | 3.1.0 | dev | yes | MIT | node_modules/callsites/package.json | license |
| node_modules/caniuse-lite | caniuse-lite | 1.0.30001806 | dev | yes | CC-BY-4.0 | node_modules/caniuse-lite/package.json | LICENSE |
| node_modules/chai | chai | 5.3.3 | dev | yes | MIT | node_modules/chai/package.json | LICENSE |
| node_modules/chalk | chalk | 4.1.2 | dev | yes | MIT | node_modules/chalk/package.json | license |
| node_modules/check-error | check-error | 2.1.3 | dev | yes | MIT | node_modules/check-error/package.json | LICENSE |
| node_modules/color-convert | color-convert | 2.0.1 | dev | yes | MIT | node_modules/color-convert/package.json | LICENSE |
| node_modules/color-name | color-name | 1.1.4 | dev | yes | MIT | node_modules/color-name/package.json | LICENSE |
| node_modules/concat-map | concat-map | 0.0.1 | dev | yes | MIT | node_modules/concat-map/package.json | LICENSE |
| node_modules/convert-source-map | convert-source-map | 2.0.0 | dev | yes | MIT | node_modules/convert-source-map/package.json | LICENSE |
| node_modules/cross-spawn | cross-spawn | 7.0.6 | dev | yes | MIT | node_modules/cross-spawn/package.json | LICENSE |
| node_modules/css-tree | css-tree | 3.2.1 | dev | yes | MIT | node_modules/css-tree/package.json | LICENSE |
| node_modules/csstype | csstype | 3.2.3 | dev | yes | MIT | node_modules/csstype/package.json | LICENSE |
| node_modules/data-urls | data-urls | 7.0.0 | dev | yes | MIT | node_modules/data-urls/package.json | LICENSE.txt |
| node_modules/data-urls/node_modules/whatwg-url | whatwg-url | 16.0.1 | dev | yes | MIT | node_modules/data-urls/node_modules/whatwg-url/package.json | LICENSE.txt |
| node_modules/debug | debug | 4.4.3 | dev | yes | MIT | node_modules/debug/package.json | LICENSE |
| node_modules/decimal.js | decimal.js | 10.6.0 | dev | yes | MIT | node_modules/decimal.js/package.json | none |
| node_modules/deep-eql | deep-eql | 5.0.2 | dev | yes | MIT | node_modules/deep-eql/package.json | LICENSE |
| node_modules/deep-is | deep-is | 0.1.4 | dev | yes | MIT | node_modules/deep-is/package.json | LICENSE |
| node_modules/electron-to-chromium | electron-to-chromium | 1.5.399 | dev | yes | ISC | node_modules/electron-to-chromium/package.json | LICENSE |
| node_modules/entities | entities | 8.0.0 | dev | yes | BSD-2-Clause | node_modules/entities/package.json | LICENSE |
| node_modules/es-module-lexer | es-module-lexer | 1.7.0 | dev | yes | MIT | node_modules/es-module-lexer/package.json | LICENSE |
| node_modules/esbuild | esbuild | 0.28.1 | dev | yes | MIT | node_modules/esbuild/package.json | LICENSE.md |
| node_modules/escalade | escalade | 3.2.0 | dev | yes | MIT | node_modules/escalade/package.json | license |
| node_modules/escape-string-regexp | escape-string-regexp | 4.0.0 | dev | yes | MIT | node_modules/escape-string-regexp/package.json | license |
| node_modules/eslint | eslint | 9.39.5 | dev | yes | MIT | node_modules/eslint/package.json | LICENSE |
| node_modules/eslint-plugin-react-hooks | eslint-plugin-react-hooks | 5.2.0 | dev | yes | MIT | node_modules/eslint-plugin-react-hooks/package.json | LICENSE |
| node_modules/eslint-plugin-react-refresh | eslint-plugin-react-refresh | 0.4.26 | dev | yes | MIT | node_modules/eslint-plugin-react-refresh/package.json | LICENSE |
| node_modules/eslint-scope | eslint-scope | 8.4.0 | dev | yes | BSD-2-Clause | node_modules/eslint-scope/package.json | LICENSE |
| node_modules/eslint-visitor-keys | eslint-visitor-keys | 4.2.1 | dev | yes | Apache-2.0 | node_modules/eslint-visitor-keys/package.json | LICENSE |
| node_modules/espree | espree | 10.4.0 | dev | yes | BSD-2-Clause | node_modules/espree/package.json | LICENSE |
| node_modules/esquery | esquery | 1.7.0 | dev | yes | BSD-3-Clause | node_modules/esquery/package.json | license.txt |
| node_modules/esrecurse | esrecurse | 4.3.0 | dev | yes | BSD-2-Clause | node_modules/esrecurse/package.json | none |
| node_modules/estraverse | estraverse | 5.3.0 | dev | yes | BSD-2-Clause | node_modules/estraverse/package.json | LICENSE.BSD |
| node_modules/estree-walker | estree-walker | 3.0.3 | dev | yes | MIT | node_modules/estree-walker/package.json | LICENSE |
| node_modules/esutils | esutils | 2.0.3 | dev | yes | BSD-2-Clause | node_modules/esutils/package.json | LICENSE.BSD |
| node_modules/expect-type | expect-type | 1.4.0 | dev | yes | Apache-2.0 | node_modules/expect-type/package.json | LICENSE |
| node_modules/fast-deep-equal | fast-deep-equal | 3.1.3 | dev | yes | MIT | node_modules/fast-deep-equal/package.json | LICENSE |
| node_modules/fast-json-stable-stringify | fast-json-stable-stringify | 2.1.0 | dev | yes | MIT | node_modules/fast-json-stable-stringify/package.json | LICENSE |
| node_modules/fast-levenshtein | fast-levenshtein | 2.0.6 | dev | yes | MIT | node_modules/fast-levenshtein/package.json | LICENSE.md |
| node_modules/fdir | fdir | 6.5.0 | dev | yes | MIT | node_modules/fdir/package.json | LICENSE |
| node_modules/file-entry-cache | file-entry-cache | 8.0.0 | dev | yes | MIT | node_modules/file-entry-cache/package.json | LICENSE |
| node_modules/find-up | find-up | 5.0.0 | dev | yes | MIT | node_modules/find-up/package.json | license |
| node_modules/flat-cache | flat-cache | 4.0.1 | dev | yes | MIT | node_modules/flat-cache/package.json | LICENSE |
| node_modules/flatted | flatted | 3.4.4 | dev | yes | ISC | node_modules/flatted/package.json | LICENSE |
| node_modules/fsevents | fsevents | 2.3.3 | dev, optional | no | MIT | package-lock.json | none |
| node_modules/gensync | gensync | 1.0.0-beta.2 | dev | yes | MIT | node_modules/gensync/package.json | LICENSE |
| node_modules/glob-parent | glob-parent | 6.0.2 | dev | yes | ISC | node_modules/glob-parent/package.json | LICENSE |
| node_modules/globals | globals | 14.0.0 | dev | yes | MIT | node_modules/globals/package.json | license |
| node_modules/has-flag | has-flag | 4.0.0 | dev | yes | MIT | node_modules/has-flag/package.json | license |
| node_modules/html-encoding-sniffer | html-encoding-sniffer | 6.0.0 | dev | yes | MIT | node_modules/html-encoding-sniffer/package.json | LICENSE.txt |
| node_modules/ignore | ignore | 5.3.2 | dev | yes | MIT | node_modules/ignore/package.json | LICENSE-MIT |
| node_modules/import-fresh | import-fresh | 3.3.1 | dev | yes | MIT | node_modules/import-fresh/package.json | license |
| node_modules/imurmurhash | imurmurhash | 0.1.4 | dev | yes | MIT | node_modules/imurmurhash/package.json | none |
| node_modules/is-extglob | is-extglob | 2.1.1 | dev | yes | MIT | node_modules/is-extglob/package.json | LICENSE |
| node_modules/is-glob | is-glob | 4.0.3 | dev | yes | MIT | node_modules/is-glob/package.json | LICENSE |
| node_modules/is-potential-custom-element-name | is-potential-custom-element-name | 1.0.1 | dev | yes | MIT | node_modules/is-potential-custom-element-name/package.json | LICENSE-MIT.txt |
| node_modules/isexe | isexe | 2.0.0 | dev | yes | ISC | node_modules/isexe/package.json | LICENSE |
| node_modules/js-tokens | js-tokens | 4.0.0 | dev | yes | MIT | node_modules/js-tokens/package.json | LICENSE |
| node_modules/js-yaml | js-yaml | 4.3.0 | dev | yes | MIT | node_modules/js-yaml/package.json | LICENSE |
| node_modules/jsdom | jsdom | 30.0.1 | dev | yes | MIT | node_modules/jsdom/package.json | LICENSE.txt |
| node_modules/jsdom/node_modules/lru-cache | lru-cache | 11.5.2 | dev | yes | BlueOak-1.0.0 | node_modules/jsdom/node_modules/lru-cache/package.json | LICENSE.md |
| node_modules/jsesc | jsesc | 3.1.0 | dev | yes | MIT | node_modules/jsesc/package.json | LICENSE-MIT.txt |
| node_modules/json-buffer | json-buffer | 3.0.1 | dev | yes | MIT | node_modules/json-buffer/package.json | LICENSE |
| node_modules/json-schema-traverse | json-schema-traverse | 0.4.1 | dev | yes | MIT | node_modules/json-schema-traverse/package.json | LICENSE |
| node_modules/json-stable-stringify-without-jsonify | json-stable-stringify-without-jsonify | 1.0.1 | dev | yes | MIT | node_modules/json-stable-stringify-without-jsonify/package.json | LICENSE |
| node_modules/json5 | json5 | 2.2.3 | dev | yes | MIT | node_modules/json5/package.json | LICENSE.md |
| node_modules/keyv | keyv | 4.5.4 | dev | yes | MIT | node_modules/keyv/package.json | none |
| node_modules/levn | levn | 0.4.1 | dev | yes | MIT | node_modules/levn/package.json | LICENSE |
| node_modules/locate-path | locate-path | 6.0.0 | dev | yes | MIT | node_modules/locate-path/package.json | license |
| node_modules/lodash.merge | lodash.merge | 4.6.2 | dev | yes | MIT | node_modules/lodash.merge/package.json | LICENSE |
| node_modules/loupe | loupe | 3.2.1 | dev | yes | MIT | node_modules/loupe/package.json | LICENSE |
| node_modules/lru-cache | lru-cache | 5.1.1 | dev | yes | ISC | node_modules/lru-cache/package.json | LICENSE |
| node_modules/magic-string | magic-string | 0.30.21 | dev | yes | MIT | node_modules/magic-string/package.json | LICENSE |
| node_modules/mdn-data | mdn-data | 2.27.1 | dev | yes | CC0-1.0 | node_modules/mdn-data/package.json | LICENSE |
| node_modules/minimatch | minimatch | 3.1.5 | dev | yes | ISC | node_modules/minimatch/package.json | LICENSE |
| node_modules/ms | ms | 2.1.3 | dev | yes | MIT | node_modules/ms/package.json | license.md |
| node_modules/nanoid | nanoid | 3.3.16 | dev | yes | MIT | node_modules/nanoid/package.json | LICENSE |
| node_modules/natural-compare | natural-compare | 1.4.0 | dev | yes | MIT | node_modules/natural-compare/package.json | none |
| node_modules/node-releases | node-releases | 2.0.51 | dev | yes | MIT | node_modules/node-releases/package.json | LICENSE |
| node_modules/optionator | optionator | 0.9.4 | dev | yes | MIT | node_modules/optionator/package.json | LICENSE |
| node_modules/p-limit | p-limit | 3.1.0 | dev | yes | MIT | node_modules/p-limit/package.json | license |
| node_modules/p-locate | p-locate | 5.0.0 | dev | yes | MIT | node_modules/p-locate/package.json | license |
| node_modules/parent-module | parent-module | 1.0.1 | dev | yes | MIT | node_modules/parent-module/package.json | license |
| node_modules/parse5 | parse5 | 8.0.1 | dev | yes | MIT | node_modules/parse5/package.json | LICENSE |
| node_modules/path-exists | path-exists | 4.0.0 | dev | yes | MIT | node_modules/path-exists/package.json | license |
| node_modules/path-key | path-key | 3.1.1 | dev | yes | MIT | node_modules/path-key/package.json | license |
| node_modules/pathe | pathe | 2.0.3 | dev | yes | MIT | node_modules/pathe/package.json | LICENSE |
| node_modules/pathval | pathval | 2.0.1 | dev | yes | MIT | node_modules/pathval/package.json | LICENSE |
| node_modules/picocolors | picocolors | 1.1.1 | dev | yes | ISC | node_modules/picocolors/package.json | LICENSE |
| node_modules/picomatch | picomatch | 4.0.5 | dev | yes | MIT | node_modules/picomatch/package.json | LICENSE |
| node_modules/postcss | postcss | 8.5.25 | dev | yes | MIT | node_modules/postcss/package.json | LICENSE |
| node_modules/prelude-ls | prelude-ls | 1.2.1 | dev | yes | MIT | node_modules/prelude-ls/package.json | LICENSE |
| node_modules/punycode | punycode | 2.3.1 | dev | yes | MIT | node_modules/punycode/package.json | LICENSE-MIT.txt |
| node_modules/react | react | 19.2.8 | production-capable | yes | MIT | node_modules/react/package.json | LICENSE |
| node_modules/react-dom | react-dom | 19.2.8 | production-capable | yes | MIT | node_modules/react-dom/package.json | LICENSE |
| node_modules/react-refresh | react-refresh | 0.18.0 | dev | yes | MIT | node_modules/react-refresh/package.json | LICENSE |
| node_modules/require-from-string | require-from-string | 2.0.2 | dev | yes | MIT | node_modules/require-from-string/package.json | license |
| node_modules/resolve-from | resolve-from | 4.0.0 | dev | yes | MIT | node_modules/resolve-from/package.json | license |
| node_modules/rollup | rollup | 4.62.3 | dev | yes | MIT | node_modules/rollup/package.json | LICENSE.md |
| node_modules/saxes | saxes | 6.0.0 | dev | yes | ISC | node_modules/saxes/package.json | none |
| node_modules/scheduler | scheduler | 0.27.0 | production-capable | yes | MIT | node_modules/scheduler/package.json | LICENSE |
| node_modules/semver | semver | 6.3.1 | dev | yes | ISC | node_modules/semver/package.json | LICENSE |
| node_modules/shebang-command | shebang-command | 2.0.0 | dev | yes | MIT | node_modules/shebang-command/package.json | license |
| node_modules/shebang-regex | shebang-regex | 3.0.0 | dev | yes | MIT | node_modules/shebang-regex/package.json | license |
| node_modules/siginfo | siginfo | 2.0.0 | dev | yes | ISC | node_modules/siginfo/package.json | LICENSE |
| node_modules/source-map-js | source-map-js | 1.2.1 | dev | yes | BSD-3-Clause | node_modules/source-map-js/package.json | LICENSE |
| node_modules/stackback | stackback | 0.0.2 | dev | yes | MIT | node_modules/stackback/package.json | none |
| node_modules/std-env | std-env | 3.10.0 | dev | yes | MIT | node_modules/std-env/package.json | none |
| node_modules/strip-json-comments | strip-json-comments | 3.1.1 | dev | yes | MIT | node_modules/strip-json-comments/package.json | license |
| node_modules/strip-literal | strip-literal | 3.1.0 | dev | yes | MIT | node_modules/strip-literal/package.json | LICENSE |
| node_modules/strip-literal/node_modules/js-tokens | js-tokens | 9.0.1 | dev | yes | MIT | node_modules/strip-literal/node_modules/js-tokens/package.json | LICENSE |
| node_modules/supports-color | supports-color | 7.2.0 | dev | yes | MIT | node_modules/supports-color/package.json | license |
| node_modules/symbol-tree | symbol-tree | 3.2.4 | dev | yes | MIT | node_modules/symbol-tree/package.json | LICENSE |
| node_modules/tinybench | tinybench | 2.9.0 | dev | yes | MIT | node_modules/tinybench/package.json | LICENSE |
| node_modules/tinyexec | tinyexec | 0.3.2 | dev | yes | MIT | node_modules/tinyexec/package.json | LICENSE |
| node_modules/tinyglobby | tinyglobby | 0.2.17 | dev | yes | MIT | node_modules/tinyglobby/package.json | LICENSE |
| node_modules/tinypool | tinypool | 1.1.1 | dev | yes | MIT | node_modules/tinypool/package.json | LICENSE |
| node_modules/tinyrainbow | tinyrainbow | 2.0.0 | dev | yes | MIT | node_modules/tinyrainbow/package.json | none |
| node_modules/tinyspy | tinyspy | 4.0.4 | dev | yes | MIT | node_modules/tinyspy/package.json | none |
| node_modules/tldts | tldts | 7.4.11 | dev | yes | MIT | node_modules/tldts/package.json | LICENSE |
| node_modules/tldts-core | tldts-core | 7.4.11 | dev | yes | MIT | node_modules/tldts-core/package.json | LICENSE |
| node_modules/tough-cookie | tough-cookie | 6.0.2 | dev | yes | BSD-3-Clause | node_modules/tough-cookie/package.json | LICENSE |
| node_modules/tr46 | tr46 | 6.0.0 | dev | yes | MIT | node_modules/tr46/package.json | LICENSE.md |
| node_modules/ts-api-utils | ts-api-utils | 2.5.0 | dev | yes | MIT | node_modules/ts-api-utils/package.json | LICENSE.md |
| node_modules/type-check | type-check | 0.4.0 | dev | yes | MIT | node_modules/type-check/package.json | LICENSE |
| node_modules/typescript | typescript | 5.9.3 | dev | yes | Apache-2.0 | node_modules/typescript/package.json | LICENSE.txt |
| node_modules/typescript-eslint | typescript-eslint | 8.65.0 | dev | yes | MIT | node_modules/typescript-eslint/package.json | LICENSE |
| node_modules/undici | undici | 8.10.0 | dev | yes | MIT | node_modules/undici/package.json | LICENSE |
| node_modules/undici-types | undici-types | 7.18.2 | dev | yes | MIT | node_modules/undici-types/package.json | LICENSE |
| node_modules/update-browserslist-db | update-browserslist-db | 1.2.3 | dev | yes | MIT | node_modules/update-browserslist-db/package.json | LICENSE |
| node_modules/uri-js | uri-js | 4.4.1 | dev | yes | BSD-2-Clause | node_modules/uri-js/package.json | LICENSE |
| node_modules/vite | vite | 7.3.6 | dev | yes | MIT | node_modules/vite/package.json | LICENSE.md |
| node_modules/vite-node | vite-node | 3.2.4 | dev | yes | MIT | node_modules/vite-node/package.json | LICENSE |
| node_modules/vitest | vitest | 3.2.7 | dev | yes | MIT | node_modules/vitest/package.json | LICENSE.md |
| node_modules/w3c-xmlserializer | w3c-xmlserializer | 5.0.0 | dev | yes | MIT | node_modules/w3c-xmlserializer/package.json | LICENSE.md |
| node_modules/webidl-conversions | webidl-conversions | 8.0.1 | dev | yes | BSD-2-Clause | node_modules/webidl-conversions/package.json | LICENSE.md |
| node_modules/whatwg-mimetype | whatwg-mimetype | 5.0.0 | dev | yes | MIT | node_modules/whatwg-mimetype/package.json | LICENSE.txt |
| node_modules/whatwg-url | whatwg-url | 17.1.0 | dev | yes | MIT | node_modules/whatwg-url/package.json | LICENSE.txt |
| node_modules/which | which | 2.0.2 | dev | yes | ISC | node_modules/which/package.json | LICENSE |
| node_modules/why-is-node-running | why-is-node-running | 2.3.0 | dev | yes | MIT | node_modules/why-is-node-running/package.json | LICENSE |
| node_modules/word-wrap | word-wrap | 1.2.5 | dev | yes | MIT | node_modules/word-wrap/package.json | LICENSE |
| node_modules/xml-name-validator | xml-name-validator | 5.0.0 | dev | yes | Apache-2.0 | node_modules/xml-name-validator/package.json | LICENSE.txt |
| node_modules/xmlchars | xmlchars | 2.2.0 | dev | yes | MIT | node_modules/xmlchars/package.json | LICENSE |
| node_modules/yallist | yallist | 3.1.1 | dev | yes | ISC | node_modules/yallist/package.json | LICENSE |
| node_modules/yaml | yaml | 2.9.1 | production-capable | yes | ISC | node_modules/yaml/package.json | LICENSE |
| node_modules/yocto-queue | yocto-queue | 0.1.0 | dev | yes | MIT | node_modules/yocto-queue/package.json | license |
