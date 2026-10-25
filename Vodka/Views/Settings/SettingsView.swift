//
//  SettingsView.swift
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

import ServiceManagement
import SwiftUI
import VodkaKit

struct SettingsView: View {
    @AppStorage("SUEnableAutomaticChecks") var vodkaUpdate = false
    @AppStorage("showMenuBarExtra") var showMenuBarExtra = false
    @AppStorage("checkVodkaWineUpdates") var checkVodkaWineUpdates = true
    @AppStorage("defaultBottleLocation") var defaultBottleLocation = BottleData.defaultBottleDir
    @AppStorage("preferredTerminal") var preferredTerminal = "terminal"
    @AppStorage(WineGameMode.enabledDefaultsKey) var gameModeEnabled = true
    @AppStorage(WineGameMode.fitBelowNotchDefaultsKey) var fitGamesBelowNotch = false
    @AppStorage(AppDelegate.skipQuitConfirmationKey) var skipQuitConfirmation = false
    @AppStorage(BottleCreationView.defaultWinVersionKey) var defaultWinVersion = WinVersion.win10
    @AppStorage(SteamAtLaunch.defaultsKey) var openSteamAtLaunch = false
    @AppStorage(VodkaApp.logRetentionDaysKey) var logRetentionDays = 7

    /// Read from the system rather than stored, so it stays right when the
    /// person changes it in System Settings › General › Login Items.
    @State private var openAtLogin = SMAppService.mainApp.status == .enabled
    @State private var loginItemError: String?
    @State private var logsSize: Int64?
    @State private var confirmClearShaders = false

    @AppStorage(SettingsTab.defaultsKey) var tab = SettingsTab.general

    var body: some View {
        TabView(selection: $tab) {
            Tab("settings.general", systemImage: "gearshape", value: SettingsTab.general) {
                page { general }
            }
            Tab("Gaming", systemImage: "gamecontroller", value: SettingsTab.gaming) {
                page { gaming }
            }
            Tab("Graphics", systemImage: "display", value: SettingsTab.graphics) {
                page { GPTKSettingsSection() }
            }
            Tab("Storage", systemImage: "internaldrive", value: SettingsTab.storage) {
                page { storage }
            }
            Tab("settings.updates", systemImage: "arrow.triangle.2.circlepath", value: SettingsTab.updates) {
                page { updates }
            }
            Tab("Statistics", systemImage: "chart.bar", value: SettingsTab.statistics) {
                StatisticsView(refresh: .constant(false))
                    .frame(width: ViewWidth.large + 80, height: 560)
            }
        }
    }

    /// One tab's form, sized to its rows so short tabs make a short window.
    private func page(@ViewBuilder _ content: () -> some View) -> some View {
        Form(content: content)
            .formStyle(.grouped)
            .fixedSize(horizontal: false, vertical: true)
            .frame(width: ViewWidth.medium)
    }

    private var gaming: some View {
        Section {
            Toggle("Open Steam when Vodka opens", isOn: $openSteamAtLaunch)
                .help("Starts Steam in the PC it's installed in, unless it's already running.")
            Toggle("Game Mode for Windows games", isOn: $gameModeEnabled)
                .help("Marks Wine processes as games, so macOS turns on Game Mode when a game is full screen.")
            Toggle("Fit full-screen games below the notch", isOn: $fitGamesBelowNotch)
                .help("Games see the display without the area beside the camera, so nothing is hidden behind it.")
        }
        .onChange(of: gameModeEnabled) { WineGameMode.apply() }
        .onChange(of: fitGamesBelowNotch) { WineGameMode.apply() }
    }

