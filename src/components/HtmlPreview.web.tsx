import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';

interface Props { html: string; style?: any; }

// FNV-1a: cheap, deterministic hash of the full html string, used only as a
// React `key` (see below) — not a content hash for caching/security.
function hashString(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

export function HtmlPreview({ html, style }: Props) {
  // Browsers don't reliably reload an <iframe>'s content when only its
  // `srcDoc` attribute is mutated in place (varies by browser, and is the
  // reason template/theme changes in Style Studio weren't showing up on
  // web). Keying the iframe by a hash of `html` forces React to unmount and
  // remount a fresh iframe element whenever the content actually changes,
  // guaranteeing a real reload instead of a silent no-op attribute update.
  const key = useMemo(() => hashString(html), [html]);

  return (
    <View style={[styles.container, style]}>
      {/* @ts-ignore — iframe is valid on web */}
      <iframe
        key={key}
        srcDoc={html}
        title="Invoice Preview"
        style={{ flex: 1, border: 'none', width: '100%', height: '100%', display: 'block' }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
