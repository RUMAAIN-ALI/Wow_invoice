import { MIGRATION_STEPS, CURRENT_THEME_VERSION } from './versions';

export interface AppliedMigration {
  readonly from: number;
  readonly to: number;
}

/**
 * migrateTheme: Ingests an override payload, checks its version, and runs all
 * necessary sequential migration steps up to the target system version.
 */
export function migrateTheme(
  payload: any,
  targetVersion: number = CURRENT_THEME_VERSION
): { readonly migratedPayload: any; readonly applied: readonly AppliedMigration[] } {
  const applied: AppliedMigration[] = [];
  
  if (!payload || typeof payload !== 'object') {
    return { migratedPayload: {}, applied };
  }

  // Deep copy raw payload
  let currentPayload = JSON.parse(JSON.stringify(payload));
  const currentVersion = currentPayload?.meta?.version ?? 1;

  if (currentVersion >= targetVersion) {
    return { migratedPayload: currentPayload, applied };
  }

  let versionIter = currentVersion;
  while (versionIter < targetVersion) {
    const step = MIGRATION_STEPS.find(s => s.from === versionIter);
    if (!step) {
      break; // No migration step registered for this version path
    }
    currentPayload = step.migrate(currentPayload);
    applied.push({ from: step.from, to: step.to });
    versionIter = step.to;
  }

  return { migratedPayload: currentPayload, applied };
}
