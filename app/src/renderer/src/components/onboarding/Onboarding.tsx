import { useEffect, useRef, useState } from 'react'
import { ArrowLeftIcon } from '../icons/ArrowLeftIcon'
import { DirectX12Step } from './DirectX12Step'
import { EngineSetupStep } from './EngineSetupStep'
import { GraphicsStep } from './GraphicsStep'
import { ImportPCsStep } from './ImportPCsStep'
import { ReadyStep } from './ReadyStep'
import { SteamSetupStep } from './SteamSetupStep'
import type {
  ComponentInstallStatus,
  DiscoveredBottle,
  GraphicsChoiceId,
  SteamSetupStage
} from './types'
import { WelcomeStep } from './WelcomeStep'

interface OnboardingProps {
  onComplete?: () => void
}

const GPTK_DOWNLOAD_URL = 'https://developer.apple.com/download/all/?q=game%20porting%20toolkit'
const DEFAULT_STORAGE_PATH = '~/Library/Containers/com.rolling7ho.Gmac/Bottles'
const TOTAL_STEPS = 7

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

  const [discoveredBottles] = useState<DiscoveredBottle[]>([])
  const [selectedBottleIds, setSelectedBottleIds] = useState<string[]>([])

  const [steamStage, setSteamStage] = useState<SteamSetupStage>('idle')

  const timersRef = useRef<number[]>([])

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

  useEffect(() => {
    return () => {
      clearTimers()
    }
  }, [])

  function startEngineInstall(): void {
    clearTimers()
    setEngineError(null)
    setRosettaStatus('installing')
    setEngineStatus('installing')
    setDownloadProgress(0)
    setDownloadDetail('0 MB of 459 MB')

    scheduleTimer(() => {
      setRosettaStatus('installed')
      setDownloadProgress(32)
      setDownloadDetail('147 MB of 459 MB')
    }, 550)

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

  function handleDownloadToolkit(): void {
    void window.gmac.openExternalUrl(GPTK_DOWNLOAD_URL)
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

  function handleStartSteamSetup(): void {
    clearTimers()
    setSteamStage('creating')

    scheduleTimer(() => {
      setSteamStage('downloading')
    }, 700)

    scheduleTimer(() => {
      setSteamStage('installing')
    }, 1450)

    scheduleTimer(() => {
      setSteamStage('done')
    }, 2200)
  }

  const isBusy =
    rosettaStatus === 'installing' ||
    engineStatus === 'installing' ||
    engineStatus === 'verifying' ||
    toolkitInstalling ||
    steamStage === 'creating' ||
    steamStage === 'downloading' ||
    steamStage === 'installing'

  const canGoBack = stepIndex > 0 && !isBusy

  return (
    <div className="onboarding-radiance relative flex h-full flex-col text-[#161212] select-none">
      <header className="app-drag relative z-10 h-10 shrink-0" />

      <div className="relative z-10 flex-1 overflow-hidden">
        <div
          className="onboarding-track flex h-full w-full"
          style={{ transform: `translate3d(-${stepIndex * 100}%, 0, 0)` }}
        >
          <div
            className="flex h-full w-full shrink-0"
            aria-hidden={stepIndex !== 0}
            inert={stepIndex !== 0}
          >
            <WelcomeStep onStart={() => setStepIndex(1)} />
          </div>

          <div
            className="flex h-full w-full shrink-0"
            aria-hidden={stepIndex !== 1}
            inert={stepIndex !== 1}
          >
            <EngineSetupStep
              rosettaStatus={rosettaStatus}
              engineStatus={engineStatus}
              downloadProgress={downloadProgress}
              downloadDetail={downloadDetail}
              errorMessage={engineError}
              onInstall={startEngineInstall}
              onRetry={startEngineInstall}
              onContinue={() => setStepIndex(2)}
            />
          </div>

          <div
            className="flex h-full w-full shrink-0"
            aria-hidden={stepIndex !== 2}
            inert={stepIndex !== 2}
          >
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
              onContinue={() => setStepIndex(3)}
              onSkip={() => setStepIndex(3)}
            />
          </div>

          <div
            className="flex h-full w-full shrink-0"
            aria-hidden={stepIndex !== 3}
            inert={stepIndex !== 3}
          >
            <GraphicsStep
              selected={graphicsChoice}
              toolkitInstalled={toolkitInstalled}
              onSelect={setGraphicsChoice}
              onContinue={() => setStepIndex(4)}
            />
          </div>

          <div
            className="flex h-full w-full shrink-0"
            aria-hidden={stepIndex !== 4}
            inert={stepIndex !== 4}
          >
            <ImportPCsStep
              bottles={discoveredBottles}
              selectedIds={selectedBottleIds}
              onToggleBottle={handleToggleBottle}
              onToggleAll={handleToggleAllBottles}
              onImportSelected={() => setStepIndex(5)}
              onSkip={() => setStepIndex(5)}
            />
          </div>

          <div
            className="flex h-full w-full shrink-0"
            aria-hidden={stepIndex !== 5}
            inert={stepIndex !== 5}
          >
            <SteamSetupStep
              storagePath={DEFAULT_STORAGE_PATH}
              stage={steamStage}
              onStartSetup={handleStartSteamSetup}
              onContinue={() => setStepIndex(6)}
              onSkip={() => setStepIndex(6)}
            />
          </div>

          <div
            className="flex h-full w-full shrink-0"
            aria-hidden={stepIndex !== 6}
            inert={stepIndex !== 6}
          >
            <ReadyStep
              steamInstalled={steamStage === 'done'}
              graphicsChoice={graphicsChoice}
              onOpenSteam={() => onComplete?.()}
              onFinish={() => onComplete?.()}
            />
          </div>
        </div>
      </div>

      {stepIndex > 0 ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-8 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2"
        >
          {Array.from({ length: TOTAL_STEPS - 1 }, (_, index) => {
            const targetStep = index + 1
            const isActive = stepIndex === targetStep
            return (
              <span
                key={targetStep}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  isActive ? 'w-5 bg-[#713131]' : 'w-1.5 bg-[#161212]/20'
                }`}
              />
            )
          })}
        </div>
      ) : null}

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
