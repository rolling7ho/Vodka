//
//  SetupView.swift
//  Gmac
//
//  This file is part of Gmac, a fork of Whisky.
//
//  Gmac is free software: you can redistribute it and/or modify it under the terms
//  of the GNU General Public License as published by the Free Software Foundation,
//  either version 3 of the License, or (at your option) any later version.
//
//  Gmac is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
//  without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
//  See the GNU General Public License for more details.
//
//  You should have received a copy of the GNU General Public License along with Gmac.
//  If not, see https://www.gnu.org/licenses/.
//

import GmacKit
import SwiftUI

enum SetupStage {
    case rosetta
    case gmacWineDownload
    case gmacWineInstall
}

struct SetupView: View {
    @State private var path: [SetupStage] = []
    @State var tarLocation: URL = .init(fileURLWithPath: "")
    @State private var gmacWineDiagnostics = GmacWineSetupDiagnostics()
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
                        case .gmacWineDownload:
                            GmacWineDownloadView(
                                tarLocation: $tarLocation,
                                path: $path,
                                showSetup: $showSetup,
                                diagnostics: $gmacWineDiagnostics
                            )
                        case .gmacWineInstall:
                            GmacWineInstallView(
                                tarLocation: $tarLocation,
                                path: $path,
                                showSetup: $showSetup,
                                diagnostics: $gmacWineDiagnostics
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
            if !firstTime, !GmacWineInstaller.isGmacWineInstalled() {
                path = [.gmacWineDownload]
            }
        }
    }
}
