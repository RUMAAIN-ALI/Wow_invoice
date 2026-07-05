import AsyncStorage from '@react-native-async-storage/async-storage';

const dk  = (id: string) => `inv_design_v1_${id}`;
const ahk = (id: string) => `inv_ai_html_v1_${id}`;
const ank = (id: string) => `inv_ai_name_v1_${id}`;

export async function getTemplateId(documentTypeId: string): Promise<string> {
  const v = await AsyncStorage.getItem(dk(documentTypeId));
  return v ?? 'classic';
}

export async function setTemplateId(documentTypeId: string, templateId: string): Promise<void> {
  await AsyncStorage.setItem(dk(documentTypeId), templateId);
}

export async function saveAiTemplate(id: string, name: string, html: string): Promise<void> {
  await AsyncStorage.multiSet([
    [ahk(id), html],
    [ank(id), name],
  ]);
}

export async function getAiTemplateHtml(id: string): Promise<string | null> {
  return AsyncStorage.getItem(ahk(id));
}

export interface AiTemplateEntry {
  id: string;   // full design id like "ai_uuid"
  name: string;
}

export async function listAiTemplates(): Promise<AiTemplateEntry[]> {
  const keys = await AsyncStorage.getAllKeys();
  const htmlKeys = keys.filter(k => k.startsWith('inv_ai_html_v1_'));
  const result: AiTemplateEntry[] = [];
  for (const key of htmlKeys) {
    const rawId = key.replace('inv_ai_html_v1_', '');
    const name  = (await AsyncStorage.getItem(ank(rawId))) ?? 'Custom AI Template';
    result.push({ id: `ai_${rawId}`, name });
  }
  return result;
}
