import { ArrowRightIcon } from '../icons/ArrowRightIcon'

interface PlaceholderStepProps {
  title: string
  description: string
  nextLabel?: string
  onNext?: () => void
}

export function PlaceholderStep({
  title,
  description,
  nextLabel,
  onNext
}: PlaceholderStepProps) {
  return (
    <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-10 text-center">
      <h2 className="text-[32px] font-semibold tracking-[-0.025em] text-[#161212]">
        {title}
      </h2>
      <p className="mt-3 max-w-md text-[15px] text-[#5e5454]">{description}</p>

      {nextLabel && onNext ? (
        <div className="mt-8">
          <button
            type="button"
            onClick={onNext}
            className="app-no-drag group inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#007AFF] px-7 py-3 text-[15px] font-medium text-white transition-all duration-150 hover:bg-[#0066D6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007AFF] active:scale-[0.98]"
          >
            <span>{nextLabel}</span>
            <ArrowRightIcon className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </button>
        </div>
      ) : null}
    </main>
  )
}
