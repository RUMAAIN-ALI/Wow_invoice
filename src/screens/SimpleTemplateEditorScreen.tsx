import React, { useState } from 'react';
import {
  View, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Appbar, Text } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { updateTemplateExtraFields } from '../services/templateService';
import { COLORS } from '../constants';
import { Button } from '../components/Button';

type Nav   = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'SimpleTemplateEditor'>;

export function SimpleTemplateEditorScreen() {
  const navigation = useNavigation<Nav>();
  const route      = useRoute<Route>();
  const { documentTypeId, documentTypeName, initialFields } = route.params;

  const [fields, setFields] = useState<string[]>(initialFields);
  const [newField, setNewField] = useState('');
  const [saving, setSaving] = useState(false);

  const updateField = (index: number, value: string) => {
    setFields(prev => prev.map((f, i) => i === index ? value : f));
  };

  const deleteField = (index: number) => {
    setFields(prev => prev.filter((_, i) => i !== index));
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    setFields(prev => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  };

  const moveDown = (index: number) => {
    setFields(prev => {
      if (index >= prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  };

  const addField = () => {
    const trimmed = newField.trim();
    if (!trimmed) return;
    setFields(prev => [...prev, trimmed]);
    setNewField('');
  };

  const handleSave = async () => {
    const valid = fields.filter(f => f.trim());
    setSaving(true);
    try {
      await updateTemplateExtraFields(documentTypeId, valid);
      navigation.replace('FillRecord', { documentTypeId, documentTypeName });
    } catch {
      Alert.alert('Error', 'Could not save template.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      <Appbar.Header style={styles.appbar} elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} color={COLORS.primary} />
        <Appbar.Content title={documentTypeName} titleStyle={styles.appbarTitle} />
      </Appbar.Header>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text variant="bodySmall" style={styles.hint}>
            Rename, reorder, or delete fields. Add new ones at the bottom.
          </Text>

          {fields.map((field, i) => (
            <View key={i} style={styles.fieldRow}>
              <View style={styles.reorderButtons}>
                <TouchableOpacity
                  style={[styles.reorderBtn, i === 0 && styles.reorderBtnDisabled]}
                  onPress={() => moveUp(i)}
                  disabled={i === 0}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="chevron-up" size={16} color={i === 0 ? COLORS.border : COLORS.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.reorderBtn, i === fields.length - 1 && styles.reorderBtnDisabled]}
                  onPress={() => moveDown(i)}
                  disabled={i === fields.length - 1}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="chevron-down" size={16} color={i === fields.length - 1 ? COLORS.border : COLORS.textSecondary} />
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.fieldInput}
                value={field}
                onChangeText={v => updateField(i, v)}
                placeholder="Field name"
                placeholderTextColor={COLORS.textMuted}
                returnKeyType="done"
              />

              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => deleteField(i)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
              </TouchableOpacity>
            </View>
          ))}

          <View style={styles.addRow}>
            <TextInput
              style={styles.addInput}
              value={newField}
              onChangeText={setNewField}
              placeholder="Add a field…"
              placeholderTextColor={COLORS.textMuted}
              returnKeyType="done"
              onSubmitEditing={addField}
            />
            <TouchableOpacity
              style={[styles.addBtn, !newField.trim() && styles.addBtnDisabled]}
              onPress={addField}
              disabled={!newField.trim()}
            >
              <Ionicons name="add" size={22} color={newField.trim() ? COLORS.primary : COLORS.border} />
            </TouchableOpacity>
          </View>

          <View style={{ height: 24 }} />

          <Button
            label="Save & Start Using →"
            onPress={handleSave}
            loading={saving}
          />

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: COLORS.background },
  appbar:      { backgroundColor: COLORS.surface },
  appbarTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  scroll:      { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  hint:        { color: COLORS.textSecondary, marginBottom: 16 },

  fieldRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surface, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 12,
    marginBottom: 8, borderWidth: 1, borderColor: COLORS.border,
    gap: 8,
  },
  reorderButtons: { gap: 2 },
  reorderBtn: {
    width: 26, height: 26,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 8, backgroundColor: COLORS.background,
  },
  reorderBtnDisabled: { opacity: 0.3 },

  fieldInput: {
    flex: 1,
    fontSize: 15, fontWeight: '500', color: COLORS.text,
    paddingVertical: 6,
  },
  deleteBtn: {
    width: 32, height: 32,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 8,
  },

  addRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surface, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 12,
    borderWidth: 1.5, borderColor: COLORS.primary,
    borderStyle: 'dashed', gap: 8, marginTop: 4,
  },
  addInput: {
    flex: 1,
    fontSize: 15, color: COLORS.text,
    paddingVertical: 6,
  },
  addBtn:         { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  addBtnDisabled: { opacity: 0.4 },
});
