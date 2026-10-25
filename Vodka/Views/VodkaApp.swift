// swiftlint:disable file_length
//
//  VodkaApp.swift
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
import os.log
import Sparkle
import SwiftUI
import VodkaKit

private let logger = Logger(subsystem: Bundle.main.bundleIdentifier ?? "com.rolling7ho.Vodka", category: "VodkaApp")

@main
// swiftlint:disable:next type_body_length
struct VodkaApp: App {
    /// True when launched by the UI test harness (the `-VodkaUITestMode` launch
    /// argument set in `VodkaUITests`). UI tests run without a Wine runtime
    /// installed, which would otherwise auto-present the first-launch setup sheet
    /// over the main window and race every toolbar interaction; this lets that
    /// auto-presentation (and the update check) be skipped in tests.
    static let isUITesting = ProcessInfo.processInfo.arguments.contains("-VodkaUITestMode")

    /// Scene id for the main window, used to reopen it from the menu-bar extra.
    static let mainWindowID = "main"

    /// Opt-in: show a menu-bar extra and keep Vodka running after the main
    /// window closes (see `AppDelegate.applicationShouldTerminateAfterLastWindowClosed`).
    @AppStorage("showMenuBarExtra") private var showMenuBarExtra = false
    @State var showSetup: Bool = false
    @State private var showMigrate: Bool = false
    @State private var showDiagnosticsSheet: Bool = false
    @State private var showTroubleshootingPicker: Bool = false
    @State private var showTroubleshootingWizard: Bool = false
    @State private var troubleshootingBottle: Bottle?
    @State private var troubleshootingProgram: Program?
    @State private var troubleshootingEntryContext: EntryContext?
    @State private var crashDiagnosisBanner: CrashDiagnosisBannerState?
    @State private var crashDiagnosisSheet: CrashDiagnosisBannerState?
    @State private var crashDiagnosisLogText: String = ""
    @State private var audioDeviceToast: ToastData?
    @State private var audioMonitor = AudioDeviceMonitor()
    @State private var audioAlertTracker = AudioAlertTracker()
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    @Environment(\.openURL) var openURL
    private let updaterController: SPUStandardUpdaterController

    init() {
        // Before anything reads a bottle, a setting or the engine: they may
        // still be in the folders of a build from before the rename.
        Self.migrateWhiskyBuildData()
        updaterController = SPUStandardUpdaterController(
            startingUpdater: true,
            updaterDelegate: nil,
            userDriverDelegate: SparkleUpdaterDelegate.shared
        )
    }

    /// Brings a deployed GPTK payload up to date at launch, in one background
    /// task so the steps never run over each other.
    ///
    /// - The stored payload is checked first if nothing has checked it as it
    ///   is now (a store imported before imports verified Apple's signature),
    ///   and a deployment of a store that fails is taken back out.
    /// - The MetalFX and NVAPI bridges and the D3D12 video processor go into
    ///   runtimes that already hold the payload. Deploying does this too, but
    ///   an install set up before they existed never deploys again, so without
    ///   this they would stay missing until it happened to reimport. Each step
    ///   is idempotent and a no-op on runtimes it does not apply to.
    private func updateGPTKPayloadIfNeeded() {
        var data = BottleData()
        let bottles = data.loadBottles().map(\.url)
        Task.detached(priority: .background) {
            GPTKImporter.verifyStoredPayload()
            GPTKImporter.ensureMetalFXBridgeInstalled()
            GPTKImporter.ensureNVAPIBridgeInstalled()
            GPTKImporter.ensureVideoProcessorInstalled(bottles: bottles)
        }
    }

