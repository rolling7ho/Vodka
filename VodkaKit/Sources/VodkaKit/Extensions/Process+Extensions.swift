//
//  Process+Extensions.swift
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

import Foundation
import os.log

/// Output events from a running process
/// - Note: Uses Int32 termination status instead of Process references for Sendable conformance
public enum ProcessOutput: Hashable, Sendable {
    /// Process has started
    case started
    /// Message from stdout
    case message(String)
    /// Message from stderr
    case error(String)
    /// Process terminated with exit code
    case terminated(Int32)
}

public extension Process {
    /// Run the process returning a stream output
    func runStream(name: String, fileHandle: FileHandle?) throws -> AsyncStream<ProcessOutput> {
        let stream = makeStream(name: name, fileHandle: fileHandle)
        self.logProcessInfo(name: name)
        fileHandle?.writeInfo(for: self)
        try run()
        return stream
    }

    private func makeStream(name: String, fileHandle: FileHandle?) -> AsyncStream<ProcessOutput> {
        let pipe = Pipe()
        let errorPipe = Pipe()
        let outputLock = NSLock()
        standardOutput = pipe
        standardError = errorPipe

        return AsyncStream<ProcessOutput> { continuation in
            continuation.yield(.started)

            continuation.onTermination = self.makeStreamTerminationCallback()

            pipe.fileHandleForReading.readabilityHandler = self.makeReadabilityHandler(
                kind: .stdout,
                outputLock: outputLock,
                continuation: continuation,
                fileHandle: fileHandle
            )

            errorPipe.fileHandleForReading.readabilityHandler = self.makeReadabilityHandler(
                kind: .stderr,
                outputLock: outputLock,
                continuation: continuation,
                fileHandle: fileHandle
            )

            terminationHandler = self.makeProcessTerminationHandler(
                context: TerminationContext(
                    name: name,
                    pipe: pipe,
                    errorPipe: errorPipe,
                    outputLock: outputLock,
                    continuation: continuation,
                    fileHandle: fileHandle
                )
            )
        }
    }

    private enum StreamKind {
        case stdout
        case stderr
    }

    private struct TerminationContext {
        let name: String
        let pipe: Pipe
        let errorPipe: Pipe
        let outputLock: NSLock
        let continuation: AsyncStream<ProcessOutput>.Continuation
        let fileHandle: FileHandle?
    }

    private func makeStreamTerminationCallback()
        -> @Sendable (AsyncStream<ProcessOutput>.Continuation.Termination) -> Void {
        { termination in
            if case .cancelled = termination, self.isRunning {
                self.terminate()
            }
        }
    }

    private func makeReadabilityHandler(
        kind: StreamKind,
        outputLock: NSLock,
        continuation: AsyncStream<ProcessOutput>.Continuation,
        fileHandle: FileHandle?
    ) -> @Sendable (FileHandle) -> Void {
        { pipeHandle in
            // The read itself must happen under the lock: if bytes were consumed
            // here first and emitted only after the lock, the termination handler
            // could drain an empty pipe, finish the stream, and the pending yield
            // would land on a finished continuation, losing the final output of a
            // fast-exiting process.
            outputLock.lock()
            defer { outputLock.unlock() }
            switch pipeHandle.nextOutput() {
            case .endOfFile:
                // The pipe's write end closed while this handler is still installed
                // (the process can stop writing well before it exits). `readabilityHandler`
                // keeps firing on the permanently-readable EOF condition, pegging a CPU
                // core, so remove it here. Any final bytes are drained when the process
                // exits (whisky-app/whisky#917).
                pipeHandle.readabilityHandler = nil
            case .pending:
                // A non-empty chunk that isn't valid UTF-8 on its own (e.g. a multi-byte
                // sequence split across reads). Its bytes are already consumed, so this is not
                // a recovery, we just don't treat the stream as EOF, and leave the handler
                // installed for the remaining output.
                return
            case let .text(line):
                self.emit(line: line, kind: kind, continuation: continuation, fileHandle: fileHandle)
            }
        }
    }

    private func makeProcessTerminationHandler(
        context: TerminationContext
    ) -> @Sendable (Process) -> Void {
        { process in
            do {
                // Stop readability handlers first to avoid racing / double-consuming output.
                context.pipe.fileHandleForReading.readabilityHandler = nil
                context.errorPipe.fileHandleForReading.readabilityHandler = nil

                context.outputLock.lock()
                defer { context.outputLock.unlock() }

                try self.drainToLog(
                    context.pipe.fileHandleForReading,
                    kind: .stdout,
                    continuation: context.continuation,
                    fileHandle: context.fileHandle
                )
                try self.drainToLog(
                    context.errorPipe.fileHandleForReading,
                    kind: .stderr,
                    continuation: context.continuation,
                    fileHandle: context.fileHandle
                )
                try context.fileHandle?.closeWineLog()
            } catch {
                Logger.wineKit.error("Error while clearing data: \(error)")
            }

            process.logTermination(name: context.name)
            context.continuation.yield(.terminated(process.terminationStatus))
            context.continuation.finish()
        }
    }

