#!/bin/bash
# Builds Gmac's DirectX 12 layer (DXMT, https://github.com/rolling7ho/dxmt, branch
# teardown) and stages it where scripts/install-local.sh embeds it in the app.
#
# Usage: scripts/build-gmac-d3d12.sh [dxmt checkout]
#        (default: $GMAC_DXMT_DIR or ../dxmt, sibling checkout of rolling7ho/dxmt)
#
# The checkout needs DXMT's toolchains/ (llvm-darwin and wine), as for any DXMT
# build, and both mingw-w64 cross compilers. The bridge is built as gmacmetal,
# so it sits beside the runtime's own winemetal instead of replacing it.
#
# Stages build/gmac-d3d12/{x64,x32}/{d3d12,dxgi,gmacmetal}.dll and
# build/gmac-d3d12/unix/gmacmetal.so.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DXMT="$(cd "${1:-${GMAC_DXMT_DIR:-$ROOT/../dxmt}}" && pwd)"
OUT="$ROOT/build/gmac-d3d12"

for bits in 64 32; do
    dir="$DXMT/build-gmac$bits"
    if [ ! -f "$dir/build.ninja" ]; then
        (cd "$DXMT" && meson setup "build-gmac$bits" --cross-file "build-win$bits.txt" \
            --buildtype release --strip -Denable_d3d12=true -Dwine_builtin_dll=false \
            -Dwinemetal_name=gmacmetal -Dnative_llvm_path=toolchains/llvm-darwin \
            -Dwine_install_path=toolchains/wine --prefix "$DXMT/install-gmac$bits")
    fi
    ninja -C "$dir" install
done

rm -rf "$OUT"
mkdir -p "$OUT/x64" "$OUT/x32" "$OUT/unix"
cp "$DXMT"/install-gmac64/system32/{d3d12,dxgi}.dll "$DXMT/install-gmac64/x86_64-windows/gmacmetal.dll" "$OUT/x64/"
cp "$DXMT"/install-gmac32/syswow64/{d3d12,dxgi}.dll "$DXMT/install-gmac32/i386-windows/gmacmetal.dll" "$OUT/x32/"
cp "$DXMT/install-gmac64/x86_64-unix/gmacmetal.so" "$OUT/unix/"
# Record the DXMT source commit when building from a Git checkout.
if git -C "$DXMT" rev-parse --git-dir >/dev/null 2>&1; then
    DXMT_REF="$(git -C "$DXMT" rev-parse --short HEAD)"
    DXMT_LOG="$(git -C "$DXMT" log -1 --format='rolling7ho/dxmt %H %s')"
else
    DXMT_REF="untracked"
    DXMT_LOG="dxmt $DXMT"
fi
printf '%s\n' "$DXMT_LOG" > "$OUT/SOURCE"
echo "Staged $OUT ($DXMT_REF)"
