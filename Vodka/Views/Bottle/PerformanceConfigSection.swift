//
//  PerformanceConfigSection.swift
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

struct PerformanceConfigSection: View {
    @ObservedObject var bottle: Bottle
    @Binding var isExpanded: Bool

    var body: some View {
        Section("config.title.performance", isExpanded: $isExpanded) {
            Toggle(isOn: $bottle.settings.shaderCacheEnabled) {
                VStack(alignment: .leading) {
                    Text("config.shaderCache")
                    Text("config.shaderCache.info")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            Toggle(isOn: $bottle.settings.disableAppNap) {
                VStack(alignment: .leading) {
                    Text("config.disableAppNap")
                    Text("config.disableAppNap.info")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
        }
    }
}
