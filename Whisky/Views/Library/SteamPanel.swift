//
//  SteamPanel.swift
//  Whisky
//
//  This file is part of Whisky.
//
//  Whisky is free software: you can redistribute it and/or modify it under the terms
//  of the GNU General Public License as published by the Free Software Foundation,
//  either version 3 of the License, or (at your option) any later version.
//
//  Whisky is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
//  without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
//  See the GNU General Public License for more details.
//
//  You should have received a copy of the GNU General Public License along with Whisky.
//  If not, see https://www.gnu.org/licenses/.
//

import SwiftUI
import WhiskyKit

/// Steam at the top of the library: whether it is running, what it holds,
/// and the way into it.
///
/// Running is read from the bottle's processes, so a Steam started before
/// Whisky opened, or from the Dock, shows as running too, and the button
/// says Show rather than Open: opening one that is already up only brings
/// its window forward, and saying Open there read as if it were closed.
struct SteamPanel: View {
    /// Shown only with Steam in more than one Windows PC.
    let bottleName: String?
    let icon: URL?
    let isRunning: Bool
    let games: [LibraryRow]
    /// Hands Steam a `steam://` link or a command.
    let send: (String) -> Void

    @State private var iconImage: Image?

    var body: some View {
        HStack(spacing: 14) {
            iconView
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text("Steam")
                        .font(.title3.weight(.semibold))
                    if let bottleName {
                        Text(bottleName)
                            .font(.callout)
                            .foregroundStyle(.secondary)
                    }
                }
                HStack(spacing: 6) {
                    Circle()
                        .fill(isRunning ? Color.green : Color.secondary.opacity(0.5))
                        .frame(width: 7, height: 7)
                    Text(summary)
                        .font(.callout)
                        .foregroundStyle(.secondary)
                }
            }
            Spacer(minLength: 12)
            Button {
                send("steam://store")
            } label: {
                Label("Store", systemImage: "bag")
            }
            .controlSize(.large)
            Button {
                send("steam://open/games")
            } label: {
                Text(isRunning ? "Show Steam" : "Open Steam")
                    .frame(minWidth: 84)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            if isRunning {
                Menu {
                    Button("Quit Steam", systemImage: "power") { send("-shutdown") }
                } label: {
                    Image(systemName: "ellipsis")
                }
                .menuStyle(.borderlessButton)
                .menuIndicator(.hidden)
                .fixedSize()
                .help("More")
            }
        }
        .padding(16)
        .background(.quaternary.opacity(0.5), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .task(id: icon) {
            guard let icon else { return }
            iconImage = await Image(nsImage: IconCache.shared.sampledIcon(for: icon).image)
        }
        .animation(.default, value: isRunning)
    }

    private var summary: String {
        let state = isRunning ? "Running" : "Not running"
        let count = games.count == 1 ? "1 game installed" : "\(games.count) games installed"
        let bytes = games.compactMap(\.sizeOnDisk).reduce(0, +)
        guard bytes > 0 else { return "\(state) · \(count)" }
        return "\(state) · \(count) · \(ByteCountFormatter.string(fromByteCount: bytes, countStyle: .file))"
    }

    @ViewBuilder
    private var iconView: some View {
        if let iconImage {
            iconImage
                .resizable()
                .frame(width: 48, height: 48)
        } else {
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(.quaternary)
                .frame(width: 48, height: 48)
                .overlay {
                    Image(systemName: "gamecontroller.fill")
                        .foregroundStyle(.secondary)
                }
        }
    }
}

/// A titled group of cards in the library.
struct LibrarySection<Content: View>: View {
    let title: String
    let count: Int
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(title)
                    .font(.title3.weight(.semibold))
                Text("\(count)")
                    .font(.callout.monospacedDigit())
                    .foregroundStyle(.secondary)
            }
            content
        }
    }
}

/// The last tile of the games grid: the way to more of them.
struct GetMoreGamesTile: View {
    let action: () -> Void

    @State private var isHovering = false

    var body: some View {
        Button(action: action) {
            VStack(spacing: 8) {
                Image(systemName: "plus")
                    .font(.system(size: 22, weight: .medium))
                Text("Get More Games")
                    .font(.headline)
                Text("Browse the Steam Store")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 132)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(.quaternary.opacity(isHovering ? 0.8 : 0.4))
            )
            .overlay {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .strokeBorder(.secondary.opacity(0.35), style: StrokeStyle(lineWidth: 1.5, dash: [6, 5]))
            }
            .contentShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
        .buttonStyle(.plain)
        .onHover { isHovering = $0 }
        .animation(.easeOut(duration: 0.16), value: isHovering)
    }
}
