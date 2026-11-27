interface HomeProps {
  onOpenOnboarding?: () => void
}

export function Home({ onOpenOnboarding }: HomeProps) {
  return (
    <div className="flex min-h-screen w-full flex-col bg-white text-[#161212] select-none">
      <div className="app-drag h-10 w-full shrink-0" />
      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-10 text-center">
        <h1 className="text-[28px] font-bold tracking-[-0.02em] text-[#161212]">Home</h1>
        <p className="mt-2 text-[14px] text-[#161212]/65">Home screen placeholder.</p>
        {onOpenOnboarding && (
          <button
            type="button"
            onClick={onOpenOnboarding}
            className="app-no-drag mt-6 rounded-full border border-[#161212]/15 bg-white px-4 py-2 text-[13px] font-medium text-[#161212] transition hover:bg-[#161212]/5"
          >
            Open Onboarding
          </button>
        )}
      </main>
    </div>
  )
}
