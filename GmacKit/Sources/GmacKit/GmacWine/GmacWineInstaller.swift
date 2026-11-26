//
//  GmacWineInstaller.swift
//  GmacKit
//
//  This file is part of Gmac, a fork of Whisky.
//
//  Gmac is free software: you can redistribute it and/or modify it under the terms
//  of the GNU General Public License as published by the Free Software Foundation,
//  either version 3 of the License, or (at your option) any later version.
//
//  Gmac is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
//  without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
//  See the GNU General Public License for more details.
//
//  You should have received a copy of the GNU General Public License along with Gmac.
//  If not, see https://www.gnu.org/licenses/.
//

// swiftlint:disable file_length
import CryptoKit
import Foundation
import os
import SemanticVersion

private let logger = Logger(subsystem: Bundle.gmacBundleIdentifier, category: "GmacWineInstaller")

/// Errors thrown by ``GmacWineInstaller/install(from:)``.
public enum GmacWineInstallError: LocalizedError, Equatable {
    /// The downloaded tarball was not found at the expected path — typically the
    /// OS purged the temporary download before installation ran.
    case tarballNotFound

    public var errorDescription: String? {
        switch self {
        case .tarballNotFound:
            String(localized: "setup.gmacwine.error.tarballMissing")
        }
    }
}

/// Manages the installation and updates of the GmacWine runtime.
///
/// `GmacWineInstaller` handles downloading, installing, and managing the
/// Wine runtime that Gmac uses to run Windows applications. It provides
/// version checking, update detection, and installation/uninstallation.
///
/// ## Overview
///
/// GmacWine is a custom Wine build bundled with Gmac. This class manages
/// its lifecycle within the application's Library directory.
///
/// ## Checking Installation Status
///
/// ```swift
/// if GmacWineInstaller.isGmacWineInstalled() {
///     if let version = GmacWineInstaller.gmacWineVersion() {
///         print("GmacWine version: \(version)")
///     }
/// } else {
///     // Prompt user to install
/// }
/// ```
///
/// ## Installing GmacWine
///
/// ```swift
/// // After downloading the tarball
/// do {
///     try GmacWineInstaller.install(from: downloadedTarballURL)
/// } catch {
///     // Surface the failure cause to the user
/// }
/// ```
///
/// ## Topics
///
/// ### File Locations
/// - ``applicationFolder``
/// - ``libraryFolder``
/// - ``binFolder``
///
/// ### Installation Status
/// - ``isGmacWineInstalled()``
/// - ``gmacWineVersion()``
///
/// ### Installation Management
/// - ``install(from:)``
/// - ``uninstall()``
/// - ``shouldUpdateGmacWine()``
public class GmacWineInstaller {
    /// The root application support folder for Gmac.
    ///
    /// Located at `~/Library/Application Support/{bundle-identifier}/`.
    public static let applicationFolder = FileManager.default.urls(
        for: .applicationSupportDirectory, in: .userDomainMask
    )[0].appending(path: Bundle.gmacBundleIdentifier)

    /// The folder containing all library files including Wine and DXVK.
    ///
    /// Located at `~/Library/Application Support/{bundle-identifier}/Libraries/`.
    public static let libraryFolder = applicationFolder.appending(path: "Libraries")

    /// The URL to the Wine binary directory.
    ///
    /// This folder contains `wine64`, `wineserver`, and other Wine executables.
    public static let binFolder: URL = libraryFolder.appending(path: "Wine").appending(path: "bin")

    /// Checks whether GmacWine is currently installed and usable.
    ///
    /// Requires both a readable version plist *and* the `wine64` binary on disk:
    /// a half-extracted or partially-removed runtime can leave the plist behind
    /// without the binary, and reporting that as "installed" makes every bottle
    /// fail confusingly instead of prompting a re-install.
    ///
    /// - Returns: `true` only if the runtime is present and runnable.
    public static func isGmacWineInstalled() -> Bool {
        isRuntimePresent(inLibraryFolder: libraryFolder)
    }

