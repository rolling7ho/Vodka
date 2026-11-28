//
//  BridgeHandlers+GameDB.swift
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
    func listGameDB(params: [String: JSONValue]) -> JSONValue {
        let allEntries = GameDBLoader.loadDefaults()
        let query = params["query"]?.stringValue?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let steamAppID = params["steamAppId"]?.intValue

        let filtered: [GameDBEntry] = if let steamAppID {
            allEntries.filter { $0.steamAppId == steamAppID }
        } else if !query.isEmpty {
            GameMatcher.searchEntries(query, in: allEntries)
        } else {
            allEntries
        }

        return .object([
            "entries": .array(filtered.map(Self.encodeGameDBEntry))
        ])
    }

    @MainActor
    func previewGameDB(params: [String: JSONValue]) throws -> JSONValue {
        let bottle = try resolveBottleForConfig(path: params["bottlePath"]?.stringValue)
        let (entry, variant) = try resolveGameDBTarget(params: params)
        let changes = GameConfigApplicator.previewChanges(variant: variant, bottle: bottle)
        return .object([
            "entryId": .string(entry.id),
            "variantId": .string(variant.id),
            "changes": .array(changes.map(Self.encodeConfigChange))
        ])
    }

    @MainActor
    func applyGameDB(params: [String: JSONValue]) throws -> JSONValue {
        let bottle = try resolveBottleForConfig(path: params["bottlePath"]?.stringValue)
        let (entry, variant) = try resolveGameDBTarget(params: params)
        let changes = GameConfigApplicator.previewChanges(variant: variant, bottle: bottle)
        _ = try GameConfigApplicator.apply(entry: entry, variant: variant, to: bottle)
        bottle.saveBottleSettings()
        return .object([
            "ok": .bool(true),
            "entryId": .string(entry.id),
            "variantId": .string(variant.id),
            "appliedCount": .int(changes.count)
        ])
    }

    private func resolveGameDBTarget(params: [String: JSONValue]) throws -> (GameDBEntry, GameConfigVariant) {
        guard let entryID = params["entryId"]?.stringValue, !entryID.isEmpty else {
            throw BridgeError.invalidParams("Missing GameDB entryId.")
        }
        let entries = GameDBLoader.loadDefaults()
        guard let entry = entries.first(where: { $0.id == entryID }) else {
            throw BridgeError.operationFailed("GameDB entry not found.")
        }
        let requestedVariantID = params["variantId"]?.stringValue
        let variant = entry.variants.first(where: { $0.id == requestedVariantID })
            ?? entry.defaultVariant
            ?? entry.variants.first
        guard let resolvedVariant = variant else {
            throw BridgeError.operationFailed("Selected GameDB entry has no configuration variants.")
        }
        return (entry, resolvedVariant)
    }

    private static func encodeConfigChange(_ change: ConfigChange) -> JSONValue {
        .object([
            "category": .string(change.category),
            "settingName": .string(change.settingName),
            "currentValue": .string(change.currentValue),
            "newValue": .string(change.newValue),
            "isHighImpact": .bool(change.isHighImpact)
        ])
    }

    private static func encodeGameDBEntry(_ entry: GameDBEntry) -> JSONValue {
        let encodedVariants = entry.variants.map { variant -> JSONValue in
            .object([
                "id": .string(variant.id),
                "label": .string(variant.label),
                "isDefault": .bool(variant.isDefault ?? false),
                "whenToUse": variant.whenToUse.map { .string($0) } ?? .null,
                "rationale": .array((variant.rationale ?? []).map { .string($0) }),
                "winetricksVerbs": .array((variant.winetricksVerbs ?? []).map { .string($0) })
            ])
        }
        return .object([
            "id": .string(entry.id),
            "title": .string(entry.title),
            "subtitle": entry.subtitle.map { .string($0) } ?? .null,
            "steamAppId": entry.steamAppId.map { .int($0) } ?? .null,
            "rating": .string(entry.rating.rawValue),
            "ratingLabel": .string(entry.rating.displayName),
            "antiCheat": entry.antiCheat.map { .string($0) } ?? .null,
            "notes": .array((entry.notes ?? []).map { .string($0) }),
            "variants": .array(encodedVariants)
        ])
    }
}
