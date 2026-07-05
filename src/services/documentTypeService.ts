import { getSession } from './businessService';
import { getPublishedTemplates, getPinnedTemplates } from './templateService';
import { DocumentType } from '../types';

export async function getAllDocumentTypes(): Promise<DocumentType[]> {
  const { businessId } = getSession();
  return getPublishedTemplates(businessId) as Promise<DocumentType[]>;
}

export async function getPinnedDocumentTypes(): Promise<DocumentType[]> {
  const { businessId } = getSession();
  return getPinnedTemplates(businessId) as Promise<DocumentType[]>;
}
