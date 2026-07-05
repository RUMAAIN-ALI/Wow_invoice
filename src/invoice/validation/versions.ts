/**
 * CURRENT_THEME_VERSION: The latest supported schema version of the DocumentTheme configuration.
 */
export const CURRENT_THEME_VERSION = 3;

/**
 * MigrationStep: Describes a stepwise upgrade from one specific version to the next.
 */
export interface MigrationStep {
  readonly from: number;
  readonly to: number;
  readonly migrate: (payload: any) => any;
}

/**
 * MIGRATION_STEPS: Registered upgrade handlers for sequential schema migrations.
 */
export const MIGRATION_STEPS: readonly MigrationStep[] = [
  {
    from: 1,
    to: 2,
    migrate(payload: any): any {
      // Step 1 to 2: In v1, table style was missing; v2 defaults table.style to 'striped'
      const updated = { ...payload };
      if (!updated.table) {
        updated.table = {};
      }
      if (!updated.table.style) {
        updated.table.style = 'striped';
      }
      if (updated.meta) {
        updated.meta = { ...updated.meta, version: 2 };
      }
      return updated;
    }
  },
  {
    from: 2,
    to: 3,
    migrate(payload: any): any {
      // Step 2 to 3: In v2, border radius was absent; v3 maps it to strict token 'rounded-md'
      const updated = { ...payload };
      if (!updated.style) {
        updated.style = {};
      }
      if (updated.style.borderRadius === undefined) {
        updated.style.borderRadius = 'rounded-md';
      }
      if (updated.meta) {
        updated.meta = { ...updated.meta, version: 3 };
      }
      return updated;
    }
  }
];
