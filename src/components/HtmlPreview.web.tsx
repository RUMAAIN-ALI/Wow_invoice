import React from 'react';
import { View, StyleSheet } from 'react-native';

interface Props { html: string; style?: any; }

export function HtmlPreview({ html, style }: Props) {
  return (
    <View style={[styles.container, style]}>
      {/* @ts-ignore — iframe is valid on web */}
      <iframe
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
