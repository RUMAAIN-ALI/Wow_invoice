import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import { TemplateType, DocumentCategory } from '../types';
import { detectTemplateType } from '../constants';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type DocumentRoute = 'CreateGstInvoice' | 'FillRecord';

/**
 * Resolves which creation screen a document type should use.
 *
 * Rule priority:
 *   1. templateType (authoritative — comes from DB)
 *   2. detectTemplateType(name, category) — fallback for screens that don't
 *      have the DB value in scope
 *
 * Add new screen mappings here as dedicated screens are built.
 * Screens that call navigateToDocument never need to know about individual
 * screen names.
 */
function resolveScreen(
  documentTypeName: string,
  templateType?: TemplateType | string,
  category: DocumentCategory = 'billing',
): DocumentRoute {
  const type = templateType ?? detectTemplateType(documentTypeName, category);

  if (type === 'transaction_document') {
    const n = documentTypeName.toLowerCase();
    if (n.includes('gst')) return 'CreateGstInvoice';
    // Future: if (n.includes('invoice') || n.includes('bill')) return 'CreateInvoiceScreen';
  }

  return 'FillRecord';
}

/**
 * Navigate to the correct creation screen for a document type.
 * Use this everywhere instead of inline navigation.navigate('FillRecord'|'CreateGstInvoice').
 */
export function navigateToDocument(
  navigation: Nav,
  documentTypeId: string,
  documentTypeName: string,
  templateType?: TemplateType | string,
  category: DocumentCategory = 'billing',
): void {
  const screen = resolveScreen(documentTypeName, templateType, category);
  navigation.navigate(screen, { documentTypeId, documentTypeName });
}
