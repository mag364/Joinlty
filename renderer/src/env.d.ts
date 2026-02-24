/// <reference types="vite/client" />

import type { CoupleBudgetApi } from '@shared/preload'

declare global {
  interface Window {
    coupleBudget: CoupleBudgetApi
  }
}

export {}
