import { useCallback, useEffect, useState } from 'react'
import type { BridgeProgressEvent } from '../../../../shared/ipc'
import { ArrowLeftIcon } from '../icons/ArrowLeftIcon'
import { DirectX12Step } from './DirectX12Step'
import { EngineSetupStep } from './EngineSetupStep'
import { ImportPCsStep } from './ImportPCsStep'
import { LauncherSetupStep } from './LauncherSetupStep'
import { ReadyStep } from './ReadyStep'
import type {
  ComponentInstallStatus,
  DiscoveredBottle,
  LauncherId,
  LauncherSetupStage,
  SlideDirection
} from './types'
import { WelcomeStep } from './WelcomeStep'

interface OnboardingProps {
  onComplete?: () => void
}

type StepKey = 'welcome' | 'engine' | 'directx12' | 'import' | 'launcher' | 'ready'
type RadianceColor = 'accent' | 'orange' | 'blue' | 'red' | 'green'

const RADIANCE_THEMES: RadianceColor[] = ['accent', 'orange', 'blue', 'red', 'green']

const STEP_RADIANCE: Record<StepKey, { color: RadianceColor; dot: string }> = {
  welcome: { color: 'accent', dot: '#713131' },
  engine: { color: 'orange', dot: '#EA7824' },
  directx12: { color: 'blue', dot: '#007AFF' },
  import: { color: 'red', dot: '#E13842' },
  launcher: { color: 'green', dot: '#22A860' },
  ready: { color: 'accent', dot: '#713131' }
}

const GPTK_DOWNLOAD_URL = 'https://developer.apple.com/download/all/?q=game%20porting%20toolkit'

