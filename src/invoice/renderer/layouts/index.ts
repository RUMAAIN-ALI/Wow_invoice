import { TemplateDefinition } from '../../templates/template-definition';
import { TemplateCategory } from '../../templates/template-category';
import { ResolvedTheme } from '../../themes/resolved-theme';
import { InvoiceData } from '../invoice-data';
import { renderInvoiceLayout } from './invoice-layout';

export type LayoutFn = (template: TemplateDefinition, theme: ResolvedTheme, data: InvoiceData) => string;

/**
 * CATEGORY_LAYOUTS: dispatch table from TemplateCategory to its layout
 * renderer. Only `invoice` is migrated so far (the pilot) — the other
 * categories are intentionally absent so renderInvoice() in renderer.ts
 * falls through to the pre-existing shape-branched code, leaving their
 * output unchanged until each is migrated the same way.
 */
export const CATEGORY_LAYOUTS: Partial<Record<TemplateCategory, LayoutFn>> = {
  invoice: renderInvoiceLayout,
};
