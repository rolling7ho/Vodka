import type { ReactNode } from 'react'
import { ArrowRightIcon } from '../icons/ArrowRightIcon'
import {
  BattleNetLogo,
  CheckIcon,
  EAAppLogo,
  EpicLogo,
  RockstarLogo,
  SpinnerIcon,
  SteamLogo,
  UbisoftLogo
} from '../icons/OnboardingIcons'
import {
  stepParallaxClass,
  type LauncherId,
  type LauncherSetupStage,
  type SlideDirection
} from './types'

interface LauncherOption {
  id: LauncherId
  name: string
  recommended?: boolean
  icon: (className: string) => ReactNode
}

export const LAUNCHER_OPTIONS: LauncherOption[] = [
  {
    id: 'steam',
    name: 'Steam',
    recommended: true,
    icon: (className) => <SteamLogo className={className} />
  },
  {
    id: 'epicGames',
    name: 'Epic Games Store',
    icon: (className) => <EpicLogo className={className} />
  },
  {
    id: 'battleNet',
    name: 'Battle.net',
    icon: (className) => <BattleNetLogo className={className} />
  },
  {
    id: 'eaApp',
    name: 'EA App',
    icon: (className) => <EAAppLogo className={className} />
  },
  {
    id: 'rockstar',
    name: 'Rockstar Games Launcher',
    icon: (className) => <RockstarLogo className={className} />
  },
  {
    id: 'ubisoft',
    name: 'Ubisoft Connect',
    icon: (className) => <UbisoftLogo className={className} />
  }
]

export function getLauncherName(id: LauncherId): string {
  return LAUNCHER_OPTIONS.find((option) => option.id === id)?.name ?? 'Steam'
}

interface LauncherSetupStepProps {
  isActive: boolean
  enterDirection: SlideDirection
  selectedLauncher: LauncherId
  steamAlreadyInstalled: boolean
  stage: LauncherSetupStage
  errorMessage?: string | null
  onSelectLauncher: (launcher: LauncherId) => void
  onStartSetup: () => void
  onContinue: () => void
  onSkip: () => void
}

function stageLabel(stage: LauncherSetupStage, launcherName: string): string {
  switch (stage) {
    case 'creating':
      return `Creating ${launcherName} PC...`
    case 'downloading':
      return `Downloading ${launcherName} installer...`
    case 'installing':
      return `Installing ${launcherName}...`
    case 'done':
      return `${launcherName} is installed.`
    default:
      return ''
  }
}