    var body: some Scene {
        WindowGroup(id: Self.mainWindowID) {
            ContentView(showSetup: $showSetup)
                // Wide enough for two columns of library cards next to the
                // sidebar. At 600 the grid could only ever draw one.
                .frame(minWidth: ViewWidth.window, minHeight: 316)
                .environmentObject(BottleVM.shared)
                .onAppear {
                    NSWindow.allowsAutomaticWindowTabbing = false
                    Task.detached {
                        await VodkaApp.deleteOldLogs()
                    }
                    updateGPTKPayloadIfNeeded()
                    Task.detached(priority: .utility) {
                        WineGameMode.apply()
                    }
                    startAudioDeviceListening()
                }
                .onReceive(
                    NotificationCenter.default.publisher(for: .crashDiagnosisAvailable)
                ) { notification in
                    handleCrashDiagnosisNotification(notification)
                }
                .sheet(isPresented: $showDiagnosticsSheet) {
                    DiagnosticsPickerSheet()
                        .environmentObject(BottleVM.shared)
                }
                .sheet(isPresented: $showTroubleshootingPicker) {
                    TroubleshootingTargetPicker(
                        bottles: BottleVM.shared.bottles
                    ) { bottle, program in
                        troubleshootingBottle = bottle
                        troubleshootingProgram = program
                        troubleshootingEntryContext = .helpMenu(
                            bottleURL: bottle.url,
                            programURL: program?.url
                        )
                        showTroubleshootingWizard = true
                    }
                }
                .sheet(isPresented: $showTroubleshootingWizard) {
                    if let bottle = troubleshootingBottle,
                       let context = troubleshootingEntryContext {
                        TroubleshootingWizardView(
                            bottle: bottle,
                            program: troubleshootingProgram,
                            entryContext: context
                        )
                    }
                }
                .sheet(isPresented: $showMigrate) {
                    MigrateBottlesSheet()
                        .environmentObject(BottleVM.shared)
                }
                .sheet(item: $crashDiagnosisSheet) { banner in
                    DiagnosticsView(
                        diagnosis: banner.diagnosis,
                        logText: crashDiagnosisLogText,
                        programName: banner.programName,
                        bottleName: bottle(forProgramPath: banner.programPath)?.settings.name ?? "",
                        timestamp: Date(),
                        applyBottle: bottle(forProgramPath: banner.programPath)
                    )
                    .frame(minWidth: 600, minHeight: 400)
                }
                .overlay(alignment: .top) {
                    if let banner = crashDiagnosisBanner {
                        crashDiagnosisBannerView(banner)
                    }
                }
                .toast($audioDeviceToast)
        }
        .handlesExternalEvents(matching: ["*"])
        .commands {
            CommandGroup(after: .appInfo) {
                SparkleView(updater: updaterController.updater)
            }
            // Statistics lives in Settings, so its item sits beside Settings….
            CommandGroup(after: .appSettings) {
                StatisticsMenuButton()
            }
            CommandGroup(before: .systemServices) {
                Divider()
                Button("open.setup") {
                    showSetup = true
                }
            }
            CommandGroup(replacing: .newItem) {}
            CommandGroup(after: .newItem) {
                Button("open.bottle") {
                    let panel = NSOpenPanel()
                    panel.canChooseFiles = false
                    panel.canChooseDirectories = true
                    panel.allowsMultipleSelection = false
                    panel.canCreateDirectories = false
                    panel.begin { result in
                        if result == .OK {
                            if let url = panel.urls.first {
                                // Task inherits main actor context from SwiftUI commands builder
                                Task {
                                    BottleVM.shared.bottlesList.paths.append(url)
                                    BottleVM.shared.loadBottles()
                                }
                            }
                        }
                    }
                }
                .keyboardShortcut("I", modifiers: [.command])
                Button("Migrate from the Original Whisky…") {
                    showMigrate = true
                }
            }
            CommandGroup(after: .importExport) {
                Button("open.logs") {
                    VodkaApp.openLogsFolder()
                }
                .keyboardShortcut("L", modifiers: [.command])
                Button("kill.bottles") {
                    VodkaApp.killBottles()
                }
                .keyboardShortcut("K", modifiers: [.command, .shift])
                Button("wine.clearShaderCaches") {
                    VodkaApp.killBottles() // Better not make things more complicated for ourselves
                    VodkaApp.wipeShaderCaches()
                }
            }
            CommandGroup(replacing: .help) {
                Button("help.github") {
                    if let url = URL(string: "https://github.com/rolling7ho/Vodka") {
                        openURL(url)
                    }
                }
                Button("help.issues") {
                    if let url = URL(string: "https://github.com/rolling7ho/Vodka/issues") {
                        openURL(url)
                    }
                }
                Divider()
                Button("Run Diagnostics\u{2026}") {
                    showDiagnosticsSheet = true
                }
                .keyboardShortcut("D", modifiers: [.command, .shift])
                Button(String(localized: "troubleshooting.entry.helpMenu")) {
                    showTroubleshootingPicker = true
                }
                .keyboardShortcut("T", modifiers: [.command, .shift])
            }
        }
        Settings {
            SettingsView()
                .environmentObject(BottleVM.shared)
        }
        MenuBarExtra("Vodka", systemImage: "wineglass", isInserted: $showMenuBarExtra) {
            VodkaMenuBarView()
                .environmentObject(BottleVM.shared)
        }
    }

    // MARK: - Crash Diagnosis Notification

