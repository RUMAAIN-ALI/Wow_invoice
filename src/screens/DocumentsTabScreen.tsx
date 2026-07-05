import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Appbar, Searchbar, Text, Surface } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { getAllTemplates } from '../services/templateService';
import { getCustomers, searchCustomers } from '../services/customerService';
import { getSession } from '../services/businessService';
import { DocumentType, Customer } from '../types';
import { COLORS } from '../constants';
import { DocIcon } from '../components/DocIcon';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Section = 'documents' | 'customers';

const SEARCH_DEBOUNCE_MS = 300;

export function DocumentsTabScreen() {
  const navigation = useNavigation<Nav>();
  const [section, setSection] = useState<Section>('documents');
  const [docTypes, setDocTypes] = useState<DocumentType[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const { businessId } = getSession();
      getAllTemplates(businessId).then(types => {
        if (active) setDocTypes(types as DocumentType[]);
      });
      return () => { active = false; };
    }, [])
  );

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search]);

  const loadCustomers = useCallback(() => {
    const { businessId } = getSession();
    const query = debouncedSearch.trim();
    (query ? searchCustomers(businessId, query) : getCustomers(businessId)).then(setCustomers);
  }, [debouncedSearch]);

  useFocusEffect(useCallback(() => {
    if (section === 'customers') loadCustomers();
  }, [section, loadCustomers]));

  const filteredDocTypes = docTypes.filter(dt =>
    dt.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      <Appbar.Header style={styles.appbar} elevated>
        <Appbar.Content title="Records" titleStyle={styles.appbarTitle} />
        {section === 'customers' && (
          <Appbar.Action
            icon="account-plus-outline"
            onPress={() => navigation.navigate('CustomerEdit', {})}
            color={COLORS.primary}
          />
        )}
      </Appbar.Header>

      <View style={styles.tabRow}>
        {(['documents', 'customers'] as Section[]).map(s => (
          <TouchableOpacity
            key={s}
            style={[styles.tabChip, section === s && styles.tabChipActive]}
            onPress={() => setSection(s)}
            activeOpacity={0.75}
          >
            <Text style={[styles.tabChipText, section === s && styles.tabChipTextActive]}>
              {s === 'documents' ? 'Documents' : 'Customers'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.searchContainer}>
        <Searchbar
          placeholder={section === 'documents' ? 'Search document types...' : 'Search customers...'}
          value={search}
          onChangeText={setSearch}
          style={styles.searchbar}
          inputStyle={styles.searchInput}
          elevation={0}
          icon={({ size, color }) => <Ionicons name="search" size={size} color={color} />}
          clearIcon={({ size, color }) => <Ionicons name="close-circle" size={size} color={color} />}
        />
      </View>

      {section === 'documents' ? (
        <FlatList
          data={filteredDocTypes}
          keyExtractor={dt => dt.id}
          contentContainerStyle={styles.list}
          renderItem={({ item: dt }) => (
            <TouchableOpacity
              onPress={() => navigation.navigate('DocumentDashboard', {
                documentTypeId: dt.id,
                documentTypeName: dt.name,
              })}
              activeOpacity={0.7}
            >
              <Surface style={styles.card} elevation={1}>
                <DocIcon icon={(dt as any).icon} category={(dt as any).category} size="sm" docName={dt.name} />
                <View style={styles.cardInfo}>
                  <Text variant="bodyLarge" style={styles.cardName}>{dt.name}</Text>
                  <Text variant="bodySmall" style={styles.cardCategory}>
                    {((dt as any).category as string).charAt(0).toUpperCase() + ((dt as any).category as string).slice(1)}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
              </Surface>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="documents-outline" size={48} color={COLORS.textMuted} />
              <Text variant="bodyMedium" style={styles.emptyText}>No document types found</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={customers}
          keyExtractor={c => c.id}
          contentContainerStyle={styles.list}
          renderItem={({ item: c }) => (
            <TouchableOpacity
              onPress={() => navigation.navigate('CustomerHistory', { customerId: c.id })}
              activeOpacity={0.7}
            >
              <Surface style={styles.card} elevation={1}>
                <View style={styles.custAvatar}>
                  <Text style={styles.custAvatarText}>{c.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.cardInfo}>
                  <Text variant="bodyLarge" style={styles.cardName}>{c.name}</Text>
                  {!!c.phone && <Text variant="bodySmall" style={styles.cardCategory}>{c.phone}</Text>}
                </View>
                <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
              </Surface>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={48} color={COLORS.textMuted} />
              <Text variant="bodyMedium" style={styles.emptyText}>
                {debouncedSearch ? 'No matching customers' : 'No customers yet'}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  appbar: { backgroundColor: COLORS.surface },
  appbarTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tabChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tabChipActive: { backgroundColor: `${COLORS.primary}15`, borderColor: COLORS.primary },
  tabChipText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  tabChipTextActive: { color: COLORS.primary },
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
  list: { padding: 16, gap: 8 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 16,
    gap: 14,
    backgroundColor: COLORS.surface,
  },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  cardCategory: { fontSize: 13, fontWeight: '500', color: COLORS.textSecondary, marginTop: 2 },
  custAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  custAvatarText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  empty: { padding: 60, alignItems: 'center', gap: 12 },
  emptyText: { color: COLORS.textSecondary },
});
