/**
 * The default calibration store — bridges lib/db repo.calibration to the pure
 * calibration module's port. Kept separate so calibration.ts stays repo-free
 * (and unit-testable) while app code shares one real implementation.
 */
import { repo, type CalibrationClaim, type NewCalibrationClaim } from '../db'
import type { CalibrationClaimRow, CalibrationPort } from './calibration'

export const defaultCalibrationPort: CalibrationPort = {
  record: (row) => repo.calibration.record(row as unknown as NewCalibrationClaim),
  resolve: (id, outcome, note) => repo.calibration.resolve(id, outcome as CalibrationClaim['outcome'], note),
  list: (limit) => repo.calibration.list(limit) as unknown as Promise<CalibrationClaimRow[]>,
}
