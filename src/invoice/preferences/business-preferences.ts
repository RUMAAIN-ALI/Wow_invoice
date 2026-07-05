import { PaperSize, CurrencyFormat, DateFormat, QRPosition, SignaturePosition, LogoSize, LogoPosition } from '../themes/design-tokens';

/**
 * Business Preferences: Immutable flags representing what information is displayed.
 * Decoupled from pure styling (Theme) and layout definitions.
 */
export interface BusinessPreferences {
  // Brand visibility
  readonly showLogo: boolean;
  readonly logoSize: LogoSize;
  readonly logoPosition: LogoPosition;
  readonly showBusinessName: boolean;
  readonly showAddress: boolean;
  readonly showPhone: boolean;
  readonly showEmail: boolean;
  readonly showGstin: boolean;

  // Table Column Functional Toggles
  readonly showHsn: boolean;
  readonly showUnit: boolean;
  readonly showGstPct: boolean;
  readonly showDiscount: boolean;

  // Payments & Footer
  readonly showPaymentSection: boolean;
  readonly showQrCode: boolean;
  readonly qrPosition: QRPosition;
  readonly showBankDetails: boolean;
  readonly showSignature: boolean;
  readonly signaturePosition: SignaturePosition;
  readonly footerMessage: string | null;

  // Localization & Format
  readonly currencyCode: CurrencyFormat;
  readonly dateFormat: DateFormat;
  readonly paperSize: PaperSize;
}
