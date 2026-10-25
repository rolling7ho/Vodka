//
//  DiscordConfigSection.swift
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

struct DiscordConfigSection: View {
    @ObservedObject var bottle: Bottle

    var body: some View {
        Section("config.discord") {
            // A build without a Discord application behind it cannot show
            // presence, and no setting here can fix that, so the row goes.
            if DiscordPresence.isAvailable {
                Toggle(isOn: $bottle.settings.discordPresence) {
                    VStack(alignment: .leading) {
                        Text("config.discord.presence")
                        Text("config.discord.presence.info")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }

            Toggle(isOn: $bottle.settings.discordBridge) {
                VStack(alignment: .leading) {
                    Text("config.discord.bridge")
                    Text("config.discord.bridge.info")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }
}
