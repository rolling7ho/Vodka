//
//  SteamSetupGuideView.swift
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
    /// Whether a graphics choice was made for the Steam bottle. Kept per bottle
    /// (the key the picker writes), so a new bottle starts at this step again.
    private var graphicsChosen: Bool {
        _ = pollTick
        guard let bottle = steamBottle else { return false }
        return UserDefaults.standard.string(forKey: GraphicsChoiceView.pickedKey(for: bottle)) != nil
    }

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
                    Text("Four steps, about 10 minutes. Everything is set up with recommended settings "
                        + "for games and macOS Game Mode.")
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

                graphicsStep

                step(
                    number: 3, title: "Install Steam",
                    state: StepState(done: steamInstalled, active: steamBottle != nil && !steamInstalled),
                    detail: "Downloads the official Steam installer from Valve and installs it for you. "
                        + "Takes 1–2 minutes; nothing pops up until it's done."
                ) {
                    Button(installing ? "Installing…" : "Install Steam") { installSteam() }
                        .disabled(installing || steamBottle == nil || steamBottle?.inFlight == true)
                }

                step(
                    number: 4, title: "Sign in and install a game",
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

    /// Step 2: how games are drawn. Stays open once chosen, so it can be changed here too.
    @ViewBuilder
    private var graphicsStep: some View {
        let ready = steamBottle != nil
        HStack(alignment: .top, spacing: 14) {
            ZStack {
                let idle = ready ? Color.accentColor : Color.secondary.opacity(0.3)
                Circle().fill(graphicsChosen ? Color.green : idle)
                if graphicsChosen {
                    Image(systemName: "checkmark").font(.headline.bold()).foregroundStyle(.white)
                } else {
                    Text("2").font(.headline.bold()).foregroundStyle(.white)
                }
            }
            .frame(width: 32, height: 32)
            VStack(alignment: .leading, spacing: 6) {
                Text("Choose your graphics").font(.title3.bold())
                Text("Windows games are drawn with DirectX, OpenGL or Vulkan, and each needs its own "
                    + "translation to Apple's Metal. Automatic is best for most people. If you mostly play "
                    + "one kind of game, pick it — you can change this any time in the PC's settings.")
                    .foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
                if let bottle = steamBottle {
                    GraphicsChoiceView(bottle: bottle) { pollTick += 1 }
                    if !graphicsChosen {
                        Button("Use Automatic") {
                            bottle.settings.graphicsBackend = .recommended
                            UserDefaults.standard.set(
                                GraphicsChoice.automatic.rawValue, forKey: GraphicsChoiceView.pickedKey(for: bottle)
                            )
                            pollTick += 1
                        }
                            .buttonStyle(.borderedProminent).padding(.top, 2)
                    }
                }
            }
        }
        .padding(16)
        .background(.background.secondary, in: RoundedRectangle(cornerRadius: 12))
        .opacity(ready ? 1 : 0.6)
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
                if !done || number == 4 {
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
