'use client'

import { useSyncExternalStore } from 'react'
import {
  subscribeToWorld,
  subscribeToWorldPassively,
  worldOnServer,
  worldState,
  type WorldState,
} from '@/lib/world/report-store'

/**
 * The current world picture, shared by every surface that draws it.
 *
 * Read through `useSyncExternalStore` so the server and the first client render
 * agree — there is no sweep on the server, so both start empty and the real
 * report arrives as an ordinary update rather than a hydration mismatch.
 */
export function useWorldReport(): WorldState {
  return useSyncExternalStore(subscribeToWorld, worldState, worldOnServer)
}

/** The world report if something has loaded it, without loading it (R338). */
export function usePassiveWorldReport(): WorldState {
  return useSyncExternalStore(subscribeToWorldPassively, worldState, worldOnServer)
}
