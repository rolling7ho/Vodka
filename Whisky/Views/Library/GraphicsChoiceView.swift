//
//  GraphicsChoiceView.swift
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
import UniformTypeIdentifiers
import WhiskyKit

/// The graphics choices offered to players, named after the DirectX version
/// a game uses with familiar games as examples, the way CrossOver names its
/// options, rather than after the translation layer behind them.
enum GraphicsChoice: String, CaseIterable, Identifiable {
    case automatic, directX12, directX11, directX9, openGL

    var id: String { rawValue }

    var title: String {
        switch self {
        case .automatic: "Automatic (Recommended)"
        case .directX12: "DirectX 12"
        case .directX11: "DirectX 11"
        case .directX9: "DirectX 9 and older"
        case .openGL: "OpenGL and Vulkan"
        }
    }

    var examples: String {
        switch self {
        case .automatic: "Checks each game you install and picks the right option for it."
        case .directX12: "Teardown, Cyberpunk 2077, Elden Ring, Hogwarts Legacy, Forza Horizon 5"
        case .directX11: "Skyrim Special Edition, Fallout 4, The Witcher 3, Dark Souls III, Sekiro"
        case .directX9: "Fallout: New Vegas, Oblivion, Left 4 Dead 2, Dishonored"
        case .openGL: "Doom (2016), Half-Life, Wolfenstein: The New Order"
        }
    }

    var symbol: String {
        switch self {
        case .automatic: "wand.and.stars"
        case .directX12: "bolt.fill"
        case .directX11: "cube.fill"
        case .directX9: "clock.arrow.circlepath"
        case .openGL: "circle.hexagongrid.fill"
        }
    }

    /// The translation layer behind the choice, shown under Advanced.
    var technology: String {
        switch self {
        case .automatic: "D3DMetal, DXMT or WineD3D, per game"
        case .directX12: "Apple D3DMetal"
        case .directX11: "DXMT (DirectX 11 to Metal)"
        case .directX9, .openGL: "WineD3D (OpenGL)"
        }
    }

    var backend: GraphicsBackend {
        switch self {
        case .automatic: .recommended
        case .directX12: .d3dMetal
        case .directX11: .dxmt
        case .directX9, .openGL: .wined3d
        }
    }

    /// Whether the choice needs Apple's Game Porting Toolkit to be installed.
    var needsGPTK: Bool { self == .directX12 }

    init(backend: GraphicsBackend) {
        switch backend {
        case .recommended: self = .automatic
        case .d3dMetal: self = .directX12
        case .dxmt, .dxvk: self = .directX11
        case .wined3d: self = .directX9
        }
    }
}

/// Lets a player pick how a bottle's games are drawn, with Apple's DirectX 12
/// support added from here when a game needs it.
struct GraphicsChoiceView: View {
    @ObservedObject var bottle: Bottle
    /// Called when a choice is made, so onboarding can move on.
    var onChoose: (() -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(GraphicsChoice.allCases) { choice in
                row(choice)
            }
            GPTKInstallCard()
                .padding(.top, 4)
        }
    }

    /// DirectX 9 and OpenGL/Vulkan share a backend, so the row picked is
    /// remembered per bottle; it counts while the bottle is still on its backend.
    @State private var picked: GraphicsChoice?

    private var pickedKey: String { Self.pickedKey(for: bottle) }

    /// Where the row picked for `bottle` is remembered.
    static func pickedKey(for bottle: Bottle) -> String {
        "graphicsChoice." + bottle.url.path(percentEncoded: false)
    }

    private var selection: GraphicsChoice {
        let backend = bottle.settings.graphicsBackend
        let stored = picked ?? UserDefaults.standard.string(forKey: pickedKey).flatMap(GraphicsChoice.init(rawValue:))
        if let stored, stored.backend == backend { return stored }
        return GraphicsChoice(backend: backend)
    }

    private func row(_ choice: GraphicsChoice) -> some View {
        let selected = selection == choice
        return Button {
            bottle.settings.graphicsBackend = choice.backend
            picked = choice
            UserDefaults.standard.set(choice.rawValue, forKey: pickedKey)
            onChoose?()
        } label: {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: choice.symbol)
                    .font(.title3)
                    .frame(width: 24)
                    .foregroundStyle(selected ? Color.white : Color.accentColor)
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 6) {
                        Text(choice.title).font(.headline)
                        if choice.needsGPTK {
                            Text("Needs Apple's free toolkit")
                                .font(.caption2.bold())
                                .padding(.horizontal, 6).padding(.vertical, 2)
                                .background(.orange.opacity(0.25), in: Capsule())
                        }
                    }
                    Text(choice.examples)
                        .font(.callout)
                        .foregroundStyle(selected ? Color.white.opacity(0.85) : Color.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 0)
                if selected {
                    Image(systemName: "checkmark.circle.fill").font(.title3).foregroundStyle(.white)
                }
            }
            .padding(10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                selected ? AnyShapeStyle(Color.accentColor) : AnyShapeStyle(.quaternary.opacity(0.5)),
                in: RoundedRectangle(cornerRadius: 10)
            )
            .contentShape(RoundedRectangle(cornerRadius: 10))
        }
        .buttonStyle(.plain)
    }
}

