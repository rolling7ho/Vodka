//
//  AudioAlertTracker.swift
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

import Foundation

/// Tracks the last alert time per device name to rate-limit audio device alerts.
/// One alert per device per 3 minutes to avoid notification fatigue.
struct AudioAlertTracker {
    private var lastAlertTimes: [String: Date] = [:]
    private let cooldownInterval: TimeInterval = 180 // 3 minutes

    /// Returns true if an alert should be shown for this device.
    mutating func shouldAlert(deviceName: String) -> Bool {
        let now = Date()
        if let lastTime = lastAlertTimes[deviceName],
           now.timeIntervalSince(lastTime) < cooldownInterval {
            return false
        }
        lastAlertTimes[deviceName] = now
        return true
    }
}
