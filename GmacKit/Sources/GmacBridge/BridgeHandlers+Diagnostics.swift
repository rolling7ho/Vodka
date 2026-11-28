//
//  BridgeHandlers+Diagnostics.swift
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

extension BridgeRouter {
    func listLogs() -> JSONValue {
        let folder = Self.bridgeLogsFolder
        let items = (try? FileManager.default.contentsOfDirectory(
            at: folder,
            includingPropertiesForKeys: [.contentModificationDateKey, .fileSizeKey, .isRegularFileKey]
        )) ?? []

        let formatter = ISO8601DateFormatter()
        let logFiles: [(date: Date, json: JSONValue)] = items.compactMap { url in
            let values = try? url.resourceValues(
                forKeys: [.contentModificationDateKey, .fileSizeKey, .isRegularFileKey]
            )
            guard values?.isRegularFile == true else { return nil }
            let ext = url.pathExtension.lowercased()
            guard ext == "log" || ext == "txt" else { return nil }
            let modDate = values?.contentModificationDate ?? .distantPast
            let sizeBytes = values?.fileSize ?? 0
            let json = JSONValue.object([
                "name": .string(url.lastPathComponent),
                "path": .string(url.path(percentEncoded: false)),
                "sizeBytes": .int(sizeBytes),
                "modifiedAt": .string(formatter.string(from: modDate))
            ])
            return (modDate, json)
        }
        .sorted { $0.date > $1.date }

        return .object([
            "folder": .string(folder.path(percentEncoded: false)),
            "files": .array(logFiles.prefix(50).map(\.json))
        ])
    }

    @MainActor
    func readLogFile(params: [String: JSONValue]) throws -> JSONValue {
        guard let rawPath = params["path"]?.stringValue, !rawPath.isEmpty else {
            throw BridgeError.invalidParams("Missing log file path.")
        }
        let targetURL = try validatedReadableLogURL(rawPath)
        let content = try String(contentsOf: targetURL, encoding: .utf8)
        let lines = content.components(separatedBy: .newlines)
        let truncated = lines.count > 500
        let tailText = lines.suffix(500).joined(separator: "\n")
        return .object([
            "path": .string(targetURL.path(percentEncoded: false)),
            "content": .string(tailText),
            "lineCount": .int(lines.count),
            "truncated": .bool(truncated)
        ])
    }

    @MainActor
    func analyzeDiagnostics(params: [String: JSONValue]) throws -> JSONValue {
        let logText: String
        if let providedText = params["logText"]?.stringValue, !providedText.isEmpty {
            logText = providedText
        } else if let logPath = params["logPath"]?.stringValue, !logPath.isEmpty {
            let url = try validatedReadableLogURL(logPath)
            logText = try String(contentsOf: url, encoding: .utf8)
        } else {
            throw BridgeError.invalidParams("Provide logText or logPath.")
        }

        let exitCode = params["exitCode"]?.intValue.map { Int32($0) }
        let diagnosis = CrashClassifier().classify(log: logText, exitCode: exitCode)
        let (_, actionMap) = PatternLoader.loadDefaults()
        let remediations = diagnosis.remediations(from: actionMap)

        return .object([
            "primaryCategory": diagnosis.primaryCategory.map { .string($0.displayName) } ?? .null,
            "primaryConfidence": diagnosis.primaryConfidence.map { .string($0.rawValue) } ?? .null,
            "headline": diagnosis.headline.map { .string($0) } ?? .null,
            "matches": .array(diagnosis.matches.prefix(25).map(Self.encodeDiagnosisMatch)),
            "remediations": .array(remediations.map(Self.encodeRemediationAction))
        ])
    }

