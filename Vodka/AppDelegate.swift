//
//  AppDelegate.swift
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

import Foundation
import os
import SwiftUI
import VodkaKit

private let logger = Logger(subsystem: Bundle.vodkaBundleIdentifier, category: "AppDelegate")

class AppDelegate: NSObject, NSApplicationDelegate {
    @AppStorage("hasShownMoveToApplicationsAlert") private var hasShownMoveToApplicationsAlert = false

    func application(_ application: NSApplication, open urls: [URL]) {
        // Test if automatic window tabbing is enabled
        // as it is disabled when ContentView appears
        if NSWindow.allowsAutomaticWindowTabbing, let url = urls.first {
            // Reopen the file after Vodka has been opened
            // so that the `onOpenURL` handler is actually called
            NSWorkspace.shared.open(url)
        }
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        if !hasShownMoveToApplicationsAlert, !AppDelegate.insideAppsFolder {
            DispatchQueue.main.asyncAfter(deadline: .now()) {
                NSApp.activate(ignoringOtherApps: true)
                self.showAlertOnFirstLaunch()
                self.hasShownMoveToApplicationsAlert = true
            }
        }

        // Background cleanup of orphaned temp files from previous sessions
        Task.detached {
            await TempFileTracker.shared.cleanupOldFiles(olderThan: 24 * 60 * 60)
        }

        // An engine replaced outside the app's own install arrives without the
        // stored D3DMetal payload, and DirectX 12 games then find no GPU.
        Task.detached(priority: .utility) {
            GPTKImporter.deployStoredPayloadIfCapable()
        }

        // Startup orphan process detection
        // Probe each known bottle's wineserver to detect processes from previous sessions
        Task {
            // Wait for bottles to load (BottleVM needs time to initialize)
            try? await Task.sleep(for: .seconds(2))
            await self.sweepOrphanProcesses()
        }
    }

