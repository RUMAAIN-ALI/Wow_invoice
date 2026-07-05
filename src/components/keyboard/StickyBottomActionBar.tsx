import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';

interface Props {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Wraps a bottom action row (Save/Preview/Share, etc.) so it stays pinned
 * just above the keyboard instead of being covered or scrolling out of view.
 */
export function StickyBottomActionBar({ children, style }: Props) {
  return (
    <KeyboardStickyView offset={{ closed: 0, opened: 0 }}>
      <View style={style}>{children}</View>
    </KeyboardStickyView>
  );
}
