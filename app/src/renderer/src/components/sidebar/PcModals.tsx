import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { BottleSummary } from '../../../../shared/ipc'
import { PC_ICON_OPTIONS, PcGlyph, type PcIconId } from '../icons/PcIcons'
import { SpinnerIcon } from '../icons/OnboardingIcons'
import { PencilIcon, SparklesIcon, TrashIcon } from '../icons/SidebarIcons'

interface PcContextMenuProps {
  pc: BottleSummary
  x: number
  y: number
  onClose: () => void
  onRename: (pc: BottleSummary) => void
  onChangeIcon: (pc: BottleSummary) => void
  onDelete: (pc: BottleSummary) => void
}

export function PcContextMenu({
  pc,
  x,
  y,
  onClose,
  onRename,
  onChangeIcon,
  onDelete
}: PcContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const left = Math.min(x, window.innerWidth - 196)
  const top = Math.min(y, window.innerHeight - 156)

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('scroll', onClose, true)
    window.addEventListener('blur', onClose)

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('scroll', onClose, true)
      window.removeEventListener('blur', onClose)
    }
  }, [onClose])

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label={`Actions for ${pc.name}`}
      style={{ left, top }}
      className="app-no-drag fixed z-50 w-44 rounded-xl border border-[#161212]/[0.1] bg-white p-1 shadow-[0_10px_28px_rgba(22,18,18,0.14)]"
    >
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onClose()
          onRename(pc)
        }}
        className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] font-normal text-[#161212] transition-colors hover:bg-[#161212]/[0.05] hover:text-[#713131]"
      >
        <PencilIcon className="h-[14px] w-[14px] shrink-0" />
        <span>Rename</span>
      </button>

      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onClose()
          onChangeIcon(pc)
        }}
        className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] font-normal text-[#161212] transition-colors hover:bg-[#161212]/[0.05] hover:text-[#713131]"
      >
        <SparklesIcon className="h-[14px] w-[14px] shrink-0" />
        <span>Change Icon</span>
      </button>

      <div className="my-1 h-px bg-[#161212]/[0.08]" role="separator" />

      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onClose()
          onDelete(pc)
        }}
        className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] font-normal text-red-600 transition-colors hover:bg-red-500/[0.08]"
      >
        <TrashIcon className="h-[14px] w-[14px] shrink-0" />
        <span>Delete</span>
      </button>
    </div>
  )
}

interface CreatePcModalProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (name: string, icon: PcIconId) => Promise<void>
}

