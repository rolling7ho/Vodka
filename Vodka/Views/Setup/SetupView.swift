//
//  SetupView.swift
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

enum SetupStage {
    case rosetta
    case vodkaWineDownload
    case vodkaWineInstall
}

struct SetupView: View {
    @State private var path: [SetupStage] = []
    @State var tarLocation: URL = .init(fileURLWithPath: "")
    @State private var vodkaWineDiagnostics = VodkaWineSetupDiagnostics()
    @Binding var showSetup: Bool
    var firstTime: Bool = true

    var body: some View {
        VStack {
            NavigationStack(path: $path) {
                WelcomeView(path: $path, showSetup: $showSetup, firstTime: firstTime)
                    .navigationBarBackButtonHidden(true)
                    .navigationDestination(for: SetupStage.self) { stage in
                        switch stage {
                        case .rosetta:
                            RosettaView(path: $path, showSetup: $showSetup)
                        case .vodkaWineDownload:
                            VodkaWineDownloadView(
                                tarLocation: $tarLocation,
                                path: $path,
                                showSetup: $showSetup,
                                diagnostics: $vodkaWineDiagnostics
                            )
                        case .vodkaWineInstall:
                            VodkaWineInstallView(
                                tarLocation: $tarLocation,
                                path: $path,
                                showSetup: $showSetup,
                                diagnostics: $vodkaWineDiagnostics
                            )
                        }
                    }
            }
        }
        .padding()
        .interactiveDismissDisabled()
        .onAppear {
            // A missing runtime outside first run goes straight to the download:
            // the welcome screen has nothing else to offer then.
            if !firstTime, !VodkaWineInstaller.isVodkaWineInstalled() {
                path = [.vodkaWineDownload]
            }
        }
    }
}
