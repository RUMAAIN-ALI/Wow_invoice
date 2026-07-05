import React from 'react';
import { View, StyleSheet } from 'react-native';
import { List } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Field } from '../types';
import { COLORS, FIELD_TYPE_LABELS, FIELD_TYPE_ICONS } from '../constants';

interface FieldRowProps {
  field: Field;
  onDelete: (id: string) => void;
  onEdit?: (field: Field) => void;
  draggable?: boolean;
}

export function FieldRow({ field, onDelete, onEdit, draggable }: FieldRowProps) {
  return (
    <List.Item
      title={field.name}
      titleStyle={styles.title}
      description={`${FIELD_TYPE_LABELS[field.type]}${field.required ? ' · Required' : ''}`}
      descriptionStyle={styles.description}
      style={styles.row}
      left={() => (
        <View style={styles.leftContainer}>
          {draggable && (
            <Ionicons name="reorder-three" size={20} color={COLORS.textMuted} style={styles.handle} />
          )}
          <View style={styles.fieldTypeIcon}>
            <Ionicons
              name={(FIELD_TYPE_ICONS[field.type] ?? 'document-outline') as any}
              size={16}
              color={COLORS.primary}
            />
          </View>
        </View>
      )}
      right={() => (
        <View style={styles.actions}>
          {onEdit && (
            <View style={styles.actionBtn}>
              <Ionicons
                name="pencil-outline"
                size={18}
                color={COLORS.primary}
                onPress={() => onEdit(field)}
              />
            </View>
          )}
          <View style={styles.actionBtn}>
            <Ionicons
              name="trash-outline"
              size={18}
              color={COLORS.danger}
              onPress={() => onDelete(field.id)}
            />
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 4,
  },
  title: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  description: { fontSize: 12, color: COLORS.textSecondary },
  leftContainer: { flexDirection: 'row', alignItems: 'center', paddingLeft: 8 },
  handle: { marginRight: 6 },
  fieldTypeIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: `${COLORS.primary}14`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingRight: 4 },
  actionBtn: { padding: 8 },
});
