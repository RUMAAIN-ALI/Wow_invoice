import React, { useEffect, useRef, useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Customer } from '../types';
import { searchCustomers } from '../services/customerService';
import { getSession } from '../services/businessService';

const SEARCH_DEBOUNCE_MS = 250;
const MIN_QUERY_LEN = 2;

interface CustomerAutocompleteFieldProps {
  value: string;
  onChangeText: (v: string) => void;
  onSelectCustomer: (customer: Customer) => void;
  placeholder?: string;
  style?: any;
  inputStyle?: any;
  placeholderTextColor?: string;
}

export function CustomerAutocompleteField({
  value, onChangeText, onSelectCustomer, placeholder, style, inputStyle, placeholderTextColor,
}: CustomerAutocompleteFieldProps) {
  const [results, setResults] = useState<Customer[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const query = value.trim();
    if (query.length < MIN_QUERY_LEN) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      const { businessId } = getSession();
      const matches = await searchCustomers(businessId, query);
      setResults(matches);
    }, SEARCH_DEBOUNCE_MS);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [value]);

  return (
    <View style={[styles.container, style]}>
      <TextInput
        style={inputStyle}
        value={value}
        onChangeText={t => { onChangeText(t); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        placeholderTextColor={placeholderTextColor ?? '#9CA3AF'}
      />
      {open && results.length > 0 && (
        <View style={styles.dropdown}>
          {results.map(c => (
            <TouchableOpacity
              key={c.id}
              style={styles.row}
              activeOpacity={0.7}
              onPress={() => { onSelectCustomer(c); setOpen(false); setResults([]); }}
            >
              <Text style={styles.name} numberOfLines={1}>{c.name}</Text>
              {!!c.phone && <Text style={styles.sub} numberOfLines={1}>{c.phone}</Text>}
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
