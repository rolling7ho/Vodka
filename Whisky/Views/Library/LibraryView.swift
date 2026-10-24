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

    private var bottles: [Bottle] { bottleVM.bottles.filter(\.isAvailable) }

    private var visible: [LibraryRow] {
        guard !search.isEmpty else { return model.rows }
        return model.rows.filter { $0.item.name.localizedCaseInsensitiveContains(search) }
    }

    /// Every input that changes what the grid should contain. Pins live in
    /// bottle settings, so a program pinned in the bottle screen shows up here
    /// without a relaunch.
    private var reloadTrigger: String {
        let pins = bottles.flatMap { $0.settings.pins.map(\.name) }
        return (bottles.map(\.url.path) + pins + ["\(refresh)"]).joined(separator: "\u{1F}")
    }

    var body: some View {
        Group {
            if model.rows.isEmpty {
                emptyState
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

/// Walks someone from nothing to playing a Steam game, one step at a time.
///
/// Each step says what to click and what will happen, including the parts that
/// look like something went wrong but haven't, such as Steam updating itself.
struct SteamSetupGuideView: View {
    @EnvironmentObject var bottleVM: BottleVM
    /// Set when the guide is shown in a sheet, so it can offer a Done button.
    var dismiss: (() -> Void)?

    @State private var creating = false
    @State private var installing = false
    @State private var errorMessage: String?
    @State private var steamOpened = false
    @State private var pollTick = 0

    private static let bottleName = "Steam"

    private var bottles: [Bottle] { bottleVM.bottles.filter(\.isAvailable) }
    private var steamBottle: Bottle? {
        _ = pollTick
        return SteamInstaller.steamBottle(in: bottles)
            ?? bottles.first { $0.settings.name == Self.bottleName }
    }
    private var steamInstalled: Bool {
        _ = pollTick
        return steamBottle.map(SteamInstaller.isInstalled(in:)) ?? false
    }
    private var installedGames: Int {
        _ = pollTick
        return steamBottle.map { SteamLibrary.enumerate(bottleURL: $0.url).count } ?? 0
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Play your Steam games on this Mac")
                        .font(.largeTitle.bold())
                    Text("Three steps, about 10 minutes. Everything is set up with recommended settings "
                        + "for sharp, full-resolution games and macOS Game Mode.")
                        .foregroundStyle(.secondary)
                }

                step(
                    number: 1, title: "Create your Steam space",
                    state: StepState(done: steamBottle != nil, active: steamBottle == nil),
                    detail: "Makes a private Windows environment just for Steam and its games. "
                        + "Takes about a minute — you'll see it appear in the sidebar."
                ) {
                    Button(creating ? "Creating…" : "Create") { createBottle() }
                        .disabled(creating)
                }

                step(
                    number: 2, title: "Install Steam",
                    state: StepState(done: steamInstalled, active: steamBottle != nil && !steamInstalled),
                    detail: "Downloads the official Steam installer from Valve and installs it for you. "
                        + "Takes 1–2 minutes; nothing pops up until it's done."
                ) {
                    Button(installing ? "Installing…" : "Install Steam") { installSteam() }
                        .disabled(installing || steamBottle == nil || steamBottle?.inFlight == true)
                }

                step(
                    number: 3, title: "Sign in and install a game",
                    state: StepState(done: installedGames > 0, active: steamInstalled && installedGames == 0),
                    detail: "Steam opens and first updates itself — the window can stay blank or show "
                        + "“Updating Steam” for 2–5 minutes. That's normal. Then sign in, open your library "
                        + "and install a game. Installed games show up here, ready to play."
                ) {
                    Button(steamOpened ? "Open Steam Again" : "Open Steam") { openSteam() }
                        .disabled(!steamInstalled)
                }

                if let errorMessage {
                    Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                        .foregroundStyle(.orange)
                }

                tips

                if let dismiss {
                    HStack {
                        Spacer()
                        Button("Done", action: dismiss).keyboardShortcut(.defaultAction)
                    }
                }
            }
            .padding(28)
            .frame(maxWidth: 640, alignment: .leading)
            .frame(maxWidth: .infinity)
        }
        .task {
            // Steam installs and game downloads happen outside the app; look again now and then.
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(3))
                pollTick += 1
            }
        }
    }

    private var tips: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Good to know").font(.headline)
            tip("play.rectangle", "Press Play on a game here, or in Steam — both use the best settings.")
            tip("gamecontroller", "Play full screen to turn on Game Mode. You'll see a controller icon in "
                + "the menu bar while it's on.")
            tip("sparkles", "Popular games like Teardown have a preset that's applied automatically.")
            tip("hourglass", "A game's first launch is slower while it prepares its graphics. "
                + "Later launches are quicker.")
            tip("exclamationmark.shield", "Games with kernel anti-cheat (many online shooters) "
                + "can't run on a Mac this way.")
        }
        .padding(16)
        .background(.quaternary.opacity(0.5), in: RoundedRectangle(cornerRadius: 10))
    }

    private func tip(_ symbol: String, _ text: String) -> some View {
        Label {
            Text(text).foregroundStyle(.secondary)
        } icon: {
            Image(systemName: symbol).foregroundStyle(.tint)
        }
    }

    private struct StepState {
        let done: Bool
        let active: Bool
    }

    private func step(
        number: Int, title: String, state: StepState, detail: String,
        @ViewBuilder action: () -> some View
    ) -> some View {
        let done = state.done
        let active = state.active
        return HStack(alignment: .top, spacing: 14) {
            ZStack {
                Circle().fill(done ? Color.green : (active ? Color.accentColor : Color.secondary.opacity(0.3)))
                if done {
                    Image(systemName: "checkmark").font(.headline.bold()).foregroundStyle(.white)
                } else {
                    Text("\(number)").font(.headline.bold()).foregroundStyle(.white)
                }
            }
            .frame(width: 32, height: 32)
            VStack(alignment: .leading, spacing: 6) {
                Text(title).font(.title3.bold())
                Text(detail).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
                if !done || number == 3 {
                    action().buttonStyle(.borderedProminent).disabled(!active && !done).padding(.top, 2)
                }
            }
        }
        .padding(16)
        .background(.background.secondary, in: RoundedRectangle(cornerRadius: 12))
        .opacity(active || done ? 1 : 0.6)
    }

    private func createBottle() {
        creating = true
        errorMessage = nil
        _ = bottleVM.createNewBottle(
            bottleName: Self.bottleName, winVersion: .win10, bottleURL: BottleData.defaultBottleDir
        )
        Task {
            while bottleVM.bottles.contains(where: { $0.inFlight }) {
                try? await Task.sleep(for: .milliseconds(500))
            }
            creating = false
            pollTick += 1
        }
    }

    private func installSteam() {
        guard let bottle = steamBottle else { return }
        installing = true
        errorMessage = nil
        Task {
            do {
                try await SteamInstaller.install(in: bottle)
                pollTick += 1
                openSteam()
            } catch {
                errorMessage = error.localizedDescription
            }
            installing = false
        }
    }

    private func openSteam() {
        guard let bottle = steamBottle else { return }
        SteamInstaller.open(in: bottle)
        steamOpened = true
    }
}
