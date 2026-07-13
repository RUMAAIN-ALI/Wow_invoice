import React, { useEffect, useRef, useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { TextInput as PaperTextInput } from 'react-native-paper';
import { ItemHistoryEntry, searchItemHistory } from '../services/itemHistoryService';
import { getSession } from '../services/businessService';

const SEARCH_DEBOUNCE_MS = 250;
const MIN_QUERY_LEN = 2;

interface ItemNameAutocompleteFieldProps {
  value: string;
  onChangeText: (v: string) => void;
  onSelectItem: (entry: ItemHistoryEntry) => void;
  label?: string;
  placeholder?: string;
  style?: any;
  inputStyle?: any;
  placeholderTextColor?: string;
  autoFocus?: boolean;
}

/**
 * "Item memory" recall for Add Item — mirrors CustomerAutocompleteField.tsx,
 * built on Paper's outlined TextInput for a real MD3 floating label.
 * Suggestions come from item_history (previously typed document line items),
 * not a product catalog; selecting one prefills unit/rate/GST/HSN from the
 * last time this item was used.
 */
export function ItemNameAutocompleteField({
  value, onChangeText, onSelectItem, label, placeholder, style, inputStyle, autoFocus,
}: ItemNameAutocompleteFieldProps) {
  const [results, setResults] = useState<ItemHistoryEntry[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const query = value.trim();
    if (query.length < MIN_QUERY_LEN) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      const { businessId } = getSession();
      const matches = await searchItemHistory(businessId, query);
      setResults(matches);
    }, SEARCH_DEBOUNCE_MS);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [value]);

  return (
    <View style={[styles.container, style]}>
      <PaperTextInput
        mode="outlined"
        label={label}
        style={inputStyle}
        value={value}
        onChangeText={t => { onChangeText(t); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        autoFocus={autoFocus}
      />
      {open && results.length > 0 && (
        <View style={styles.dropdown}>
          {results.map(entry => (
            <TouchableOpacity
              key={entry.id}
              style={styles.row}
              activeOpacity={0.7}
              onPress={() => { onSelectItem(entry); setOpen(false); setResults([]); }}
            >
              <Text style={styles.name} numberOfLines={1}>{entry.name}</Text>
              <Text style={styles.sub} numberOfLines={1}>
                {[
                  entry.lastRate != null ? `₹${entry.lastRate}` : null,
                  entry.lastGstPct ? `GST ${entry.lastGstPct}%` : null,
                  entry.lastUnit || null,
                ].filter(Boolean).join(' · ')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  dropdown: {
    marginTop: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    maxHeight: 220,
    overflow: 'hidden',
  },
  row: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  name: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  sub: { fontSize: 12, color: '#64748B', marginTop: 2 },
});
