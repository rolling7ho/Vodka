//
//  AuditedBugRegressionTests.swift
//  GmacKitTests
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
@testable import GmacKit
import Testing

@Suite("Audited Bug Regression Tests")
struct AuditedBugRegressionTests {
    // MARK: - GameDBEntry

    @Test("GameConfigVariantSettings decodes enhancedSync 'none' as EnhancedSync.none")
    func decodesEnhancedSyncNone() throws {
        let json = #"{"enhancedSync": "none"}"#
        let settings = try JSONDecoder().decode(GameConfigVariantSettings.self, from: Data(json.utf8))
        #expect(settings.enhancedSync == EnhancedSync.none)
    }

    // MARK: - VDFParser CRLF handling

    @Test("VDFParser stops line comments at CRLF and tracks CRLF line numbers")
    func vdfParserHandlesCRLFCommentsAndLineNumbers() throws {
        let document = "// header comment\r\n\"AppState\"\r\n{\r\n\t\"appid\"\t\"12345\" // trailing\r\n}\r\n"
        let root = try VDFParser.parse(document)
        let appState = try #require(root["appstate"]?.objectValue)
        #expect(appState["appid"]?.intValue == 12_345)

        #expect(throws: VDFParseError.unterminatedString(line: 2)) {
            try VDFParser.parse("\"a\" \"b\"\r\n\"unterminated\r\n\"c\" \"d\"")
        }

