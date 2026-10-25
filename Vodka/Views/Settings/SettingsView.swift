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

import SwiftUI
import VodkaKit

struct SettingsView: View {
    @AppStorage("SUEnableAutomaticChecks") var vodkaUpdate = false
    @AppStorage("killOnTerminate") var killOnTerminate = false
    @AppStorage("showMenuBarExtra") var showMenuBarExtra = false
    @AppStorage("checkVodkaWineUpdates") var checkVodkaWineUpdates = true
    @AppStorage("defaultBottleLocation") var defaultBottleLocation = BottleData.defaultBottleDir
    @AppStorage("preferredTerminal") var preferredTerminal = "terminal"
    @AppStorage(WineGameMode.enabledDefaultsKey) var gameModeEnabled = true
    @AppStorage(WineGameMode.fitBelowNotchDefaultsKey) var fitGamesBelowNotch = false

    var body: some View {
        Form {
            Section("Gaming") {
                Toggle("Game Mode for Windows games", isOn: $gameModeEnabled)
                    .help("Marks Wine processes as games, so macOS turns on Game Mode when a game is full screen.")
                Toggle("Fit full-screen games below the notch", isOn: $fitGamesBelowNotch)
                    .help("Games see the display without the area beside the camera, so nothing is hidden behind it.")
            }
            .onChange(of: gameModeEnabled) { WineGameMode.apply() }
            .onChange(of: fitGamesBelowNotch) { WineGameMode.apply() }
            GPTKSettingsSection()
            Section("settings.general") {
                Toggle("settings.toggle.kill.on.terminate", isOn: $killOnTerminate)
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
            Section("settings.updates") {
                Toggle("settings.toggle.vodka.updates", isOn: $vodkaUpdate)
                Toggle("settings.toggle.vodkawine.updates", isOn: $checkVodkaWineUpdates)
            }
        }
        .formStyle(.grouped)
        .fixedSize(horizontal: false, vertical: true)
        .frame(width: ViewWidth.medium)
    }
}

#Preview {
    SettingsView()
}
