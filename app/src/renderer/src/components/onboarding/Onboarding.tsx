import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeftIcon } from '../icons/ArrowLeftIcon'
import { DirectX12Step } from './DirectX12Step'
import { EngineSetupStep } from './EngineSetupStep'
import { GraphicsStep } from './GraphicsStep'
import { ImportPCsStep } from './ImportPCsStep'
import { getLauncherName, LauncherSetupStep } from './LauncherSetupStep'
import { ReadyStep } from './ReadyStep'
import type {
  ComponentInstallStatus,
  DiscoveredBottle,
  GraphicsChoiceId,
  LauncherId,
  LauncherSetupStage
} from './types'
import { WelcomeStep } from './WelcomeStep'

interface OnboardingProps {
  onComplete?: () => void
}

type StepKey = 'welcome' | 'engine' | 'directx12' | 'graphics' | 'import' | 'launcher' | 'ready'

const GPTK_DOWNLOAD_URL = 'https://developer.apple.com/download/all/?q=game%20porting%20toolkit'

export function Onboarding({ onComplete }: OnboardingProps) {
  const [stepIndex, setStepIndex] = useState(0)

  const [rosettaStatus, setRosettaStatus] = useState<ComponentInstallStatus>('pending')
  const [engineStatus, setEngineStatus] = useState<ComponentInstallStatus>('pending')
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [downloadDetail, setDownloadDetail] = useState('0 MB of 459 MB')
  const [engineError, setEngineError] = useState<string | null>(null)

  const [toolkitInstalled, setToolkitInstalled] = useState(false)
  const [toolkitInstalling, setToolkitInstalling] = useState(false)
  const [detectedToolkitFile, setDetectedToolkitFile] = useState<string | null>(null)

  const [graphicsChoice, setGraphicsChoice] = useState<GraphicsChoiceId>('automatic')

  const [discoveredBottles, setDiscoveredBottles] = useState<DiscoveredBottle[]>([])
  const [selectedBottleIds, setSelectedBottleIds] = useState<string[]>([])

  const [selectedLauncher, setSelectedLauncher] = useState<LauncherId>('steam')
  const [steamAlreadyInstalled, setSteamAlreadyInstalled] = useState(false)
  const [launcherStage, setLauncherStage] = useState<LauncherSetupStage>('idle')
  const [configuredLauncher, setConfiguredLauncher] = useState<LauncherId | null>(null)

  const timersRef = useRef<number[]>([])

  const steps: StepKey[] = [
    'welcome',
    'engine',
    'directx12',
    'graphics',
    ...(discoveredBottles.length > 0 ? (['import'] as const) : []),
    'launcher',
    'ready'
  ]

  const safeStepIndex = Math.min(stepIndex, steps.length - 1)
  const activeStep = steps[safeStepIndex]

  function clearTimers(): void {
    for (const id of timersRef.current) {
      window.clearTimeout(id)
    }
    timersRef.current = []
  }

  function scheduleTimer(callback: () => void, delayMs: number): void {
    const id = window.setTimeout(callback, delayMs)
    timersRef.current.push(id)
  }

  const syncSystemStatus = useCallback(async () => {
    const api = window.gmac as
      | { getSystemStatus?: () => Promise<import('../../../../shared/ipc').SystemStatus> }
      | undefined
    if (!api?.getSystemStatus) {
      return
    }

    try {
      const status = await api.getSystemStatus()
      setRosettaStatus((prev) =>
        prev === 'installing' ? prev : status.rosettaInstalled ? 'installed' : 'pending'
      )
      setEngineStatus((prev) => {
        if (prev === 'installing' || prev === 'verifying') {
          return prev
        }
        return status.engineInstalled ? 'installed' : 'pending'
      })
      if (status.engineInstalled) {
        setDownloadProgress(100)
        setDownloadDetail('Installed')
      }
      setToolkitInstalled((prev) => prev || status.toolkitInstalled)
      setDetectedToolkitFile((prev) => status.detectedToolkitFile ?? prev)
      setDiscoveredBottles(status.legacyWhiskyBottles)
      setSelectedBottleIds((prev) =>
        prev.length > 0 ? prev : status.legacyWhiskyBottles.map((bottle) => bottle.id)
      )
      setSteamAlreadyInstalled(status.steamInstalled)
    } catch {
      // Keep default state when IPC status lookup is unavailable.
    }
  }, [])

  useEffect(() => {
    void syncSystemStatus()
    return () => {
      clearTimers()
    }
  }, [syncSystemStatus])

  useEffect(() => {
    if (activeStep !== 'directx12' || toolkitInstalled) {
      return
    }

    const interval = window.setInterval(() => {
      void syncSystemStatus()
    }, 3000)

    return () => {
      window.clearInterval(interval)
    }
  }, [activeStep, toolkitInstalled, syncSystemStatus])

  function startEngineInstall(): void {
    clearTimers()
    setEngineError(null)
    if (rosettaStatus !== 'installed') {
      setRosettaStatus('installing')
    }
    if (engineStatus !== 'installed') {
      setEngineStatus('installing')
      setDownloadProgress(0)
      setDownloadDetail('0 MB of 459 MB')
    }

    scheduleTimer(() => {
      setRosettaStatus('installed')
      if (engineStatus !== 'installed') {
        setDownloadProgress(32)
        setDownloadDetail('147 MB of 459 MB')
      }
    }, 550)

    if (engineStatus !== 'installed') {
      scheduleTimer(() => {
        setDownloadProgress(68)
        setDownloadDetail('312 MB of 459 MB')
      }, 1050)

      scheduleTimer(() => {
        setDownloadProgress(100)
        setDownloadDetail('Verifying archive (SHA-256)...')
        setEngineStatus('verifying')
      }, 1550)

      scheduleTimer(() => {
        setEngineStatus('installed')
        setDownloadDetail('Installed')
      }, 2050)
    }
  }

  function handleDownloadToolkit(): void {
    const api = window.gmac as { openExternalUrl?: (url: string) => Promise<void> } | undefined
    if (api?.openExternalUrl) {
      void api.openExternalUrl(GPTK_DOWNLOAD_URL).catch(() => {
        window.open(GPTK_DOWNLOAD_URL, '_blank', 'noopener,noreferrer')
      })
      return
    }
    window.open(GPTK_DOWNLOAD_URL, '_blank', 'noopener,noreferrer')
  }

  function handleInstallToolkit(fileName: string): void {
    clearTimers()
    setDetectedToolkitFile(fileName)
    setToolkitInstalling(true)
    scheduleTimer(() => {
      setToolkitInstalling(false)
      setToolkitInstalled(true)
    }, 900)
  }

  function handleToggleBottle(id: string): void {
    setSelectedBottleIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  function handleToggleAllBottles(): void {
    setSelectedBottleIds((prev) =>
      prev.length === discoveredBottles.length ? [] : discoveredBottles.map((bottle) => bottle.id)
    )
  }

  function handleSelectLauncher(launcher: LauncherId): void {
    setSelectedLauncher(launcher)
    if (launcherStage === 'done') {
      setLauncherStage('idle')
    }
  }

  function handleStartLauncherSetup(): void {
    clearTimers()
    const targetLauncher = selectedLauncher
    setLauncherStage('creating')

    scheduleTimer(() => {
      setLauncherStage('downloading')
    }, 700)

    scheduleTimer(() => {
      setLauncherStage('installing')
    }, 1450)

    scheduleTimer(() => {
      setLauncherStage('done')
      setConfiguredLauncher(targetLauncher)
    }, 2200)
  }

  function goToStep(target: StepKey): void {
    const idx = steps.indexOf(target)
    if (idx !== -1) {
      setStepIndex(idx)
    }
  }

  const isBusy =
    rosettaStatus === 'installing' ||
    engineStatus === 'installing' ||
    engineStatus === 'verifying' ||
    toolkitInstalling ||
    launcherStage === 'creating' ||
    launcherStage === 'downloading' ||
    launcherStage === 'installing'

  const canGoBack = safeStepIndex > 0 && !isBusy

  const activeLauncherForReady =
    configuredLauncher ?? (steamAlreadyInstalled && selectedLauncher === 'steam' ? 'steam' : null)

  return (
    <div className="onboarding-radiance relative flex h-full flex-col text-[#161212] select-none">
      <header className="app-drag relative z-10 h-10 shrink-0" />

      <div className="relative z-10 flex-1 overflow-hidden">
        <div
          className="onboarding-track flex h-full w-full"
          style={{ transform: `translate3d(-${safeStepIndex * 100}%, 0, 0)` }}
        >
          {steps.map((stepKey, index) => {
            const isActive = safeStepIndex === index

            return (
              <div
                key={stepKey}
                className="flex h-full w-full shrink-0"
                aria-hidden={!isActive}
                inert={!isActive}
              >
                {stepKey === 'welcome' ? (
                  <WelcomeStep onStart={() => goToStep('engine')} />
                ) : null}

                {stepKey === 'engine' ? (
                  <EngineSetupStep
                    rosettaStatus={rosettaStatus}
                    engineStatus={engineStatus}
                    downloadProgress={downloadProgress}
                    downloadDetail={downloadDetail}
                    errorMessage={engineError}
                    onInstall={startEngineInstall}
                    onRetry={startEngineInstall}
                    onContinue={() => goToStep('directx12')}
                  />
                ) : null}

                {stepKey === 'directx12' ? (
                  <DirectX12Step
                    installed={toolkitInstalled}
                    installing={toolkitInstalling}
                    detectedFileName={detectedToolkitFile}
                    onDownloadFromApple={handleDownloadToolkit}
                    onChooseFile={handleInstallToolkit}
                    onInstallDetected={() => {
                      if (detectedToolkitFile) {
                        handleInstallToolkit(detectedToolkitFile)
                      }
                    }}
                    onContinue={() => goToStep('graphics')}
                    onSkip={() => goToStep('graphics')}
                  />
                ) : null}

                {stepKey === 'graphics' ? (
                  <GraphicsStep
                    selected={graphicsChoice}
                    toolkitInstalled={toolkitInstalled}
                    onSelect={setGraphicsChoice}
                    onContinue={() =>
                      goToStep(discoveredBottles.length > 0 ? 'import' : 'launcher')
                    }
                  />
                ) : null}

                {stepKey === 'import' ? (
                  <ImportPCsStep
                    bottles={discoveredBottles}
                    selectedIds={selectedBottleIds}
                    onToggleBottle={handleToggleBottle}
                    onToggleAll={handleToggleAllBottles}
                    onImportSelected={() => goToStep('launcher')}
                    onSkip={() => goToStep('launcher')}
                  />
                ) : null}

                {stepKey === 'launcher' ? (
                  <LauncherSetupStep
                    selectedLauncher={selectedLauncher}
                    steamAlreadyInstalled={steamAlreadyInstalled}
                    stage={launcherStage}
                    onSelectLauncher={handleSelectLauncher}
                    onStartSetup={handleStartLauncherSetup}
                    onContinue={() => {
                      if (selectedLauncher === 'steam' && steamAlreadyInstalled) {
                        setConfiguredLauncher('steam')
                      }
                      goToStep('ready')
                    }}
                    onSkip={() => goToStep('ready')}
                  />
                ) : null}

                {stepKey === 'ready' ? (
                  <ReadyStep
                    isActive={isActive}
                    selectedLauncherName={
                      activeLauncherForReady ? getLauncherName(activeLauncherForReady) : null
                    }
                    launcherReady={activeLauncherForReady !== null}
                    onPrimaryAction={() => onComplete?.()}
                  />
                ) : null}
              </div>
            )
          })}
        </div>
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-8 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2"
      >
        {steps.map((stepKey, index) => {
          const isActive = safeStepIndex === index
          return (
            <span
              key={stepKey}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                isActive ? 'w-5 bg-[#713131]' : 'w-1.5 bg-[#161212]/20'
              }`}
            />
          )
        })}
      </div>

      <button
        type="button"
        aria-label="Back"
        aria-hidden={!canGoBack}
        tabIndex={canGoBack ? 0 : -1}
        disabled={!canGoBack}
        onClick={() => setStepIndex((prev) => Math.max(0, prev - 1))}
        className={`app-no-drag group absolute right-6 bottom-6 z-20 inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#161212]/10 bg-white/80 text-[#161212] shadow-xs backdrop-blur-md transition-all duration-200 hover:border-[#161212]/20 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007AFF] active:scale-95 ${
          canGoBack
            ? 'cursor-pointer scale-100 opacity-100'
            : 'pointer-events-none scale-90 opacity-0'
        }`}
      >
        <ArrowLeftIcon className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
      </button>
    </div>
  )
}
