import { TemplateDefinition } from '../templates/template-definition';
import { DocumentTheme } from './document-theme';
import { BusinessPreferences } from '../preferences/business-preferences';
import { ResolvedTheme } from './resolved-theme';
import { validateSchema, ValidationWarning } from '../validation/schema';
import { migrateTheme, AppliedMigration } from '../validation/migrate';
import { normalizeTheme } from '../validation/normalize';
import { Density, BorderRadius, LogoSize } from './design-tokens';

/**
 * ResolutionContext: Static environmental details passed into the resolver.
 */
export interface ResolutionContext {
  readonly template: TemplateDefinition;
  readonly locale: string;                // e.g. "en-IN"
  readonly appVersion: string;
  readonly themeVersion: number;
}

/**
 * ResolutionResult: Diagnostics and output theme produced by the pipeline.
 */
export interface ResolutionResult {
  readonly theme: ResolvedTheme;
  readonly warnings: readonly ValidationWarning[];
  readonly migrations: readonly AppliedMigration[];
}

// ─── Token Mappers ───────────────────────────────────────────────────────────

const ITEM_GAP_MAP: Record<Density, number> = {
  compact: 4,
  comfortable: 8,
  spacious: 16,
};

const FONT_SIZE_MAP: Record<Density, number> = {
  compact: 11,
  comfortable: 13,
  spacious: 16,
};

const BORDER_RADIUS_MAP: Record<BorderRadius, number> = {
  none: 0,
  square: 2,
  'rounded-sm': 4,
  'rounded-md': 8,
  'rounded-lg': 16,
};

const LOGO_HEIGHT_MAP: Record<LogoSize, number> = {
  small: 40,
  medium: 60,
  large: 90,
};

const TABLE_PADDING_MAP: Record<Density, string> = {
  compact: '4px 8px',
  comfortable: '8px 10px',
  spacious: '12px 18px',
};

/**
 * computeFingerprint: A fast, pure, deterministic hash algorithm (FNV-1a)
 * generating hex identifiers for caching and print validation.
 */
