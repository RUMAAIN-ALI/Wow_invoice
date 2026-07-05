import { Platform } from 'react-native';
import { DocumentCategory, TemplateType } from '../types';

const ANTHROPIC_API_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? '';

// On web: requests go through the local proxy (node proxy.js) to avoid CORS.
// On native: requests go directly to Anthropic — no CORS restriction.
const CLAUDE_API_URL = Platform.OS === 'web'
  ? 'http://localhost:3001/api/anthropic'
  : 'https://api.anthropic.com/v1/messages';

export async function getAiFieldSuggestions(
  documentName: string,
  category: DocumentCategory,
  templateType: TemplateType
): Promise<string[]> {
  const isWeb = Platform.OS === 'web';
  // On native, require the API key; on web the proxy supplies it server-side.
  if (!isWeb && !ANTHROPIC_API_KEY) return [];

  const context = templateType === 'record_form'
    ? 'This is a service form or record (NOT an invoice). Do not include item table, qty, price, or amount fields.'
    : 'This is a billing/invoice document. Do not include item table fields — only header fields like customer name, due date, notes.';

  const body = {
    model: 'claude-opus-4-8',
    max_tokens: 256,
    messages: [{
      role: 'user',
      content: `List 5-7 field names for a "${documentName}" document (category: ${category}).
${context}
Return ONLY a JSON array of short field name strings, nothing else.
Example: ["Customer Name", "Date", "Reference No", "Notes"]`,
    }],
  };

  const headers: Record<string, string> = {
    'Content-Type':      'application/json',
    'anthropic-version': '2023-06-01',
  };
  if (!isWeb) headers['x-api-key'] = ANTHROPIC_API_KEY;

  try {
    const res = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) return [];

    const json = await res.json() as { content: Array<{ type: string; text: string }> };
    const text = json.content?.[0]?.type === 'text' ? json.content[0].text.trim() : '';
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];

    const parsed = JSON.parse(match[0]);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}
