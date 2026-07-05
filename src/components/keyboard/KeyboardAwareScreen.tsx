import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView, KeyboardAwareScrollViewProps } from 'react-native-keyboard-controller';

interface Props extends Partial<KeyboardAwareScrollViewProps> {
  children: React.ReactNode;
  edges?: readonly Edge[];
  safeAreaStyle?: StyleProp<ViewStyle>;
}

/**
 * Standard wrapper for every form screen in the app: SafeAreaView + an
 * auto-scrolling ScrollView that keeps the focused field (and its label/
 * validation message) visible above the keyboard. Use this instead of
 * hand-rolling SafeAreaView + ScrollView + KeyboardAvoidingView per screen.
 */
export function KeyboardAwareScreen({
  children,
  edges = ['bottom', 'left', 'right'],
  safeAreaStyle,
  contentContainerStyle,
  ...scrollViewProps
}: Props) {
  return (
    <SafeAreaView style={[{ flex: 1 }, safeAreaStyle]} edges={edges}>
      <KeyboardAwareScrollView
        bottomOffset={32}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={contentContainerStyle}
        {...scrollViewProps}
      >
        {children}
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}