        #expect(throws: VDFParseError.unexpectedToken(line: 3)) {
            try VDFParser.parse("\"a\" \"b\"\r\n\"c\" \"d\"\r\nbare")
        }
    }

    // MARK: - ShellLink Unicode paths

    @Test("LinkInfo decodes UTF-16LE Unicode paths with two-byte null terminators")
    @MainActor
    func linkInfoDecodesUnicodePath() throws {
        let tempDir = FileManager.default.temporaryDirectory
            .appending(path: "shelllink-unicode-\(UUID().uuidString)")
        let bottleURL = tempDir.appending(path: "Bottle")
        try FileManager.default.createDirectory(
            at: bottleURL.appending(path: "drive_c/Games"),
            withIntermediateDirectories: true
        )
        defer { try? FileManager.default.removeItem(at: tempDir) }

        let windowsPath = "C:\\Games\\Sample.exe"
        var pathData = try #require(windowsPath.data(using: .utf16LittleEndian))
        pathData.append(contentsOf: [0x00, 0x00])

        let headerSize: UInt32 = 0x24
        let linkInfoSize = headerSize + UInt32(pathData.count)
        var data = Data()
        for value: UInt32 in [linkInfoSize, headerSize, 0x01, 0, 0, 0, 0, headerSize, 0] {
            data.append(contentsOf: withUnsafeBytes(of: value.littleEndian) { Array($0) })
        }
        data.append(pathData)

        let fileURL = tempDir.appending(path: "unicode.bin")
        try data.write(to: fileURL)

        let handle = try FileHandle(forReadingFrom: fileURL)
        defer { try? handle.close() }

        let bottle = Bottle(bottleUrl: bottleURL)
        var offset: UInt64 = 0
        let info = LinkInfo(handle: handle, bottle: bottle, offset: &offset)

        let expectedPath = bottleURL.appending(path: "drive_c/Games/Sample.exe").path(percentEncoded: false)
        #expect(info.program?.url.path(percentEncoded: false) == expectedPath)
        #expect(offset == UInt64(linkInfoSize))
    }

    // MARK: - Tasklist CSV parsing

    @Test("parseTasklistOutput preserves commas inside quoted fields")
    func parseTasklistPreservesQuotedCommas() {
        let csv = """
        "Image Name","PID","Session Name","Session#","Mem Usage"
        "game.exe","42","Console","0","24,576 K"
        "big,game.exe","99","Console","0","1,234,567 K"
        """

        let processes = Wine.parseTasklistOutput(csv)
        #expect(processes.count == 2)
        #expect(processes[0].imageName == "game.exe")
        #expect(processes[0].winePID == 42)
        #expect(processes[0].memoryUsage == "24,576 K")
        #expect(processes[1].imageName == "big,game.exe")
        #expect(processes[1].winePID == 99)
        #expect(processes[1].memoryUsage == "1,234,567 K")
    }

    // MARK: - BottleOperations.remove inFlight reset

    @Test("BottleOperations.remove clears inFlight when file deletion fails")
    @MainActor
    func bottleRemoveFailureClearsInFlight() throws {
        let tempDir = FileManager.default.temporaryDirectory
            .appending(path: "bottle-remove-\(UUID().uuidString)")
        let bottleURL = tempDir.appending(path: "Bottle")
        try FileManager.default.createDirectory(at: bottleURL, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: tempDir) }

        final class InMemoryRegistry: BottleRegistry {
            var bottles: [Bottle] = []
            var bottlePaths: [URL] = []

            func bottle(for url: URL) -> Bottle? {
                bottles.first { $0.url == url }
            }

            func loadBottles() {}
        }

        let bottle = Bottle(bottleUrl: bottleURL)
        let registry = InMemoryRegistry()
        registry.bottles = [bottle]
        registry.bottlePaths = [bottleURL]

        // Removing the directory first forces FileManager.removeItem to throw.
        try FileManager.default.removeItem(at: bottleURL)

        BottleOperations.remove(bottleAt: bottleURL, deleteFiles: true, registry: registry)

        #expect(!bottle.inFlight)
        #expect(registry.bottlePaths == [bottleURL])
    }

    // MARK: - DiagnosticExporter JSON escaping and UTF-8 tail slicing

    @Test("DiagnosticExporter produces valid JSON when arguments contain control characters")
    @MainActor
    func diagnosticExporterEscapesControlCharactersInJSON() throws {
        let tempDir = FileManager.default.temporaryDirectory
            .appending(path: "diag-json-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: tempDir, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: tempDir) }

        let bottle = Bottle(bottleUrl: tempDir)
        let program = Program(url: tempDir.appending(path: "game.exe"), bottle: bottle)
        program.settings.arguments = "--flag \"quoted\"\n--next\tvalue"

        let jsonString = DiagnosticExporter.programSettingsSummary(
            program: program,
            options: ExportOptions(includeSensitiveDetails: true)
        )
        let parsed = try JSONSerialization.jsonObject(with: Data(jsonString.utf8)) as? [String: String]
        #expect(parsed?["arguments"] == "--flag \"quoted\"\n--next\tvalue")
    }

    @Test("DiagnosticExporter.tailOfLogFile handles a multi-byte UTF-8 sequence across the 256 KB boundary")
    func diagnosticExporterTailHandlesMultibyteUTF8Boundary() throws {
        let tempDir = FileManager.default.temporaryDirectory
            .appending(path: "diag-tail-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: tempDir, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: tempDir) }

        let logURL = tempDir.appending(path: "wine.log")
        // Place a 3-byte UTF-8 character right across the 256 KiB tail boundary.
        let prefixBytes = Data(repeating: 0x41, count: 100)
        let multibyte = Data("界\n".utf8)
        let suffixLine = "final log line\n"
        let fillerCount = (256 * 1_024) - suffixLine.utf8.count - 1
        var payload = prefixBytes
        payload.append(multibyte)
        payload.append(Data(repeating: 0x42, count: fillerCount - 1))
        payload.append(0x0A)
        payload.append(Data(suffixLine.utf8))
        try payload.write(to: logURL)

        let tail = DiagnosticExporter.tailOfLogFile(logURL, lineCount: 5)
        #expect(tail.contains("final log line"))
        #expect(!tail.contains("not UTF-8"))
    }

    // MARK: - DLLOverrideResolver managed conflict detection

    @Test("DLLOverrideResolver compares custom overrides against the winning managed mode")
    func dllOverrideResolverUsesEffectiveManagedMode() {
        let resolver = DLLOverrideResolver(
            managed: [
                (entry: DLLOverrideEntry(dllName: "d3d11", mode: .nativeThenBuiltin), source: .dxvk),
                (entry: DLLOverrideEntry(dllName: "d3d11", mode: .builtin), source: .launcher("Steam"))
            ],
            bottleCustom: [
                DLLOverrideEntry(dllName: "d3d11", mode: .builtin)
            ],
            programCustom: []
        )

        let result = resolver.resolve()
        #expect(result.overrides == "d3d11=b")
        #expect(result.warnings.isEmpty)
    }

    // MARK: - TroubleshootingFlowEngine stale check cancellation

    @Test("TroubleshootingFlowEngine ignores stale check results after startOver")
    @MainActor
    func flowEngineCancelsInFlightCheckOnStartOver() async {
        struct DelayedCheck: TroubleshootingCheck {
            let checkId = "delayed.check"

            func run(params: [String: String], context: CheckContext) async -> CheckResult {
                try? await Task.sleep(for: .milliseconds(150))
                return CheckResult(outcome: .pass, summary: "Done")
            }
        }

        final class NullStore: TroubleshootingSessionStoring {
            func save(_ session: TroubleshootingSession) {}
            func completeSession(_ session: TroubleshootingSession) {}
        }

        let flow = FlowDefinition(
            version: 1,
            categoryId: "graphics",
            nodes: [
                "start": FlowStepNode(
                    id: "start",
                    type: .check,
                    phase: .checks,
                    checkId: "delayed.check",
                    on: ["pass": "after"]
                ),
                "after": FlowStepNode(id: "after", type: .info, phase: .checks, title: "After")
            ],
            entryNodeId: "start"
        )
        let registry = CheckRegistry()
        registry.register(DelayedCheck())
        let engine = TroubleshootingFlowEngine(
            flowDefinitions: ["graphics": flow],
            fragments: [:],
            checkRegistry: registry,
            sessionStore: NullStore()
        )

        engine.selectCategory(.graphics)
        #expect(engine.isRunningCheck)

        engine.startOver()
        #expect(!engine.isRunningCheck)
        #expect(engine.currentNode == nil)

        try? await Task.sleep(for: .milliseconds(250))

        #expect(engine.currentNode == nil)
        #expect(engine.session.phase == .symptom)
        #expect(engine.session.checkResults.isEmpty)
    }

    // MARK: - AudioTroubleshootingEngine stale probe cancellation

    @Test("AudioTroubleshootingEngine ignores stale probes after reset")
    @MainActor
    func audioEngineCancelsProbesOnReset() async {
        struct DelayedProbe: AudioProbe {
            let id = "delayed"
            let displayName = "Delayed Probe"

            func run() async -> AudioProbeResult {
                try? await Task.sleep(for: .milliseconds(150))
                return AudioProbeResult(probeId: id, status: .passed, summary: "OK")
            }
        }

        let engine = AudioTroubleshootingEngine(probes: [DelayedProbe()])
        engine.selectSymptom(.noSound)
        #expect(engine.wizardState == .runningProbes)

        engine.reset()
        #expect(engine.wizardState == .pickSymptom)

        try? await Task.sleep(for: .milliseconds(250))

        #expect(engine.wizardState == .pickSymptom)
        #expect(engine.probeResults.isEmpty)
    }
}
