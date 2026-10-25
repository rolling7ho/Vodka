//
//  ContentView+Sidebar.swift
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

import AppKit
import SemanticVersion
import SwiftUI
import VodkaKit

// MARK: - Sidebar & Detail

extension ContentView {
    var sidebar: some View {
        ScrollViewReader { proxy in
            List(selection: $selected) {
                Section {
                    libraryRow
                }
                // A bottle is a Wine prefix, so it belongs under a heading rather
                // than being the whole sidebar. With one bottle this is the row
                // that reaches its config; with several it is also the switcher.
                // Making another is rare, so its button lives on the heading
                // rather than in the window's toolbar beside the library's own.
                // Pinned open: a click on the header's + also toggled the
                // section, so opening New PC collapsed the list of PCs.
                Section(isExpanded: .constant(true)) {
                    ForEach(sortedBottles) { bottle in
                        bottleRow(bottle)
                            .id(bottle.url)
                    }
                } header: {
                    HStack(spacing: 6) {
                        Text("sidebar.bottles")
                        Spacer()
                        Button {
                            showBottleCreation.toggle()
                        } label: {
                            Image(systemName: "plus")
                        }
                        .buttonStyle(.borderless)
                        .help("button.createBottle")
                        .accessibilityIdentifier("toolbar.createBottle")
                    }
                }
            }
            .animation(.default, value: bottleVM.bottles)
            .listStyle(.sidebar)
            .accessibilityIdentifier("bottleSidebar")
            .safeAreaInset(edge: .bottom, spacing: 0) {
                SettingsLink {
                    Label("Settings", systemImage: "gearshape")
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .foregroundStyle(.secondary)
                .padding(.horizontal, 18)
                .padding(.vertical, 10)
                .accessibilityIdentifier("sidebar.settings")
            }
            // No search field here. The library has one, and two fields forty
            // points apart searching different things (bottles here, programs
            // there) is a choice nobody should have to make to find a game.
            .onChange(of: newlyCreatedBottleURL) { _, url in
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
                    selected = url
                    withAnimation {
                        proxy.scrollTo(url, anchor: .center)
                    }
                }
            }
        }
    }

    /// Selecting nothing means the library, not an empty pane: the library is
    /// the home screen, and a person who has not picked a bottle has not made a
    /// mistake.
    var libraryRow: some View {
        // A button drawing its own selection, because the list's selection is
        // a bottle URL.
        Button {
            selected = nil
        } label: {
            Label("library.title", systemImage: "square.grid.2x2")
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .listRowBackground(
            RoundedRectangle(cornerRadius: 6, style: .continuous)
                .fill(selected == nil ? AnyShapeStyle(.selection) : AnyShapeStyle(.clear))
        )
        .accessibilityIdentifier("sidebar.library")
    }

    /// One PC's row: in progress, missing from disk, or ready.
    @ViewBuilder
    private func bottleRow(_ bottle: Bottle) -> some View {
        if bottle.inFlight {
            HStack {
                Text(bottle.settings.name)
                Spacer()
                ProgressView().controlSize(.small)
            }
            .opacity(0.5)
        } else if !bottle.isAvailable {
            HStack {
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundStyle(.orange)
                    .font(.caption)
                Text(bottle.settings.name)
                Spacer()
                Button {
                    Task { await bottle.remove(delete: false) }
                } label: {
                    Image(systemName: "xmark.circle")
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
                .help("button.removeFromList.help")
            }
            .opacity(0.6)
            .selectionDisabled(true)
        } else {
            BottleListEntry(
                bottle: bottle,
                selected: $selected,
                refresh: $triggerRefresh,
                toast: $toast
            )
            .accessibilityIdentifier("sidebar.bottle")
        }
    }

    @ViewBuilder
    var detail: some View {
        if let bottle = selected {
            if let bottle = bottleVM.bottles.first(where: { $0.url == bottle }) {
                BottleView(bottle: bottle)
                    .disabled(bottle.inFlight)
                    .id(bottle.url)
            }
        } else if bottleVM.countActive() > 0 {
            LibraryView(selectedBottle: $selected, refresh: $triggerRefresh)
        } else {
            // No bottles yet: the guide is the way in, and its first step makes one.
            if bottleVM.bottles.isEmpty || bottleVM.countActive() == 0, bottlesLoaded {
                SteamSetupGuideView()
            }
        }
    }

    var sortedBottles: [Bottle] {
        bottleVM.bottles.sorted()
    }
}

// MARK: - Process Close Confirmation

extension ContentView {
    @MainActor
    func showProcessCloseAlert(for bottle: Bottle) {
        let checkbox = NSButton(
            checkboxWithTitle: String(localized: "bottle.close.remember"),
            target: nil,
            action: nil
        )
        let alert = NSAlert()
        alert.messageText = String(localized: "bottle.close.confirm.title")
        alert.informativeText = String(localized: "bottle.close.confirm.message")
        alert.alertStyle = .informational
        alert.addButton(withTitle: String(localized: "bottle.close.keepRunning"))
        let stopButton = alert.addButton(withTitle: String(localized: "bottle.close.stopBottle"))
        stopButton.hasDestructiveAction = true
        alert.accessoryView = checkbox

        let response = alert.runModal()

        if response == .alertFirstButtonReturn {
            // Keep Running (default)
            if checkbox.state == .on {
                bottle.settings.closeWithProcessesPolicy = .alwaysKeepRunning
            }
        } else if response == .alertSecondButtonReturn {
            // Stop Bottle
            if checkbox.state == .on {
                bottle.settings.closeWithProcessesPolicy = .alwaysStop
            }
            Wine.killBottle(bottle: bottle)
            ProcessRegistry.shared.clearRegistry(for: bottle.url)
        }
    }
}

#Preview {
    ContentView(showSetup: .constant(false))
        .environmentObject(BottleVM.shared)
}
