//
//  ResolutionConfigSection.swift
//  Vodka
//
//  This file is part of Vodka, a fork of Whisky.
//
//  Vodka is free software: you can redistribute it and/or modify it under the terms
//  of the GNU General Public License as published by the Free Software Foundation,
//  either version 3 of the License, or (at your option) any later version.
//
//  Vodka is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
//  without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
//  See the GNU General Public License for more details.
//
//  You should have received a copy of the GNU General Public License along with Vodka.
//  If not, see https://www.gnu.org/licenses/.
//

import SwiftUI
import VodkaKit

struct ResolutionConfigSection: View {
    @ObservedObject var bottle: Bottle
    @State private var hasRunningProcesses: Bool = false
    @State private var widthText: String = ""
    @State private var heightText: String = ""
    @State private var isLoadingRegistryState: Bool = true

    var body: some View {
        Section("config.title.display") {
            Toggle(isOn: $bottle.settings.virtualDesktopEnabled) {
                VStack(alignment: .leading) {
                    Text("config.virtualDesktop")
                    Text("config.virtualDesktop.info")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .onChange(of: bottle.settings.virtualDesktopEnabled) { _, enabled in
                persistVirtualDesktop(enabled: enabled)
            }

            if bottle.settings.virtualDesktopEnabled {
                Picker("config.virtualDesktop.resolution", selection: $bottle.settings.resolutionPreset) {
                    ForEach(ResolutionPreset.allCases, id: \.self) { preset in
                        Text(presetLabel(preset)).tag(preset)
                    }
                }
                .onChange(of: bottle.settings.resolutionPreset) { _, _ in
                    syncCustomFields()
                    persistResolution()
                }

                if bottle.settings.resolutionPreset == .matchDisplay {
                    matchDisplayHint
                }

                if bottle.settings.resolutionPreset == .custom {
                    customResolutionFields
                }

                Text("config.virtualDesktop.nextLaunch")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            if hasRunningProcesses {
                runningProcessWarning
            }
        }
        .animation(.default, value: bottle.settings.virtualDesktopEnabled)
        .task {
            await loadRegistryState()
            syncCustomFields()
            await checkRunningProcesses()
        }
    }

    // MARK: - Match Display Hint

    private var matchDisplayHint: some View {
        HStack {
            Image(systemName: "display")
                .foregroundStyle(.secondary)
            if let screen = NSScreen.main {
                let pixelWidth = Int(screen.frame.width * screen.backingScaleFactor)
                let pixelHeight = Int(screen.frame.height * screen.backingScaleFactor)
                Text("config.virtualDesktop.matchDisplay \(pixelWidth) \(pixelHeight)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } else {
                Text("config.virtualDesktop.matchDisplay.fallback")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }

    // MARK: - Custom Resolution Fields

    private var customResolutionFields: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text("config.virtualDesktop.width")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                TextField("1920", text: $widthText)
                    .textFieldStyle(.roundedBorder)
                    .frame(width: 80)
                    .onChange(of: widthText) { _, newValue in
                        if let val = Int(newValue) {
                            bottle.settings.customResolutionWidth = min(max(val, 640), 7_680)
                        }
                    }
                    .onSubmit {
                        validateAndPersistCustom()
                    }
            }
            Text("\u{00D7}")
                .foregroundStyle(.secondary)
                .padding(.top, 12)
            VStack(alignment: .leading, spacing: 2) {
                Text("config.virtualDesktop.height")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                TextField("1080", text: $heightText)
                    .textFieldStyle(.roundedBorder)
                    .frame(width: 80)
                    .onChange(of: heightText) { _, newValue in
                        if let val = Int(newValue) {
                            bottle.settings.customResolutionHeight = min(max(val, 480), 4_320)
                        }
                    }
                    .onSubmit {
                        validateAndPersistCustom()
                    }
            }
        }
    }

    // MARK: - Running Process Warning

    private var runningProcessWarning: some View {
        HStack {
            Image(systemName: "info.circle")
                .foregroundStyle(.blue)
            Text("config.virtualDesktop.processesRunning")
                .font(.caption)
            Spacer()
        }
        .padding(8)
        .background(.blue.opacity(0.1), in: RoundedRectangle(cornerRadius: 8))
    }

    // MARK: - Helpers

    func presetLabel(_ preset: ResolutionPreset) -> String {
        switch preset {
        case .matchDisplay:
            String(localized: "config.virtualDesktop.matchDisplay.label")
        case .custom:
            String(localized: "config.virtualDesktop.custom")
        default:
            preset.label
        }
    }

    func syncCustomFields() {
        widthText = "\(bottle.settings.customResolutionWidth)"
        heightText = "\(bottle.settings.customResolutionHeight)"
    }

    func checkRunningProcesses() async {
        let wineserverActive = await Wine.isWineserverRunning(for: bottle)
        let trackedCount = ProcessRegistry.shared.getProcessCount(for: bottle)
        hasRunningProcesses = wineserverActive || trackedCount > 0
    }
}

// MARK: - Registry Persistence

extension ResolutionConfigSection {
    func persistVirtualDesktop(enabled: Bool) {
        Task {
            do {
                if enabled {
                    let res = effectiveResolutionString()
                    try await Wine.enableVirtualDesktop(bottle: bottle, resolution: res)
                } else {
                    try await Wine.disableVirtualDesktop(bottle: bottle)
                }
            } catch {
                bottle.settings.virtualDesktopEnabled = !enabled
            }
        }
    }

    func persistResolution() {
        guard bottle.settings.virtualDesktopEnabled else { return }
        Task {
            do {
                let res = effectiveResolutionString()
                try await Wine.enableVirtualDesktop(bottle: bottle, resolution: res)
            } catch {
                // Best effort; user will see "next launch" notice
            }
        }
    }

    func validateAndPersistCustom() {
        let width = min(max(Int(widthText) ?? 1_920, 640), 7_680)
        let height = min(max(Int(heightText) ?? 1_080, 480), 4_320)
        bottle.settings.customResolutionWidth = width
        bottle.settings.customResolutionHeight = height
        widthText = "\(width)"
        heightText = "\(height)"
        persistResolution()
    }

    func effectiveResolutionString() -> String {
        let preset = bottle.settings.resolutionPreset
        switch preset {
        case .matchDisplay:
            if let screen = NSScreen.main {
                let width = Int(screen.frame.width * screen.backingScaleFactor)
                let height = Int(screen.frame.height * screen.backingScaleFactor)
                return "\(width)x\(height)"
            }
            return "1920x1080"
        case .custom:
            return "\(bottle.settings.customResolutionWidth)x\(bottle.settings.customResolutionHeight)"
        default:
            if let dims = preset.dimensions {
                return "\(dims.width)x\(dims.height)"
            }
            return "1920x1080"
        }
    }

    func loadRegistryState() async {
        do {
            if let resolution = try await Wine.queryVirtualDesktop(bottle: bottle) {
                bottle.settings.virtualDesktopEnabled = true
                let parts = resolution.split(separator: "x")
                if parts.count == 2, let width = Int(parts[0]), let height = Int(parts[1]) {
                    matchRegistryToPreset(width: width, height: height)
                }
            } else {
                bottle.settings.virtualDesktopEnabled = false
            }
        } catch {
            // Registry query failed; leave defaults
        }
        isLoadingRegistryState = false
    }

    func matchRegistryToPreset(width: Int, height: Int) {
        for preset in ResolutionPreset.allCases {
            if let dims = preset.dimensions, dims.width == width, dims.height == height {
                bottle.settings.resolutionPreset = preset
                return
            }
        }
        bottle.settings.resolutionPreset = .custom
        bottle.settings.customResolutionWidth = width
        bottle.settings.customResolutionHeight = height
    }
}

/// The settings most people need for a Steam bottle, shown above everything else.
///
/// Everything here has a recommended value already; the rest of the bottle's
/// configuration sits behind Advanced.
struct GameEssentialsSection: View {
    @ObservedObject var bottle: Bottle

    var body: some View {
        Section {
            Toggle(isOn: $bottle.settings.nativeResolution) {
                VStack(alignment: .leading) {
                    Text("Sharp, full-resolution games")
                    Text(nativeResolutionCaption)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            Toggle(isOn: $bottle.settings.metalHud) {
                VStack(alignment: .leading) {
                    Text("Show FPS counter")
                    Text("Apple's Metal performance overlay in the corner of every game: frame rate, "
                        + "frame time and GPU memory.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        } header: {
            Text("Game Settings")
        } footer: {
            Text("macOS Game Mode, for every PC, is in Vodka Settings \u{203A} Gaming.")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        Section {
            GraphicsChoiceView(bottle: bottle, compact: true)
        } header: {
            Text("Graphics")
        } footer: {
            Text("Automatic picks for each game, and games with a preset, like Teardown, get their best settings "
                + "when you press Play. If Steam is open, quit and reopen it after changing this.")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }

    private var nativeResolutionCaption: String {
        var pixels = "full pixel resolution"
        if let screen = NSScreen.main {
            let width = Int(screen.frame.width * screen.backingScaleFactor)
            let height = Int(screen.frame.height * screen.backingScaleFactor)
            pixels = "full \(width) × \(height) pixels"
        }
        return "Games render at your display's \(pixels) instead of being upscaled, and Steam is "
            + "sharp too. Turn off for more FPS in demanding games."
    }
}