    private func handleCrashDiagnosisNotification(_ notification: Notification) {
        guard let diagnosis = notification.userInfo?["diagnosis"] as? CrashDiagnosis,
              let programPath = notification.userInfo?["programPath"] as? String,
              let logFileURL = notification.userInfo?["logFileURL"] as? URL
        else { return }

        let programName = URL(fileURLWithPath: programPath).deletingPathExtension().lastPathComponent
        crashDiagnosisBanner = CrashDiagnosisBannerState(
            diagnosis: diagnosis,
            programName: programName,
            programPath: programPath,
            logFileURL: logFileURL
        )

        // Auto-dismiss after 8 seconds
        Task {
            try? await Task.sleep(for: .seconds(8))
            withAnimation {
                crashDiagnosisBanner = nil
            }
        }
    }

    private func crashDiagnosisBannerView(_ banner: CrashDiagnosisBannerState) -> some View {
        HStack {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(.orange)
            Text("Crash detected \u{2014} \(banner.programName)")
                .fontWeight(.medium)
            Spacer()
            Button("View Diagnosis") {
                openDiagnosisFromCrash(banner)
            }
            .buttonStyle(.bordered)
            .controlSize(.small)
            Button(String(localized: "troubleshooting.entry.troubleshoot")) {
                openTroubleshootingFromCrash(banner)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.small)
            Button {
                withAnimation {
                    crashDiagnosisBanner = nil
                }
            } label: {
                Image(systemName: "xmark")
                    .font(.caption)
            }
            .buttonStyle(.plain)
        }
        .padding(10)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(Color(.controlBackgroundColor))
                .shadow(radius: 4)
        )
        .padding(.horizontal, 16)
        .padding(.top, 8)
        .transition(.move(edge: .top).combined(with: .opacity))
    }

    // MARK: - Troubleshooting from Crash Banner

    /// The bottle whose prefix contains `programPath`, if any.
    private func bottle(forProgramPath programPath: String) -> Bottle? {
        BottleVM.shared.bottles.first { bottle in
            programPath.hasPrefix(bottle.url.path(percentEncoded: false))
        }
    }

    private func openDiagnosisFromCrash(_ banner: CrashDiagnosisBannerState) {
        withAnimation {
            crashDiagnosisBanner = nil
        }
        Task {
            crashDiagnosisLogText = (try? String(contentsOf: banner.logFileURL, encoding: .utf8)) ?? ""
            crashDiagnosisSheet = banner
        }
    }

    private func openTroubleshootingFromCrash(_ banner: CrashDiagnosisBannerState) {
        withAnimation {
            crashDiagnosisBanner = nil
        }

        guard let bottle = bottle(forProgramPath: banner.programPath) else {
            // Fallback: open picker if we could not match the program
            showTroubleshootingPicker = true
            return
        }

        let program = bottle.programs.first { program in
            program.url.path(percentEncoded: false) == banner.programPath
        }
        let evidence: [String: String] = [
            "crashCategory": banner.diagnosis.primaryCategory?.rawValue ?? "unknown",
            "logFileURL": banner.logFileURL.absoluteString
        ]
        troubleshootingBottle = bottle
        troubleshootingProgram = program
        troubleshootingEntryContext = .launchFailure(
            programURL: program?.url ?? URL(fileURLWithPath: banner.programPath),
            bottleURL: bottle.url,
            evidence: evidence
        )
        showTroubleshootingWizard = true
    }

    // MARK: - Audio Device Alerts

    private func startAudioDeviceListening() {
        audioMonitor.startListening { event in
            Task { @MainActor in
                guard audioAlertTracker.shouldAlert(deviceName: event.deviceName) else { return }

                switch event.eventType {
                case .defaultOutputChanged, .disconnected:
                    let message = String(
                        localized: "audio.alert.disconnected"
                    ) + ": \(event.deviceName)"
                    audioDeviceToast = ToastData(message: message, style: .info)
                case .reconnected:
                    let message = String(
                        localized: "audio.alert.reconnected"
                    ) + ": \(event.deviceName)"
                    audioDeviceToast = ToastData(message: message, style: .success)
                case .sampleRateChanged:
                    // Check for low sample rate (HFP/Bluetooth issue)
                    if let device = audioMonitor.defaultOutputDevice(),
                       device.sampleRate < 22_050, device.sampleRate > 0 {
                        let message = String(localized: "audio.alert.lowSampleRate")
                            + ": \(event.deviceName)"
                        audioDeviceToast = ToastData(message: message, style: .info)
                    }
                }
            }
        }
    }
}

// MARK: - VodkaApp Utility Methods

