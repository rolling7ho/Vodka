# runtime: Wine/CrossOver build workbench

This directory contains the local runtime build driver and release notes for Vodka's Windows
runtime (`Libraries.tar.gz`). Runtime builds are assembled and published as GitHub Releases on
`rolling7ho/Vodka`.

The Wine and DXMT source trees live in separate repositories:

- `rolling7ho/winecx` (branch `d3dmetal-errno`): patched Wine/CrossOver source tree.
- `rolling7ho/dxmt` (branch `teardown`): DXMT source tree from which `vodkametal` builds.

Local build lanes (`runtime-47/`, `runtime-up/`, `runtime-ci/`), packaged runtimes
(`pkg-*/`), build dependencies (`deps/`), and `.local-ci/` state are untracked and ignored
by `.gitignore`. Delete `build/`, `staging/`, and `smoke-prefix*` inside local lanes after
an experiment.

## Contents

| Path | Contents | Tracked |
|---|---|---|
| `local-build.rb` | Local runtime build driver replaying `runtime-up/.github/workflows/build.yml`. | yes |
| `release-notes-474.md` | Release notes and digests for runtime 4.7.3/4.7.4 experiments. | yes |
| `runtime-47/`, `runtime-up/`, `runtime-ci/` | Local runtime lane checkouts. | no |
| `pkg-*/`, `deps/`, `.local-ci/` | Packaged runtimes, dependencies, and build state. | no |
| `../../dxmt/` | Sibling checkout of `rolling7ho/dxmt` used by `../scripts/build-vodka-d3d12.sh`. | separate repo |
| `../../winecx/` | Sibling checkout of `rolling7ho/winecx`. | separate repo |

## Usage

Run `local-build.rb` from the `runtime/` directory (or from a dedicated external workbench
directory) so that relative lane paths resolve:

```sh
cd runtime && ruby local-build.rb
```

Changes to `winecx` or `dxmt` belong in their respective repositories, not in `rolling7ho/Vodka`.