    /// Quitting Vodka stops everything it runs: Steam, games and Wine's own
    /// services in every PC. That is a force stop, so a game loses whatever it
    /// hasn't saved, and Vodka asks first whenever something is running.
    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        guard !Self.relaunchingForUpdate, RunningWinePrograms.anyRunning else { return .terminateNow }
        if !UserDefaults.standard.bool(forKey: Self.skipQuitConfirmationKey) {
            guard confirmStoppingEverything() else { return .terminateCancel }
        }
        // AppKit asks on the main thread.
        MainActor.assumeIsolated { stopEverything() }
        return .terminateNow
    }

    static let skipQuitConfirmationKey = "skipQuitConfirmation"

    /// Set by Sparkle just before it quits Vodka to install an update.
    nonisolated(unsafe) static var relaunchingForUpdate = false

    private func confirmStoppingEverything() -> Bool {
        let names = RunningWinePrograms.names()
        let alert = NSAlert()
        alert.alertStyle = .warning
        alert.messageText = names.isEmpty
            ? "Quit Vodka and stop its PCs?"
            : "Quit Vodka and stop \(names.formatted(.list(type: .and)))?"
        alert.informativeText = "Quitting force-stops everything running in your PCs. "
            + "Anything a game hasn't saved will be lost."
        alert.addButton(withTitle: "Quit and Stop All").hasDestructiveAction = true
        alert.addButton(withTitle: "Cancel")
        alert.showsSuppressionButton = true
        alert.suppressionButton?.title = "Don't ask again"
        guard alert.runModal() == .alertFirstButtonReturn else { return false }
        if alert.suppressionButton?.state == .on {
            UserDefaults.standard.set(true, forKey: Self.skipQuitConfirmationKey)
        }
        return true
    }

    /// Synchronous, because the app exits as soon as termination is allowed.
    @MainActor
    private func stopEverything() {
        for bottle in BottleVM.shared.bottles {
            Wine.killBottleAndWait(bottle: bottle)
            ProcessRegistry.shared.clearRegistry(for: bottle.url)
        }
        // A server whose PC isn't in the list, or whose list entry moved.
        _ = Wine.killServerlessEngineProcesses()
        logger.info("Stopped every PC on quit")
    }

    func applicationWillTerminate(_ notification: Notification) {
        // Synchronous best-effort temp file cleanup (cannot await in applicationWillTerminate)
        let trackedFiles = TempFileTracker.shared.getAllTrackedFiles()
        for (fileURL, _) in trackedFiles {
            try? FileManager.default.removeItem(at: fileURL)
        }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        // When the user opts into the menu-bar extra, keep Vodka running after
        // the window closes so it stays reachable from the menu bar (and Wine
        // processes keep running). Otherwise quit on last window close, as usual.
        !UserDefaults.standard.bool(forKey: "showMenuBarExtra")
    }

    // MARK: - Dock Menu

    /// The pin behind a Dock menu item.
    private final class DockPin: NSObject {
        let bottleURL: URL
        let pinURL: URL

        init(bottleURL: URL, pinURL: URL) {
            self.bottleURL = bottleURL
            self.pinURL = pinURL
        }
    }

    /// Right-clicking Vodka in the Dock lists the pinned games, launchable
    /// without the main window.
    func applicationDockMenu(_ sender: NSApplication) -> NSMenu? {
        let entries = QuickLaunch.availablePins()
        guard !entries.isEmpty else { return nil }

        let menu = NSMenu()
        let bottleCount = Set(entries.map(\.bottle.url)).count
        for entry in entries.prefix(10) {
            guard let pinURL = entry.pin.url else { continue }
            let title = bottleCount > 1
                ? "\(entry.pin.name) (\(entry.bottle.settings.name))"
                : entry.pin.name
            let item = NSMenuItem(
                title: title, action: #selector(launchDockPin(_:)), keyEquivalent: ""
            )
            item.target = self
            item.representedObject = DockPin(bottleURL: entry.bottle.url, pinURL: pinURL)
            menu.addItem(item)
        }
        return menu
    }

    @MainActor @objc private func launchDockPin(_ sender: NSMenuItem) {
        guard let ref = sender.representedObject as? DockPin,
              let bottle = BottleVM.shared.bottles.first(where: { $0.url == ref.bottleURL }),
              let pin = bottle.settings.pins.first(where: { $0.url == ref.pinURL })
        else { return }
        QuickLaunch.launch(pin: pin, in: bottle)
    }

    private static var appUrl: URL? {
        Bundle.main.resourceURL?.deletingLastPathComponent().deletingLastPathComponent()
    }

    private static let expectedUrl = URL(fileURLWithPath: "/Applications/Vodka.app")

    private static var insideAppsFolder: Bool {
        if let url = appUrl {
            return url.path.contains("Xcode") || url.path.contains(expectedUrl.path)
        }
        return false
    }

    @MainActor
    private func sweepOrphanProcesses() async {
        var cleanedCount = 0

        // Strays whose wineserver is gone spin on failed waits; no policy
        // keeps them, since they cannot run anything.
        if await Task.detached(operation: { Wine.killServerlessEngineProcesses() }).value > 0 {
            cleanedCount += 1
        }

        // A PC left running is flagged, not stopped: it may be a game opened
        // from a Dock shortcut while Vodka was closed.
        for bottle in BottleVM.shared.bottles {
            guard await Wine.isWineserverRunning(for: bottle) else { continue }
            logger.info("Found Wine processes running in '\(bottle.settings.name)' at launch")
        }

        // Post notification for cleaned orphans (toast display in ContentView)
        if cleanedCount > 0 {
            NotificationCenter.default.post(
                name: .zombieProcessesCleaned,
                object: nil,
                userInfo: ["count": cleanedCount]
            )
        }
    }

    @MainActor
    private func showAlertOnFirstLaunch() {
        let alert = NSAlert()
        alert.messageText = String(localized: "showAlertOnFirstLaunch.messageText")
        alert.informativeText = String(localized: "showAlertOnFirstLaunch.informativeText")
        alert.addButton(withTitle: String(localized: "showAlertOnFirstLaunch.button.moveToApplications"))
        alert.addButton(withTitle: String(localized: "showAlertOnFirstLaunch.button.dontMove"))

        let response = alert.runModal()

        if response == .alertFirstButtonReturn {
            let appURL = Bundle.main.bundleURL

            do {
                _ = try FileManager.default.replaceItemAt(AppDelegate.expectedUrl, withItemAt: appURL)
                NSWorkspace.shared.open(AppDelegate.expectedUrl)
            } catch {
                logger.error("Failed to move the app: \(error.localizedDescription)")
            }
        }
    }
}

extension Notification.Name {
    /// Posted when orphaned Wine processes are cleaned up at launch.
    /// Contains userInfo key "count" (Int) with the number of processes killed.
    static let zombieProcessesCleaned = Notification.Name("zombieProcessesCleaned")

    /// Posted from program settings to navigate to the Audio troubleshooting panel.
    static let openAudioTroubleshooting = Notification.Name(
        "com.rolling7ho.Vodka.openAudioTroubleshooting"
    )
}
