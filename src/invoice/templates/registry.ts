import { TemplateDefinition } from './template-definition';

export const SYSTEM_TEMPLATES: Record<string, TemplateDefinition> = {
  classic: {
    id: 'classic',
    name: 'Classic Design',
    description: 'Traditional two-column layout with brand accent bar',
    capabilities: {
      branding: { logo: true, qrCode: true, signature: true },
      taxation: { hsnColumn: true, gstBreakup: true, taxSummary: true },
      payment: { bankDetails: true, paymentTerms: true, upiDetails: true },
      layout: { margins: true, orientation: true, extraFields: true }
    }
  },
  modern: {
    id: 'modern',
    name: 'Modern Design',
    description: 'Contemporary full-width colored header band styling',
    capabilities: {
      branding: { logo: true, qrCode: true, signature: true },
      taxation: { hsnColumn: true, gstBreakup: true, taxSummary: true },
      payment: { bankDetails: true, paymentTerms: true, upiDetails: true },
      layout: { margins: true, orientation: true, extraFields: true }
    }
  },
  minimal: {
    id: 'minimal',
    name: 'Minimalist Design',
    description: 'Sophisticated black & white serif layout with clean ruled lines',
    capabilities: {
      branding: { logo: false, qrCode: true, signature: true }, // Supports UPI text printing
      taxation: { hsnColumn: true, gstBreakup: true, taxSummary: true },
      payment: { bankDetails: true, paymentTerms: true, upiDetails: true },
      layout: { margins: false, orientation: false, extraFields: true }
    }
  },
  letterhead: {
    id: 'letterhead',
    name: 'Letterhead Design',
    description: 'Corporate letterhead styling with a large header and formal signature block',
    capabilities: {
      branding: { logo: true, qrCode: true, signature: true },
      taxation: { hsnColumn: true, gstBreakup: true, taxSummary: true },
      payment: { bankDetails: true, paymentTerms: true, upiDetails: true },
      layout: { margins: true, orientation: true, extraFields: true }
    }
  },
  thermal: {
    id: 'thermal',
    name: 'Thermal / Compact',
    description: 'Single-column receipt layout optimized for 58mm/80mm thermal printers',
    capabilities: {
      branding: { logo: false, qrCode: false, signature: false },
      taxation: { hsnColumn: false, gstBreakup: true, taxSummary: true },
      payment: { bankDetails: false, paymentTerms: false, upiDetails: true },
      layout: { margins: false, orientation: false, extraFields: false }
    }
  }
};
