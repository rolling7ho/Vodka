#!/bin/bash
# Builds Vodka's DirectX 12 layer (DXMT, https://github.com/rolling7ho/dxmt, branch
# teardown) and stages it where scripts/install-local.sh embeds it in the app.
#
# Usage: scripts/build-vodka-d3d12.sh [dxmt checkout]
#        (default: ../engine/dxmt-work/dxmt, next to this repository)
#
# The checkout needs DXMT's toolchains/ (llvm-darwin and wine), as for any DXMT
# build, and both mingw-w64 cross compilers. The bridge is built as vodkametal,
# so it sits beside the runtime's own winemetal instead of replacing it.
#
# Stages build/vodka-d3d12/{x64,x32}/{d3d12,dxgi,vodkametal}.dll and
# build/vodka-d3d12/unix/vodkametal.so.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DXMT="$(cd "${1:-$ROOT/../engine/dxmt-work/dxmt}" && pwd)"
OUT="$ROOT/build/vodka-d3d12"

for bits in 64 32; do
    dir="$DXMT/build-vodka$bits"
    if [ ! -f "$dir/build.ninja" ]; then
        (cd "$DXMT" && meson setup "build-vodka$bits" --cross-file "build-win$bits.txt" \
            --buildtype release --strip -Denable_d3d12=true -Dwine_builtin_dll=false \
            -Dwinemetal_name=vodkametal -Dnative_llvm_path=toolchains/llvm-darwin \
            -Dwine_install_path=toolchains/wine --prefix "$DXMT/install-vodka$bits")
    fi
    ninja -C "$dir" install
done

rm -rf "$OUT"
mkdir -p "$OUT/x64" "$OUT/x32" "$OUT/unix"
cp "$DXMT"/install-vodka64/system32/{d3d12,dxgi}.dll "$DXMT/install-vodka64/x86_64-windows/vodkametal.dll" "$OUT/x64/"
cp "$DXMT"/install-vodka32/syswow64/{d3d12,dxgi}.dll "$DXMT/install-vodka32/i386-windows/vodkametal.dll" "$OUT/x32/"
cp "$DXMT/install-vodka64/x86_64-unix/vodkametal.so" "$OUT/unix/"
git -C "$DXMT" log -1 --format='rolling7ho/dxmt %H %s' > "$OUT/SOURCE"
echo "Staged $OUT ($(git -C "$DXMT" rev-parse --short HEAD))"
