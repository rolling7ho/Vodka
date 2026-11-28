import { useEffect, useState } from 'react'
import type {
  AudioDeviceItem,
  AudioTestResult,
  AudioTroubleshootResult,
  BottleConfig
} from '../../../../shared/ipc'
import { SpinnerIcon } from '../icons/OnboardingIcons'

interface AudioConfigCardProps {
  bottlePath: string
  isManagedPc: boolean
  config: BottleConfig
  onUpdate: (patch: Partial<BottleConfig>) => void
  onExternalConfigUpdate: (next: BottleConfig) => void
}

export function AudioConfigCard({
  bottlePath,
  isManagedPc,
  config,
  onUpdate,
  onExternalConfigUpdate
}: AudioConfigCardProps) {
  const [devices, setDevices] = useState<AudioDeviceItem[]>([])
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<AudioTestResult | null>(null)
  const [troubleshootOpen, setTroubleshootOpen] = useState(false)
  const [symptom, setSymptom] = useState('noSound')
  const [troubleshootData, setTroubleshootData] = useState<AudioTroubleshootResult | null>(null)
  const [applyingFixId, setApplyingFixId] = useState<string | null>(null)

  useEffect(() => {
    if (!window.gmac) {
      return
    }
    void window.gmac
      .getAudioStatus(isManagedPc ? bottlePath : undefined)
      .then((res) => setDevices(res.devices))
      .catch(() => {})
  }, [bottlePath, isManagedPc])

  const handleRunTest = async () => {
    if (!isManagedPc || !window.gmac) {
      return
    }
    setIsTesting(true)
    try {
      const result = await window.gmac.runAudioTest(bottlePath)
      setTestResult(result)
    } finally {
      setIsTesting(false)
    }
  }

  const handleRunTroubleshoot = async (targetSymptom: string) => {
    if (!isManagedPc || !window.gmac) {
      return
    }
    setTroubleshootOpen(true)
    const res = await window.gmac.troubleshootAudio(bottlePath, targetSymptom)
    setTroubleshootData(res)
  }

  const handleApplyFix = async (fixId: string) => {
    if (!isManagedPc || !window.gmac) {
      return
    }
    setApplyingFixId(fixId)
    try {
      const res = await window.gmac.applyAudioFix(bottlePath, fixId)
      onExternalConfigUpdate(res.config)
      const refreshed = await window.gmac.troubleshootAudio(bottlePath, symptom)
      setTroubleshootData(refreshed)
    } finally {
      setApplyingFixId(null)
    }
  }

  return (
    <div className="rounded-2xl bg-[#FAF9F8] p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[11.5px] font-semibold tracking-[0.06em] text-[#5e5454] uppercase">
          Audio
        </h3>
        {isManagedPc && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isTesting}
              onClick={() => void handleRunTest()}
              className="app-no-drag inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-white px-3 py-1 text-[12px] font-medium text-[#161212] ring-1 ring-[#161212]/[0.08] transition-colors hover:bg-[#F3EFEF]"
            >
              {isTesting && <SpinnerIcon className="h-3 w-3" />}
              <span>{isTesting ? 'Testing...' : 'Test Audio'}</span>
            </button>
            <button
              type="button"
              onClick={() => void handleRunTroubleshoot(symptom)}
              className="app-no-drag cursor-pointer rounded-lg bg-white px-3 py-1 text-[12px] font-medium text-[#713131] ring-1 ring-[#161212]/[0.08] transition-colors hover:bg-[#F3EFEF]"
            >
              Audio Troubleshooter
            </button>
          </div>
        )}
      </div>

      <div className="mt-4 space-y-4">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <label htmlFor="pc-audio-driver" className="text-[13.5px] font-medium text-[#161212]">
              Wine Audio Driver
            </label>
            <div className="mt-0.5 text-[12px] text-[#5e5454]">
              Choose CoreAudio directly or defer to Wine driver auto-detection.
            </div>
          </div>
          <select
            id="pc-audio-driver"
            value={config.audioDriver}
            onChange={(event) =>
              onUpdate({
                audioDriver: event.target.value as BottleConfig['audioDriver']
              })
            }
            className="app-no-drag cursor-pointer rounded-xl bg-white px-3 py-2 text-[13px] font-medium text-[#161212] ring-1 ring-[#161212]/[0.08] focus:outline-none"
          >
            <option value="auto">Automatic</option>
            <option value="coreaudio">CoreAudio</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>

        <div className="flex flex-col justify-between gap-2 border-t border-[#161212]/[0.06] pt-3 sm:flex-row sm:items-center">
          <div>
            <label htmlFor="pc-audio-latency" className="text-[13.5px] font-medium text-[#161212]">
              Audio Buffer Latency
            </label>
            <div className="mt-0.5 text-[12px] text-[#5e5454]">
              Use Stable buffer if Bluetooth headphones or USB DACs crackle.
            </div>
          </div>
          <select
            id="pc-audio-latency"
            value={config.audioLatencyPreset}
            onChange={(event) =>
              onUpdate({
                audioLatencyPreset: event.target.value as BottleConfig['audioLatencyPreset']
              })
            }
            className="app-no-drag cursor-pointer rounded-xl bg-white px-3 py-2 text-[13px] font-medium text-[#161212] ring-1 ring-[#161212]/[0.08] focus:outline-none"
          >
            <option value="defaultPreset">Default</option>
            <option value="lowLatency">Low Latency</option>
            <option value="stable">Stable (Anti-Crackling)</option>
          </select>
        </div>

        <div className="flex flex-col justify-between gap-3 border-t border-[#161212]/[0.06] pt-3 sm:flex-row sm:items-center">
          <div className="min-w-0">
            <label htmlFor="pc-output-mode" className="text-[13.5px] font-medium text-[#161212]">
              Output Device Routing
            </label>
            <div className="mt-0.5 text-[12px] text-[#5e5454]">
              Follow macOS default output or lock this PC to a specific device.
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <select
              id="pc-output-mode"
              value={config.outputDeviceMode}
              onChange={(event) =>
                onUpdate({
                  outputDeviceMode: event.target.value as BottleConfig['outputDeviceMode']
                })
              }
              className="app-no-drag shrink-0 cursor-pointer whitespace-nowrap rounded-xl bg-white px-3 py-2 text-[13px] font-medium text-[#161212] ring-1 ring-[#161212]/[0.08] focus:outline-none"
            >
              <option value="followSystem">Follow System</option>
              <option value="pinned">Pin Device</option>
            </select>

            {config.outputDeviceMode === 'pinned' && (
              <select
                aria-label="Pinned audio output device"
                value={config.pinnedDeviceName ?? ''}
                onChange={(event) =>
                  onUpdate({
                    pinnedDeviceName: event.target.value || null
                  })
                }
                className="app-no-drag cursor-pointer rounded-xl bg-white px-3 py-2 text-[13px] font-medium text-[#161212] ring-1 ring-[#161212]/[0.08] focus:outline-none"
              >
                <option value="">Select output device...</option>
                {devices.map((dev) => (
                  <option key={dev.id} value={dev.name}>
                    {dev.name} ({dev.transportType})
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {testResult && (
        <div className="mt-4 rounded-xl bg-white p-3.5 ring-1 ring-[#161212]/[0.06]">
          <div className="text-[12.5px] font-semibold text-[#161212]">
            Audio Test: {testResult.summary}
          </div>
          {testResult.evidence.length > 0 && (
            <ul className="mt-1.5 space-y-0.5 font-mono text-[11px] text-[#5e5454]">
              {testResult.evidence.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {troubleshootOpen && troubleshootData && (
        <div className="mt-4 space-y-3 rounded-xl bg-white p-4 ring-1 ring-[#161212]/[0.08]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-[13px] font-semibold text-[#161212]">
              Audio Troubleshooter
            </div>
            <div className="flex items-center gap-2">
              <select
                aria-label="Audio symptom"
                value={symptom}
                onChange={(event) => {
                  const next = event.target.value
                  setSymptom(next)
                  void handleRunTroubleshoot(next)
                }}
                className="app-no-drag cursor-pointer rounded-lg bg-[#FAF9F8] px-2.5 py-1 text-[12px] font-medium text-[#161212]"
              >
                <option value="noSound">No sound at all</option>
                <option value="crackling">Crackling or popping</option>
                <option value="stutter">Audio stutter or desync</option>
                <option value="wrongDevice">Wrong output device</option>
                <option value="menusOnly">Sound in menus only</option>
              </select>
              <button
                type="button"
                onClick={() => setTroubleshootOpen(false)}
                className="app-no-drag cursor-pointer text-[12px] font-medium text-[#5e5454] hover:text-[#161212]"
              >
                Close
              </button>
            </div>
          </div>

          {troubleshootData.findings.length > 0 && (
            <div className="space-y-1.5">
              {troubleshootData.findings.map((finding) => (
                <div key={finding.id} className="rounded-lg bg-[#FAF9F8] px-3 py-2 text-[12px]">
                  <span className="font-semibold text-[#161212]">{finding.description}</span>
                  <div className="mt-0.5 text-[#5e5454]">{finding.evidence}</div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            {troubleshootData.suggestedFixes.map((fix) => (
              <div
                key={fix.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#FAF9F8] px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-medium text-[#161212]">{fix.title}</div>
                  <div className="text-[11.5px] text-[#5e5454]">{fix.description}</div>
                </div>
                <button
                  type="button"
                  disabled={applyingFixId !== null}
                  onClick={() => void handleApplyFix(fix.id)}
                  className="app-no-drag cursor-pointer rounded-lg bg-[#713131] px-3 py-1 text-[12px] font-medium text-white transition-colors hover:bg-[#5E2828] disabled:opacity-55"
                >
                  {applyingFixId === fix.id ? 'Applying...' : 'Apply Fix'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
