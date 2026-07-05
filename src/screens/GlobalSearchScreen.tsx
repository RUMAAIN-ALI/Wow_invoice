import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Appbar, Searchbar, Text } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Customer } from '../types';
import { searchAllInvoices, GlobalSearchInvoice } from '../services/invoiceService';
import { searchCustomers } from '../services/customerService';
import { getSession } from '../services/businessService';
import { COLORS } from '../constants';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const SEARCH_DEBOUNCE_MS = 300;
const MIN_QUERY_LEN = 2;

function fmtMoney(paise: number): string {
  return '₹' + (paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

type ResultItem =
  | { kind: 'header'; key: string; label: string }
  | { kind: 'invoice'; key: string; invoice: GlobalSearchInvoice }
  | { kind: 'customer'; key: string; customer: Customer };

export function GlobalSearchScreen() {
  const navigation = useNavigation<Nav>();
  const [query, setQuery] = useState('');
  const [invoices, setInvoices] = useState<GlobalSearchInvoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < MIN_QUERY_LEN) { setInvoices([]); setCustomers([]); setLoading(false); return; }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const { businessId } = getSession();
      const [inv, cust] = await Promise.all([
        searchAllInvoices(businessId, q),
        searchCustomers(businessId, q),
      ]);
      setInvoices(inv);
      setCustomers(cust);
      setLoading(false);
    }, SEARCH_DEBOUNCE_MS);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const items: ResultItem[] = [];
  if (customers.length > 0) {
    items.push({ kind: 'header', key: 'h-customers', label: 'Customers' });
    for (const c of customers) items.push({ kind: 'customer', key: `c-${c.id}`, customer: c });
  }
  if (invoices.length > 0) {
    items.push({ kind: 'header', key: 'h-documents', label: 'Documents' });
    for (const i of invoices) items.push({ kind: 'invoice', key: `i-${i.id}`, invoice: i });
  }

  const showEmpty = !loading && query.trim().length >= MIN_QUERY_LEN && items.length === 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <Appbar.Header style={styles.appbar} elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} color={COLORS.primary} />
        <Appbar.Content title="Search" titleStyle={styles.appbarTitle} />
      </Appbar.Header>

      <View style={styles.searchContainer}>
        <Searchbar
          placeholder="Search documents or customers..."
          value={query}
          onChangeText={setQuery}
          autoFocus
          style={styles.searchbar}
          inputStyle={styles.searchInput}
          elevation={0}
          icon={({ size, color }) => <Ionicons name="search" size={size} color={color} />}
          clearIcon={({ size, color }) => <Ionicons name="close-circle" size={size} color={color} />}
        />
      </View>

      {showEmpty ? (
        <View style={styles.empty}>
          <Ionicons name="search-outline" size={40} color={COLORS.textMuted} />
          <Text style={styles.emptyText}>No matches for "{query.trim()}"</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => i.key}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            if (item.kind === 'header') {
              return <Text style={styles.sectionHeader}>{item.label}</Text>;
            }
            if (item.kind === 'customer') {
              const c = item.customer;
              return (
                <TouchableOpacity
                  style={styles.row}
                  activeOpacity={0.7}
                  onPress={() => navigation.navigate('CustomerHistory', { customerId: c.id })}
                >
                  <View style={styles.customerAvatar}>
                    <Text style={styles.customerAvatarText}>{c.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowTitle}>{c.name}</Text>
                    {!!c.phone && <Text style={styles.rowSub}>{c.phone}</Text>}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
                </TouchableOpacity>
              );
            }
            const inv = item.invoice;
            return (
              <TouchableOpacity
                style={styles.row}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('PreviewRecord', {
                  recordId: inv.id, documentTypeName: inv.typeName,
                })}
              >
                <View style={styles.docIconBox}>
                  <Ionicons name="document-text-outline" size={18} color={COLORS.primary} />
                </View>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowTitle}>{inv.number}</Text>
                  <Text style={styles.rowSub}>
                    {inv.typeName}{inv.customerName ? ` · ${inv.customerName}` : ''} · {fmtDate(inv.issuedAt ?? inv.createdAt)}
                  </Text>
                </View>
                <Text style={styles.rowAmount}>{fmtMoney(inv.totalPaise)}</Text>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  appbar: { backgroundColor: COLORS.surface },
  appbarTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  searchbar: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: { fontSize: 15 },
  listContent: { padding: 16 },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  docIconBox: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: `${COLORS.primary}12`,
    alignItems: 'center', justifyContent: 'center',
  },
  customerAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  customerAvatarText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  rowInfo: { flex: 1 },
  rowTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  rowSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  rowAmount: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontSize: 14, color: COLORS.textSecondary },
});