function computeFingerprint(
  templateId: string,
  theme: DocumentTheme,
  pref: BusinessPreferences,
  ctx: ResolutionContext
): string {
  const content = [
    templateId,
    theme.meta.id,
    theme.meta.version,
    theme.style.fontFamily,
    theme.style.accentColor,
    theme.style.density,
    theme.style.borderRadius,
    theme.table.style,
    theme.table.density,
    pref.showLogo,
    pref.logoSize,
    pref.showQrCode,
    pref.qrPosition,
    pref.showBankDetails,
    pref.showSignature,
    pref.signaturePosition,
    pref.currencyCode,
    pref.dateFormat,
    pref.paperSize,
    ctx.locale,
    ctx.themeVersion,
  ].join('|');

  let hash = 2166136261 >>> 0;
  for (let i = 0; i < content.length; i++) {
    hash ^= content.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash.toString(16).toUpperCase().padStart(8, '0');
}

/**
 * resolveTheme: Pipelines visual overrides and preferences against template constraints.
 */
export function resolveTheme(
  baseTheme: DocumentTheme,
  userOverrides: any,
  preferences: BusinessPreferences,
  context: ResolutionContext,
  env: 'development' | 'production' = 'production'
): ResolutionResult {
  const warningsList: ValidationWarning[] = [];

  // 1. Version Migration
  const { migratedPayload, applied: migrationsApplied } = migrateTheme(userOverrides, context.themeVersion);

  // 2. Schema Validation
  const { validPayload: schemaValidatedOverrides, warnings: schemaWarnings } = validateSchema(migratedPayload, env);
  warningsList.push(...schemaWarnings);

  // 3. Normalization
  const normalizedOverrides = normalizeTheme(schemaValidatedOverrides);

  // 4. Composition (Merge base and overrides)
  const mergedTheme: DocumentTheme = {
    meta: {
      ...baseTheme.meta,
      ...normalizedOverrides.meta,
    },
    style: {
      fontFamily: normalizedOverrides.style?.fontFamily ?? baseTheme.style.fontFamily,
      accentColor: normalizedOverrides.style?.accentColor ?? baseTheme.style.accentColor,
      density: normalizedOverrides.style?.density ?? baseTheme.style.density,
      borderRadius: normalizedOverrides.style?.borderRadius ?? baseTheme.style.borderRadius,
    },
    table: {
      style: normalizedOverrides.table?.style ?? baseTheme.table.style,
      density: normalizedOverrides.table?.density ?? baseTheme.table.density,
    },
  };

  // 5. Semantic Validation (Verify template capabilities & enforce limits)
  const capabilities = context.template.capabilities;

  let showLogo = preferences.showLogo;
  if (showLogo && !capabilities.branding.logo) {
    showLogo = false;
    warningsList.push({
      path: 'preferences.showLogo',
      message: `Template '${context.template.id}' does not support logo rendering; logo disabled.`
    });
  }

  let showQrCode = preferences.showQrCode;
  if (showQrCode && !capabilities.branding.qrCode) {
    showQrCode = false;
    warningsList.push({
      path: 'preferences.showQrCode',
      message: `Template '${context.template.id}' does not support QR rendering; QR code disabled.`
    });
  }

  let showSignature = preferences.showSignature;
  if (showSignature && !capabilities.branding.signature) {
    showSignature = false;
    warningsList.push({
      path: 'preferences.showSignature',
      message: `Template '${context.template.id}' does not support signatures; signature block disabled.`
    });
  }

  let showBankDetails = preferences.showBankDetails;
  if (showBankDetails && !capabilities.payment.bankDetails) {
    showBankDetails = false;
    warningsList.push({
      path: 'preferences.showBankDetails',
      message: `Template '${context.template.id}' does not support bank details; section disabled.`
    });
  }

  let showHsn = preferences.showHsn;
  if (showHsn && !capabilities.taxation.hsnColumn) {
    showHsn = false;
    warningsList.push({
      path: 'preferences.showHsn',
      message: `Template '${context.template.id}' does not support HSN columns; HSN column disabled.`
    });
  }

  let showGstPct = preferences.showGstPct;
  if (showGstPct && !capabilities.taxation.gstBreakup) {
    showGstPct = false;
    warningsList.push({
      path: 'preferences.showGstPct',
      message: `Template '${context.template.id}' does not support GST percentage display; GST column disabled.`
    });
  }

  const showUnit = preferences.showUnit;

  const showDiscount = preferences.showDiscount;

  // 6. Token mapping & final object expansion
  const resolved: ResolvedTheme = {
    fingerprint: computeFingerprint(context.template.id, mergedTheme, preferences, context),

    // Resolved layout styles
    fontFamily: mergedTheme.style.fontFamily,
    accentColor: mergedTheme.style.accentColor,
    itemGapPx: ITEM_GAP_MAP[mergedTheme.style.density],
    fontSizeBasePx: FONT_SIZE_MAP[mergedTheme.style.density],
    borderRadiusPx: BORDER_RADIUS_MAP[mergedTheme.style.borderRadius],
    tableStyle: mergedTheme.table.style,
    tableCellPadding: TABLE_PADDING_MAP[mergedTheme.table.density],

    // Resolved capabilities/preferences visibility flags
    showLogo,
    logoHeightPx: LOGO_HEIGHT_MAP[preferences.logoSize],
    showBusinessName: preferences.showBusinessName,
    showAddress: preferences.showAddress && capabilities.layout.extraFields, // template address requires layout space
    showPhone: preferences.showPhone,
    showEmail: preferences.showEmail,
    showGstin: preferences.showGstin && capabilities.taxation.gstBreakup,
    
    // Table column visibility
    showHsn,
    showUnit,
    showGstPct,
    showDiscount,

    showPaymentSection: preferences.showPaymentSection && (capabilities.payment.upiDetails || capabilities.payment.bankDetails),
    showQrCode,
    qrPosition: preferences.qrPosition,
    showBankDetails,
    showSignature,
    signaturePosition: preferences.signaturePosition,

    // Formatter settings
    currencyCode: preferences.currencyCode,
    dateFormat: preferences.dateFormat,
    footerText: preferences.footerMessage ?? '',
  };

  return {
    theme: resolved,
    warnings: warningsList,
    migrations: migrationsApplied,
  };
}
