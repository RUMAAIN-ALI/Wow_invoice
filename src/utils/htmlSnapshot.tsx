import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import { captureRef } from 'react-native-view-shot';

interface Props {
  html: string;
  width?: number;
  onCaptured: (uri: string) => void;
  onError: (err: any) => void;
}

const MEASURE_JS = `
  (function() {
    window.ReactNativeWebView.postMessage(String(document.documentElement.scrollHeight));
  })();
  true;
`;

/**
 * Renders the given HTML off-screen at full content height (not just the
 * visible viewport) and captures it as a PNG. Two measurement passes handle
 * layouts that reflow once the viewport width/height actually changes.
 */
export function HtmlSnapshotCapture({ html, width = 800, onCaptured, onError }: Props) {
  const containerRef = useRef<View>(null);
  const webRef = useRef<WebView>(null);
  const [height, setHeight] = useState(600);
  const [pass, setPass] = useState(0);

  useEffect(() => {
    if (pass < 2) return;
    const t = setTimeout(async () => {
      try {
        const uri = await captureRef(containerRef, { format: 'png', quality: 1, result: 'tmpfile' });
        onCaptured(uri);
      } catch (e) {
        onError(e);
      }
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pass]);

  return (
    <View
      ref={containerRef}
      collapsable={false}
      style={{ position: 'absolute', top: -10000, left: 0, width, height }}
    >
      <WebView
        ref={webRef}
        source={{ html }}
        style={{ width, height }}
        originWhitelist={['*']}
        scrollEnabled={false}
        onMessage={(e) => {
          const h = parseInt(e.nativeEvent.data, 10);
          if (h && Math.abs(h - height) > 4) setHeight(h);
          if (pass === 0) {
            setTimeout(() => webRef.current?.injectJavaScript(MEASURE_JS), 200);
          }
          setPass(p => p + 1);
        }}
        onLoadEnd={() => {
          webRef.current?.injectJavaScript(MEASURE_JS);
        }}
      />
    </View>
  );
}