export function LauncherSetupStep({
  isActive,
  enterDirection,
  selectedLauncher,
  steamAlreadyInstalled,
  stage,
  errorMessage,
  onSelectLauncher,
  onStartSetup,
  onContinue,
  onSkip
}: LauncherSetupStepProps) {
  const isBusy = stage === 'creating' || stage === 'downloading' || stage === 'installing'
  const selectedName = getLauncherName(selectedLauncher)
  const selectedAlreadyReady = selectedLauncher === 'steam' && steamAlreadyInstalled

  return (
    <main className="relative z-10 flex flex-1 flex-col items-center justify-center overflow-y-auto px-8 pb-16">
      <h2
        className={`text-center text-[34px] leading-tight font-semibold tracking-[-0.03em] text-[#161212] ${
          stepParallaxClass(isActive, enterDirection, 1) ?? ''
        }`}
      >
        Set up a launcher
      </h2>

      <div
        className={`mt-7 w-full max-w-lg divide-y divide-[#161212]/8 rounded-2xl border border-[#161212]/10 bg-white/75 shadow-xs backdrop-blur-md ${
          stepParallaxClass(isActive, enterDirection, 2) ?? ''
        }`}
      >
        {LAUNCHER_OPTIONS.map((launcher, index) => {
          const isSelected = selectedLauncher === launcher.id
          const isInstalled = launcher.id === 'steam' && steamAlreadyInstalled
          const isFirst = index === 0
          const isLast = index === LAUNCHER_OPTIONS.length - 1
          const rowRounding = isFirst
            ? 'rounded-t-2xl'
            : isLast
              ? 'rounded-b-2xl'
              : ''

          return (
            <button
              key={launcher.id}
              type="button"
              disabled={isBusy}
              aria-pressed={isSelected}
              onClick={() => onSelectLauncher(launcher.id)}
              className={`app-no-drag flex w-full cursor-pointer items-center gap-3.5 px-4 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#007AFF] disabled:cursor-not-allowed ${rowRounding} ${
                isSelected ? 'bg-[#007AFF]/[0.06]' : 'hover:bg-[#161212]/[0.02]'
              }`}
            >
              <span
                className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                  isSelected
                    ? 'bg-[#007AFF] text-white'
                    : 'bg-[#713131]/[0.08] text-[#713131]'
                }`}
              >
                {launcher.icon('h-4 w-4')}
              </span>

              <span className="flex min-w-0 flex-1 items-center gap-2">
                <span className="text-[14.5px] font-medium text-[#161212]">{launcher.name}</span>
                {isInstalled ? (
                  <span className="rounded-full bg-emerald-500/12 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                    Installed
                  </span>
                ) : launcher.recommended ? (
                  <span className="rounded-full bg-[#161212]/[0.06] px-2 py-0.5 text-[11px] font-medium text-[#5e5454]">
                    Recommended
                  </span>
                ) : null}
              </span>

              <span
                className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors ${
                  isSelected
                    ? 'bg-[#007AFF] text-white'
                    : 'border border-[#161212]/15 bg-white/60'
                }`}
              >
                {isSelected ? <CheckIcon className="h-3 w-3" /> : null}
              </span>
            </button>
          )
        })}
      </div>

      {stage !== 'idle' ? (
        <div className="mt-4 flex w-full max-w-lg items-center gap-2.5 rounded-xl border border-[#161212]/10 bg-white/75 px-4 py-2.5 text-[13px] text-[#161212] backdrop-blur-md">
          {stage === 'done' ? (
            <CheckIcon className="h-4 w-4 shrink-0 text-emerald-600" />
          ) : (
            <SpinnerIcon className="h-4 w-4 shrink-0 text-[#007AFF]" />
          )}
          <span>{stageLabel(stage, selectedName)}</span>
        </div>
      ) : null}

      {errorMessage ? (
        <div
          role="alert"
          className="mt-4 w-full max-w-lg rounded-xl border border-red-500/20 bg-red-50/90 px-4 py-3 text-[13px] text-red-700"
        >
          {errorMessage}
        </div>
      ) : null}

      <div
        className={`mt-7 flex items-center gap-3 ${stepParallaxClass(isActive, enterDirection, 3) ?? ''}`}
      >
        {stage === 'done' || selectedAlreadyReady ? (
          <button
            type="button"
            onClick={onContinue}
            className="app-no-drag group inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#007AFF] px-7 py-3 text-[15px] font-medium text-white transition-all duration-150 hover:bg-[#0066D6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007AFF] active:scale-[0.98]"
          >
            <span>Continue</span>
            <ArrowRightIcon className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled={isBusy}
              onClick={onStartSetup}
              className="app-no-drag group inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#007AFF] px-7 py-3 text-[15px] font-medium text-white transition-all duration-150 hover:bg-[#0066D6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007AFF] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isBusy ? (
                <>
                  <SpinnerIcon className="h-4 w-4" />
                  <span>Setting Up {selectedName}...</span>
                </>
              ) : (
                <>
                  <span>Set Up {selectedName}</span>
                  <ArrowRightIcon className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                </>
              )}
            </button>

            <button
              type="button"
              disabled={isBusy}
              onClick={onSkip}
              className="app-no-drag cursor-pointer rounded-full px-5 py-3 text-[14px] font-medium text-[#5e5454] transition-colors hover:bg-[#161212]/[0.05] hover:text-[#161212] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Skip for now
            </button>
          </>
        )}
      </div>
    </main>
  )
}
