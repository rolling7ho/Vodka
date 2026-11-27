import type { ReactNode } from 'react'
import { ArrowRightIcon } from '../icons/ArrowRightIcon'
import {
  CheckIcon,
  DirectX11CompatLogo,
  DirectX11Logo,
  DirectX12Logo,
  DirectX9Logo,
  InfoIcon,
  OpenGLVulkanLogo,
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
    examples: 'Checks each game you install and selects the best translation layer automatically.',
    icon: (className) => <SparklesIcon className={className} />
  },
  {
    id: 'directX12',
    title: 'DirectX 12',
    examples: 'Teardown, Cyberpunk 2077, Elden Ring, Hogwarts Legacy, Forza Horizon 5',
    needsToolkit: true,
    icon: (className) => <DirectX12Logo className={className} />
  },
  {
    id: 'directX11',
    title: 'DirectX 11',
    examples: 'Skyrim Special Edition, Fallout 4, The Witcher 3, Dark Souls III, Sekiro',
    icon: (className) => <DirectX11Logo className={className} />
  },
  {
    id: 'directX11Compatibility',
    title: 'DirectX 11 (Compatibility)',
    examples: 'Fallback DXVK layer for DirectX 10 or 11 games that fail on standard DirectX 11.',
    icon: (className) => <DirectX11CompatLogo className={className} />
  },
  {
    id: 'directX9',
    title: 'DirectX 9 and older',
    examples: 'Fallout: New Vegas, Oblivion, Left 4 Dead 2, Dishonored',
    icon: (className) => <DirectX9Logo className={className} />
  },
  {
    id: 'openGL',
    title: 'OpenGL and Vulkan',
    examples: 'Doom (2016), Half-Life, Wolfenstein: The New Order',
    icon: (className) => <OpenGLVulkanLogo className={className} />
  }
]

interface GraphicsStepProps {
  isActive: boolean
  selected: GraphicsChoiceId
  toolkitInstalled: boolean
  onSelect: (choice: GraphicsChoiceId) => void
  onContinue: () => void
}

export function GraphicsStep({
  isActive,
  selected,
  toolkitInstalled,
  onSelect,
  onContinue
}: GraphicsStepProps) {
  return (
    <main className="relative z-10 flex flex-1 flex-col items-center justify-center overflow-y-auto px-8 pb-16">
      <div className={`flex flex-col items-center ${isActive ? 'animate-step-1' : 'opacity-0'}`}>
        <h2 className="text-center text-[34px] leading-tight font-semibold tracking-[-0.03em] text-[#161212]">
          Choose your graphics
        </h2>
        <p className="mt-2.5 max-w-lg text-center text-[15px] text-[#5e5454]">
          Select how Windows games translate graphics to Apple Metal. You can change this per PC or
          per game later.
        </p>
      </div>

      <div
        className={`mt-6 w-full max-w-lg divide-y divide-[#161212]/8 rounded-2xl border border-[#161212]/10 bg-white/75 shadow-xs backdrop-blur-md ${
          isActive ? 'animate-step-2' : 'opacity-0'
        }`}
      >
        {GRAPHICS_CHOICES.map((choice, index) => {
          const isSelected = selected === choice.id
          const isFirst = index === 0
          const isLast = index === GRAPHICS_CHOICES.length - 1
          const rowRounding = isFirst
            ? 'rounded-t-2xl'
            : isLast
              ? 'rounded-b-2xl'
              : ''

          return (
            <div
              key={choice.id}
              className={`relative flex items-center gap-2 pr-3.5 transition-colors ${rowRounding} ${
                isSelected ? 'bg-[#007AFF]/[0.06]' : 'hover:bg-[#161212]/[0.02]'
              }`}
            >
              <button
                type="button"
                aria-pressed={isSelected}
                onClick={() => onSelect(choice.id)}
                className="app-no-drag flex min-w-0 flex-1 cursor-pointer items-center gap-3.5 py-3 pl-4 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#007AFF]"
              >
                <span
                  className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                    isSelected
                      ? 'bg-[#007AFF] text-white'
                      : 'bg-[#713131]/[0.08] text-[#713131]'
                  }`}
                >
                  {choice.icon('h-4 w-4')}
                </span>

                <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                  <span className="text-[14.5px] font-medium text-[#161212]">{choice.title}</span>
                  {choice.needsToolkit && !toolkitInstalled ? (
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                      Needs Apple&apos;s toolkit
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

              <div className="group/info app-no-drag relative shrink-0">
                <button
                  type="button"
                  aria-label={`Compatible games for ${choice.title}`}
                  className="inline-flex h-7 w-7 cursor-default items-center justify-center rounded-full text-[#5e5454]/70 transition-colors hover:bg-[#161212]/[0.06] hover:text-[#161212] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#007AFF]"
                >
                  <InfoIcon className="h-4 w-4" />
                </button>

                <div
                  role="tooltip"
                  className="pointer-events-none invisible absolute top-1/2 left-full z-30 ml-3 w-52 -translate-y-1/2 rounded-xl border border-[#161212]/10 bg-[#d8d8de]/80 px-3 py-2 text-[12px] leading-snug text-[#161212] opacity-0 shadow-md backdrop-blur-md transition-all duration-150 group-hover/info:visible group-hover/info:opacity-100 group-focus-within/info:visible group-focus-within/info:opacity-100"
                >
                  {choice.examples}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className={`mt-7 ${isActive ? 'animate-step-3' : 'opacity-0'}`}>
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
