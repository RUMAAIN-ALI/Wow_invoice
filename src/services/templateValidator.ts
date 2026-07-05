import {
  RendererType, TemplateStyle,
  ValidationResult, SanitizationResult, StaticSignature, TemplateConfig,
} from '../types';
import { sanitizeHtml, MAX_HTML_BYTES } from './htmlSanitizer';

// ─── Placeholder registry ─────────────────────────────────────────────────────

const ALL_KNOWN_PLACEHOLDERS = new Set([
  '%%BUSINESS_NAME%%', '%%BUSINESS_ADDRESS%%', '%%BUSINESS_GSTIN%%',
  '%%BUSINESS_PHONE%%', '%%BUSINESS_EMAIL%%',  '%%BUSINESS_CONTACT%%',
  '%%BRAND_COLOR%%',   '%%DOC_TYPE%%',         '%%DOC_NUMBER%%',
  '%%DOC_DATE%%',      '%%BILL_TO%%',          '%%ITEMS_TABLE%%',
  '%%TOTALS_BLOCK%%',  '%%EXTRAS_BLOCK%%',     '%%SIGNATURE_BLOCK%%',
  '%%SUBTOTAL%%',      '%%TOTAL%%',
]);

// Required placeholders per InvoiceDocumentType (canonical %% format)
const REQUIRED_PLACEHOLDERS: Record<string, string[]> = {
  invoice:        ['%%DOC_NUMBER%%', '%%DOC_DATE%%', '%%ITEMS_TABLE%%', '%%TOTAL%%', '%%BUSINESS_NAME%%'],
  tax_invoice:    ['%%DOC_NUMBER%%', '%%DOC_DATE%%', '%%ITEMS_TABLE%%', '%%TOTAL%%', '%%BUSINESS_NAME%%'],
  bill:           ['%%DOC_NUMBER%%', '%%DOC_DATE%%', '%%ITEMS_TABLE%%', '%%TOTAL%%', '%%BUSINESS_NAME%%'],
  receipt:        ['%%DOC_NUMBER%%', '%%DOC_DATE%%',                    '%%TOTAL%%', '%%BUSINESS_NAME%%'],
  quotation:      ['%%DOC_NUMBER%%', '%%DOC_DATE%%', '%%ITEMS_TABLE%%',              '%%BUSINESS_NAME%%'],
  purchase_order: ['%%DOC_NUMBER%%', '%%DOC_DATE%%', '%%ITEMS_TABLE%%', '%%TOTAL%%', '%%BUSINESS_NAME%%'],
  delivery_note:  ['%%DOC_NUMBER%%', '%%DOC_DATE%%', '%%ITEMS_TABLE%%',              '%%BUSINESS_NAME%%'],
};

// ─── Validator interface ──────────────────────────────────────────────────────

interface TemplateValidator {
  validate(payload: string, documentType: string): ValidationResult;
}

// ─── HTML validator ───────────────────────────────────────────────────────────

class HtmlTemplateValidator implements TemplateValidator {
  validate(rawHtml: string, documentType: string): ValidationResult {
    const sanitization = sanitizeHtml(rawHtml);
    const html         = sanitization.html;

    // Structural HTML check (lightweight)
    const validHtml =
      /<!doctype\s+html/i.test(html) &&
      /<html[\s>]/i.test(html)       &&
      /<body[\s>]/i.test(html)       &&
      /<\/html>/i.test(html);

    // Placeholder scan
    const found      = new Set<string>();
    const unknown: string[] = [];
    let match: RegExpExecArray | null;
    const re = /%%[A-Z_]+%%/g;
    while ((match = re.exec(html)) !== null) {
      const p = match[0];
      if (ALL_KNOWN_PLACEHOLDERS.has(p)) found.add(p);
      else if (!unknown.includes(p))     unknown.push(p);
    }

    const required = REQUIRED_PLACEHOLDERS[documentType] ?? REQUIRED_PLACEHOLDERS['invoice'];
    const missing  = required.filter(p => !found.has(p));

    const requiredSectionsPresent =
      found.has('%%BUSINESS_NAME%%') && found.has('%%ITEMS_TABLE%%');

    // Tags that should not survive sanitization
    const unsupportedTags: string[] = [];
    for (const tag of ['script', 'iframe', 'form', 'object', 'embed']) {
      if (new RegExp(`<${tag}[\\s>]`, 'i').test(html)) unsupportedTags.push(tag);
    }

    const passed =
      validHtml                       &&
      missing.length          === 0   &&
      unsupportedTags.length  === 0   &&
      requiredSectionsPresent         &&
      sanitization.htmlSizeBytes <= MAX_HTML_BYTES;

    return {
      passed,
      validHtml,
      placeholdersMissing:      missing,
      placeholdersUnknown:      unknown,
      requiredSectionsPresent,
      unsupportedTags,
      htmlSizeBytes:            sanitization.htmlSizeBytes,
      sanitization,
      validatedAt:              new Date().toISOString(),
    };
  }
}

