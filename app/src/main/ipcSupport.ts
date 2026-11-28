import { ipcMain } from 'electron'
import {
  AudioStatusResult,
  AudioTestResult,
  AudioTroubleshootResult,
  BottleConfig,
  BottlePinItem,
  BottleProcessesResult,
  DiagnosticsAnalyzeResult,
  DiagnosticsExportResult,
  GameDbApplyResult,
  GameDbEntryItem,
  GameDbPreviewResult,
  IPC_CHANNELS,
  LogReadResult,
  LogsListResult,
  TroubleshootCategoryItem,
  TroubleshootFixResult,
  TroubleshootRunResult,
  UpdateCheckResult,
  WinetricksListResult,
  WinetricksRunResult
} from '../shared/ipc'
import { GmacBridgeClient } from './bridge'
import { checkUpdatesAndBroadcast } from './runtime'

export function registerSupportIpcHandlers(bridge: GmacBridgeClient): void {
  ipcMain.handle(IPC_CHANNELS.CHECK_UPDATES, async (): Promise<UpdateCheckResult> => {
    return await checkUpdatesAndBroadcast()
  })

  ipcMain.handle(
    IPC_CHANNELS.LIST_BOTTLE_PROCESSES,
    async (_event, path: string): Promise<BottleProcessesResult> => {
      if (process.env.GMAC_FRESH_INSTALL === '1' || !bridge.isAvailable()) {
        return { running: false, processes: [] }
      }
      return await bridge.request<BottleProcessesResult>('bottles.listProcesses', { path })
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.KILL_BOTTLE_PROCESS,
    async (_event, path: string, pid: number, force?: boolean): Promise<{ killed: boolean }> => {
      if (process.env.GMAC_FRESH_INSTALL === '1' || !bridge.isAvailable()) {
        return { killed: true }
      }
      return await bridge.request<{ killed: boolean }>('bottles.killProcess', {
        path,
        pid,
        ...(typeof force === 'boolean' ? { force } : {})
      })
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.KILL_BOTTLE,
    async (_event, path: string): Promise<{ killed: boolean }> => {
      if (process.env.GMAC_FRESH_INSTALL === '1' || !bridge.isAvailable()) {
        return { killed: true }
      }
      return await bridge.request<{ killed: boolean }>('bottles.killBottle', { path })
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.LIST_BOTTLE_PINS,
    async (_event, path: string): Promise<{ pins: BottlePinItem[] }> => {
      if (process.env.GMAC_FRESH_INSTALL === '1' || !bridge.isAvailable()) {
        return { pins: [] }
      }
      return await bridge.request<{ pins: BottlePinItem[] }>('bottles.listPins', { path })
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.ADD_BOTTLE_PIN,
    async (_event, path: string, programPath: string, name?: string): Promise<{ pins: BottlePinItem[] }> => {
      if (process.env.GMAC_FRESH_INSTALL === '1' || !bridge.isAvailable()) {
        return { pins: [] }
      }
      return await bridge.request<{ pins: BottlePinItem[] }>('bottles.addPin', {
        path,
        programPath,
        ...(name ? { name } : {})
      })
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.REMOVE_BOTTLE_PIN,
    async (_event, path: string, programPath: string): Promise<{ pins: BottlePinItem[] }> => {
      if (process.env.GMAC_FRESH_INSTALL === '1' || !bridge.isAvailable()) {
        return { pins: [] }
      }
      return await bridge.request<{ pins: BottlePinItem[] }>('bottles.removePin', {
        path,
        programPath
      })
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.LIST_WINETRICKS_VERBS,
    async (_event, path?: string): Promise<WinetricksListResult> => {
      if (!bridge.isAvailable()) {
        return { available: false, categories: [] }
      }
      return await bridge.request<WinetricksListResult>(
        'winetricks.listVerbs',
        path ? { path } : undefined
      )
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.RUN_WINETRICKS_VERB,
    async (_event, path: string, verb: string): Promise<WinetricksRunResult> => {
      if (process.env.GMAC_FRESH_INSTALL === '1' || !bridge.isAvailable()) {
        return { ok: true, exitCode: 0, output: `Simulated winetricks -q ${verb}` }
      }
      return await bridge.request<WinetricksRunResult>('winetricks.run', { path, verb })
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.GET_AUDIO_STATUS,
    async (_event, bottlePath?: string): Promise<AudioStatusResult> => {
      if (!bridge.isAvailable()) {
        return { defaultDevice: null, devices: [], findings: [] }
      }
      return await bridge.request<AudioStatusResult>(
        'audio.status',
        bottlePath ? { bottlePath } : undefined
      )
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.RUN_AUDIO_TEST,
    async (_event, bottlePath: string): Promise<AudioTestResult> => {
      if (!bridge.isAvailable()) {
        return { ok: false, status: 'skipped', summary: 'Bridge unavailable', evidence: [], findings: [] }
      }
      return await bridge.request<AudioTestResult>('audio.test', { bottlePath })
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.TROUBLESHOOT_AUDIO,
    async (_event, bottlePath: string, symptom: string): Promise<AudioTroubleshootResult> => {
      return await bridge.request<AudioTroubleshootResult>('audio.troubleshoot', {
        bottlePath,
        symptom
      })
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.APPLY_AUDIO_FIX,
    async (
      _event,
      bottlePath: string,
      fixId: string
    ): Promise<{ ok: boolean; fixId: string; config: BottleConfig }> => {
      return await bridge.request<{ ok: boolean; fixId: string; config: BottleConfig }>(
        'audio.applyFix',
        { bottlePath, fixId }
      )
    }
  )

  ipcMain.handle(IPC_CHANNELS.LIST_LOGS, async (): Promise<LogsListResult> => {
    if (!bridge.isAvailable()) {
      return { folder: '~/Library/Logs/com.rolling7ho.Gmac', files: [] }
    }
    return await bridge.request<LogsListResult>('logs.list')
  })

  ipcMain.handle(
    IPC_CHANNELS.READ_LOG_FILE,
    async (_event, path: string): Promise<LogReadResult> => {
      return await bridge.request<LogReadResult>('logs.read', { path })
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.ANALYZE_DIAGNOSTICS,
    async (
      _event,
      input: { logText?: string; logPath?: string; exitCode?: number }
    ): Promise<DiagnosticsAnalyzeResult> => {
      return await bridge.request<DiagnosticsAnalyzeResult>('diagnostics.analyze', input)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.EXPORT_DIAGNOSTICS_REPORT,
    async (_event, bottlePath?: string): Promise<DiagnosticsExportResult> => {
      return await bridge.request<DiagnosticsExportResult>(
        'diagnostics.export',
        bottlePath ? { bottlePath } : undefined
      )
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.LIST_TROUBLESHOOT_CATEGORIES,
    async (): Promise<{ categories: TroubleshootCategoryItem[] }> => {
      if (!bridge.isAvailable()) {
        return { categories: [] }
      }
      return await bridge.request<{ categories: TroubleshootCategoryItem[] }>(
        'troubleshoot.listCategories'
      )
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.RUN_TROUBLESHOOT_FLOW,
    async (
      _event,
      input: { bottlePath: string; category: string; nodeId?: string }
    ): Promise<TroubleshootRunResult> => {
      return await bridge.request<TroubleshootRunResult>('troubleshoot.runFlow', input)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.APPLY_TROUBLESHOOT_FIX,
    async (
      _event,
      input: { bottlePath: string; fixId: string; params?: Record<string, string> }
    ): Promise<TroubleshootFixResult> => {
      return await bridge.request<TroubleshootFixResult>('troubleshoot.applyFix', input)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.UNDO_TROUBLESHOOT_FIX,
    async (
      _event,
      input: {
        bottlePath: string
        fixId: string
        beforeValue?: string | null
        afterValue?: string | null
        params?: Record<string, string>
      }
    ): Promise<{ restored: boolean }> => {
      return await bridge.request<{ restored: boolean }>('troubleshoot.undoFix', input)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.LIST_GAMEDB,
    async (
      _event,
      input?: { query?: string; steamAppId?: number }
    ): Promise<{ entries: GameDbEntryItem[] }> => {
      if (!bridge.isAvailable()) {
        return { entries: [] }
      }
      return await bridge.request<{ entries: GameDbEntryItem[] }>('gamedb.list', input)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.PREVIEW_GAMEDB,
    async (
      _event,
      input: { bottlePath: string; entryId: string; variantId?: string }
    ): Promise<GameDbPreviewResult> => {
      return await bridge.request<GameDbPreviewResult>('gamedb.preview', input)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.APPLY_GAMEDB,
    async (
      _event,
      input: { bottlePath: string; entryId: string; variantId?: string }
    ): Promise<GameDbApplyResult> => {
      return await bridge.request<GameDbApplyResult>('gamedb.apply', input)
    }
  )
}
