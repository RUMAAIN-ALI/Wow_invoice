import { Platform } from 'react-native';
import { TemplateGenerationInput, GeneratedTemplateMetadata } from '../types';
import { ThemePatch } from '../invoice/themes/document-theme';
import { BusinessPreferences } from '../invoice/preferences/business-preferences';

const ANTHROPIC_API_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? '';
const CLAUDE_API_URL = Platform.OS === 'web'
  ? 'http://localhost:3001/api/anthropic'
  : 'https://api.anthropic.com/v1/messages';

// Sentinel chosen to be valid HTML (browser ignores it) and vanishingly unlikely
// to appear in AI-generated template content.
const END_SENTINEL = '<!-- @@END_TEMPLATE@@ -->';

const SYSTEM_PROMPT = `You are a professional invoice HTML template designer for Indian SMB businesses.

Generate a complete, self-contained A4 HTML template using ONLY these exact placeholder strings:
  %%BUSINESS_NAME%%      company name
  %%BUSINESS_ADDRESS%%   full address (may be empty)
  %%BUSINESS_GSTIN%%     "GSTIN: XXXXX" or empty
  %%BUSINESS_PHONE%%     phone or empty
  %%BUSINESS_EMAIL%%     email or empty
  %%BUSINESS_CONTACT%%   "Tel: X | email" or empty
  %%BRAND_COLOR%%        primary brand hex colour e.g. #2563EB
  %%DOC_TYPE%%           document type label e.g. "Invoice"
  %%DOC_NUMBER%%         document number e.g. "INV-0001"
  %%DOC_DATE%%           date e.g. "21 June 2026"
  %%BILL_TO%%            pre-rendered customer div (may be empty string)
  %%ITEMS_TABLE%%        pre-rendered <table> with inline styles
  %%TOTALS_BLOCK%%       pre-rendered totals div with inline styles (may be empty)
  %%EXTRAS_BLOCK%%       pre-rendered extra fields grid (may be empty)
  %%SIGNATURE_BLOCK%%    pre-rendered authorised signatory div
  %%SUBTOTAL%%           formatted amount e.g. "₹1,000.00"
  %%TOTAL%%              formatted total

Rules:
- max-width: 794px (A4 portrait)
- All CSS inside a <style> block in <head>
- Include: -webkit-print-color-adjust:exact; print-color-adjust:exact
- No JavaScript, no external URLs, no iframes, no forms
- Do NOT add CSS for %%ITEMS_TABLE%%, %%TOTALS_BLOCK%%, %%EXTRAS_BLOCK%% — these arrive pre-styled
- Use %%BRAND_COLOR%% as the template's primary colour throughout

Respond in EXACTLY this format — no other text before or after:
<TEMPLATE_METADATA>
{"rendererType":"html","templateType":"<type>","industry":"<industry>","style":"<style>","language":"<lang>"}
</TEMPLATE_METADATA>

<HTML_CONTENT>
<!DOCTYPE html>
<html>
...complete template HTML...
</html>
${END_SENTINEL}`;

const AI_PATCH_SYSTEM_PROMPT = `You are a professional Document Style Assistant for Indian SMB invoice systems.
Your job is to translate a user's natural language style request into a JSON structure called a "ThemePatch".
You MUST output ONLY changed properties to patch the current document layout. Do NOT output unchanged fields.

Allowed Patch Schema:
{
  "style": {
    "fontFamily": "Arial" | "Inter" | "Roboto" | "Georgia",
    "accentColor": "Hex color code, e.g. #1E3A8A",
    "density": "compact" | "comfortable" | "spacious",
    "borderRadius": "none" | "square" | "rounded-sm" | "rounded-md" | "rounded-lg"
  },
  "table": {
    "style": "minimal" | "striped" | "bordered",
    "density": "compact" | "comfortable" | "spacious"
  },
  "preferences": {
    "showLogo": boolean,
    "logoSize": "small" | "medium" | "large",
    "showQrCode": boolean,
    "showSignature": boolean,
    "showHsn": boolean,
    "showUnit": boolean,
    "showGstPct": boolean,
    "showDiscount": boolean
  }
}

Rules:
1. ONLY return the properties that the user explicitly wants to modify or that are directly implied by their style intent.
2. DO NOT invent or return any other properties.
3. Forbidden values: raw HTML, custom CSS, JavaScript, SQL, pixel values (px/pt), or raw margins. Everything must be expressed in the design tokens above.
4. Return a confidence value between 0.0 and 1.0 representing how certain you are of the translation.
5. Return a brief, professional user-facing explanation in English explaining what settings you've modified and why (e.g. "I switched your font to Georgia and spacing to spacious to give a luxury look").

Respond in EXACTLY this JSON format — no other text before or after the JSON block:
{
  "patch": {
    // only the changed fields here
  },
  "confidence": 0.95,
  "explanation": "Brief explanation of the style changes applied."
}`;

export interface AiPatchResponse {
  readonly patch: ThemePatch;
  readonly confidence: number;
  readonly explanation: string;
}

// ─── Response parsing ─────────────────────────────────────────────────────────