// ─── Form (TemplateConfig) validator ─────────────────────────────────────────

class FormTemplateValidator implements TemplateValidator {
  validate(payload: string, _documentType: string): ValidationResult {
    const emptySanitization: SanitizationResult = {
      html:                    payload,
      htmlSizeBytes:           payload.length,
      removedScripts:          0,
      removedEventHandlers:    0,
      removedExternalResources:0,
      removedDangerousTags:    0,
      safe:                    true,
    };

    let config: TemplateConfig;
    try {
      config = JSON.parse(payload) as TemplateConfig;
    } catch {
      return {
        passed:                   false,
        validHtml:                false,
        placeholdersMissing:      [],
        placeholdersUnknown:      [],
        requiredSectionsPresent:  false,
        unsupportedTags:          [],
        htmlSizeBytes:            payload.length,
        sanitization:             emptySanitization,
        validatedAt:              new Date().toISOString(),
      };
    }

    const hasIdentity = !!config.identity?.prefix;
    const hasItems    = Array.isArray(config.items?.columns) && config.items.columns.length > 0;
    const requiredSectionsPresent = hasIdentity && hasItems;

    return {
      passed:                   requiredSectionsPresent,
      validHtml:                true,
      placeholdersMissing:      [],
      placeholdersUnknown:      [],
      requiredSectionsPresent,
      unsupportedTags:          [],
      htmlSizeBytes:            payload.length,
      sanitization:             emptySanitization,
      validatedAt:              new Date().toISOString(),
    };
  }
}

// ─── Registry ─────────────────────────────────────────────────────────────────

const htmlValidator = new HtmlTemplateValidator();
const formValidator = new FormTemplateValidator();

export const validatorRegistry = {
  get(rendererType: RendererType): TemplateValidator {
    return rendererType === 'html' ? htmlValidator : formValidator;
  },
};

export function validateTemplate(
  payload:      string,
  rendererType: RendererType,
  documentType: string,
): ValidationResult {
  return validatorRegistry.get(rendererType).validate(payload, documentType);
}

// ─── Static signature ─────────────────────────────────────────────────────────

export function computeStaticSignature(
  html:         string,
  rendererType: RendererType,
  displayName?: string,
): StaticSignature {
  const usesThemeColor  = html.includes('%%BRAND_COLOR%%');
  const allPlaceholders = [...html.matchAll(/%%[A-Z_]+%%/g)].map(m => m[0]);
  const placeholderCount = new Set(allPlaceholders).size;
  const imageCount      = (html.match(/<img\b/gi) ?? []).length;
  const tableCount      = (html.match(/<table\b/gi) ?? []).length;
  const styleBlocks     = html.match(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)?.join('') ?? '';
  const cssRuleCount    = (styleBlocks.match(/[^{}]+\{[^{}]*\}/g) ?? []).length;

  return {
    rendererType,
    usesThemeColor,
    placeholderCount,
    imageCount,
    tableCount,
    cssRuleCount,
    displayName,
  };
}

// ─── Lifecycle status helper ──────────────────────────────────────────────────

export function getLifecycleStatus(
  state:          string,
  validationJson: ValidationResult | undefined,
): 'draft' | 'validated' | 'published' | 'archived' {
  if (state === 'published') return 'published';
  if (state === 'archived')  return 'archived';
  if (validationJson?.passed) return 'validated';
  return 'draft';
}
