import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { COLORS } from '../constants';
import { formatMonthYear } from '../services/formatService';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

interface CalendarPickerModalProps {
  visible: boolean;
  initialDate?: Date;
  minDate?: Date;
  maxDate?: Date;
  title?: string;
  onSelect: (date: Date) => void;
  onClose: () => void;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

export function CalendarPickerModal({
  visible, initialDate, minDate, maxDate, title, onSelect, onClose,
}: CalendarPickerModalProps) {
  const [viewDate, setViewDate] = useState(() => initialDate ?? new Date());

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const goMonth = (delta: number) => setViewDate(new Date(year, month + delta, 1));

  const isDisabled = (day: number) => {
    const d = startOfDay(new Date(year, month, day));
    if (minDate && d < startOfDay(minDate)) return true;
    if (maxDate && d > startOfDay(maxDate)) return true;
    return false;
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          <SafeAreaView style={styles.sheet}>
            {!!title && <Text style={styles.title}>{title}</Text>}

            <View style={styles.monthRow}>
              <TouchableOpacity onPress={() => goMonth(-1)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="chevron-back" size={20} color={COLORS.text} />
              </TouchableOpacity>
              <Text style={styles.monthLabel}>
                {formatMonthYear(viewDate.toISOString())}
              </Text>
              <TouchableOpacity onPress={() => goMonth(1)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="chevron-forward" size={20} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.weekRow}>
              {WEEKDAYS.map((w, i) => (
                <Text key={i} style={styles.weekday}>{w}</Text>
              ))}
            </View>

            <View style={styles.grid}>
              {cells.map((day, i) => {
                if (day === null) return <View key={i} style={styles.cell} />;
                const disabled = isDisabled(day);
                const selected = initialDate && isSameDay(new Date(year, month, day), initialDate);
                return (
                  <TouchableOpacity
                    key={i}
                    style={[styles.cell, selected && styles.cellSelected]}
                    disabled={disabled}
                    onPress={() => onSelect(new Date(year, month, day))}
                  >
                    <Text style={[
                      styles.cellText,
                      disabled && styles.cellTextDisabled,
                      selected && styles.cellTextSelected,
                    ]}>
                      {day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </SafeAreaView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheet: {
    width: 320,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 16,
  },
  title: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 8, textAlign: 'center' },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  monthLabel: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  weekRow: { flexDirection: 'row', marginTop: 8 },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellSelected: { backgroundColor: COLORS.primary, borderRadius: 999 },
  cellText: { fontSize: 14, color: COLORS.text },
  cellTextDisabled: { color: COLORS.textMuted, opacity: 0.4 },
  cellTextSelected: { color: '#FFFFFF', fontWeight: '700' },
});
