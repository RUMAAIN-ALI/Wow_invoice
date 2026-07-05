/**
 * Branding Capabilities: Defines what branding elements a template structure is capable of rendering.
 */
export interface BrandingCapabilities {
  readonly logo: boolean;
  readonly qrCode: boolean;
  readonly signature: boolean;
}

/**
 * Taxation Capabilities: Defines what taxation tables and sections a template structure can display.
 */
export interface TaxationCapabilities {
  readonly hsnColumn: boolean;
  readonly gstBreakup: boolean;
  readonly taxSummary: boolean;
}

/**
 * Payment Capabilities: Defines what payment sections a template structure can render.
 */
export interface PaymentCapabilities {
  readonly bankDetails: boolean;
  readonly paymentTerms: boolean;
  readonly upiDetails: boolean;
}

/**
 * Layout Capabilities: Defines structural properties supported by a template layout.
 */
export interface LayoutCapabilities {
  readonly margins: boolean;
  readonly orientation: boolean; // portrait vs landscape
  readonly extraFields: boolean; // support for custom text/label fields
}

/**
 * Template Capabilities: Groups all declarative structural abilities of a template.
 * Rendering modules consult these values before attempting to render corresponding DOM blocks.
 */
export interface TemplateCapabilities {
  readonly branding: BrandingCapabilities;
  readonly taxation: TaxationCapabilities;
  readonly payment: PaymentCapabilities;
  readonly layout: LayoutCapabilities;
}
