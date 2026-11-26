//
//  LaunchResult+Toast.swift
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

extension LaunchResult {
    /// Converts launch result to appropriate toast notification data.
    /// Toast style and auto-dismiss behavior are derived from the testable properties
    /// `notificationStyle` and `shouldAutoDismiss` defined in GmacKit.
    var toastData: ToastData {
        let style: ToastStyle = switch notificationStyle {
        case .success: .success
        case .info: .info
        case .error: .error
        }

        let message = switch self {
        case let .launchedSuccessfully(name):
            String(localized: "status.launched \(name)")
        case let .launchedInTerminal(name):
            String(localized: "status.launchedTerminal \(name)")
        case let .launchFailed(_, errorDescription):
            String(localized: "status.launchFailed \(errorDescription)")
        }

        return ToastData(message: message, style: style, autoDismiss: shouldAutoDismiss)
    }
}