    @ViewBuilder
    private var general: some View {
        Section {
            Toggle("Open Vodka at login", isOn: $openAtLogin)
                .onChange(of: openAtLogin) { _, enabled in setOpenAtLogin(enabled) }
            if let loginItemError {
                Text(loginItemError)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Toggle("Ask before quitting while games are running", isOn: askBeforeQuitting)
                .help("Quitting Vodka force-stops everything running in your PCs.")
            Toggle("settings.toggle.menubar", isOn: $showMenuBarExtra)
                .help("settings.toggle.menubar.help")
            Picker("settings.terminal", selection: $preferredTerminal) {
                // installedTerminals should always include Terminal.app on macOS,
                // but fall back to showing just Terminal if somehow empty
                let terminals = TerminalApp.installedTerminals
                ForEach(terminals.isEmpty ? [.terminal] : terminals) { terminal in
                    Text(terminal.displayName).tag(terminal.rawValue)
                }
            }
        }
        Section("New PCs") {
            Picker("create.win", selection: $defaultWinVersion) {
                ForEach(WinVersion.allCases.reversed(), id: \.self) {
                    Text($0.pretty()).tag($0)
                }
            }
            ActionView(
                text: "settings.path",
                subtitle: defaultBottleLocation.prettyPath(),
                actionName: "create.browse"
            ) {
                let panel = NSOpenPanel()
                panel.canChooseFiles = false
                panel.canChooseDirectories = true
                panel.allowsMultipleSelection = false
                panel.canCreateDirectories = true
                panel.directoryURL = BottleData.containerDir
                panel.begin { result in
                    if result == .OK, let url = panel.urls.first {
                        defaultBottleLocation = url
                    }
                }
            }
        }
    }

    private var askBeforeQuitting: Binding<Bool> {
        Binding(get: { !skipQuitConfirmation }, set: { skipQuitConfirmation = !$0 })
    }

    private func setOpenAtLogin(_ enabled: Bool) {
        let service = SMAppService.mainApp
        guard enabled != (service.status == .enabled) else { return }
        do {
            if enabled {
                try service.register()
            } else {
                try service.unregister()
            }
            loginItemError = nil
        } catch {
            loginItemError = error.localizedDescription
            openAtLogin = service.status == .enabled
        }
    }

    private var storage: some View {
        Group {
            Section {
                Picker("Keep Wine logs for", selection: $logRetentionDays) {
                    Text("1 day").tag(1)
                    Text("1 week").tag(7)
                    Text("1 month").tag(30)
                    Text("Forever").tag(0)
                }
                LabeledContent("Logs") {
                    HStack {
                        if let logsSize {
                            Text(logsSize.formatted(.byteCount(style: .file)))
                                .foregroundStyle(.secondary)
                        }
                        Button("Show in Finder") { VodkaApp.openLogsFolder() }
                    }
                }
                LabeledContent("PCs") {
                    Button("Show in Finder") {
                        NSWorkspace.shared.activateFileViewerSelecting([defaultBottleLocation])
                    }
                }
            }
            .task(id: logRetentionDays) {
                logsSize = await Task.detached {
                    VodkaApp.deleteOldLogs()
                    return VodkaApp.logsFolderSize()
                }.value
            }
            Section {
                LabeledContent {
                    Button("Clear\u{2026}") { confirmClearShaders = true }
                } label: {
                    Text("Shader caches")
                    Text("Games rebuild them as they run, so the first minutes after clearing may stutter.")
                }
                .confirmationDialog(
                    "Clear shader caches?", isPresented: $confirmClearShaders
                ) {
                    Button("Stop PCs and Clear", role: .destructive) {
                        VodkaApp.killBottles()
                        VodkaApp.wipeShaderCaches()
                    }
                } message: {
                    Text("Everything running in your PCs is stopped first.")
                }
            }
        }
    }

    private var updates: some View {
        Section {
            Toggle("settings.toggle.vodka.updates", isOn: $vodkaUpdate)
            Toggle("settings.toggle.vodkawine.updates", isOn: $checkVodkaWineUpdates)
        }
    }
}

#Preview {
    SettingsView()
}

/// The Settings window's tabs, kept in defaults so the Statistics menu item
/// can open the window on its own tab.
enum SettingsTab: String {
    case general
    case gaming
    case graphics
    case storage
    case updates
    case statistics

    static let defaultsKey = "settingsTab"
}

/// Statistics lives in Settings, so the menu item opens Settings on that tab.
struct StatisticsMenuButton: View {
    @Environment(\.openSettings) private var openSettings
    @AppStorage(SettingsTab.defaultsKey) private var tab = SettingsTab.general

    var body: some View {
        Button("Statistics\u{2026}") {
            tab = .statistics
            openSettings()
        }
        .keyboardShortcut("S", modifiers: [.command, .shift])
    }
}
