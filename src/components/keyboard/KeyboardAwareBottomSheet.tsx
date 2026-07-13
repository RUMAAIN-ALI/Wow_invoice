import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { Portal } from 'react-native-paper';
import { StickyBottomActionBar } from './StickyBottomActionBar';

interface Props {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** Primary CTA row (e.g. "Add to Invoice"). Stays pinned above the keyboard. */
  footer?: React.ReactNode;
  maxHeightPct?: number;
  contentStyle?: StyleProp<ViewStyle>;
  /** Override the sheet container's background/colors to match the caller's theme. */
  sheetStyle?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<import('react-native').TextStyle>;
}

/**
 * Standard wrapper for every Modal-based bottom sheet in the app: handles
 * keyboard avoidance (focused field auto-scrolls into view) and keeps the
 * primary action button pinned above the keyboard instead of hidden behind
 * it. Use this instead of hand-rolling Modal + overlay + ScrollView per
 * screen — see KeyboardAwareScreen.tsx for the equivalent full-screen wrapper.
 */
export function KeyboardAwareBottomSheet({
  visible,
  onClose,
  title,
  children,
  footer,
  maxHeightPct = 85,
  contentStyle,
  sheetStyle,
  titleStyle,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/*
        Local Portal.Host: RN's Modal renders in its own native window, so
        Paper components that render via Portal (Menu, Dialog, Tooltip) would
        otherwise mount to the app-root Portal.Host and end up invisible
        behind this Modal, especially on Android. Scoping a host here keeps
        them inside the same native surface as the sheet.
      */}
      <Portal.Host>
        <View style={styles.overlay}>
          <TouchableOpacity style={styles.bg} activeOpacity={1} onPress={onClose} />
          <View style={[styles.sheet, { maxHeight: `${maxHeightPct}%` }, sheetStyle]}>
            <View style={styles.handle} />
            {title ? <Text style={[styles.title, titleStyle]}>{title}</Text> : null}
            <KeyboardAwareScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              bottomOffset={24}
              contentContainerStyle={contentStyle}
            >
              {children}
            </KeyboardAwareScrollView>
            {footer ? <StickyBottomActionBar>{footer}</StickyBottomActionBar> : null}
          </View>
        </View>
      </Portal.Host>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  bg: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingTop: 12,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E2E4EA', alignSelf: 'center', marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '700', color: '#1A1A1A', marginBottom: 16 },
});