export function Onboarding({ onComplete }: OnboardingProps) {
  const [stepIndex, setStepIndex] = useState(0)
  const [navDirection, setNavDirection] = useState<SlideDirection>('forward')

  const [rosettaStatus, setRosettaStatus] = useState<ComponentInstallStatus>('pending')
  const [engineStatus, setEngineStatus] = useState<ComponentInstallStatus>('pending')
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [engineError, setEngineError] = useState<string | null>(null)

  const [toolkitInstalled, setToolkitInstalled] = useState(false)
  const [toolkitInstalling, setToolkitInstalling] = useState(false)
  const [detectedToolkitFile, setDetectedToolkitFile] = useState<string | null>(null)
  const [detectedToolkitPath, setDetectedToolkitPath] = useState<string | null>(null)
  const [toolkitError, setToolkitError] = useState<string | null>(null)

  const [discoveredBottles, setDiscoveredBottles] = useState<DiscoveredBottle[]>([])
  const [selectedBottleIds, setSelectedBottleIds] = useState<string[]>([])

  const [selectedLauncher, setSelectedLauncher] = useState<LauncherId>('steam')
  const [steamAlreadyInstalled, setSteamAlreadyInstalled] = useState(false)
  const [launcherStage, setLauncherStage] = useState<LauncherSetupStage>('idle')
  const [launcherError, setLauncherError] = useState<string | null>(null)

  const steps: StepKey[] = [
    'welcome',
    'engine',
    'directx12',
    ...(discoveredBottles.length > 0 ? (['import'] as const) : []),
    'launcher',
    'ready'
  ]

  const safeStepIndex = Math.min(stepIndex, steps.length - 1)
  const activeStep = steps[safeStepIndex]
  const activeRadiance = STEP_RADIANCE[activeStep]
  const pulseClass = safeStepIndex % 2 === 0 ? 'animate-radiance-pulse-a' : 'animate-radiance-pulse-b'

  const syncSystemStatus = useCallback(async () => {
    if (!window.gmac?.getSystemStatus) {
      return
    }

    try {
      const status = await window.gmac.getSystemStatus()
      setRosettaStatus((prev) =>
        prev === 'installing' || prev === 'installed'
          ? prev
          : status.rosettaInstalled
            ? 'installed'
            : 'pending'
      )
      setEngineStatus((prev) => {
        if (prev === 'installing' || prev === 'verifying' || prev === 'installed') {
          return prev
        }
        return status.engineInstalled ? 'installed' : 'pending'
      })
      if (status.engineInstalled) {
        setDownloadProgress(100)
      }
      setToolkitInstalled((prev) => prev || status.toolkitInstalled)
      setDetectedToolkitFile((prev) => status.detectedToolkitFile ?? prev)
      setDetectedToolkitPath((prev) => status.detectedToolkitPath ?? prev)
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
  }, [syncSystemStatus])

  useEffect(() => {
    if (!window.gmac?.onBridgeProgress) {
      return
    }

    const unsubscribe = window.gmac.onBridgeProgress((event: BridgeProgressEvent) => {
      const component = event.data.component
      if (component === 'rosetta') {
        const status = event.data.status
        if (status === 'installing' || status === 'installed') {
          setRosettaStatus(status)
        }
      } else if (component === 'engine') {
        const status = event.data.status
        if (status === 'installing' || status === 'verifying' || status === 'installed') {
          setEngineStatus(status)
        }
        if (typeof event.data.progress === 'number') {
          setDownloadProgress(event.data.progress)
        }
      } else if (component === 'launcher') {
        const stage = event.data.stage
        if (
          stage === 'creating' ||
          stage === 'downloading' ||
          stage === 'installing' ||
          stage === 'done'
        ) {
          setLauncherStage(stage)
        }
      }
    })

    return () => {
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (activeStep !== 'directx12' || toolkitInstalled) {
      return
    }

    void syncSystemStatus()

    const handleFocus = () => {
      void syncSystemStatus()
    }
    window.addEventListener('focus', handleFocus)

    const interval = window.setInterval(() => {
      void syncSystemStatus()
    }, 3000)

    return () => {
      window.removeEventListener('focus', handleFocus)
      window.clearInterval(interval)
    }
  }, [activeStep, toolkitInstalled, syncSystemStatus])

  async function startEngineInstall(): Promise<void> {
    setEngineError(null)
    if (rosettaStatus !== 'installed') {
      setRosettaStatus('installing')
    }
    if (engineStatus !== 'installed') {
      setEngineStatus('installing')
      setDownloadProgress(0)
    }

    try {
      await window.gmac.installEngine()
      setRosettaStatus('installed')
      setEngineStatus('installed')
      setDownloadProgress(100)
    } catch (error) {
      setEngineStatus('error')
      setEngineError(error instanceof Error ? error.message : 'Engine installation failed.')
    }
  }

  function handleDownloadToolkit(): void {
    void window.gmac.openExternalUrl(GPTK_DOWNLOAD_URL).catch(() => {
      window.open(GPTK_DOWNLOAD_URL, '_blank', 'noopener,noreferrer')
    })
  }

  async function installToolkitAtPath(toolkitPath: string): Promise<void> {
    setToolkitError(null)
    setToolkitInstalling(true)
    try {
      const result = await window.gmac.installToolkit(toolkitPath)
      if (result.installed) {
        setToolkitInstalled(true)
      } else {
        setToolkitError(
          'Toolkit was saved, but the installed Wine runtime does not support D3DMetal.'
        )
      }
    } catch (error) {
      setToolkitError(error instanceof Error ? error.message : 'Toolkit installation failed.')
    } finally {
      setToolkitInstalling(false)
    }
  }

  async function handleChooseToolkitFile(): Promise<void> {
    const chosenPath = await window.gmac.pickToolkitFile()
    if (!chosenPath) {
      return
    }
    const basename = chosenPath.split('/').pop() ?? chosenPath
    setDetectedToolkitFile(basename)
    setDetectedToolkitPath(chosenPath)
    await installToolkitAtPath(chosenPath)
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

  async function handleImportSelectedBottles(): Promise<void> {
    try {
      await window.gmac.importLegacyBottles(selectedBottleIds)
    } catch {
      // Proceed to launcher step even if import encounters an error.
    }
    goToStep('launcher')
  }

  function handleSelectLauncher(launcher: LauncherId): void {
    setSelectedLauncher(launcher)
    setLauncherError(null)
    if (launcherStage === 'done') {
      setLauncherStage('idle')
    }
  }

  async function handleStartLauncherSetup(): Promise<void> {
    setLauncherError(null)
    setLauncherStage('creating')
    try {
      await window.gmac.setDefaultGraphics('automatic').catch(() => undefined)
      await window.gmac.setupLauncher(selectedLauncher, 'automatic')
      setLauncherStage('done')
      if (selectedLauncher === 'steam') {
        setSteamAlreadyInstalled(true)
      }
    } catch (error) {
      setLauncherStage('idle')
      setLauncherError(error instanceof Error ? error.message : 'Launcher setup failed.')
    }
  }

  function handleFinishOnboarding(): void {
    void window.gmac?.setDefaultGraphics?.('automatic').catch(() => undefined)
    onComplete?.()
  }

  function goToStep(target: StepKey): void {
    const idx = steps.indexOf(target)
    if (idx !== -1) {
      setNavDirection(idx >= safeStepIndex ? 'forward' : 'backward')
      setStepIndex(idx)
    }
  }

  function goBack(): void {
    setNavDirection('backward')
    setStepIndex((prev) => Math.max(0, prev - 1))
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

  const afterDirectX12Step: StepKey = discoveredBottles.length > 0 ? 'import' : 'launcher'

  return (
    <div className="onboarding-radiance relative flex h-full flex-col text-[#161212] select-none">
      <div aria-hidden="true" className={`pointer-events-none absolute inset-0 z-0 ${pulseClass}`}>
        <div className="radiance-drift-primary">
          {RADIANCE_THEMES.map((theme) => (
            <div
              key={theme}
              className={`absolute inset-0 transition-opacity duration-700 ease-in-out radiance-primary-${theme} ${
                activeRadiance.color === theme ? 'opacity-100' : 'opacity-0'
              }`}
            />
          ))}
        </div>

        <div className="radiance-drift-secondary">
          {RADIANCE_THEMES.map((theme) => (
            <div
              key={theme}
              className={`absolute inset-0 transition-opacity duration-700 ease-in-out radiance-secondary-${theme} ${
                activeRadiance.color === theme ? 'opacity-100' : 'opacity-0'
              }`}
            />
          ))}
        </div>
      </div>

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
                className={`onboarding-slide flex h-full w-full shrink-0 ${
                  isActive ? 'scale-100 opacity-100' : 'scale-[0.96] opacity-0'
                }`}
                aria-hidden={!isActive}
                inert={!isActive}
              >
                {stepKey === 'welcome' ? (
                  <WelcomeStep onStart={() => goToStep('engine')} />
                ) : null}

                {stepKey === 'engine' ? (
                  <EngineSetupStep
                    isActive={isActive}
                    enterDirection={navDirection}
                    rosettaStatus={rosettaStatus}
                    engineStatus={engineStatus}
                    downloadProgress={downloadProgress}
                    errorMessage={engineError}
                    onInstall={() => {
                      void startEngineInstall()
                    }}
                    onRetry={() => {
                      void startEngineInstall()
                    }}
                    onContinue={() => goToStep('directx12')}
                  />
                ) : null}

                {stepKey === 'directx12' ? (
                  <DirectX12Step
                    isActive={isActive}
                    enterDirection={navDirection}
                    installed={toolkitInstalled}
                    installing={toolkitInstalling}
                    detectedFileName={detectedToolkitFile}
                    errorMessage={toolkitError}
                    onDownloadFromApple={handleDownloadToolkit}
                    onChooseFile={() => {
                      void handleChooseToolkitFile()
                    }}
                    onInstallDetected={() => {
                      if (detectedToolkitPath) {
                        void installToolkitAtPath(detectedToolkitPath)
                      }
                    }}
                    onContinue={() => goToStep(afterDirectX12Step)}
                    onSkip={() => goToStep(afterDirectX12Step)}
                  />
                ) : null}

                {stepKey === 'import' ? (
                  <ImportPCsStep
                    isActive={isActive}
                    enterDirection={navDirection}
                    bottles={discoveredBottles}
                    selectedIds={selectedBottleIds}
                    onToggleBottle={handleToggleBottle}
                    onToggleAll={handleToggleAllBottles}
                    onImportSelected={() => {
                      void handleImportSelectedBottles()
                    }}
                    onSkip={() => goToStep('launcher')}
                  />
                ) : null}

                {stepKey === 'launcher' ? (
                  <LauncherSetupStep
                    isActive={isActive}
                    enterDirection={navDirection}
                    selectedLauncher={selectedLauncher}
                    steamAlreadyInstalled={steamAlreadyInstalled}
                    stage={launcherStage}
                    errorMessage={launcherError}
                    onSelectLauncher={handleSelectLauncher}
                    onStartSetup={() => {
                      void handleStartLauncherSetup()
                    }}
                    onContinue={() => goToStep('ready')}
                    onSkip={() => goToStep('ready')}
                  />
                ) : null}

                {stepKey === 'ready' ? (
                  <ReadyStep
                    isActive={isActive}
                    onPrimaryAction={handleFinishOnboarding}
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
                isActive ? 'w-5' : 'w-1.5 bg-[#161212]/20'
              }`}
              style={isActive ? { backgroundColor: activeRadiance.dot } : undefined}
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
        onClick={goBack}
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
