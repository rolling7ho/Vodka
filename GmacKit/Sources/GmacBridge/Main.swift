//
//  Main.swift
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

@main
struct GmacBridgeMain {
    static func main() async {
        let writer = BridgeWriter()
        let router = BridgeRouter(writer: writer)
        let decoder = JSONDecoder()

        for await lineData in stdinLines() {
            do {
                let request = try decoder.decode(BridgeRequest.self, from: lineData)
                let response = await router.handle(request)
                writer.sendResponse(response)
            } catch {
                writer.sendResponse(
                    BridgeResponse(
                        id: 0,
                        result: nil,
                        error: BridgeErrorPayload(
                            code: "parse_error",
                            message: error.localizedDescription
                        )
                    )
                )
            }
        }
    }

    private static func stdinLines() -> AsyncStream<Data> {
        AsyncStream { continuation in
            DispatchQueue(label: "com.rolling7ho.GmacBridge.stdin").async {
                var buffer = Data()
                while true {
                    let chunk = FileHandle.standardInput.availableData
                    if chunk.isEmpty {
                        let trimmed = trimLine(buffer)
                        if !trimmed.isEmpty {
                            continuation.yield(trimmed)
                        }
                        continuation.finish()
                        return
                    }

                    buffer.append(chunk)
                    while let newlineIndex = buffer.firstIndex(of: 0x0A) {
                        let rawLine = buffer.subdata(in: buffer.startIndex ..< newlineIndex)
                        buffer.removeSubrange(buffer.startIndex ... newlineIndex)
                        let trimmed = trimLine(rawLine)
                        if !trimmed.isEmpty {
                            continuation.yield(trimmed)
                        }
                    }
                }
            }
        }
    }

    private static func trimLine(_ data: Data) -> Data {
        guard let text = String(data: data, encoding: .utf8) else {
            return Data()
        }
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.data(using: .utf8) ?? Data()
    }
}
