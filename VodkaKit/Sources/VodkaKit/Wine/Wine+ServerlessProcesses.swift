//
//  Wine+ServerlessProcesses.swift
//  VodkaKit
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

import Darwin
import Foundation
import os.log

private let serverlessLogger = Logger(
    subsystem: Bundle.vodkaBundleIdentifier,
    category: "Wine.ServerlessProcesses"
)

public extension Wine {
    /// Ends Windows processes left running from the engine after every
    /// wineserver is gone.
    ///
    /// A Wine process whose server has gone cannot do anything, but it does
    /// not exit either: each wait it makes fails at once, so a client like
    /// Steam spins two cores at 100% on its event loops, taking them from the
    /// next game. With no wineserver from the engine running at all, every
    /// process running from the engine is one of these. With any server up,
    /// nothing is touched, since its clients cannot be told apart from strays.
    ///
    /// - Returns: How many processes were ended.
    @discardableResult
    static func killServerlessEngineProcesses() -> Int {
        let engine = VodkaWineInstaller.libraryFolder.resolvingSymlinksInPath().path + "/"
        var pids = [pid_t](repeating: 0, count: 8_192)
        let found = Int(proc_listallpids(&pids, Int32(pids.count * MemoryLayout<pid_t>.size)))
        var strays: [pid_t] = []
        for pid in pids.prefix(max(found, 0)) where pid > 0 {
            var buffer = [CChar](repeating: 0, count: 4 * Int(MAXPATHLEN))
            guard proc_pidpath(pid, &buffer, UInt32(buffer.count)) > 0 else { continue }
            let path = String(cString: buffer)
            guard path.hasPrefix(engine) else { continue }
            if path.hasSuffix("/wineserver") { return 0 }
            strays.append(pid)
        }
        for pid in strays {
            kill(pid, SIGKILL)
        }
        if !strays.isEmpty {
            serverlessLogger.info("Ended \(strays.count) Wine processes whose wineserver was gone")
        }
        return strays.count
    }
}