    private func drainToLog(
        _ handle: FileHandle,
        kind: StreamKind,
        continuation: AsyncStream<ProcessOutput>.Continuation,
        fileHandle: FileHandle?
    ) throws {
        // `readabilityHandler` may stop firing before the last bytes are consumed.
        // Only what is already buffered: the process has exited, so it wrote
        // nothing more, but the Wine server and services the first process in
        // a bottle boots inherit its pipes. Reading to the end waited for them
        // to close theirs, about three seconds on every cold launch.
        guard let remaining = handle.readBuffered(),
              let text = String(data: remaining, encoding: .utf8),
              !text.isEmpty
        else { return }
        emit(line: text, kind: kind, continuation: continuation, fileHandle: fileHandle)
    }

    private func emit(
        line: String,
        kind: StreamKind,
        continuation: AsyncStream<ProcessOutput>.Continuation,
        fileHandle: FileHandle?
    ) {
        switch kind {
        case .stdout:
            continuation.yield(.message(line))
            guard !line.isEmpty else { return }
            Logger.wineKit.info("\(line, privacy: .public)")
        case .stderr:
            continuation.yield(.error(line))
            guard !line.isEmpty else { return }
            Logger.wineKit.warning("\(line, privacy: .public)")
        }
        fileHandle?.writeWineLog(line: line)
    }

    private func logTermination(name: String) {
        if terminationStatus == 0 {
            Logger.wineKit.info(
                "Terminated \(name) with status code '\(self.terminationStatus, privacy: .public)'"
            )
        } else {
            Logger.wineKit.warning(
                "Terminated \(name) with status code '\(self.terminationStatus, privacy: .public)'"
            )
        }
    }

    private func logProcessInfo(name: String) {
        Logger.wineKit.info("Running process \(name)")

        if let arguments {
            Logger.wineKit.info("Arguments: `\(arguments.joined(separator: " "))`")
        }
        if let executableURL {
            Logger.wineKit.info("Executable: `\(executableURL.path(percentEncoded: false))`")
        }
        if let directory = currentDirectoryURL {
            Logger.wineKit.info("Directory: `\(directory.path(percentEncoded: false))`")
        }
        if let environment {
            Logger.wineKit.info("Environment: \(environment)")
        }
    }
}

extension FileHandle {
    /// The classification of a single read from a pipe's readable end.
    enum OutputRead: Equatable {
        /// Decodable, non-empty output ready to emit.
        case text(String)
        /// A non-empty read that isn't valid UTF-8 on its own (e.g. a multi-byte sequence
        /// split across reads). The bytes are already consumed, so this is not EOF — the
        /// caller should keep its handler installed for the rest of the output. The split
        /// character itself is not reassembled.
        case pending
        /// An empty read: the pipe's write end has closed. The caller should
        /// remove its `readabilityHandler`, which otherwise fires continuously
        /// on the permanently-readable EOF condition.
        case endOfFile
    }

    /// Reads the next available chunk, distinguishing EOF (an empty read) from a
    /// merely not-yet-decodable chunk. The distinction lets a `readabilityHandler`
    /// stop itself on EOF instead of spinning on it (whisky-app/whisky#917).
    func nextOutput() -> OutputRead {
        let data = availableData
        guard !data.isEmpty else { return .endOfFile }
        guard let text = String(data: data, encoding: .utf8), !text.isEmpty else { return .pending }
        return .text(text)
    }

    /// Everything the pipe holds right now, without waiting for its other
    /// writers to close it, or `nil` when it holds nothing.
    func readBuffered() -> Data? {
        let descriptor = fileDescriptor
        let flags = fcntl(descriptor, F_GETFL)
        guard flags >= 0, fcntl(descriptor, F_SETFL, flags | O_NONBLOCK) >= 0 else { return nil }
        var data = Data()
        var buffer = [UInt8](repeating: 0, count: 65_536)
        while true {
            let count = Darwin.read(descriptor, &buffer, buffer.count)
            if count > 0 {
                data.append(buffer, count: count)
            } else if count < 0, errno == EINTR {
                continue
            } else {
                break  // 0: every writer closed; -1 with EAGAIN: nothing more buffered.
            }
        }
        return data.isEmpty ? nil : data
    }
}