    @MainActor
    func exportDiagnosticsReport(params: [String: JSONValue]) async throws -> JSONValue {
        var bottlesList = BottleData()
        let available = bottlesList.loadBottles().filter(\.isAvailable)
        let bottle: Bottle
        if let requestedPath = params["bottlePath"]?.stringValue, !requestedPath.isEmpty {
            bottle = try resolveBottleForConfig(path: requestedPath)
        } else if let first = available.first {
            bottle = first
        } else {
            throw BridgeError.operationFailed("Create a PC before exporting diagnostics.")
        }

        let report = await StabilityDiagnostics.generateDiagnosticReport(for: bottle)
        let stamp = ISO8601DateFormatter().string(from: .now).replacingOccurrences(of: ":", with: "-")
        let desktop = FileManager.default.urls(for: .desktopDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
        let outURL = desktop.appending(path: "Gmac-Diagnostics-\(stamp).md")
        try report.write(to: outURL, atomically: true, encoding: .utf8)
        return .object([
            "path": .string(outURL.path(percentEncoded: false)),
            "report": .string(String(report.prefix(12_000)))
        ])
    }

    func listTroubleshootCategories() -> JSONValue {
        let flows = FlowLoader.loadAllFlows()
        let categories = SymptomCategory.allCases.map { category -> JSONValue in
            let flowKey = String(category.flowFileName.dropLast(5))
            return .object([
                "id": .string(category.rawValue),
                "title": .string(category.displayTitle),
                "hasFlow": .bool(flows[flowKey] != nil)
            ])
        }
        return .object(["categories": .array(categories)])
    }

    @MainActor
    func runTroubleshootFlow(params: [String: JSONValue]) async throws -> JSONValue {
        let bottle = try resolveBottleForConfig(path: params["bottlePath"]?.stringValue)
        let categoryRaw = params["category"]?.stringValue ?? SymptomCategory.launchCrash.rawValue
        let category = SymptomCategory(rawValue: categoryRaw) ?? .launchCrash
        let flowKey = String(category.flowFileName.dropLast(5))
        let flows = FlowLoader.loadAllFlows()
        guard let flow = flows[flowKey] else {
            throw BridgeError.operationFailed("No guided flow available for \(category.displayTitle).")
        }

        let preflight = await PreflightCollector.collect(bottle: bottle, program: nil)
        let session = TroubleshootingSession()
        let context = CheckContext.create(bottle: bottle, program: nil, preflight: preflight, session: session)
        let registry = CheckRegistry()

        var currentId: String? = params["nodeId"]?.stringValue ?? flow.entryNodeId
        var executedChecks: [JSONValue] = []
        var visited: Set<String> = []
        var stopNode: FlowStepNode?

        while let nodeId = currentId, visited.insert(nodeId).inserted, executedChecks.count < 16 {
            guard let node = flow.nodes[nodeId] else { break }
            if node.type == .check, let checkId = node.checkId {
                let result = await registry.run(checkId: checkId, params: node.params ?? [:], context: context)
                executedChecks.append(.object([
                    "nodeId": .string(node.id),
                    "checkId": .string(checkId),
                    "title": .string(node.title ?? checkId),
                    "outcome": .string(result.outcome.rawValue),
                    "summary": .string(result.summary),
                    "confidence": result.confidence.map { .string($0.rawValue) } ?? .null
                ]))
                currentId = node.on?[result.outcome.rawValue] ?? node.on?["default"]
                continue
            }
            stopNode = node
            break
        }

        return .object([
            "category": .string(category.rawValue),
            "executedChecks": .array(executedChecks),
            "node": stopNode.map { Self.encodeFlowNode($0, bottle: bottle) } ?? .null
        ])
    }

    @MainActor
    func applyTroubleshootFix(params: [String: JSONValue]) async throws -> JSONValue {
        let bottle = try resolveBottleForConfig(path: params["bottlePath"]?.stringValue)
        guard let fixID = params["fixId"]?.stringValue, !fixID.isEmpty else {
            throw BridgeError.invalidParams("Missing fixId.")
        }
        let stringParams = Self.extractStringParams(params["params"])
        let attempt = FixApplicator.apply(fixId: fixID, params: stringParams, bottle: bottle, program: nil)
        bottle.saveBottleSettings()
        if fixID == "set-audio-driver" || fixID == "set-buffer-size" {
            await Wine.syncAudioRegistry(bottle: bottle)
        }
        return .object([
            "ok": .bool(attempt.result != .failed && attempt.result != .undone),
            "fixId": .string(attempt.fixId),
            "result": .string(attempt.result.rawValue),
            "beforeValue": attempt.beforeValue.map { .string($0) } ?? .null,
            "afterValue": attempt.afterValue.map { .string($0) } ?? .null
        ])
    }

    @MainActor
    func undoTroubleshootFix(params: [String: JSONValue]) throws -> JSONValue {
        let bottle = try resolveBottleForConfig(path: params["bottlePath"]?.stringValue)
        guard let fixID = params["fixId"]?.stringValue, !fixID.isEmpty else {
            throw BridgeError.invalidParams("Missing fixId.")
        }
        let attempt = FixAttempt(
            fixId: fixID,
            beforeValue: params["beforeValue"]?.stringValue,
            afterValue: params["afterValue"]?.stringValue,
            result: .applied,
            params: Self.extractStringParams(params["params"])
        )
        let restored = FixApplicator.undo(attempt: attempt, bottle: bottle, program: nil)
        bottle.saveBottleSettings()
        return .object(["restored": .bool(restored)])
    }

    @MainActor
    private func validatedReadableLogURL(_ rawPath: String) throws -> URL {
        var bottlesList = BottleData()
        let candidate = URL(filePath: rawPath).standardizedFileURL.resolvingSymlinksInPath()
        let allowedRoots = [Self.bridgeLogsFolder.standardizedFileURL.resolvingSymlinksInPath()]
            + bottlesList.loadBottles().map { $0.url.standardizedFileURL.resolvingSymlinksInPath() }
        let candidatePath = candidate.path(percentEncoded: false)
        let allowed = allowedRoots.contains { candidatePath.hasPrefix($0.path(percentEncoded: false)) }
        guard allowed else {
            throw BridgeError.invalidParams("Log path is outside permitted Gmac folders.")
        }
        return candidate
    }

    @MainActor
    private static func encodeFlowNode(_ node: FlowStepNode, bottle: Bottle) -> JSONValue {
        let preview = node.fixId.flatMap {
            FixApplicator.preview(fixId: $0, params: node.params ?? [:], bottle: bottle, program: nil)
        }
        var onDict: [String: JSONValue] = [:]
        for (key, value) in node.on ?? [:] {
            onDict[key] = .string(value)
        }
        var paramDict: [String: JSONValue] = [:]
        for (key, value) in node.params ?? [:] {
            paramDict[key] = .string(value)
        }
        return .object([
            "id": .string(node.id),
            "type": .string(node.type.rawValue),
            "phase": .string(node.phase.rawValue),
            "title": node.title.map { .string($0) } ?? .null,
            "description": node.description.map { .string($0) } ?? .null,
            "fixId": node.fixId.map { .string($0) } ?? .null,
            "params": .object(paramDict),
            "on": .object(onDict),
            "fixPreview": preview.map {
                .object([
                    "settingName": .string($0.settingName),
                    "currentValue": .string($0.currentValue),
                    "newValue": .string($0.newValue),
                    "scope": .string($0.scope),
                    "isReversible": .bool($0.isReversible)
                ])
            } ?? .null
        ])
    }

    private static func encodeDiagnosisMatch(_ match: DiagnosisMatch) -> JSONValue {
        .object([
            "id": .string(match.pattern.id),
            "category": .string(match.pattern.category.displayName),
            "severity": .string(match.pattern.severity.rawValue),
            "confidence": .double(match.pattern.confidence),
            "lineIndex": .int(match.lineIndex),
            "lineText": .string(match.lineText)
        ])
    }

    private static func encodeRemediationAction(_ action: RemediationAction) -> JSONValue {
        .object([
            "id": .string(action.id),
            "title": .string(action.title),
            "description": .string(action.description),
            "risk": .string(action.risk.rawValue),
            "actionType": .string(action.actionType.rawValue),
            "settingKeyPath": action.settingKeyPath.map { .string($0) } ?? .null,
            "settingValue": action.settingValue.map { .string($0) } ?? .null,
            "winetricksVerb": action.winetricksVerb.map { .string($0) } ?? .null,
            "whatWillChange": .string(action.whatWillChange),
            "undoPath": .string(action.undoPath)
        ])
    }

    private static func extractStringParams(_ raw: JSONValue?) -> [String: String] {
        guard let obj = raw?.objectValue else { return [:] }
        var out: [String: String] = [:]
        for (key, value) in obj {
            if let str = value.stringValue {
                out[key] = str
            }
        }
        return out
    }
}
