import { RenderInput } from '../../templates';
import { SYSTEM_TEMPLATES } from '../templates/registry';
import { DocumentTheme } from '../themes/document-theme';
import { BusinessPreferences } from '../preferences/business-preferences';
import { ResolutionContext, resolveTheme } from '../themes/resolver';
import { InvoiceData } from './invoice-data';
import { renderInvoice } from './renderer';

/**
 * renderLegacyInput: Compatibility adapter that maps the current system's RenderInput
 * properties to the new resolution pipeline, then invokes the pure renderInvoice function.
 */
export function renderLegacyInput(
  designId: string,
  input: RenderInput
): string {
  // 1. Map to structural TemplateDefinition
  const templateKey = SYSTEM_TEMPLATES[designId] ? designId : 'classic';
  const template = SYSTEM_TEMPLATES[templateKey];

  // 2. Map legacy BusinessSettings into BusinessPreferences
  const biz = input.business;
  const preferences: BusinessPreferences = {
    showLogo: !!biz.logo,
    logoSize: 'medium',
    logoPosition: 'left',
    showBusinessName: true,
    showAddress: !!biz.address,
    showPhone: !!biz.phone,
    showEmail: !!biz.email,
    showGstin: !!biz.gstin,
    showHsn: true,
    showUnit: true,
    showGstPct: true,
    showDiscount: true,
    showPaymentSection: !!(biz.upiId || biz.bankName || biz.accountNumber),
    showQrCode: !!biz.upiId,
    qrPosition: 'payment-details',
    showBankDetails: !!(biz.bankName || biz.accountNumber),
    showSignature: true,
    signaturePosition: 'bottom-right',
    footerMessage: biz.footerMessage ?? 'Payment Details',
    currencyCode: 'INR',
    dateFormat: 'DD MMMM YYYY', // Maps to legacy Indian date locale formatting
    paperSize: 'a4',
    ...(input.preferences || {})
  };

  // 3. Map legacy BusinessSettings brandColor to baseTheme
  const baseTheme: DocumentTheme = {
    meta: { version: 3, id: 'base_adapted', name: 'Adapted Base Theme', isSystem: true },
    style: {
      fontFamily: designId === 'minimal' ? 'Georgia' : (designId === 'modern' ? 'Helvetica Neue' : 'Arial'),
      accentColor: biz.brandColor || '#F97316',
      density: 'comfortable',
      borderRadius: 'rounded-md',
    },
    table: {
      style: 'striped',
      density: 'comfortable',
    },
  };

  // 4. Create Resolution Context
  const context: ResolutionContext = {
    template,
    locale: 'en-IN',
    appVersion: '1.0.0',
    themeVersion: 3,
  };

  // 5. Ingest data and item lists from DataMap
  const data = input.data || {};
  const itemRows: any[] = Array.isArray(data['Item Table']) ? data['Item Table'] : [];
  
  const items = itemRows
    .filter(r => r.name)
    .map(r => ({
      name: String(r.name ?? ''),
      qty: Number(r.qty ?? 0),
      price: Number(r.price ?? 0),
      hsn: r.hsn ? String(r.hsn) : undefined,
      unit: r.unit ? String(r.unit) : undefined,
      gstPct: r.gstPct != null ? Number(r.gstPct) : undefined,
      discount: r.discount != null ? Number(r.discount) : undefined,
      taxableValue: r.taxableValue != null ? Number(r.taxableValue) : undefined,
    }));

  const extraFields: any[] = Object.entries(data)
    .filter(([k, v]) => k !== 'Customer Name' && k !== 'Customer State' && !Array.isArray(v) && (v || v === 0))
    .map(([k, v]) => ({ label: k, value: v }));

  // 6. Assemble InvoiceData
  const invoiceData: InvoiceData = {
    recordNumber: input.record.number,
    recordCreatedAt: input.record.createdAt,
    documentTypeName: input.docName,
    customerName: typeof data['Customer Name'] === 'string' ? data['Customer Name'] : '',
    customerState: typeof data['Customer State'] === 'string' ? data['Customer State'] : undefined,
    items,
    extraFields,
    sellerName: biz.name,
    sellerAddress: biz.address ?? undefined,
    sellerGstin: biz.gstin ?? undefined,
    sellerState: biz.stateName ?? undefined,
    sellerPhone: biz.phone ?? undefined,
    sellerEmail: biz.email ?? undefined,
    sellerUpiId: biz.upiId ?? undefined,
    sellerBankName: biz.bankName ?? undefined,
    sellerAccountNumber: biz.accountNumber ?? undefined,
    sellerIfsc: biz.ifsc ?? undefined,
    sellerLogoUri: biz.logo ?? undefined,
    sellerSignatureUri: biz.signature ?? undefined,
  };

  // 7. Resolve Theme configuration
  const resolved = resolveTheme(baseTheme, input.themeOverrides || {}, preferences, context);

  // 8. Execute refactored pure renderer
  return renderInvoice(template, resolved.theme, invoiceData);
}
