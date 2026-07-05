import { SanitizationResult } from '../types';

const MAX_IMAGE_COUNT       = 5;
const MAX_IMAGE_BYTES       = 500_000;
const MAX_TOTAL_IMAGE_BYTES = 1_500_000;
export const MAX_HTML_BYTES = 100_000;

const ALLOWED_DATA_PREFIXES = [
  'data:image/png;base64,',
  'data:image/jpeg;base64,',
];

// Tags that must be fully stripped including their content
const PAIRED_DANGEROUS_TAGS = ['script', 'iframe', 'form', 'object', 'embed', 'applet'];

// Void/self-closing dangerous tags
const VOID_DANGEROUS_TAGS = ['input', 'base'];

// Paired tags that may also appear self-closing
const PAIRED_OR_VOID_DANGEROUS = ['button', 'select', 'textarea', 'meta'];

export function sanitizeHtml(raw: string): SanitizationResult {
  let html = raw;
  let removedScripts          = 0;
  let removedEventHandlers    = 0;
  let removedExternalResources = 0;
  let removedDangerousTags    = 0;

  // 1. Strip paired dangerous tags and their content
  for (const tag of PAIRED_DANGEROUS_TAGS) {
    html = html.replace(
      new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}\\s*>`, 'gi'),
      () => { tag === 'script' ? removedScripts++ : removedDangerousTags++; return ''; }
    );
  }

  // 2. Strip remaining void/paired dangerous tags (no content capture needed)
  for (const tag of [...VOID_DANGEROUS_TAGS, ...PAIRED_OR_VOID_DANGEROUS]) {
    html = html.replace(
      new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}\\s*>`, 'gi'),
      () => { removedDangerousTags++; return ''; }
    );
    html = html.replace(
      new RegExp(`<${tag}\\b[^>]*\\/?>`, 'gi'),
      () => { removedDangerousTags++; return ''; }
    );
  }

  // 3. Strip event handlers: on[a-z]+="..." or on[a-z]+='...' or on[a-z]+=unquoted
  html = html.replace(
    /\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi,
    () => { removedEventHandlers++; return ''; }
  );

  // 4. Replace javascript: protocol with about:
  html = html.replace(/javascript\s*:/gi, () => {
    removedExternalResources++;
    return 'about:';
  });

  // 5. Strip external http/https URLs from src/href/action/background/formaction
  html = html.replace(
    /(\b(?:src|href|action|background|formaction)\s*=\s*)(['"])(https?:\/\/[^'"]*)\2/gi,
    (_m, attr: string, q: string) => {
      removedExternalResources++;
      return `${attr}${q}${q}`;
    }
  );

  // 6. Process data URIs — enforce png/jpeg allowlist and size limits
  let imageCount    = 0;
  let totalImgBytes = 0;

  html = html.replace(/data:[a-zA-Z0-9+\-.]+;base64,[A-Za-z0-9+/=]+/g, (uri) => {
    const lc      = uri.toLowerCase();
    const allowed = ALLOWED_DATA_PREFIXES.some(p => lc.startsWith(p));
    if (!allowed) {
      removedExternalResources++;
      return '';
    }
    const base64 = uri.split(',')[1] ?? '';
    const bytes  = Math.ceil((base64.length * 3) / 4);

    imageCount++;
    totalImgBytes += bytes;

    if (
      imageCount    > MAX_IMAGE_COUNT  ||
      bytes         > MAX_IMAGE_BYTES  ||
      totalImgBytes > MAX_TOTAL_IMAGE_BYTES
    ) {
      removedExternalResources++;
      return '';
    }
    return uri;
  });

  // 7. Measure structural HTML size (data URIs replaced with placeholder for measurement)
  const structuralHtml  = html.replace(/data:[a-zA-Z0-9+\-.]+;base64,[A-Za-z0-9+/=]*/g, 'data:');
  const htmlSizeBytes   = structuralHtml.length; // ASCII-dominant; length ≈ byte count

  const safe =
    removedScripts           === 0 &&
    removedEventHandlers     === 0 &&
    removedExternalResources === 0 &&
    removedDangerousTags     === 0;

  return {
    html,
    htmlSizeBytes,
    removedScripts,
    removedEventHandlers,
    removedExternalResources,
    removedDangerousTags,
    safe,
  };
}
