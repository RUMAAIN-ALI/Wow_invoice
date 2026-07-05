/**
 * Density Design Token: Controls the visual tightness of layout margins, paddings, and column spacing.
 */
export type Density = 'compact' | 'comfortable' | 'spacious';

/**
 * Header Style Design Token: Defines structural variation of the document header.
 */
export type HeaderStyle = 'classic' | 'modern' | 'minimal' | 'split' | 'band';

/**
 * Table Style Design Token: Controls grid rendering structure.
 */
export type TableStyle = 'minimal' | 'striped' | 'bordered';

/**
 * Logo Size Design Token: Controls the relative scale of the business logo.
 */
export type LogoSize = 'small' | 'medium' | 'large';

/**
 * Border Radius Design Token: Defines card/box corner rounding style.
 */
export type BorderRadius = 'none' | 'square' | 'rounded-sm' | 'rounded-md' | 'rounded-lg';

/**
 * Font Family Design Token: Supported fonts for layout typography.
 */
export type FontFamily = 'sans-serif' | 'serif' | 'monospace' | 'Inter' | 'Georgia' | 'Roboto' | 'Helvetica Neue' | 'Arial';

/**
 * Paper Size Design Token: Targets standard print sheet sizes.
 */
export type PaperSize = 'a4' | 'thermal_80' | 'thermal_58';

/**
 * Currency Format Token: Standard code for currency/symbol rules.
 */
export type CurrencyFormat = 'INR' | 'USD' | 'EUR';

/**
 * Date Format Token: Standard patterns for formatting timestamps.
 */
export type DateFormat = 'DD/MM/YYYY' | 'DD-MM-YYYY' | 'YYYY-MM-DD' | 'DD MMMM YYYY';

/**
 * QR Position Token: Supported positions for payment/verification codes.
 */
export type QRPosition = 'header-right' | 'footer-left' | 'footer-right' | 'payment-details';

/**
 * Signature Position Token: Layout position for the authorized signatory block.
 */
export type SignaturePosition = 'bottom-right' | 'bottom-left' | 'center';

/**
 * Logo Position Token: Horizontal alignment of the business logo within the header.
 */
export type LogoPosition = 'left' | 'center' | 'right';