    /// Whether a usable runtime exists under `folder` — both the version plist
    /// and the `wine64` binary the app actually executes. Factored out of
    /// ``isGmacWineInstalled()`` so it can be tested against a temp directory.
    static func isRuntimePresent(inLibraryFolder folder: URL) -> Bool {
        let versionPlist = folder.appending(path: "WhiskyWineVersion").appendingPathExtension("plist")
        guard gmacWineInfo(at: versionPlist) != nil else { return false }

        // Mirrors `Wine.wineBinary` (binFolder/wine64), the executable used to
        // launch every program — if it's missing the runtime isn't usable.
        let wineBinary = folder.appending(path: "Wine").appending(path: "bin").appending(path: "wine64")
        return FileManager.default.fileExists(atPath: wineBinary.path(percentEncoded: false))
    }

    /// Checks whether the installed runtime bundles Apple's D3DMetal layer.
    ///
    /// GPTK-based Wine builds carry D3DMetal under `Wine/lib/external/` as
    /// `D3DMetal.framework` with `libd3dshared.dylib` alongside. Runtimes built
    /// without GPTK ship neither, and a bottle configured for D3DMetal silently
    /// falls back to wined3d at launch.
    ///
    /// - Returns: `true` only if the D3DMetal payload is present on disk.
    public static func isD3DMetalInstalled() -> Bool {
        isD3DMetalPresent(inLibraryFolder: libraryFolder)
    }

    /// Whether the D3DMetal payload exists under `folder`. Factored out of
    /// ``isD3DMetalInstalled()`` so it can be tested against a temp directory.
    static func isD3DMetalPresent(inLibraryFolder folder: URL) -> Bool {
        let external = folder.appending(path: "Wine").appending(path: "lib").appending(path: "external")
        let candidates = [
            external.appending(path: "D3DMetal.framework"),
            external.appending(path: "libd3dshared.dylib")
        ]
        return candidates.contains { FileManager.default.fileExists(atPath: $0.path(percentEncoded: false)) }
    }

    /// Installs GmacWine from a downloaded tarball.
    ///
    /// This method extracts the GmacWine tarball to the application support
    /// directory. If GmacWine is already installed, it is replaced.
    ///
    /// - Parameter from: The URL to the downloaded tarball file.
    /// - Note: The tarball is NOT deleted after extraction. Call ``cleanupTarball(at:)``
    ///   after verifying installation success with ``isGmacWineInstalled()``.
    /// - Throws: ``GmacWineInstallError/tarballNotFound`` if the tarball is gone,
    ///   or a `TarError`/`CocoaError` if extraction or the destination rebuild fails.
    ///   The cause propagates so callers can surface the specific reason.
    ///
    /// - Important: Ensure the tarball is from a trusted source.
    public static func install(from: URL) throws {
        try install(tarball: from, into: applicationFolder)
        WineGameMode.apply()
    }

