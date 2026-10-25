#!/bin/bash
#
# build_audio_test.sh
#
# This file is part of Vodka, a fork of Whisky.
#
# Vodka is free software: you can redistribute it and/or modify it under the terms
# of the GNU General Public License as published by the Free Software Foundation,
# either version 3 of the License, or (at your option) any later version.
#
# Vodka is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
# without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
# See the GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License along with Vodka.
# If not, see https://www.gnu.org/licenses/.
#
# Cross-compiles vodka_audio_test.c into VodkaAudioTest.exe using MinGW.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SOURCE="${SCRIPT_DIR}/vodka_audio_test.c"
OUTPUT="${SCRIPT_DIR}/VodkaAudioTest.exe"
DEST_DIR="${SCRIPT_DIR}/../Vodka/Resources"
COMPILER="x86_64-w64-mingw32-gcc"

if ! command -v "${COMPILER}" &>/dev/null; then
    echo "Error: ${COMPILER} not found."
    echo "Install MinGW with: brew install mingw-w64"
    exit 1
fi

echo "Compiling VodkaAudioTest.exe..."
"${COMPILER}" -o "${OUTPUT}" "${SOURCE}" -lwinmm -lm

echo "Build successful: ${OUTPUT}"

if [ -d "${DEST_DIR}" ]; then
    cp "${OUTPUT}" "${DEST_DIR}/VodkaAudioTest.exe"
    echo "Copied to ${DEST_DIR}/VodkaAudioTest.exe"
else
    echo "Warning: ${DEST_DIR} does not exist. Copy manually to Vodka/Resources/."
fi
