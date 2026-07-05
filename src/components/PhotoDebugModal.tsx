import React from 'react';
import { Modal, View, Text, Image, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { COLORS } from '../constants';

interface PhotoDebugModalProps {
  visible: boolean;
  photoUri: string | null;
  metadata: any;
  html: string;
  onSave: () => void;
  onDiscard: () => void;
}

export function PhotoDebugModal({
  visible, photoUri, metadata, html, onSave, onDiscard,
}: PhotoDebugModalProps) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onDiscard}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={styles.title}>Photo → Template (Debug)</Text>
          <TouchableOpacity onPress={onDiscard} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={24} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {!!photoUri && (
            <>
              <Text style={styles.sectionLabel}>Source Photo</Text>
              <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="contain" />
            </>
          )}

          <Text style={styles.sectionLabel}>Parsed Metadata</Text>
          <View style={styles.codeBox}>
            <Text style={styles.codeText} selectable>
              {JSON.stringify(metadata, null, 2)}
            </Text>
          </View>

          <Text style={styles.sectionLabel}>Raw Generated HTML</Text>
          <View style={styles.codeBox}>
            <Text style={styles.codeText} selectable>
              {html}
            </Text>
          </View>
        </ScrollView>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.discardBtn} onPress={onDiscard} activeOpacity={0.8}>
            <Text style={styles.discardBtnText}>Discard</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.saveBtn} onPress={onSave} activeOpacity={0.8}>
            <Text style={styles.saveBtnText}>Save Template</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  title: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  sectionLabel: {
    fontSize: 12, fontWeight: '700', color: COLORS.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 16,
  },
  photo: { width: '100%', height: 240, borderRadius: 12, backgroundColor: '#000' },
  codeBox: {
    backgroundColor: COLORS.surface, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: COLORS.border,
  },
  codeText: { fontSize: 11, fontFamily: 'monospace', color: COLORS.text },
  actions: {
    flexDirection: 'row', gap: 12, padding: 16,
    backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  discardBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.border,
  },
  discardBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.textSecondary },
  saveBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 14,
    backgroundColor: '#7C3AED',
  },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