    /// Extracts a GmacWine tarball into `destination`, replacing any existing
    /// `Libraries/` runtime there. Factored out of ``install(from:)`` so
    /// extraction can be tested against a temporary directory without touching
    /// the real application support folder.
    ///
    /// Only the `Libraries` subfolder is removed before extraction. The
    /// destination is the live Application Support folder, which also holds
    /// unrelated app state (e.g. the analytics SDK's anonymous ID and queued
    /// events) — wiping the whole folder destroyed that state on every runtime
    /// install and update.
    static func install(tarball: URL, into destination: URL) throws {
        // Verify the tarball exists before modifying the destination, so a
        // purged temp file cannot leave the destination half-rebuilt.
        let fileManager = FileManager.default
        guard fileManager.fileExists(atPath: tarball.path) else {
            throw GmacWineInstallError.tarballNotFound
        }

        try fileManager.createDirectory(at: destination, withIntermediateDirectories: true)

        // Stage extraction inside the destination directory so that the
        // replacement happens on the same volume and an extraction failure
        // leaves any existing Libraries/ runtime intact.
        let staging = destination.appending(path: ".Libraries-staging-\(UUID().uuidString)")
        try fileManager.createDirectory(at: staging, withIntermediateDirectories: true)
        defer { try? fileManager.removeItem(at: staging) }

        try Tar.untar(tarBall: tarball, toURL: staging)

        let existingRuntime = destination.appending(path: "Libraries")
        let stagedRuntime = staging.appending(path: "Libraries")
        if fileManager.fileExists(atPath: stagedRuntime.path(percentEncoded: false)) {
            if (try? fileManager.attributesOfItem(atPath: existingRuntime.path(percentEncoded: false))) != nil {
                _ = try fileManager.replaceItemAt(existingRuntime, withItemAt: stagedRuntime)
            } else {
                try fileManager.moveItem(at: stagedRuntime, to: existingRuntime)
            }
            return
        }

        if (try? fileManager.attributesOfItem(atPath: existingRuntime.path(percentEncoded: false))) != nil {
            try fileManager.removeItem(at: existingRuntime)
        }
        let entries = try fileManager.contentsOfDirectory(at: staging, includingPropertiesForKeys: nil)
        for entry in entries {
            let target = destination.appending(path: entry.lastPathComponent)
            if (try? fileManager.attributesOfItem(atPath: target.path(percentEncoded: false))) != nil {
                _ = try fileManager.replaceItemAt(target, withItemAt: entry)
            } else {
                try fileManager.moveItem(at: entry, to: target)
            }
        }
    }

    /// Computes the SHA-256 of a file by streaming it in chunks.
    ///
    /// The archive can be several hundred megabytes, so the file is hashed
    /// incrementally rather than read fully into memory.
    ///
    /// - Parameter url: The file to hash.
    /// - Returns: The lowercase hex SHA-256 digest, or `nil` if the file cannot
    ///   be opened or read.
    public static func sha256(ofFileAt url: URL) -> String? {
        guard let handle = try? FileHandle(forReadingFrom: url) else {
            logger.error("Cannot open \(url.path) to compute SHA-256")
            return nil
        }
        defer { try? handle.close() }

        var hasher = SHA256()
        let chunkSize = 1 << 20 // 1 MiB
        do {
            while true {
                // `read(upToCount:)` returns nil at EOF and may return an empty
                // (non-nil) Data on some streams; treat both as "no more bytes".
                guard let chunk = try handle.read(upToCount: chunkSize), !chunk.isEmpty else {
                    break
                }
                hasher.update(data: chunk)
            }
        } catch {
            logger.error("Failed reading \(url.path) for SHA-256: \(error.localizedDescription)")
            return nil
        }

        return hasher.finalize().map { String(format: "%02x", $0) }.joined()
    }

    /// The outcome of checking a downloaded archive against an expected digest.
    public enum IntegrityResult: Equatable, Sendable {
        /// The file's digest matched the expected value.
        case match
        /// The file hashed successfully but did not match. Carries the actual
        /// lowercase-hex digest so callers can report it in diagnostics.
        case mismatch(actual: String)
        /// The file could not be read to compute a digest.
        case unreadable
    }

    /// Checks a file's SHA-256 against an expected hex digest.
    ///
    /// This is an integrity check — it confirms the downloaded archive is the
    /// exact bytes the runtime metadata advertised, catching truncated or
    /// corrupted downloads before install. It is not a substitute for the
    /// transport-level trust provided by HTTPS.
    ///
    /// - Parameters:
    ///   - url: The file to check.
    ///   - expected: The expected SHA-256 as a hex string (compared
    ///     case-insensitively).
    /// - Returns: ``IntegrityResult/match``, ``IntegrityResult/mismatch(actual:)``,
    ///   or ``IntegrityResult/unreadable``.
    public static func integrityResult(
        forFileAt url: URL,
        expectedSHA256 expected: String
    ) -> IntegrityResult {
        guard let actual = sha256(ofFileAt: url) else { return .unreadable }
        return actual.caseInsensitiveCompare(expected) == .orderedSame ? .match : .mismatch(actual: actual)
    }

