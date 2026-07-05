import React, { useCallback, useState } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Appbar, Text, Divider } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Customer } from '../types';
import { getCustomerById } from '../services/customerService';
import { getInvoicesByCustomer, getOutstandingByCustomer, GlobalSearchInvoice } from '../services/invoiceService';
import { COLORS } from '../constants';
import { formatCurrencyFromPaise, formatDate as fmtDate } from '../services/formatService';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'CustomerHistory'>;

function fmtMoney(paise: number): string {
  return formatCurrencyFromPaise(paise);
}

export function CustomerHistoryScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { customerId } = route.params;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [invoices, setInvoices] = useState<GlobalSearchInvoice[]>([]);
  const [outstanding, setOutstanding] = useState(0);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const [c, inv, due] = await Promise.all([
        getCustomerById(customerId),
        getInvoicesByCustomer(customerId),
        getOutstandingByCustomer(customerId),
      ]);
      if (!active) return;
      setCustomer(c);
      setInvoices(inv);
      setOutstanding(due);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [customerId]));

  const totalSpend = invoices.reduce((sum, i) => sum + i.totalPaise, 0);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      <Appbar.Header style={styles.appbar} elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} color={COLORS.primary} />
        <Appbar.Content title={customer?.name ?? 'Customer'} titleStyle={styles.appbarTitle} />
        <Appbar.Action
          icon="pencil-outline"
          onPress={() => navigation.navigate('CustomerEdit', { customerId })}
          color={COLORS.primary}
        />
      </Appbar.Header>

      {!loading && customer && (
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{customer.name.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{customer.name}</Text>
            {!!customer.phone && <Text style={styles.meta}>{customer.phone}</Text>}
            {!!customer.gstin && <Text style={styles.meta}>{customer.gstin}</Text>}
          </View>
        </View>
      )}

      {!loading && invoices.length > 0 && (
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{invoices.length}</Text>
            <Text style={styles.statLabel}>Invoices</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{fmtMoney(totalSpend)}</Text>
            <Text style={styles.statLabel}>Total Billed</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, outstanding > 0 && { color: COLORS.warning }]}>
              {fmtMoney(outstanding)}
            </Text>
            <Text style={styles.statLabel}>Outstanding</Text>
          </View>
        </View>
      )}

      <FlatList
        data={invoices}
        keyExtractor={i => i.id}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={Divider}
        ListEmptyComponent={!loading ? (
          <View style={styles.empty}>
            <Ionicons name="document-outline" size={40} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>No invoices for this customer yet</Text>
          </View>
        ) : null}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('PreviewRecord', {
              recordId: item.id, documentTypeName: item.typeName,
            })}
          >
            <View style={styles.rowInfo}>
              <Text style={styles.rowNumber}>{item.number}</Text>
              <Text style={styles.rowSub}>{item.typeName} · {fmtDate(item.issuedAt ?? item.createdAt)}</Text>
            </View>
            <Text style={styles.rowAmount}>{fmtMoney(item.totalPaise)}</Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  appbar: { backgroundColor: COLORS.surface },
  appbarTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: COLORS.surface,
    margin: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: '#fff' },
  name: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  meta: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  statBox: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statValue: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  statLabel: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
  },
  rowInfo: { flex: 1 },
  rowNumber: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  rowSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  rowAmount: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 10 },
  emptyText: { fontSize: 14, color: COLORS.textSecondary },
});
