import type { ReactNode } from 'react'
import { ArrowRightIcon } from '../icons/ArrowRightIcon'
import {
  BoltIcon,
  CheckIcon,
  ClockIcon,
  CubeIcon,
  HexagonIcon,
  LayersIcon,
  SparklesIcon
} from '../icons/OnboardingIcons'
import type { GraphicsChoiceId } from './types'

interface GraphicsChoiceOption {
  id: GraphicsChoiceId
  title: string
  examples: string
  needsToolkit?: boolean
  icon: (className: string) => ReactNode
}

export const GRAPHICS_CHOICES: GraphicsChoiceOption[] = [
  {
    id: 'automatic',
    title: 'Automatic (Recommended)',
    examples: 'Checks each game you install and picks the right option for it.',
    icon: (className) => <SparklesIcon className={className} />
  },
  {
    id: 'directX12',
    title: 'DirectX 12',
    examples: 'Teardown, Cyberpunk 2077, Elden Ring, Hogwarts Legacy, Forza Horizon 5',
    needsToolkit: true,
    icon: (className) => <BoltIcon className={className} />
  },
  {
    id: 'directX11',
    title: 'DirectX 11',
    examples: 'Skyrim Special Edition, Fallout 4, The Witcher 3, Dark Souls III, Sekiro',
    icon: (className) => <CubeIcon className={className} />
  },
  {
    id: 'directX11Compatibility',
    title: 'DirectX 11 (Compatibility)',
    examples: 'Use if a DirectX 10 or 11 game glitches or will not start on DirectX 11.',
    icon: (className) => <LayersIcon className={className} />
  },
  {
    id: 'directX9',
    title: 'DirectX 9 and older',
    examples: 'Fallout: New Vegas, Oblivion, Left 4 Dead 2, Dishonored',
    icon: (className) => <ClockIcon className={className} />
  },
  {
    id: 'openGL',
    title: 'OpenGL and Vulkan',
    examples: 'Doom (2016), Half-Life, Wolfenstein: The New Order',
    icon: (className) => <HexagonIcon className={className} />
  }
]

export function getGraphicsChoiceTitle(id: GraphicsChoiceId): string {
  return GRAPHICS_CHOICES.find((choice) => choice.id === id)?.title ?? 'Automatic (Recommended)'
}

interface GraphicsStepProps {
  selected: GraphicsChoiceId
  toolkitInstalled: boolean
  onSelect: (choice: GraphicsChoiceId) => void
  onContinue: () => void
}

export function GraphicsStep({
  selected,
  toolkitInstalled,
  onSelect,
  onContinue
}: GraphicsStepProps) {
  return (
    <main className="relative z-10 flex flex-1 flex-col items-center justify-center overflow-y-auto px-8 pb-16">
      <h2 className="text-center text-[34px] leading-tight font-semibold tracking-[-0.03em] text-[#161212]">
        Choose your graphics
      </h2>
      <p className="mt-2.5 max-w-lg text-center text-[15px] text-[#5e5454]">
        Select how Windows games translate graphics to Apple Metal. You can change this per PC or
        per game later.
      </p>

      <div className="mt-7 grid w-full max-w-2xl grid-cols-2 gap-3">
        {GRAPHICS_CHOICES.map((choice) => {
          const isSelected = selected === choice.id
          return (
            <button
              key={choice.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelect(choice.id)}
              className={`app-no-drag flex cursor-pointer items-start gap-3 rounded-2xl border p-4 text-left backdrop-blur-md transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007AFF] ${
                isSelected
                  ? 'border-[#007AFF] bg-[#007AFF]/[0.07] ring-1 ring-[#007AFF]/30 shadow-xs'
                  : 'border-[#161212]/10 bg-white/75 hover:border-[#161212]/20 hover:bg-white/90'
              }`}
            >
              <span
                className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                  isSelected
                    ? 'bg-[#007AFF] text-white'
                    : 'bg-[#713131]/[0.08] text-[#713131]'
                }`}
              >
                {choice.icon('h-4 w-4')}
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[14px] font-semibold text-[#161212]">{choice.title}</span>
                  {choice.needsToolkit && !toolkitInstalled ? (
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                      Needs Apple&apos;s toolkit
                    </span>
                  ) : null}
                </span>
                <span className="mt-1 block text-[12.5px] leading-snug text-[#5e5454]">
                  {choice.examples}
                </span>
              </span>

              <span
                className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors ${
                  isSelected
                    ? 'bg-[#007AFF] text-white'
                    : 'border border-[#161212]/15 bg-white/60 text-transparent'
                }`}
              >
                <CheckIcon className="h-3 w-3" />
              </span>
            </button>
          )
        })}
      </div>

      <div className="mt-7">
        <button
          type="button"
          onClick={onContinue}
          className="app-no-drag group inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#007AFF] px-7 py-3 text-[15px] font-medium text-white transition-all duration-150 hover:bg-[#0066D6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007AFF] active:scale-[0.98]"
        >
          <span>Continue</span>
          <ArrowRightIcon className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
        </button>
      </div>
    </main>
  )
}