    /// Removes the installation tarball after successful installation.
    ///
    /// Call this method only after ``isGmacWineInstalled()`` returns `true`
    /// to ensure the tarball is preserved for retry attempts if installation fails.
    ///
    /// - Parameter url: The URL to the tarball file to remove.
    public static func cleanupTarball(at url: URL) {
        do {
            if FileManager.default.fileExists(atPath: url.path) {
                try FileManager.default.removeItem(at: url)
            }
        } catch {
            logger.warning("Failed to cleanup tarball: \(error.localizedDescription)")
        }
    }

    /// Removes the installed GmacWine runtime.
    ///
    /// This deletes the Libraries folder containing Wine and DXVK.
    /// Existing bottles are not affected, but they will not be able
    /// to run programs until GmacWine is reinstalled.
    public static func uninstall() {
        do {
            try FileManager.default.removeItem(at: libraryFolder)
        } catch {
            logger.error("Failed to uninstall GmacWine: \(error.localizedDescription)")
        }
    }

    /// Removes everything Gmac has stored under Application Support: the
    /// GmacWine runtime and every bottle whose plist registration lives in
    /// the default bottles list. Caller is responsible for confirming with
    /// the user — this is destructive and unrecoverable.
    ///
    /// Bottles stored at custom paths outside the default bottles directory
    /// are not removed; their tracking entries are dropped from the
    /// `BottleData` plist but the on-disk bottle directories are preserved
    /// to avoid surprising users who relocated bottles intentionally.
    public static func uninstallAll() {
        // Drop the runtime first so partial failures still leave a coherent state.
        uninstall()

        // Default bottles directory (matches `Bottle.defaultBottlesDirectory`).
        let defaultBottles = applicationFolder.appending(path: "Bottles")
        if FileManager.default.fileExists(atPath: defaultBottles.path(percentEncoded: false)) {
            do {
                try FileManager.default.removeItem(at: defaultBottles)
            } catch {
                logger.error("Failed to remove default bottles folder: \(error.localizedDescription)")
            }
        }

        // The GPTK store sits outside Libraries so it survives engine updates;
        // a full uninstall is the one case where it should not.
        try? FileManager.default.removeItem(at: GPTKImporter.storeFolder)

        // BottleData.plist registers bottle paths; remove it so a reinstall
        // starts with no orphaned entries pointing at deleted directories.
        let bottleData = applicationFolder.appending(path: "BottleData.plist")
        if FileManager.default.fileExists(atPath: bottleData.path(percentEncoded: false)) {
            try? FileManager.default.removeItem(at: bottleData)
        }
    }

    /// Checks if a newer version of GmacWine is available.
    ///
    /// This method compares the locally installed version against the
    /// remote version plist to determine if an update is available.
    ///
    /// - Returns: A tuple containing:
    ///   - A boolean indicating whether an update is available.
    ///   - The remote version if an update is available, or `0.0.0` otherwise.
    public static func shouldUpdateGmacWine() async -> (Bool, SemanticVersion) {
        let versionPlistURL = DistributionConfig.versionPlistURL
        let localVersion = gmacWineVersion()

        var remoteVersion: SemanticVersion?

        if let remoteUrl = URL(string: versionPlistURL) {
            let session = URLSession(configuration: .ephemeral)
            defer { session.finishTasksAndInvalidate() }
            do {
                let (data, _) = try await session.data(from: remoteUrl)
                let decoder = PropertyListDecoder()
                let remoteInfo = try decoder.decode(GmacWineVersion.self, from: data)
                remoteVersion = remoteInfo.version
            } catch {
                logger.warning("Failed to fetch or decode remote version: \(error.localizedDescription)")
            }
        }

        if let localVersion, let remoteVersion {
            if localVersion < remoteVersion {
                return (true, remoteVersion)
            }
        }
        // This edition's engine is newer than the channel's and is what the
        // download installs; an older engine is offered it as an update.
        let gamingVersion = DistributionConfig.gamingRuntime.version
        if let localVersion, localVersion < gamingVersion {
            return (true, gamingVersion)
        }

        return (false, SemanticVersion(0, 0, 0))
    }