/// Installs Apple's Game Porting Toolkit, which brings DirectX 12 (and a
/// faster DirectX 11) to games. Apple only offers it from its own site behind
/// a free sign-in, so it cannot ship with the app: this sends the player
/// there, then finds the download in Downloads, or takes it from a file picker.
struct GPTKInstallCard: View {
    static let downloadPage = URL(string: "https://developer.apple.com/download/all/?q=game%20porting%20toolkit")

    @State private var installed = GPTKImporter.isDeployed()
    @State private var found: URL?
    @State private var working = false
    @State private var showPicker = false
    @State private var errorMessage: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if installed {
                Label("DirectX 12 support is installed.", systemImage: "checkmark.seal.fill")
                    .foregroundStyle(.green)
            } else {
                Label("DirectX 12 games need Apple's Game Porting Toolkit", systemImage: "bolt.badge.clock")
                    .font(.headline)
                Text("It's free from Apple. Sign in with your Apple Account, download "
                    + "“Game Porting Toolkit” (the .dmg), then come back here. "
                    + "DirectX 11 and older games work without it.")
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
                buttons
                if let errorMessage {
                    Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                        .font(.callout)
                        .foregroundStyle(.orange)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.background.secondary, in: RoundedRectangle(cornerRadius: 10))
        .task {
            // The download happens in the browser; keep looking for it.
            while !Task.isCancelled, !installed {
                if !working { found = Self.findDownloadedToolkit() }
                try? await Task.sleep(for: .seconds(3))
            }
        }
        .fileImporter(isPresented: $showPicker, allowedContentTypes: [.diskImage, .folder]) { result in
            guard case let .success(url) = result else { return }
            install(from: url)
        }
    }

    @ViewBuilder
    private var buttons: some View {
        HStack {
            if let found {
                Button(working ? "Installing…" : "Install \(found.lastPathComponent)") { install(from: found) }
                    .buttonStyle(.borderedProminent)
            } else if let page = Self.downloadPage {
                Button("Get It from Apple") { NSWorkspace.shared.open(page) }
                    .buttonStyle(.borderedProminent)
            }
            Button("Choose File…") { showPicker = true }
            if working { ProgressView().controlSize(.small) }
        }
        .disabled(working)
    }

    /// The newest Game Porting Toolkit disk image in Downloads, if there is one.
    static func findDownloadedToolkit() -> URL? {
        guard let downloads = FileManager.default.urls(for: .downloadsDirectory, in: .userDomainMask).first,
              let items = try? FileManager.default.contentsOfDirectory(
                  at: downloads, includingPropertiesForKeys: [.contentModificationDateKey]
              )
        else { return nil }
        let images = items.filter { url in
            let name = url.lastPathComponent.lowercased()
            return url.pathExtension.lowercased() == "dmg"
                && (name.contains("game_porting_toolkit") || name.contains("game porting toolkit")
                    || name.contains("evaluation_environment"))
        }
        return images.max { lhs, rhs in
            let left = (try? lhs.resourceValues(forKeys: [.contentModificationDateKey]))?.contentModificationDate
            let right = (try? rhs.resourceValues(forKeys: [.contentModificationDateKey]))?.contentModificationDate
            return (left ?? .distantPast) < (right ?? .distantPast)
        }
    }

    private func install(from url: URL) {
        working = true
        errorMessage = nil
        Task.detached(priority: .userInitiated) {
            let result = Self.importToolkit(from: url)
            await MainActor.run {
                working = false
                if let result {
                    errorMessage = result
                } else {
                    installed = GPTKImporter.isDeployed()
                    if !installed {
                        errorMessage = "The toolkit was saved, but this version of the Windows engine can't use it. "
                            + "Update the engine in Settings."
                    }
                    BottleVM.shared.migrateLauncherBackends()
                }
            }
        }
    }

    /// Mounts, checks, stores and deploys the toolkit. Returns an error message, or `nil`.
    private nonisolated static func importToolkit(from url: URL) -> String? {
        let accessing = url.startAccessingSecurityScopedResource()
        defer { if accessing { url.stopAccessingSecurityScopedResource() } }
        var mounts: [URL] = []
        defer { for mount in mounts.reversed() { GPTKDiskImage.detach(mount) } }
        do {
            let resolved = try GPTKDiskImage.resolvePayload(at: url)
            mounts = resolved.mounts
            let payload = try GPTKImporter.validatePayload(at: resolved.libRoot)
            try GPTKImporter.importPayload(payload)
            if GPTKImporter.isRuntimeGPTKCapable() {
                try GPTKImporter.deployStoredPayload()
            }
            return nil
        } catch {
            return error.localizedDescription
        }
    }
}
