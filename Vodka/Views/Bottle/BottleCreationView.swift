//
//  BottleCreationView.swift
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

struct BottleCreationView: View {
    @Binding var newlyCreatedBottleURL: URL?

    @State private var newBottleName: String = ""
    @State private var newBottleVersion: WinVersion = .win10
    @State private var newBottleURL: URL = UserDefaults.standard.url(forKey: "defaultBottleLocation")
        ?? BottleData.defaultBottleDir
    @State private var nameValid: Bool = false
    @State private var locationIssue: BottleLocationValidation.ValidationResult?

    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL

    // A plain title and bottom buttons rather than a navigation stack: in a
    // sheet the stack's title sits off-centre beside its toolbar buttons.
    var body: some View {
        VStack(spacing: 0) {
            Text("create.title")
                .font(.headline)
                .frame(maxWidth: .infinity)
                .padding(.top, 18)
            Form {
                TextField("create.name", text: $newBottleName)
                    .onChange(of: newBottleName) { _, name in
                        nameValid = !name.isEmpty
                    }
                    .accessibilityIdentifier("create.nameField")

                Picker("create.win", selection: $newBottleVersion) {
                    ForEach(WinVersion.allCases.reversed(), id: \.self) {
                        Text($0.pretty())
                    }
                }

                ActionView(
                    text: "create.path",
                    subtitle: newBottleURL.prettyPath(),
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
                            newBottleURL = url
                            // Probing here is what makes macOS ask, while the sheet
                            // is still up and the request has visible cause.
                            locationIssue = validate(url)
                        }
                    }
                }

                if let locationIssue {
                    locationWarning(locationIssue)
                }
            }
            .formStyle(.grouped)
            // Sized to fit, so it never needs to scroll; without this the
            // sheet flashes a scroller as it opens.
            .scrollDisabled(true)
            .onSubmit {
                submit()
            }
            HStack {
                Spacer()
                Button("create.cancel") {
                    dismiss()
                }
                .keyboardShortcut(.cancelAction)
                .accessibilityIdentifier("create.cancelButton")
                Button("create.create") {
                    submit()
                }
                .keyboardShortcut(.defaultAction)
                .disabled(!nameValid || locationIssue != nil)
                .accessibilityIdentifier("create.createButton")
            }
            .padding([.horizontal, .bottom], 20)
        }
        .fixedSize(horizontal: false, vertical: true)
        .frame(width: ViewWidth.small)
    }

    @ViewBuilder
    private func locationWarning(_ issue: BottleLocationValidation.ValidationResult) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("create.location.problem", systemImage: "exclamationmark.triangle.fill")
                .font(.headline)
                .foregroundStyle(.orange)
            Text(bottleLocationRefusal(issue) ?? "")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
            HStack {
                if case .accessDenied = issue, let settings = Self.filesAndFoldersSettingsURL {
                    Button("create.location.openPrivacySettings") { openURL(settings) }
                }
                Button("create.location.checkAgain") { locationIssue = validate(newBottleURL) }
            }
        }
        .padding(.vertical, 4)
    }

    private func validate(_ url: URL) -> BottleLocationValidation.ValidationResult? {
        let result = BottleLocationValidation.validate(at: url)
        return result == .valid ? nil : result
    }

    /// Nothing can re-present the consent prompt once it has been answered, so
    /// Settings is the only way back from a refusal.
    private static let filesAndFoldersSettingsURL = URL(
        string: "x-apple.systempreferences:com.apple.preference.security?Privacy_FilesAndFolders"
    )

    func submit() {
        // The default location never passes through the panel, so it is probed
        // here or not at all.
        guard let issue = validate(newBottleURL) else {
            newlyCreatedBottleURL = BottleVM.shared.createNewBottle(
                bottleName: newBottleName,
                winVersion: newBottleVersion,
                bottleURL: newBottleURL
            )
            dismiss()
            return
        }
        locationIssue = issue
    }
}

#Preview {
    BottleCreationView(newlyCreatedBottleURL: .constant(nil))
}