function parseAiResponse(text: string): { metadata: GeneratedTemplateMetadata; html: string } {
  const metaMatch = text.match(/<TEMPLATE_METADATA>\s*([\s\S]*?)\s*<\/TEMPLATE_METADATA>/);
  if (!metaMatch) throw new Error('AI response missing <TEMPLATE_METADATA> block');

  let metadata: GeneratedTemplateMetadata;
  try {
    metadata = JSON.parse(metaMatch[1]) as GeneratedTemplateMetadata;
  } catch {
    throw new Error('AI response has malformed JSON in <TEMPLATE_METADATA>');
  }

  const htmlStart = text.indexOf('<HTML_CONTENT>');
  if (htmlStart === -1) throw new Error('AI response missing <HTML_CONTENT> block');

  const sentinelIdx = text.indexOf(END_SENTINEL);
  if (sentinelIdx === -1) throw new Error('AI response missing @@END_TEMPLATE@@ sentinel');

  const html = text
    .slice(htmlStart + '<HTML_CONTENT>'.length, sentinelIdx)
    .trim();

  if (!html.toLowerCase().startsWith('<!doctype')) {
    throw new Error('HTML content does not start with <!DOCTYPE html>');
  }

  return { metadata, html };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function generateInvoiceTemplate(
  input: TemplateGenerationInput,
): Promise<{ metadata: GeneratedTemplateMetadata; html: string }> {
  const isWeb = Platform.OS === 'web';
  if (!isWeb && !ANTHROPIC_API_KEY) throw new Error('API key not configured.');

  const userMessage = buildUserMessage(input);

  const headers: Record<string, string> = {
    'Content-Type':       'application/json',
    'anthropic-version':  '2023-06-01',
  };
  if (!isWeb) headers['x-api-key'] = ANTHROPIC_API_KEY;

  const body = {
    model:      'claude-opus-4-8',
    max_tokens: 4096,
    system:     SYSTEM_PROMPT,
    messages:   [{ role: 'user', content: userMessage }],
  };

  const res = await fetch(CLAUDE_API_URL, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`API error ${res.status}`);

  const json = await res.json() as { content: Array<{ type: string; text: string }> };
  const text = json.content?.[0]?.type === 'text' ? json.content[0].text : '';

  return parseAiResponse(text);
}

export async function generateTemplateFromPhoto(
  imageBase64: string,
  mediaType: 'image/jpeg' | 'image/png',
  input: TemplateGenerationInput,
): Promise<{ metadata: GeneratedTemplateMetadata; html: string }> {
  const isWeb = Platform.OS === 'web';
  if (!isWeb && !ANTHROPIC_API_KEY) throw new Error('API key not configured.');

  const userMessage = buildUserMessage(input);

  const headers: Record<string, string> = {
    'Content-Type':       'application/json',
    'anthropic-version':  '2023-06-01',
  };
  if (!isWeb) headers['x-api-key'] = ANTHROPIC_API_KEY;

  const body = {
    model:      'claude-opus-4-8',
    max_tokens: 4096,
    system:     SYSTEM_PROMPT + '\n\nThe user has attached a photo of their physical bill/invoice book. '
      + 'Reproduce its layout, header structure, column arrangement, and visual style as closely as '
      + 'possible in the HTML template, using the placeholders above for the actual data.',
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
        { type: 'text', text: userMessage },
      ],
    }],
  };

  const res = await fetch(CLAUDE_API_URL, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`API error ${res.status}`);

  const json = await res.json() as { content: Array<{ type: string; text: string }> };
  const text = json.content?.[0]?.type === 'text' ? json.content[0].text : '';

  return parseAiResponse(text);
}

export async function generateThemePatch(
  userPrompt: string,
  currentTheme: Partial<ThemePatch>,
  currentPreferences: BusinessPreferences
): Promise<AiPatchResponse> {
  const isWeb = Platform.OS === 'web';
  if (!isWeb && !ANTHROPIC_API_KEY) throw new Error('API key not configured.');

  const userContent = `Current Theme Override: ${JSON.stringify(currentTheme)}
Current Preferences: ${JSON.stringify(currentPreferences)}
User Style Request: "${userPrompt}"`;

  const headers: Record<string, string> = {
    'Content-Type':       'application/json',
    'anthropic-version':  '2023-06-01',
  };
  if (!isWeb) headers['x-api-key'] = ANTHROPIC_API_KEY;

  const body = {
    model:      'claude-opus-4-8',
    max_tokens: 1000,
    system:     AI_PATCH_SYSTEM_PROMPT,
    messages:   [{ role: 'user', content: userContent }],
  };

  const res = await fetch(CLAUDE_API_URL, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`API error ${res.status}`);

  const json = await res.json() as { content: Array<{ type: string; text: string }> };
  const text = (json.content?.[0]?.type === 'text' ? json.content[0].text : '').trim();

  try {
    const cleanJsonText = text.replace(/```json\s*/i, '').replace(/```\s*$/, '').trim();
    const result = JSON.parse(cleanJsonText);
    if (!result.patch || typeof result.confidence !== 'number' || !result.explanation) {
      throw new Error('Invalid AI response structure');
    }
    return result as AiPatchResponse;
  } catch (e) {
    console.error('[AiTemplateService] Error parsing AI patch:', text, e);
    throw new Error('AI response was not in the correct JSON format.');
  }
}

function buildUserMessage(input: TemplateGenerationInput): string {
  const parts: string[] = [
    `Template type: ${input.templateType}`,
    `Industry: ${input.industry ?? 'general'}`,
    `Style: ${input.style ?? 'modern'}`,
    `Language: ${input.language}`,
    `Page size: ${input.pageSize}`,
    `Use theme colour: ${input.theme.useThemeColor}`,
    `Required placeholders: ${input.requiredPlaceholders.join(', ')}`,
  ];
  if (input.businessContext) {
    parts.push(`Business context: ${input.businessContext}`);
  }
  return parts.join('\n');
}
