/**
 * lib/engine — Lambda NX's own OSINT engine.
 *
 * Framework: Source port + guardrail (passive-only) + registry + orchestrator
 * (multi-source fallback). Analysis core: confidence grading, Admiralty code,
 * evidence de-duplication, pivot graph. Sources plug in from lib/engine/sources.
 */
export * from './types'
export * from './analysis'
export * from './feedxml'
export { Guardrail, PassiveGuardrailError } from './guardrail'
export { Registry, registry } from './registry'
export { collect } from './orchestrator'
export type { CollectMode, CollectOptions, CollectOutput } from './orchestrator'
