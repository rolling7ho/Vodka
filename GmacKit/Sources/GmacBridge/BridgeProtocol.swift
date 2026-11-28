//
//  BridgeProtocol.swift
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

enum JSONValue: Codable, Sendable, Equatable {
    case string(String)
    case int(Int)
    case double(Double)
    case bool(Bool)
    case object([String: JSONValue])
    case array([JSONValue])
    case null

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
        } else if let boolValue = try? container.decode(Bool.self) {
            self = .bool(boolValue)
        } else if let intValue = try? container.decode(Int.self) {
            self = .int(intValue)
        } else if let doubleValue = try? container.decode(Double.self) {
            self = .double(doubleValue)
        } else if let stringValue = try? container.decode(String.self) {
            self = .string(stringValue)
        } else if let arrayValue = try? container.decode([JSONValue].self) {
            self = .array(arrayValue)
        } else if let objectValue = try? container.decode([String: JSONValue].self) {
            self = .object(objectValue)
        } else {
            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "Unsupported JSON value"
            )
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case let .string(value):
            try container.encode(value)
        case let .int(value):
            try container.encode(value)
        case let .double(value):
            try container.encode(value)
        case let .bool(value):
            try container.encode(value)
        case let .object(value):
            try container.encode(value)
        case let .array(value):
            try container.encode(value)
        case .null:
            try container.encodeNil()
        }
    }

    var boolValue: Bool? {
        guard case let .bool(value) = self
        else {
            return nil
        }
        return value
    }

    var stringValue: String? {
        guard case let .string(value) = self else {
            return nil
        }
        return value
    }

    var intValue: Int? {
        switch self {
        case let .int(value):
            return value
        case let .double(value):
            if let exact = Int(exactly: value) {
                return exact
            }
            return nil
        default:
            return nil
        }
    }

    var stringArrayValue: [String]? {
        guard case let .array(items) = self else {
            return nil
        }
        return items.compactMap(\.stringValue)
    }

    var arrayValue: [JSONValue]? {
        guard case let .array(items) = self else {
            return nil
        }
        return items
    }

    var objectValue: [String: JSONValue]? {
        guard case let .object(dict) = self else {
            return nil
        }
        return dict
    }
}

struct BridgeRequest: Decodable, Sendable {
    let id: Int
    let method: String
    let params: [String: JSONValue]?
}

struct BridgeErrorPayload: Encodable, Sendable {
    let code: String
    let message: String
}

struct BridgeResponse: Encodable, Sendable {
    let id: Int
    let result: JSONValue?
    let error: BridgeErrorPayload?
}

struct BridgeEvent: Encodable, Sendable {
    let event: String
    let id: Int
    let data: JSONValue
}

enum BridgeError: LocalizedError {
    case invalidParams(String)
    case unknownMethod(String)
    case operationFailed(String)

    var code: String {
        switch self {
        case .invalidParams:
            "invalid_params"
        case .unknownMethod:
            "unknown_method"
        case .operationFailed:
            "operation_failed"
        }
    }

    var errorDescription: String? {
        switch self {
        case let .invalidParams(message):
            message
        case let .unknownMethod(method):
            "Unknown method: \(method)"
        case let .operationFailed(message):
            message
        }
    }
}

final class BridgeWriter: @unchecked Sendable {
    private let lock = NSLock()
    private let encoder = JSONEncoder()

    func sendResponse(_ response: BridgeResponse) {
        writeLine(response)
    }

    func sendEvent(id: Int, data: [String: JSONValue]) {
        writeLine(BridgeEvent(event: "progress", id: id, data: .object(data)))
    }

    private func writeLine(_ payload: some Encodable) {
        lock.lock()
        defer { lock.unlock() }
        guard let encoded = try? encoder.encode(payload) else {
            return
        }
        var line = encoded
        line.append(0x0A)
        FileHandle.standardOutput.write(line)
    }
}
