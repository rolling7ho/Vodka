import { ChildProcessWithoutNullStreams, spawn } from 'child_process'
import { existsSync } from 'fs'
import { join, resolve } from 'path'
import { app } from 'electron'
import type { BridgeProgressEvent } from '../shared/ipc'

interface PendingRequest {
  method: string
  resolve: (value: unknown) => void
  reject: (error: Error) => void
}

interface BridgeMessage {
  id?: number
  event?: string
  result?: unknown
  error?: { code?: string; message?: string }
  data?: Record<string, unknown>
}

export class GmacBridgeClient {
  private child: ChildProcessWithoutNullStreams | null = null
  private stdoutBuffer = ''
  private nextId = 1
  private pending = new Map<number, PendingRequest>()
  private progressListeners = new Set<(event: BridgeProgressEvent) => void>()

  onProgress(listener: (event: BridgeProgressEvent) => void): () => void {
    this.progressListeners.add(listener)
    return () => {
      this.progressListeners.delete(listener)
    }
  }

  isAvailable(): boolean {
    return this.resolveBinaryPath() !== null
  }

  async request<T>(method: string, params?: Record<string, unknown>): Promise<T> {
    const process = this.ensureProcess()
    const id = this.nextId++

    return await new Promise<T>((resolvePromise, rejectPromise) => {
      this.pending.set(id, {
        method,
        resolve: resolvePromise as (value: unknown) => void,
        reject: rejectPromise
      })

      const payload = JSON.stringify({ id, method, params: params ?? {} }) + '\n'
      process.stdin.write(payload, (writeError) => {
        if (writeError) {
          this.pending.delete(id)
          rejectPromise(writeError)
        }
      })
    })
  }

  dispose(): void {
    if (this.child) {
      this.child.kill()
      this.child = null
    }
    this.rejectAll(new Error('GmacBridge shut down'))
  }

  private resolveBinaryPath(): string | null {
    const candidates: string[] = []
    if (process.env.GMAC_BRIDGE_PATH) {
      candidates.push(process.env.GMAC_BRIDGE_PATH)
    }
    if (app.isPackaged) {
      candidates.push(join(process.resourcesPath, 'gmac-bridge'))
    }
    candidates.push(
      resolve(__dirname, '../../../GmacKit/.build/release/gmac-bridge'),
      resolve(__dirname, '../../../GmacKit/.build/debug/gmac-bridge')
    )

    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        return candidate
      }
    }
    return null
  }

  private ensureProcess(): ChildProcessWithoutNullStreams {
    if (this.child && !this.child.killed && this.child.exitCode === null) {
      return this.child
    }

    const binaryPath = this.resolveBinaryPath()
    if (!binaryPath) {
      throw new Error(
        'GmacBridge binary not found. Run `npm run build:bridge` in app/ to compile gmac-bridge.'
      )
    }

    const spawned = spawn(binaryPath, [], {
      stdio: ['pipe', 'pipe', 'pipe']
    })

    spawned.stdout.setEncoding('utf8')
    spawned.stdout.on('data', (chunk: string) => {
      this.handleStdoutChunk(chunk)
    })

    spawned.stderr.setEncoding('utf8')
    spawned.stderr.on('data', (chunk: string) => {
      const trimmed = chunk.trim()
      if (trimmed) {
        console.error(`[gmac-bridge] ${trimmed}`)
      }
    })

    spawned.on('error', (error) => {
      this.child = null
      this.rejectAll(error)
    })

    spawned.on('exit', (code, signal) => {
      this.child = null
      this.rejectAll(
        new Error(`GmacBridge exited unexpectedly (code=${String(code)}, signal=${String(signal)})`)
      )
    })

    this.child = spawned
    return spawned
  }

  private handleStdoutChunk(chunk: string): void {
    this.stdoutBuffer += chunk
    let newlineIndex = this.stdoutBuffer.indexOf('\n')
    while (newlineIndex !== -1) {
      const line = this.stdoutBuffer.slice(0, newlineIndex).trim()
      this.stdoutBuffer = this.stdoutBuffer.slice(newlineIndex + 1)
      if (line) {
        this.handleLine(line)
      }
      newlineIndex = this.stdoutBuffer.indexOf('\n')
    }
  }

  private handleLine(line: string): void {
    let parsed: BridgeMessage
    try {
      parsed = JSON.parse(line) as BridgeMessage
    } catch {
      return
    }

    if (parsed.event === 'progress' && typeof parsed.id === 'number' && parsed.data) {
      const entry = this.pending.get(parsed.id)
      const event: BridgeProgressEvent = {
        requestMethod: entry?.method ?? '',
        data: parsed.data
      }
      for (const listener of this.progressListeners) {
        listener(event)
      }
      return
    }

    if (typeof parsed.id === 'number') {
      const entry = this.pending.get(parsed.id)
      if (!entry) {
        return
      }
      this.pending.delete(parsed.id)
      if (parsed.error) {
        entry.reject(new Error(parsed.error.message ?? 'GmacBridge request failed'))
      } else {
        entry.resolve(parsed.result)
      }
    }
  }

  private rejectAll(error: Error): void {
    for (const entry of this.pending.values()) {
      entry.reject(error)
    }
    this.pending.clear()
  }
}
