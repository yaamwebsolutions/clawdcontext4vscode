export type CerStatus = 'optimal' | 'warning' | 'critical';

/**
 * Classify a CER value using direct CER thresholds.
 * Threshold semantics match the settings descriptions:
 * warnings/critical trigger when CER is below the configured cutoff.
 */
export function classifyCerStatus(
  cer: number,
  warningThreshold: number,
  criticalThreshold: number,
): CerStatus {
  if (cer < criticalThreshold) { return 'critical'; }
  if (cer < warningThreshold) { return 'warning'; }
  return 'optimal';
}