    /// Returns the version of the installed GmacWine runtime.
    ///
    /// - Returns: The semantic version of the installed GmacWine,
    ///   or `nil` if GmacWine is not installed or the version
    ///   file cannot be read.
    public static func gmacWineVersion() -> SemanticVersion? {
        gmacWineInfo()?.version
    }

    /// The bundled DXVK (macOS) version recorded in the installed runtime's
    /// version plist, or `nil` if GmacWine is not installed or the plist does
    /// not record a DXVK version.
    public static func gmacWineDXVKVersion() -> String? {
        gmacWineInfo()?.dxvkVersion
    }

    /// The bundled DXMT version recorded in the installed runtime's version
    /// plist, or `nil` if GmacWine is not installed or the runtime predates
    /// the DXMT payload (< v3.1.0). `nil` means the DXMT graphics backend is
    /// unavailable.
    public static func gmacWineDXMTVersion() -> String? {
        gmacWineInfo()?.dxmtVersion
    }

    /// Whether `backend` can actually be selected against the currently
    /// installed runtime. Extends the pure
    /// ``GraphicsBackend/isAvailable(runtimeInfo:)`` version gate with the
    /// payload checks version records can't express: DXMT needs the *native*
    /// payload variant (an older builtin-variant payload would silently
    /// redirect to wined3d), and D3DMetal needs the GPTK payload on disk —
    /// without it a d3dMetal bottle silently degrades to wined3d at launch
    /// (issue #146).
    public static func isBackendAvailable(_ backend: GraphicsBackend) -> Bool {
        backendAvailability(
            backend,
            runtimeInfo: gmacWineInfo(),
            d3dMetalInstalled: isD3DMetalInstalled(),
            dxmtRuntimeNative: Wine.isDXMTRuntimeNative()
        )
    }

    /// Pure availability logic behind ``isBackendAvailable(_:)``, with every
    /// machine-dependent input injected so tests answer the same on every
    /// machine.
    static func backendAvailability(
        _ backend: GraphicsBackend,
        runtimeInfo: GmacWineVersion?,
        d3dMetalInstalled: Bool,
        dxmtRuntimeNative: Bool
    ) -> Bool {
        let versionAvailable = backend.isAvailable(runtimeInfo: runtimeInfo)
        switch backend {
        case .dxmt:
            return versionAvailable && dxmtRuntimeNative
        case .d3dMetal:
            return versionAvailable && d3dMetalInstalled
        case .recommended, .dxvk, .dxmtD3D12, .wined3d:
            return versionAvailable
        }
    }

    /// Reads the full version record from the installed GmacWine runtime.
    ///
    /// - Returns: The decoded ``GmacWineVersion``, or `nil` if GmacWine is
    ///   not installed or the version file cannot be read.
    public static func gmacWineInfo() -> GmacWineVersion? {
        let versionPlist = libraryFolder
            .appending(path: "WhiskyWineVersion")
            .appendingPathExtension("plist")
        return gmacWineInfo(at: versionPlist)
    }

    /// Reads a GmacWine version record from a plist at an arbitrary URL.
    ///
    /// ``gmacWineInfo()`` resolves the installed location; this overload reads
    /// any plist URL (also convenient for tests).
    ///
    /// - Parameter url: The location of a `WhiskyWineVersion.plist` file.
    /// - Returns: The decoded record, or `nil` if it is missing or malformed.
    public static func gmacWineInfo(at url: URL) -> GmacWineVersion? {
        do {
            let decoder = PropertyListDecoder()
            let data = try Data(contentsOf: url)
            return try decoder.decode(GmacWineVersion.self, from: data)
        } catch let error as CocoaError where error.code == .fileReadNoSuchFile {
            // Expected when GmacWine simply isn't installed yet.
            logger.debug("GmacWine version plist absent: \(error.localizedDescription)")
            return nil
        } catch {
            // Present but unreadable/undecodable — likely a corrupt install.
            logger.error("GmacWine version plist unreadable, likely corrupt: \(error.localizedDescription)")
            return nil
        }
    }
}
