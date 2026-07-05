import React, { useState } from 'react';
import {
  View, StyleSheet, Modal, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity,
} from 'react-native';
import { Text, TextInput, Switch, Button as PaperButton, Divider } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import { FieldType } from '../types';
import { COLORS, FIELD_TYPE_LABELS, FIELD_TYPE_ICONS } from '../constants';

interface AddFieldSheetProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (name: string, type: FieldType, required: boolean) => void;
  editField?: { name: string; type: FieldType; required: boolean } | null;
}

const FIELD_TYPES: FieldType[] = ['text', 'number', 'date', 'currency', 'dropdown', 'signature', 'table', 'photo', 'checkbox'];

export function AddFieldSheet({ visible, onClose, onAdd, editField }: AddFieldSheetProps) {
  const [name, setName] = useState(editField?.name ?? '');
  const [type, setType] = useState<FieldType>(editField?.type ?? 'text');
  const [required, setRequired] = useState(editField?.required ?? false);

  React.useEffect(() => {
    if (visible) {
      setName(editField?.name ?? '');
      setType(editField?.type ?? 'text');
      setRequired(editField?.required ?? false);
    }
  }, [visible, editField]);

  const handleAdd = () => {
    if (!name.trim()) return;
    onAdd(name.trim(), type, required);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay} onTouchEnd={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheetWrapper}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <Text variant="titleLarge" style={styles.title}>
            {editField ? 'Edit Field' : 'Add Field'}
          </Text>

          <TextInput
            label="Field Name"
            mode="outlined"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Customer Name"
            autoFocus
            style={styles.input}
          />

          <Text variant="labelLarge" style={styles.sectionLabel}>Field Type</Text>
          <ScrollView style={styles.typeList} showsVerticalScrollIndicator={false}>
            {FIELD_TYPES.map(ft => (
              <TouchableOpacity
                key={ft}
                style={[styles.typeOption, type === ft && styles.typeOptionSelected]}
                onPress={() => setType(ft)}
                activeOpacity={0.7}
              >
                <View style={[styles.typeIconBox, type === ft && styles.typeIconBoxSelected]}>
                  <Ionicons
                    name={(FIELD_TYPE_ICONS[ft] ?? 'document-outline') as any}
                    size={16}
                    color={type === ft ? '#fff' : COLORS.textSecondary}
                  />
                </View>
                <Text style={[styles.typeLabel, type === ft && styles.typeLabelSelected]}>
                  {FIELD_TYPE_LABELS[ft]}
                </Text>
                {type === ft && (
                  <Ionicons name="checkmark-circle" size={18} color={COLORS.primary} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Divider style={styles.divider} />

          <View style={styles.requiredRow}>
            <View style={styles.requiredLeft}>
              <Ionicons name="alert-circle-outline" size={18} color={COLORS.textSecondary} style={{ marginRight: 8 }} />
              <Text variant="bodyLarge" style={styles.requiredLabel}>Required field</Text>
            </View>
            <Switch value={required} onValueChange={setRequired} />
          </View>

          <PaperButton
            mode="contained"
            onPress={handleAdd}
            disabled={!name.trim()}
            icon={({ size, color }) => <Ionicons name={editField ? 'checkmark' : 'add'} size={size} color={color} />}
            contentStyle={{ height: 52 }}
            style={styles.addBtn}
          >
            {editField ? 'Save Changes' : 'Add Field'}
          </PaperButton>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheetWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
    maxHeight: '85%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 16,
  },
  input: {
    marginBottom: 16,
    backgroundColor: COLORS.surface,
  },
  sectionLabel: {
    color: COLORS.text,
    marginBottom: 8,
  },
  typeList: {
    maxHeight: 220,
    marginBottom: 8,
  },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginBottom: 4,
    gap: 12,
  },
  typeOptionSelected: {
    backgroundColor: `${COLORS.primary}10`,
  },
  typeIconBox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeIconBoxSelected: {
    backgroundColor: COLORS.primary,
  },
  typeLabel: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
  },
  typeLabelSelected: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  divider: {
    marginVertical: 12,
  },
  requiredRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  requiredLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  requiredLabel: {
    color: COLORS.text,
  },
  addBtn: {
    borderRadius: 12,
  },
});
