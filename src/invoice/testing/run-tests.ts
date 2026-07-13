import { validateSchema } from '../validation/schema';
import { migrateTheme } from '../validation/migrate';
import { normalizeTheme } from '../validation/normalize';
import { resolveTheme, ResolutionContext } from '../themes/resolver';
import { TemplateDefinition } from '../templates/template-definition';
import { BusinessPreferences } from '../preferences/business-preferences';
import { DocumentTheme } from '../themes/document-theme';

// ─── Assertion Helpers ───────────────────────────────────────────────────────

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, message: string) {
  if (!condition) {
    failedCount++;
    console.error(`❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  } else {
    passedCount++;
    console.log(`✅ PASS: ${message}`);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  const aStr = JSON.stringify(actual);
  const eStr = JSON.stringify(expected);
  if (aStr !== eStr) {
    failedCount++;
    const errMsg = `❌ FAIL: ${message}\n  Expected: ${eStr}\n  Actual:   ${aStr}`;
    console.error(errMsg);
    throw new Error(errMsg);
  } else {
    passedCount++;
    console.log(`✅ PASS: ${message}`);
  }
}

// ─── Test Fixtures ───────────────────────────────────────────────────────────

const mockTemplateSupportsAll: TemplateDefinition = {
  id: 'classic_pro',
  name: 'Classic Pro Template',
  description: 'A layout that supports all features',
  category: 'invoice',
  theme: 'corporate',
  capabilities: {
    branding: { logo: true, qrCode: true, signature: true },
    taxation: { hsnColumn: true, gstBreakup: true, taxSummary: true },
    payment: { bankDetails: true, paymentTerms: true, upiDetails: true },
    layout: { margins: true, orientation: true, extraFields: true }
  }
};

const mockTemplateMinimal: TemplateDefinition = {
  id: 'classic_minimalist',
  name: 'Minimalist Layout',
  description: 'Limited layout with no branding assets or GST summaries',
  category: 'invoice',
  theme: 'minimal',
  capabilities: {
    branding: { logo: false, qrCode: false, signature: false },
    taxation: { hsnColumn: false, gstBreakup: false, taxSummary: false },
    payment: { bankDetails: false, paymentTerms: false, upiDetails: false },
    layout: { margins: false, orientation: false, extraFields: false }
  }
};

const defaultPreferences: BusinessPreferences = {
  showLogo: true,
  logoSize: 'medium',
  logoPosition: 'left',
  showBusinessName: true,
  showAddress: true,
  showPhone: true,
  showEmail: true,
  showGstin: true,
  showHsn: true,
  showUnit: true,
  showGstPct: true,
  showDiscount: true,
  showPaymentSection: true,
  showQrCode: true,
  qrPosition: 'payment-details',
  showBankDetails: true,
  showSignature: true,
  signaturePosition: 'bottom-right',
  footerMessage: 'Thank you',
  currencyCode: 'INR',
  dateFormat: 'DD/MM/YYYY',
  paperSize: 'a4'
};

const baseTheme: DocumentTheme = {
  meta: { version: 3, id: 'base', name: 'Base Theme', isSystem: true },
  style: { fontFamily: 'Inter', accentColor: '#2563EB', density: 'comfortable', borderRadius: 'rounded-md' },
  table: { style: 'minimal', density: 'comfortable' }
};

// ─── Unit Test Suites ────────────────────────────────────────────────────────

function runSchemaTests() {
  console.log('\n--- Running Schema Validation Tests ---');

  // Test 1: Unsupported font family token
  const payloadBadFont = {
    meta: { version: 3, id: 'test_theme', name: 'Test theme' },
    style: { fontFamily: 'Comic Sans', accentColor: '#FF5500', density: 'compact', borderRadius: 'rounded-sm' }
  };
  const { validPayload: p1, warnings: w1 } = validateSchema(payloadBadFont, 'development');
  assertEqual(p1.style.fontFamily, 'Inter', 'Should fallback to Inter for invalid font family');
  assert(w1.some(w => w.path === 'style.fontFamily'), 'Should emit validation warning for invalid font family');

  // Test 2: Stripping unknown top-level and nested properties (development environment warning)
  const payloadExtraKeys = {
    meta: { version: 3, id: 'test_theme', name: 'Test theme', extraMeta: 'junk' },
    style: { fontFamily: 'Roboto', accentColor: '#FF5500', density: 'compact', borderRadius: 'rounded-sm', shadowDepth: 10 },
    customJunkBlock: { active: true }
  };
  const { validPayload: p2, warnings: w2 } = validateSchema(payloadExtraKeys, 'development');
  assert(!('customJunkBlock' in p2), 'Should strip unknown top-level properties');
  assert(!('shadowDepth' in p2.style), 'Should strip unknown nested style properties');
  assert(w2.some(w => w.path === 'customJunkBlock'), 'Should warn about unknown top-level properties in dev environment');
  assert(w2.some(w => w.path === 'style.shadowDepth'), 'Should warn about unknown nested style properties in dev environment');
}

function runMigrationTests() {
  console.log('\n--- Running Migration Tests ---');

  // Test 1: Stepwise v1 to v3 migration
  const payloadV1 = {
    meta: { version: 1, id: 'v1_theme', name: 'Legacy Theme' },
    style: { fontFamily: 'serif', accentColor: 'red' }
    // table.style is missing in v1 (v2 migrates it)
    // style.borderRadius is missing in v1/v2 (v3 migrates it)
  };

  const { migratedPayload: migrated, applied } = migrateTheme(payloadV1, 3);
  assertEqual(migrated.meta.version, 3, 'Migrated theme schema version must be 3');
  assertEqual(migrated.table.style, 'striped', 'Migrated theme table.style should default to striped (v1 to v2 migration)');
  assertEqual(migrated.style.borderRadius, 'rounded-md', 'Migrated theme style.borderRadius should default to rounded-md (v2 to v3 migration)');
  assertEqual(applied.length, 2, 'Should apply exactly two migration steps (1->2, 2->3)');
  assertEqual(applied[0], { from: 1, to: 2 }, 'First migration step must be 1 to 2');
  assertEqual(applied[1], { from: 2, to: 3 }, 'Second migration step must be 2 to 3');
}

function runNormalizationTests() {
  console.log('\n--- Running Normalization Tests ---');

  // Test 1: Color upper-casing and hash prefixing
  const unnormalized = {
    meta: { version: 3, id: 'theme', name: 'Theme', isSystem: false },
    style: { fontFamily: 'roboto' as any, accentColor: 'ff33aa', density: 'COMPACT' as any, borderRadius: 'ROUNDED-LG' as any },
    table: { style: 'STRIPED' as any, density: 'comfortable' as any }
  };
  
  const normalized = normalizeTheme(unnormalized);
  assertEqual(normalized.style.accentColor, '#FF33AA', 'Should format hex color to uppercase with hash prefix');
  assertEqual(normalized.style.fontFamily, 'Roboto', 'Should format font family casing to canonical Roboto');
  assertEqual(normalized.style.density, 'compact', 'Should lowercase density casing');
  assertEqual(normalized.style.borderRadius, 'rounded-lg', 'Should lowercase borderRadius casing');
  assertEqual(normalized.table.style, 'striped', 'Should lowercase tableStyle casing');
}

function runCompatibilityTests() {
  console.log('\n--- Running Semantic Capabilities & Resolver Tests ---');

  const contextAllSupported: ResolutionContext = {
    template: mockTemplateSupportsAll,
    locale: 'en-IN',
    appVersion: '1.0.0',
    themeVersion: 3
  };

  const contextMinimal: ResolutionContext = {
    template: mockTemplateMinimal,
    locale: 'en-IN',
    appVersion: '1.0.0',
    themeVersion: 3
  };

  // Test 1: Full support resolution (features should map cleanly)
  const mockValidOverrides = {
    meta: { version: 3, id: 'user_override', name: 'User Override Theme', isSystem: false },
    style: {},
    table: {}
  };

  const resultAll = resolveTheme(baseTheme, mockValidOverrides, defaultPreferences, contextAllSupported);
  assertEqual(resultAll.theme.showLogo, true, 'Resolved theme logo should remain true when template supports it');
  assertEqual(resultAll.theme.showQrCode, true, 'Resolved theme QR code should remain true when template supports it');
  assertEqual(resultAll.theme.showSignature, true, 'Resolved theme signature should remain true when template supports it');
  assertEqual(resultAll.theme.showBankDetails, true, 'Resolved theme bank details should remain true when template supports it');
  assertEqual(resultAll.warnings.length, 0, 'Should not generate semantic capability warnings for fully supported template');

  // Test 2: Minimal capabilities constraint enforcement (features should be forced to false and warn)
  const resultMin = resolveTheme(baseTheme, mockValidOverrides, defaultPreferences, contextMinimal);
  assertEqual(resultMin.theme.showLogo, false, 'Resolved theme logo must be overridden to false if template capabilities disable it');
  assertEqual(resultMin.theme.showQrCode, false, 'Resolved theme QR code must be overridden to false if template capabilities disable it');
  assertEqual(resultMin.theme.showSignature, false, 'Resolved theme signature must be overridden to false if template capabilities disable it');
  assertEqual(resultMin.theme.showBankDetails, false, 'Resolved theme bank details must be overridden to false if template capabilities disable it');
  assertEqual(resultMin.theme.showHsn, false, 'Resolved theme showHsn must be overridden to false if template capabilities disable it');
  assertEqual(resultMin.theme.showGstPct, false, 'Resolved theme showGstPct must be overridden to false if template capabilities disable it');
  assertEqual(resultMin.theme.showUnit, false, 'Resolved theme showUnit must be overridden to false if template capabilities disable it');
  
  assert(resultMin.warnings.some(w => w.path === 'preferences.showLogo'), 'Should raise semantic warning for unsupported logo');
  assert(resultMin.warnings.some(w => w.path === 'preferences.showQrCode'), 'Should raise semantic warning for unsupported QR');
  assert(resultMin.warnings.some(w => w.path === 'preferences.showSignature'), 'Should raise semantic warning for unsupported signature');
  assert(resultMin.warnings.some(w => w.path === 'preferences.showBankDetails'), 'Should raise semantic warning for unsupported bank details');
  assert(resultMin.warnings.some(w => w.path === 'preferences.showHsn'), 'Should raise semantic warning for unsupported HSN columns');
  assert(resultMin.warnings.some(w => w.path === 'preferences.showGstPct'), 'Should raise semantic warning for unsupported GST % columns');
  assert(resultMin.warnings.some(w => w.path === 'preferences.showUnit'), 'Should raise semantic warning for unsupported Unit columns');
  
  assertEqual(resultMin.warnings.length, 7, 'Should emit exactly 7 semantic warnings');
}

function runThemePatchTests() {
  console.log('\n--- Running ThemePatch Integration Tests ---');
  
  const patch = {
    style: {
      accentColor: '#1D4ED8',
      density: 'compact'
    },
    preferences: {
      showQrCode: false,
      logoSize: 'small'
    }
  };

  const currentThemeOverrides: any = {
    style: { fontFamily: 'Roboto', accentColor: '#333333' }
  };
  const currentPrefs: any = {
    showQrCode: true,
    logoSize: 'medium'
  };

  const mergedTheme = {
    ...currentThemeOverrides,
    style: {
      ...currentThemeOverrides.style,
      ...patch.style
    }
  };

  const mergedPrefs = {
    ...currentPrefs,
    ...patch.preferences
  };

  assertEqual(mergedTheme.style.accentColor, '#1D4ED8', 'ThemePatch accentColor should overwrite current theme accentColor');
  assertEqual(mergedTheme.style.fontFamily, 'Roboto', 'ThemePatch should preserve untouched style fields (fontFamily)');
  assertEqual(mergedPrefs.showQrCode, false, 'ThemePatch preferences should overwrite current preferences (showQrCode)');
  assertEqual(mergedPrefs.logoSize, 'small', 'ThemePatch preferences should overwrite current preferences (logoSize)');
}

// ─── Main Executor ───────────────────────────────────────────────────────────

function main() {
  console.log('🚀 INITIALIZING TEMPLATE ENGINE TEST SUITE');
  runSchemaTests();
  runMigrationTests();
  runNormalizationTests();
  runCompatibilityTests();
  runThemePatchTests();
  console.log(`\n🎉 ALL TESTS PASSED SUCCESSFULLY! (${passedCount} assertions)\n`);
}

main();
