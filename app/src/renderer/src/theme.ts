import type { ThemePreference } from '../../shared/ipc'

const THEME_STORAGE_KEY = 'gmac.theme'

let currentPreference: ThemePreference = 'system'
let mediaListenerAttached = false

export function getThemePreference(): ThemePreference {
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (raw === 'light' || raw === 'dark' || raw === 'system') {
      currentPreference = raw
      return raw
    }
  } catch {
    // Ignore storage access errors.
  }
  return currentPreference
}

function applyThemeToDom(preference: ThemePreference): void {
  const prefersDark =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  const isDark = preference === 'dark' || (preference === 'system' && prefersDark)
  document.documentElement.classList.toggle('dark', isDark)
}

export function setThemePreference(preference: ThemePreference): void {
  currentPreference = preference
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference)
  } catch {
    // Ignore storage errors.
  }
  applyThemeToDom(preference)
  void window.gmac?.setThemePreference(preference)
}

export function initTheme(): void {
  const pref = getThemePreference()
  applyThemeToDom(pref)
  void window.gmac?.setThemePreference(pref)

  if (!mediaListenerAttached && typeof window !== 'undefined') {
    mediaListenerAttached = true
    window
      .matchMedia('(prefers-color-scheme: dark)')
      .addEventListener('change', () => {
        if (currentPreference === 'system') {
          applyThemeToDom('system')
        }
      })
  }
}
