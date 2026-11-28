/// <reference types="vite/client" />

import type { GmacApi } from '../../shared/ipc'

declare global {
  interface Window {
    gmac: GmacApi
  }
}
