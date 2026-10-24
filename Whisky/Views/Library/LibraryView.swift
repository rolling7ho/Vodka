//
//  LibraryView.swift
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

import AppKit
import SwiftUI
import WhiskyKit

/// Everything worth launching, across every bottle, most recently played first.
///
/// This is the home screen because it is the thing people open Whisky to do. A
/// bottle is a Wine prefix, which is an implementation detail of running a
/// Windows program on a Mac, and it only earns space on screen once there is
/// more than one of them.
///
/// Entries come from ``LibraryCatalogue``, so Steam games sit beside pinned
/// programs and a future launcher needs no change here.
struct LibraryView: View {
    @EnvironmentObject var bottleVM: BottleVM
    @Binding var selectedBottle: URL?
    /// Toggled by the toolbar's refresh button. Folded into the reload trigger
    /// because the bottle list is unchanged by a refresh, so watching only that
    /// left the button spinning without rebuilding anything.
    @Binding var refresh: Bool

    @AppStorage("librarySort") private var sort: LibrarySort = .recent

    @StateObject private var model = LibraryModel()
    @State private var search: String = ""
    @State private var showSteamGuide = false
    /// Counts up while the guide shows, so a game finishing its download in
    /// Steam brings up the grid without a manual refresh.
    @State private var guideTick = 0

    private var bottles: [Bottle] { bottleVM.bottles.filter(\.isAvailable) }

    private var hasSteamGames: Bool {
        _ = refresh
        _ = guideTick
        return bottles.contains { !SteamLibrary.enumerate(bottleURL: $0.url).isEmpty }
    }

    private var visible: [LibraryRow] {
        guard !search.isEmpty else { return model.rows }
        return model.rows.filter { $0.item.name.localizedCaseInsensitiveContains(search) }
    }

    /// Every input that changes what the grid should contain. Pins live in
    /// bottle settings, so a program pinned in the bottle screen shows up here
    /// without a relaunch.
    private var reloadTrigger: String {
        let pins = bottles.flatMap { $0.settings.pins.map(\.name) }
        return (bottles.map(\.url.path) + pins + ["\(refresh)", "\(guideTick)"]).joined(separator: "\u{1F}")
    }

    var body: some View {
        Group {
            // Until a Steam game is installed, the guide is what to do next,
            // whatever else the bottles hold.
            if model.rows.isEmpty || !hasSteamGames {
                emptyState
                    .task {
                        while !Task.isCancelled {
                            try? await Task.sleep(for: .seconds(5))
                            guideTick += 1
                        }
                    }
            } else {
                grid
            }
        }
        .navigationTitle("library.title")
        .searchable(text: $search, prompt: Text("library.search"))
        .toolbar { sortMenu }
        .toast($model.toast)
        .sheet(isPresented: $showSteamGuide) {
            SteamSetupGuideView { showSteamGuide = false }
                .frame(minWidth: 620, minHeight: 640)
        }
        .task(id: reloadTrigger) {
            await model.reload(bottles: bottles)
        }
        .onChange(of: sort, initial: true) {
            model.sort = sort
        }
        .onDisappear {
            model.stopTracking()
        }
        .alert(
            "library.launch.failed",
            isPresented: Binding(
                get: { model.launchError != nil },
                set: { if !$0 { model.launchError = nil } }
            )
        ) {
            Button("button.ok") { model.launchError = nil }
        } message: {
            Text(model.launchError ?? "")
        }
        .alert(
            "Game Porting Toolkit needed",
            isPresented: Binding(
                get: { model.gptkNotice != nil },
                set: { if !$0 { model.gptkNotice = nil } }
            )
        ) {
            Button("Set Up") {
                model.gptkNotice = nil
                showSteamGuide = true
            }
            Button("button.ok", role: .cancel) { model.gptkNotice = nil }
        } message: {
            Text(model.gptkNotice ?? "")
        }
    }

    @ToolbarContentBuilder
    private var sortMenu: some ToolbarContent {
        ToolbarItem(placement: .primaryAction) {
            Button {
                showSteamGuide = true
            } label: {
                Label("Steam Setup", systemImage: "gamecontroller")
            }
            .help("Set up Steam, step by step")
        }
        ToolbarItem(placement: .primaryAction) {
            Menu {
                Picker("library.sort", selection: $sort) {
                    ForEach(LibrarySort.allCases) { option in
                        Text(option.label).tag(option)
                    }
                }
                .pickerStyle(.inline)
            } label: {
                Label("library.sort", systemImage: "arrow.up.arrow.down")
            }
            .accessibilityIdentifier("library.sort")
        }
    }

    private var grid: some View {
        ScrollView {
            LazyVGrid(
                // 180 rather than 220 so two columns fit at the window's own
                // minimum width, where the sidebar leaves about 330pt: one
                // column of landscape cards is a list with wasted space.
                columns: [GridItem(.adaptive(minimum: 180, maximum: 320), spacing: 14)],
                spacing: 14
            ) {
                ForEach(visible) { row in
                    LibraryCard(
                        item: row.item,
                        bottleName: row.bottleName,
                        lastPlayed: row.lastPlayed,
                        state: model.state(for: row.item),
                        launch: { model.launch(row, bottles: bottles) }
                    )
                    .contextMenu { menu(for: row) }
                }
            }
            .padding(18)
        }
    }

    @ViewBuilder
    private func menu(for row: LibraryRow) -> some View {
        Button("button.run") { model.launch(row, bottles: bottles) }
        if model.state(for: row.item) == .running {
            Button("library.card.stop") { model.stop(row, bottles: bottles) }
        }
        Divider()
        if case let .steam(appID) = row.item.launch,
           let bottle = bottles.first(where: { $0.url == row.item.bottleURL }),
           bottle.settings.nativeResolution {
            resolutionMenu(appID: appID, bottle: bottle)
        }
        if case let .program(url) = row.item.launch {
            Button("button.showInFinder") {
                NSWorkspace.shared.activateFileViewerSelecting([url])
            }
            Button("library.card.unpin", role: .destructive) { unpin(url, in: row.item.bottleURL) }
        }
        // Per-program settings live inside the bottle's own navigation stack,
        // which the library cannot push onto, so this is as close as the menu
        // gets without a deep link into it.
        Button("library.card.configure") {
            selectedBottle = row.item.bottleURL
        }
    }

    /// Sharp draws every Retina pixel; Faster draws a quarter of them and the
    /// engine upscales them with MetalFX, for a game short of frames. Takes
    /// effect next launch.
    private func resolutionMenu(appID: Int, bottle: Bottle) -> some View {
        Picker("Resolution", selection: Binding(
            get: { bottle.settings.fasterSteamApps.contains(appID) },
            set: { faster in
                if faster {
                    bottle.settings.fasterSteamApps.insert(appID)
                } else {
                    bottle.settings.fasterSteamApps.remove(appID)
                }
                model.toast = ToastData(
                    message: faster ? "Faster: MetalFX upscaling from the next launch"
                        : "Sharp: full resolution from the next launch",
                    style: .success
                )
            }
        )) {
            Text("Sharp (Full Resolution)").tag(false)
            Text("Faster (MetalFX Upscaled)").tag(true)
        }
    }

    private func unpin(_ url: URL, in bottleURL: URL) {
        guard let bottle = bottles.first(where: { $0.url == bottleURL }) else { return }
        bottle.settings.pins.removeAll { $0.url == url }
        if let program = bottle.programs.first(where: { $0.url == url }) {
            program.pinned = false
        }
    }

    /// Nothing to play yet: the Steam guide, which is the whole way in for now.
    private var emptyState: some View {
        SteamSetupGuideView()
    }
}
