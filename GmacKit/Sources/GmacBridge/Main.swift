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
enum BridgeEntry {
    static func main() async {
        // Keep stdout strictly reserved for newline-delimited JSON-RPC frames.
        let writer = BridgeWriter()
        let server = await MainActor.run { BridgeServer(writer: writer) }

        await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
            let queue = DispatchQueue(label: "com.rolling7ho.GmacBridge.stdin", qos: .userInitiated)
            queue.async {
                while let line = readLine(strippingNewline: true) {
                    if line.isEmpty { continue }
                    guard let data = line.data(using: .utf8) else { continue }
                    let request: BridgeRequest
                    do {
                        request = try JSONDecoder().decode(BridgeRequest.self, from: data)
                    } catch {
                        let invalid = BridgeResponse<EmptyResult>(
                            id: 0,
                            ok: false,
                            result: nil,
                            error: "Invalid JSON request: \(error.localizedDescription)"
                        )
                        writer.send(invalid)
                        continue
                    }

                    Task { @MainActor in
                        await server.handle(request)
                    }
                }
                continuation.resume()
            }
        }
    }
}
