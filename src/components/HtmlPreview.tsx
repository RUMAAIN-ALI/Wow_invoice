import React, { useRef, useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

interface Props { html: string; style?: any; }

const SCROLL_TO_TOP = `
  (function() {
    window.scrollTo(0, 0);
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;
  })();
  true;
`;

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
  const webRef = useRef<WebView>(null);

  // Force scroll to top whenever HTML changes
  useEffect(() => {
    webRef.current?.injectJavaScript(SCROLL_TO_TOP);
  }, [html]);

  // WebView's `source` diffing doesn't always trigger a real reload (seen
  // in Style Studio: switching templates left the previous render on
  // screen). Keying by a hash of `html` forces a full unmount/remount
  // instead of relying on WebView to notice the source content changed.
  const key = useMemo(() => hashString(html), [html]);

  return (
    <WebView
      key={key}
      ref={webRef}
      source={{ html }}
      style={[styles.webview, style]}
      originWhitelist={['*']}
      scalesPageToFit={true}
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
      scrollEnabled={true}
      onLoadEnd={() => {
        // Also scroll to top after initial load
        webRef.current?.injectJavaScript(SCROLL_TO_TOP);
      }}
    />
  );
}

const styles = StyleSheet.create({
  webview: { flex: 1 },
});