extension VodkaApp {
    @MainActor
    static func killBottles() {
        for bottle in BottleVM.shared.bottles {
            // killBottle is fire-and-forget; errors are logged internally
            Wine.killBottle(bottle: bottle)
        }
    }

    static func openLogsFolder() {
        NSWorkspace.shared.selectFile(nil, inFileViewerRootedAtPath: Wine.logsFolder.path)
    }

    /// Settings › Storage. Zero keeps logs forever.
    static let logRetentionDaysKey = "logRetentionDays"

    nonisolated static func deleteOldLogs() {
        let days = UserDefaults.standard.object(forKey: logRetentionDaysKey) as? Int ?? 7
        guard days > 0 else { return }
        let pastDate = Date().addingTimeInterval(-Double(days) * 24 * 60 * 60)

        guard let urls = try? FileManager.default.contentsOfDirectory(
            at: Wine.logsFolder,
            includingPropertiesForKeys: [.creationDateKey]
        )
        else {
            return
        }

        let logs = urls.filter { url in
            url.pathExtension == "log"
        }

        let oldLogs = logs.filter { url in
            do {
                let resourceValues = try url.resourceValues(forKeys: [.creationDateKey])

                return resourceValues.creationDate ?? Date() < pastDate
            } catch {
                return false
            }
        }

        for log in oldLogs {
            do {
                try FileManager.default.removeItem(at: log)
            } catch {
                logger.warning("Failed to delete log: \(error.localizedDescription)")
            }
        }
    }

    nonisolated static func logsFolderSize() -> Int64 {
        let files = FileManager.default.enumerator(
            at: Wine.logsFolder, includingPropertiesForKeys: [.fileSizeKey]
        )
        var total: Int64 = 0
        while let url = files?.nextObject() as? URL {
            total += Int64((try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0)
        }
        return total
    }

    static func wipeShaderCaches() {
        let getconf = Process()
        getconf.executableURL = URL(fileURLWithPath: "/usr/bin/getconf")
        getconf.arguments = ["DARWIN_USER_CACHE_DIR"]
        let pipe = Pipe()
        getconf.standardOutput = pipe
        do {
            try getconf.run()
        } catch {
            logger.error("Failed to run getconf: \(error.localizedDescription)")
            return
        }
        getconf.waitUntilExit()

        let getconfOutput: Data
        do {
            getconfOutput = try pipe.fileHandleForReading.readToEnd() ?? Data()
        } catch {
            logger.error("Failed to read getconf output: \(error.localizedDescription)")
            return
        }

        guard let getconfOutputString = String(data: getconfOutput, encoding: .utf8) else {
            logger.error("Failed to decode getconf output as UTF-8")
            return
        }
        let d3dmPath = URL(fileURLWithPath: getconfOutputString.trimmingCharacters(in: .whitespacesAndNewlines))
            .appending(path: "d3dm").path
        do {
            try FileManager.default.removeItem(atPath: d3dmPath)
            logger.info("Successfully cleared shader caches")
        } catch {
            logger.warning("Failed to remove shader cache at \(d3dmPath): \(error.localizedDescription)")
        }
    }
}

// MARK: - Moving data from before the rename

extension VodkaApp {
    /// Moves a pre-rename build's data, asking for Whisky, Steam and games to
    /// be closed first if they are open. Nothing is moved until they are, and
    /// Vodka does not start on an empty library in the meantime.
    static func migrateWhiskyBuildData() {
        guard !isUITesting else { return }
        while true {
            switch WhiskyBuildMigration.runIfNeeded() {
            case .notNeeded, .migrated:
                return
            case let .blocked(reason):
                let alert = NSAlert()
                alert.messageText = "Close Whisky to move your games to Vodka"
                alert.informativeText = "\(reason) Vodka moves your PCs, engine and settings over from "
                    + "Whisky the first time it opens, and can't while they are in use. Quit Whisky, Steam and "
                    + "any games, then click Try Again."
                alert.addButton(withTitle: "Try Again")
                alert.addButton(withTitle: "Quit Vodka")
                if alert.runModal() != .alertFirstButtonReturn {
                    exit(0)
                }
            case let .failed(reason):
                let alert = NSAlert()
                alert.alertStyle = .critical
                alert.messageText = "Your data couldn't be moved from Whisky"
                alert.informativeText = "\(reason)\n\nOpen Vodka again to finish the move. Until then your "
                    + "data is in ~/Library, in folders named com.rolling7ho.Whisky or com.rolling7ho.Vodka."
                alert.addButton(withTitle: "Quit Vodka")
                alert.runModal()
                exit(1)
            }
        }
    }
}
