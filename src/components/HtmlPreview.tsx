import React, { useRef, useEffect } from 'react';
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

export function HtmlPreview({ html, style }: Props) {
  const webRef = useRef<WebView>(null);

  // Force scroll to top whenever HTML changes
  useEffect(() => {
    webRef.current?.injectJavaScript(SCROLL_TO_TOP);
  }, [html]);

  return (
    <WebView
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