export function CreatePcModal({ isOpen, onClose, onCreate }: CreatePcModalProps) {
  const [name, setName] = useState('')
  const [selectedIcon, setSelectedIcon] = useState<PcIconId>('pc')
  const [isCreating, setIsCreating] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isOpen) {
      return
    }
    setName('')
    setSelectedIcon('pc')
    setIsCreating(false)
    setErrorMessage(null)
    requestAnimationFrame(() => inputRef.current?.focus())

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isCreating) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  if (!isOpen) {
    return null
  }

  const trimmedName = name.trim()

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!trimmedName || isCreating) {
      return
    }
    setIsCreating(true)
    setErrorMessage(null)
    try {
      await onCreate(trimmedName, selectedIcon)
      onClose()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unable to create PC.')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div
      className="app-no-drag fixed inset-0 z-50 flex items-center justify-center bg-black/25 px-4 backdrop-blur-[2px]"
      onClick={() => {
        if (!isCreating) {
          onClose()
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-pc-title"
        className="w-full max-w-sm rounded-2xl border border-[#161212]/[0.1] bg-white p-6 shadow-[0_18px_48px_rgba(22,18,18,0.18)]"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="create-pc-title" className="text-[18px] font-semibold text-[#161212]">
          Create a PC
        </h2>
        <p className="mt-1 text-[13px] text-[#5e5454]">
          Choose a name and icon for your new Windows PC.
        </p>

        <form onSubmit={(event) => void handleSubmit(event)} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="create-pc-name"
              className="block text-[12.5px] font-medium text-[#4a4242]"
            >
              PC Name
            </label>
            <input
              id="create-pc-name"
              ref={inputRef}
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={isCreating}
              placeholder="Gaming PC"
              className="mt-1.5 w-full rounded-xl border border-[#161212]/15 bg-white px-3.5 py-2 text-[14px] text-[#161212] placeholder-[#5e5454]/45 focus:border-[#007AFF] focus:outline-none disabled:opacity-60"
            />
          </div>

          <div>
            <div className="text-[12.5px] font-medium text-[#4a4242]">Icon</div>
            <div className="mt-1.5 grid grid-cols-4 gap-2">
              {PC_ICON_OPTIONS.map((option) => {
                const isSelected = selectedIcon === option.id
                return (
                  <button
                    key={option.id}
                    type="button"
                    disabled={isCreating}
                    aria-label={option.label}
                    aria-pressed={isSelected}
                    title={option.label}
                    onClick={() => setSelectedIcon(option.id)}
                    className={`flex h-10 cursor-pointer items-center justify-center rounded-xl border transition-colors ${
                      isSelected
                        ? 'border-[#713131]/35 bg-[#713131]/[0.1] text-[#713131]'
                        : 'border-[#161212]/10 bg-white text-[#4a4242] hover:bg-[#161212]/[0.04] hover:text-[#713131]'
                    }`}
                  >
                    <PcGlyph icon={option.id} className="h-[18px] w-[18px]" />
                  </button>
                )
              })}
            </div>
          </div>

          {errorMessage && (
            <div
              role="alert"
              className="rounded-xl border border-red-500/20 bg-red-50/90 px-3 py-2 text-[12.5px] text-red-700"
            >
              {errorMessage}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              disabled={isCreating}
              onClick={onClose}
              className="cursor-pointer rounded-full px-4 py-2 text-[13.5px] font-medium text-[#5e5454] transition-colors hover:bg-[#161212]/[0.05] hover:text-[#161212] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!trimmedName || isCreating}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#007AFF] px-5 py-2 text-[13.5px] font-medium text-white transition-colors hover:bg-[#0066D6] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {isCreating && <SpinnerIcon className="h-3.5 w-3.5" />}
              <span>{isCreating ? 'Creating...' : 'Create PC'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

interface ChangePcIconModalProps {
  pc: BottleSummary | null
  onClose: () => void
  onSelectIcon: (pc: BottleSummary, icon: PcIconId) => Promise<void>
}

export function ChangePcIconModal({ pc, onClose, onSelectIcon }: ChangePcIconModalProps) {
  useEffect(() => {
    if (!pc) {
      return
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [pc, onClose])

  if (!pc) {
    return null
  }

  const currentIcon = pc.icon ?? 'pc'

  return (
    <div
      className="app-no-drag fixed inset-0 z-50 flex items-center justify-center bg-black/25 px-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-icon-title"
        className="w-full max-w-xs rounded-2xl border border-[#161212]/[0.1] bg-white p-6 shadow-[0_18px_48px_rgba(22,18,18,0.18)]"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="change-icon-title" className="text-[18px] font-semibold text-[#161212]">
          Change Icon
        </h2>
        <p className="mt-1 truncate text-[13px] text-[#5e5454]">{pc.name}</p>

        <div className="mt-4 grid grid-cols-4 gap-2">
          {PC_ICON_OPTIONS.map((option) => {
            const isSelected = currentIcon === option.id
            return (
              <button
                key={option.id}
                type="button"
                aria-label={option.label}
                aria-pressed={isSelected}
                title={option.label}
                onClick={() => {
                  void onSelectIcon(pc, option.id)
                  onClose()
                }}
                className={`flex h-11 cursor-pointer items-center justify-center rounded-xl transition-colors ${
                  isSelected
                    ? 'bg-[#713131]/[0.1] text-[#713131] ring-1 ring-[#713131]/30'
                    : 'border border-[#161212]/10 bg-white text-[#4a4242] hover:bg-[#161212]/[0.04] hover:text-[#713131]'
                }`}
              >
                <PcGlyph icon={option.id} className="h-[19px] w-[19px]" />
              </button>
            )
          })}
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-full px-4 py-1.5 text-[13px] font-medium text-[#5e5454] transition-colors hover:bg-[#161212]/[0.05] hover:text-[#161212]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

interface DeletePcModalProps {
  pc: BottleSummary | null
  onClose: () => void
  onConfirmDelete: (pc: BottleSummary) => Promise<void>
}

export function DeletePcModal({ pc, onClose, onConfirmDelete }: DeletePcModalProps) {
  const [confirmInput, setConfirmInput] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!pc) {
      return
    }
    setConfirmInput('')
    setIsDeleting(false)
    setErrorMessage(null)
    requestAnimationFrame(() => inputRef.current?.focus())

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isDeleting) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [pc])

  if (!pc) {
    return null
  }

  const isMatch = confirmInput === pc.name

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!isMatch || isDeleting) {
      return
    }
    setIsDeleting(true)
    setErrorMessage(null)
    try {
      await onConfirmDelete(pc)
      onClose()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unable to delete PC.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div
      className="app-no-drag fixed inset-0 z-50 flex items-center justify-center bg-black/25 px-4 backdrop-blur-[2px]"
      onClick={() => {
        if (!isDeleting) {
          onClose()
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-pc-title"
        className="w-full max-w-sm rounded-2xl border border-[#161212]/[0.1] bg-white p-6 shadow-[0_18px_48px_rgba(22,18,18,0.18)]"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="delete-pc-title" className="text-[18px] font-semibold text-[#161212]">
          Delete &ldquo;{pc.name}&rdquo;?
        </h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-[#5e5454]">
          This permanently deletes the PC and all files inside it from disk.
        </p>

        <form onSubmit={(event) => void handleSubmit(event)} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="delete-pc-confirm"
              className="block text-[12.5px] font-medium text-[#4a4242]"
            >
              Type <span className="font-semibold text-[#161212]">{pc.name}</span> to confirm.
            </label>
            <input
              id="delete-pc-confirm"
              ref={inputRef}
              type="text"
              value={confirmInput}
              onChange={(event) => setConfirmInput(event.target.value)}
              disabled={isDeleting}
              placeholder={pc.name}
              className="mt-1.5 w-full rounded-xl border border-[#161212]/15 bg-white px-3.5 py-2 text-[14px] text-[#161212] placeholder-[#5e5454]/45 focus:border-red-500 focus:outline-none disabled:opacity-60"
            />
          </div>

          {errorMessage && (
            <div
              role="alert"
              className="rounded-xl border border-red-500/20 bg-red-50/90 px-3 py-2 text-[12.5px] text-red-700"
            >
              {errorMessage}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              disabled={isDeleting}
              onClick={onClose}
              className="cursor-pointer rounded-full px-4 py-2 text-[13.5px] font-medium text-[#5e5454] transition-colors hover:bg-[#161212]/[0.05] hover:text-[#161212] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isMatch || isDeleting}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-red-600 px-5 py-2 text-[13.5px] font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isDeleting && <SpinnerIcon className="h-3.5 w-3.5" />}
              <span>{isDeleting ? 'Deleting...' : 'Delete PC'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
