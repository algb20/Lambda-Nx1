'use client'

import { useSyncExternalStore } from 'react'
import {
  subscribeToViewer,
  viewerOnServer,
  viewerState,
  type ViewerState,
} from '@/lib/auth/viewer'

/**
 * The signed-in account, shared by every component that asks.
 *
 * Backed by one request and one copy (see `lib/auth/viewer`), and read through
 * `useSyncExternalStore` so the server and the first client render agree —
 * there is no session on the server, so both start at `unknown`, and the real
 * answer arrives as an ordinary update rather than a hydration mismatch.
 */
export function useViewer(): ViewerState {
  return useSyncExternalStore(subscribeToViewer, viewerState, viewerOnServer)
}
