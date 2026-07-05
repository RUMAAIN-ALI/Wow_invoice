import { FontFamily, TableStyle, QRPosition, SignaturePosition, CurrencyFormat, DateFormat } from './design-tokens';

/**
 * Resolved Theme: Fully computed, flat object populated with all concrete visual & functional layout settings.
 * All optional and union flags are resolved. The renderer consumes this as a read-only parameter block.
 */
export interface ResolvedTheme {
  // Unique Identifier/Fingerprint
  readonly fingerprint: string;            // Hash representing base template + theme overrides + business preferences + version

  // Typography & Layout Spacings (Resolved from design tokens)
  readonly fontFamily: FontFamily;
  readonly accentColor: string;
  readonly itemGapPx: number;              // Concrete padding mapping to density
  readonly fontSizeBasePx: number;         // Concrete font size mapping to density
  readonly borderRadiusPx: number;         // Concrete border-radius mapping to borderRadius token
  readonly tableStyle: TableStyle;
  readonly tableCellPadding: string;       // Concrete padding mapping to table density

  // Visibility Flags (Resolved from Template Capabilities && Business Preferences)
  readonly showLogo: boolean;
  readonly logoHeightPx: number;           // Concrete dimension mapping to logoSize
  readonly showBusinessName: boolean;
  readonly showAddress: boolean;
  readonly showPhone: boolean;
  readonly showEmail: boolean;
  readonly showGstin: boolean;
  
  // Table Column Visibility
  readonly showHsn: boolean;
  readonly showUnit: boolean;
  readonly showGstPct: boolean;
  readonly showDiscount: boolean;

  readonly showPaymentSection: boolean;
  readonly showQrCode: boolean;
  readonly qrPosition: QRPosition;
  readonly showBankDetails: boolean;
  readonly showSignature: boolean;
  readonly signaturePosition: SignaturePosition;

  // Formatter Settings
  readonly currencyCode: CurrencyFormat;
  readonly dateFormat: DateFormat;
  readonly footerText: string;
}
