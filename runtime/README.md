# Runtime workbench

This directory contains the local Wine and CrossOver runtime build driver and release notes for Gmac's Windows runtime (`Libraries.tar.gz`). Runtime builds are packaged locally and published as GitHub Releases on `rolling7ho/gmac`.

The Wine and DXMT source trees live in separate repositories:

- `rolling7ho/winecx` (branch `d3dmetal-errno`): patched Wine and CrossOver source tree.
- `rolling7ho/dxmt` (branch `teardown`): DXMT source tree used to build `gmacmetal`.

Local build lanes (`runtime-47/`, `runtime-up/`, `runtime-ci/`), packaged runtimes (`pkg-*/`), build dependencies (`deps/`), and `.local-ci/` state are untracked and ignored by `.gitignore`. Delete `build/`, `staging/`, and `smoke-prefix*` inside local lanes after an experiment.

## Contents

| Path | Contents | Tracked |
|---|---|---|
| `local-build.rb` | Local runtime build driver replaying `runtime-up/.github/workflows/build.yml`. | yes |
| `release-notes-474.md` | Release notes and digest for the 4.7.3-based runtime experiment. | yes |
| `runtime-47/`, `runtime-up/`, `runtime-ci/` | Local runtime lane checkouts. | no |
| `pkg-*/`, `deps/`, `.local-ci/` | Packaged runtimes, dependencies, and build state. | no |
| `../../dxmt/` | Sibling checkout of `rolling7ho/dxmt` (`../dxmt/` from repository root) used by `../scripts/build-gmac-d3d12.sh`. | separate repo |
| `../../winecx/` | Sibling checkout of `rolling7ho/winecx` (`../winecx/` from repository root). | separate repo |

## Usage

Run `local-build.rb` from the `runtime/` directory so relative lane paths resolve:

```sh
cd runtime
ruby local-build.rb [first-step-name]
```

Optional environment variables control the build inputs:

- `RECIPE`: lane checkout directory (defaults to `runtime-up`).
- `WINECX_COMMIT`: `rolling7ho/winecx` commit hash to build.
- `RUNTIME_VERSION_OVERRIDE`: runtime version string stamped into the package (defaults to `4.8.0`).
- `FLOOR`: `MACOSX_DEPLOYMENT_TARGET` floor (defaults to `15.0`).

Changes to `winecx` or `dxmt` belong in their respective repositories, not in `rolling7ho/gmac`. See [`docs/DEPENDENCIES.md`](../docs/DEPENDENCIES.md) and [`docs/ReleaseWorkflow.md`](../docs/ReleaseWorkflow.md) for version pins and publishing steps.
