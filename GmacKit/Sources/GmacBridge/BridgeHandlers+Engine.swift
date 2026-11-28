//
//  BridgeHandlers+Engine.swift
//  GmacBridge
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

import Foundation
import GmacKit
import SemanticVersion

private final class ProgressThrottle: @unchecked Sendable {
    private let lock = NSLock()
    private var lastEmit = Date.distantPast
    private var lastPercent = -1

    func shouldEmit(percent: Int, force: Bool = false) -> Bool {
        lock.lock()
        defer { lock.unlock() }
        let now = Date()
        if force || percent >= lastPercent + 2 || now.timeIntervalSince(lastEmit) >= 0.2 {
            lastEmit = now
            lastPercent = percent
            return true
        }
        return false
    }
}

extension BridgeRouter {
    private static var archiveDestination: URL {
        FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
            .appending(path: Bundle.gmacBundleIdentifier)
            .appending(path: "RuntimeDownload")
            .appending(path: "Libraries.tar.gz")
    }

    func installEngine(requestID: Int) async throws -> JSONValue {
        try await ensureRosettaInstalled(requestID: requestID)

        if GmacWineInstaller.isGmacWineInstalled() {
            writer.sendEvent(id: requestID, data: [
                "component": .string("engine"),
                "status": .string("installed"),
                "progress": .int(100),
                "detail": .string("Installed")
            ])
            return .object(["installed": .bool(true)])
        }

        let (downloadURL, expectedSHA256) = try await resolveRuntimeDownload()
        let destination = Self.archiveDestination

        try await downloadOrReuseArchive(
            requestID: requestID,
            downloadURL: downloadURL,
            destination: destination,
            expectedSHA256: expectedSHA256
        )

        try verifyAndExtractArchive(
            requestID: requestID,
            destination: destination,
            expectedSHA256: expectedSHA256
        )

        return .object(["installed": .bool(true)])
    }

    private func ensureRosettaInstalled(requestID: Int) async throws {
        if !Rosetta2.isRosettaInstalled {
            writer.sendEvent(id: requestID, data: [
                "component": .string("rosetta"),
                "status": .string("installing")
            ])
            let installed = try await Rosetta2.installRosetta()
            guard installed else {
                throw BridgeError.operationFailed("Rosetta 2 installation failed.")
            }
        }
        writer.sendEvent(id: requestID, data: [
            "component": .string("rosetta"),
            "status": .string("installed")
        ])
    }

    private func downloadOrReuseArchive(
        requestID: Int,
        downloadURL: URL,
        destination: URL,
        expectedSHA256: String?
    ) async throws {
        if let expected = expectedSHA256,
           FileManager.default.fileExists(atPath: destination.path(percentEncoded: false)) {
            let integrity = GmacWineInstaller.integrityResult(
                forFileAt: destination,
                expectedSHA256: expected
            )
            if integrity == .match {
                return
            }
            ResumableDownloader.discardArtifacts(at: destination)
        }

        try await downloadRuntimeArchive(
            requestID: requestID,
            from: downloadURL,
            to: destination
        )
    }

    private func verifyAndExtractArchive(
        requestID: Int,
        destination: URL,
        expectedSHA256: String?
    ) throws {
        writer.sendEvent(id: requestID, data: [
            "component": .string("engine"),
            "status": .string("verifying"),
            "progress": .int(100),
            "detail": .string("Verifying archive (SHA-256)...")
        ])

        if let expected = expectedSHA256 {
            let integrity = GmacWineInstaller.integrityResult(
                forFileAt: destination,
                expectedSHA256: expected
            )
            guard integrity == .match else {
                ResumableDownloader.discardArtifacts(at: destination)
                throw BridgeError.operationFailed(
                    "The downloaded Wine runtime failed its SHA-256 integrity check."
                )
            }
        }

        writer.sendEvent(id: requestID, data: [
            "component": .string("engine"),
            "status": .string("verifying"),
            "progress": .int(100),
            "detail": .string("Installing Gmac Windows Engine...")
        ])

        try GmacWineInstaller.install(from: destination)
        guard GmacWineInstaller.isGmacWineInstalled() else {
            throw BridgeError.operationFailed("Gmac Windows Engine installation verification failed.")
        }
        GmacWineInstaller.cleanupTarball(at: destination)
        GPTKImporter.deployStoredPayloadIfCapable()

        writer.sendEvent(id: requestID, data: [
            "component": .string("engine"),
            "status": .string("installed"),
            "progress": .int(100),
            "detail": .string("Installed")
        ])
    }

    private func resolveRuntimeDownload() async throws -> (URL, String?) {
        guard let versionURL = URL(string: DistributionConfig.versionPlistURL) else {
            throw BridgeError.operationFailed("Invalid runtime version URL.")
        }

        let (data, response) = try await URLSession(configuration: .ephemeral).data(from: versionURL)
        if let http = response as? HTTPURLResponse, !(200 ... 299).contains(http.statusCode) {
            throw BridgeError.operationFailed("Version check failed with HTTP \(http.statusCode).")
        }

        let info = try PropertyListDecoder().decode(GmacWineVersion.self, from: data)
        let gaming = DistributionConfig.gamingRuntime
        let useGaming = info.version < gaming.version
        let expectedSHA256 = useGaming ? gaming.sha256 : info.sha256
        let versionString = useGaming
            ? gaming.tag
            : "\(info.version.major).\(info.version.minor).\(info.version.patch)"
        let urlString = useGaming
            ? DistributionConfig.gamingRuntimeURL
            : DistributionConfig.librariesURL(version: versionString)

        guard let downloadURL = URL(string: urlString) else {
            throw BridgeError.operationFailed("Invalid runtime download URL.")
        }

        return (downloadURL, expectedSHA256)
    }

    private func downloadRuntimeArchive(requestID: Int, from url: URL, to destination: URL) async throws {
        let config = URLSessionConfiguration.ephemeral
        config.waitsForConnectivity = true
        config.timeoutIntervalForRequest = 60
        config.timeoutIntervalForResource = 600
        let downloader = ResumableDownloader(sessionConfiguration: config)
        let throttle = ProgressThrottle()
        let eventWriter = writer

        try await downloader.download(
            from: url,
            to: destination,
            progress: { progress in
                let total = progress.expectedBytes ?? 0
                let percent = total > 0
                    ? min(100, Int((Double(progress.bytesOnDisk) / Double(total) * 100.0).rounded()))
                    : 0
                guard throttle.shouldEmit(percent: percent, force: percent == 100) else {
                    return
                }
                let receivedMB = Self.formatMegabytes(progress.bytesOnDisk)
                let totalMB = total > 0 ? Self.formatMegabytes(total) : "460 MB"
                eventWriter.sendEvent(id: requestID, data: [
                    "component": .string("engine"),
                    "status": .string("installing"),
                    "progress": .int(percent),
                    "detail": .string("\(receivedMB) of \(totalMB)")
                ])
            }
        )
    }

    private static func formatMegabytes(_ bytes: Int64) -> String {
        let megabytes = Double(bytes) / (1_024.0 * 1_024.0)
        return String(format: "%.0f MB", megabytes)
    }
}
