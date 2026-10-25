//
//  GraphicsConfigSection.swift
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

import Metal
import SwiftUI
import VodkaKit

/// Fine-tuning for how games are drawn, under the bottle's Advanced toggle.
///
/// Which translation layer a bottle uses is picked once, in the Game Settings
/// section (``GraphicsChoiceView``); this section only tunes it.
struct GraphicsConfigSection: View {
    @ObservedObject var bottle: Bottle
    @State private var hasRunningProcesses: Bool = false

    private var resolvedBackend: GraphicsBackend {
        if bottle.settings.graphicsBackend == .recommended {
            return GraphicsBackendResolver.resolve()
        }
        return bottle.settings.graphicsBackend
    }

    var body: some View {
        Section("Graphics Tuning") {
            // Said once, after an update put a bottle the old Steam profile had
            // switched to DXVK back on Recommended (#276).
            if bottle.settings.launcherBackendResetNotice {
                launcherBackendResetNotice
            }

            // A bottle explicitly set to D3DMetal without its payload silently
            // degrades to WineD3D at launch — say so instead (issue #146).
            if bottle.settings.graphicsBackend == .d3dMetal,
               !VodkaWineInstaller.isBackendAvailable(.d3dMetal) {
                d3dMetalMissingWarning
            }

            if hasRunningProcesses {
                runningProcessWarning
            }

            // MetalFX rides on D3DMetal's DLSS bridge and Metal 4 is D3DMetal's
            // own command-encoding backend, so both are meaningless under any
            // other backend rather than merely inactive.
            if resolvedBackend == .d3dMetal {
                metalFXToggles
            }

            DXVKSettingsView(
                bottle: bottle,
                resolvedBackend: resolvedBackend,
                bottleURL: bottle.url
            )

            metalDebugToggles

            if !programsWithGraphicsOverrides.isEmpty {
                programOverridesInfo
            }
        }
        .onChange(of: bottle.settings.graphicsBackend) {
            // Picking a backend answers the notice.
            if bottle.settings.launcherBackendResetNotice {
                bottle.settings.launcherBackendResetNotice = false
            }
        }
        .task {
            await checkRunningProcesses()
        }
    }

    // MARK: - D3DMetal Upscaling

    @ViewBuilder
    private var metalFXToggles: some View {
        Toggle(isOn: $bottle.settings.metalFX) {
            VStack(alignment: .leading) {
                Text("config.metalFX")
                Text("config.metalFX.info")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        Toggle(isOn: $bottle.settings.metal4Enabled) {
            VStack(alignment: .leading) {
                Text("config.metal4")
                Text("config.metal4.info")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Label("Experimental: can freeze games on loading screens, as in Teardown. "
                    + "Leave off unless a game needs it.", systemImage: "exclamationmark.triangle")
                    .font(.caption)
                    .foregroundStyle(.orange)
            }
        }
        // Frame generation reaches MetalFX through the same DLSS bridge
        // as upscaling, so it has nothing to switch on without it.
        Toggle(isOn: $bottle.settings.frameGeneration) {
            VStack(alignment: .leading) {
                Text("config.frameGeneration")
                Text("config.frameGeneration.info")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .disabled(!bottle.settings.metalFX)
    }

    // MARK: - Metal Debugging

    /// The frame-rate overlay lives in Game Settings; these are for chasing bugs.
    private var metalDebugToggles: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("config.metal.title")
                .font(.headline)
            Toggle(isOn: $bottle.settings.metalTrace) {
                Text("config.metalTrace")
                Text("config.metalTrace.info")
            }
            if let device = MTLCreateSystemDefaultDevice(), device.supportsFamily(.apple9) {
                Toggle(isOn: $bottle.settings.dxrEnabled) {
                    Text("config.dxr")
                    Text("config.dxr.info")
                }
            }
            Toggle(isOn: $bottle.settings.metalValidation) {
                Text("config.metalValidation")
            }
        }
    }

    // MARK: - Launcher Backend Reset Notice

    private var launcherBackendResetNotice: some View {
        HStack {
            Image(systemName: "info.circle")
                .foregroundStyle(.blue)
            Text("config.graphics.backend.launcherReset")
                .font(.caption)
            Spacer()
            Button {
                bottle.settings.launcherBackendResetNotice = false
            } label: {
                Image(systemName: "xmark")
            }
            .buttonStyle(.borderless)
            .help("config.graphics.backend.launcherReset.dismiss")
            .accessibilityLabel("config.graphics.backend.launcherReset.dismiss")
        }
    }

    // MARK: - D3DMetal Missing Warning

    private var d3dMetalMissingWarning: some View {
        HStack {
            Image(systemName: "exclamationmark.triangle")
                .foregroundStyle(.orange)
            Text("config.graphics.backend.d3dMetal.missingWarning")
                .font(.caption)
            Spacer()
        }
    }

    // MARK: - Running Process Warning

    private var runningProcessWarning: some View {
        HStack {
            Image(systemName: "info.circle")
                .foregroundStyle(.blue)
            Text("config.graphics.nextLaunchInfo")
                .font(.caption)
            Spacer()
            Button("config.graphics.stopBottle") {
                Wine.killBottle(bottle: bottle)
                Task {
                    // Brief delay for wineserver to stop
                    try? await Task.sleep(nanoseconds: 2_000_000_000)
                    await checkRunningProcesses()
                }
            }
            .font(.caption)
            .foregroundStyle(.red)
        }
        .padding(8)
        .background(.blue.opacity(0.1), in: RoundedRectangle(cornerRadius: 8))
    }

    // MARK: - Running Process Check

    private func checkRunningProcesses() async {
        let wineserverActive = await Wine.isWineserverRunning(for: bottle)
        let trackedCount = ProcessRegistry.shared.getProcessCount(for: bottle)
        hasRunningProcesses = wineserverActive || trackedCount > 0
    }

    // MARK: - Per-Program Override Info

    private var programsWithGraphicsOverrides: [Program] {
        bottle.programs.filter { $0.settings.overrides?.graphicsBackend != nil }
    }

    private var programOverridesInfo: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("config.graphics.programOverrides")
                .font(.headline)
            ForEach(programsWithGraphicsOverrides) { program in
                HStack {
                    Image(systemName: "slider.horizontal.3")
                        .foregroundStyle(.blue)
                        .font(.caption)
                    Text(program.name)
                        .font(.callout)
                    Spacer()
                    Text(
                        program.settings.overrides?.graphicsBackend?.displayName
                            ?? String(localized: "config.graphics.inherited")
                    )
                    .font(.caption)
                    .foregroundStyle(.secondary)
                }
            }
            Text("config.graphics.programOverrides.hint")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }
}
