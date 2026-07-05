import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Alert, TouchableOpacity, SectionList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Appbar, Searchbar, Text, Divider, Button } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { DocRecord } from '../types';
import {
  getRecordsByDocumentType, deleteRecord, getAvailableYears, getAvailableMonths,
  getRecordCountByType, RecordListCursor,
} from '../services/invoiceService';
import { COLORS, DOC_TYPE_COLORS } from '../constants';
import { navigateToDocument } from '../navigation/documentRouter';
import { CalendarPickerModal } from '../components/CalendarPickerModal';
import { formatMonthYear, formatMonthName, formatDate } from '../services/formatService';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'RecordList'>;
type Tab = 'recent' | 'browse' | 'range';

const PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 300;
const RECENT_DAYS = 90;

function monthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
}

function monthLabel(iso: string): string {
  return formatMonthYear(iso);
}

function monthName(monthNum: string): string {
  return formatMonthName(parseInt(monthNum, 10));
}

function fmtShortDate(d: Date): string {
  return formatDate(d.toISOString());
}

export function RecordListScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { documentTypeId, documentTypeName } = route.params;

  const [tab, setTab] = useState<Tab>('recent');

  const [records, setRecords] = useState<DocRecord[]>([]);
  const [cursor, setCursor] = useState<RecordListCursor | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasAnyRecords, setHasAnyRecords] = useState(true);
  const requestId = useRef(0);

  useFocusEffect(useCallback(() => {
    getRecordCountByType(documentTypeId).then(count => setHasAnyRecords(count > 0));
  }, [documentTypeId]));

  // Browse History drill-down
  const [years, setYears] = useState<string[]>([]);
  const [months, setMonths] = useState<string[]>([]);
  const [browseYear, setBrowseYear] = useState<string | null>(null);
  const [browseMonth, setBrowseMonth] = useState<string | null>(null);

  // Date Range
  const [rangeFrom, setRangeFrom] = useState<Date | null>(null);
  const [rangeTo, setRangeTo] = useState<Date | null>(null);
  const [picker, setPicker] = useState<'from' | 'to' | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (tab === 'browse' && !browseYear) {
      getAvailableYears(documentTypeId).then(setYears);
    }
  }, [tab, browseYear, documentTypeId]);

  useEffect(() => {
    if (tab === 'browse' && browseYear && !browseMonth) {
      getAvailableMonths(documentTypeId, browseYear).then(setMonths);
    }
  }, [tab, browseYear, browseMonth, documentTypeId]);

  const { dateFrom, dateTo, showResults } = useMemo(() => {
    if (tab === 'recent') {
      const from = new Date();
      from.setDate(from.getDate() - RECENT_DAYS);
      return { dateFrom: from.toISOString(), dateTo: undefined, showResults: true };
    }
    if (tab === 'browse' && browseYear && browseMonth) {
      const y = parseInt(browseYear, 10);
      const m = parseInt(browseMonth, 10) - 1;
      const from = new Date(y, m, 1);
      const to = new Date(y, m + 1, 1);
      to.setMilliseconds(-1);
      return { dateFrom: from.toISOString(), dateTo: to.toISOString(), showResults: true };
    }
    if (tab === 'range' && rangeFrom && rangeTo) {
      const from = new Date(rangeFrom); from.setHours(0, 0, 0, 0);
      const to = new Date(rangeTo); to.setHours(23, 59, 59, 999);
      return { dateFrom: from.toISOString(), dateTo: to.toISOString(), showResults: true };
    }
    return { dateFrom: undefined, dateTo: undefined, showResults: false };
  }, [tab, browseYear, browseMonth, rangeFrom, rangeTo]);

  const loadFirstPage = useCallback(async () => {
    if (!showResults) { setRecords([]); setCursor(null); setLoading(false); return; }
    const myRequest = ++requestId.current;
    setLoading(true);
    const page = await getRecordsByDocumentType(documentTypeId, {
      limit: PAGE_SIZE, search: debouncedSearch, dateFrom, dateTo,
    });
    if (myRequest !== requestId.current) return;
    setRecords(page.items as unknown as DocRecord[]);
    setCursor(page.nextCursor);
    setLoading(false);
  }, [documentTypeId, debouncedSearch, showResults, dateFrom, dateTo]);

  useFocusEffect(useCallback(() => { loadFirstPage(); }, [loadFirstPage]));

  const loadMore = async () => {
    if (!cursor || loadingMore || loading) return;
    setLoadingMore(true);
    const page = await getRecordsByDocumentType(documentTypeId, {
      limit: PAGE_SIZE, search: debouncedSearch, dateFrom, dateTo, cursor,
    });
    setRecords(prev => [...prev, ...(page.items as unknown as DocRecord[])]);
    setCursor(page.nextCursor);
    setLoadingMore(false);
  };

  const docColors = DOC_TYPE_COLORS[documentTypeName.toLowerCase().trim()];
  const iconBg    = docColors?.bg    ?? `${COLORS.primary}12`;
  const iconColor = docColors?.icon  ?? COLORS.primary;

  const sections = useMemo(() => {
    const groups = new Map<string, { title: string; data: DocRecord[] }>();
    for (const r of records) {
      const dateIso = r.issuedAt ?? r.createdAt;
      const key = monthKey(dateIso);
      if (!groups.has(key)) groups.set(key, { title: monthLabel(dateIso), data: [] });
      groups.get(key)!.data.push(r);
    }
    return Array.from(groups.values());
  }, [records]);

  const handleDelete = (id: string) => {
    Alert.alert('Delete record?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await deleteRecord(id);
          setRecords(prev => prev.filter(r => r.id !== id));
        },
      },
    ]);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const selectTab = (t: Tab) => {
    setTab(t);
    if (t !== 'browse') { setBrowseYear(null); setBrowseMonth(null); }
    if (t !== 'range')  { setRangeFrom(null); setRangeTo(null); }
  };

  const renderList = () => (
    <>
      <View style={styles.searchContainer}>
        <Searchbar
          placeholder="Search number, customer, phone, amount..."
          value={search}
          onChangeText={setSearch}
          style={styles.searchbar}
          inputStyle={styles.searchInput}
          elevation={0}
          icon={({ size, color }) => <Ionicons name="search" size={size} color={color} />}
          clearIcon={({ size, color }) => <Ionicons name="close-circle" size={size} color={color} />}
        />
      </View>

      {!loading && records.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIconBox}>
            <Ionicons name="document-outline" size={40} color={COLORS.textMuted} />
          </View>
          <Text variant="titleMedium" style={styles.emptyTitle}>
            {!hasAnyRecords ? 'No records yet' : debouncedSearch ? 'No matching records' : 'No records here'}
          </Text>
          <Text variant="bodySmall" style={styles.emptySubtext}>
            {!hasAnyRecords
              ? `Create your first ${documentTypeName}`
              : debouncedSearch ? 'Try a different search term' : 'Nothing in this period'}
          </Text>
          {!hasAnyRecords && (
            <Button
              mode="contained"
              onPress={() => navigateToDocument(navigation, documentTypeId, documentTypeName)}
              style={styles.createBtn}
              contentStyle={{ height: 48 }}
              icon={({ size, color }) => <Ionicons name="add" size={size} color={color} />}
            >
              Create First Record
            </Button>
          )}
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={r => r.id}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionHeader}>{section.title}</Text>
          )}
          ListFooterComponent={loadingMore ? (
            <ActivityIndicator style={styles.footerSpinner} color={COLORS.primary} />
          ) : null}
          renderItem={({ item: r, index, section }) => (
            <>
              {index > 0 && <Divider />}
              <TouchableOpacity
                style={styles.recordRow}
                onPress={() => navigation.navigate('PreviewRecord', { recordId: r.id, documentTypeName })}
                onLongPress={() => handleDelete(r.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.recordIconBox, { backgroundColor: iconBg }]}>
                  <Ionicons name="document-text-outline" size={18} color={iconColor} />
                </View>
                <View style={styles.recordInfo}>
                  <Text style={styles.recordNumber}>{r.number}</Text>
                  <Text style={styles.recordDate}>
                    {r.customerName ? `${r.customerName} · ` : ''}{formatDate(r.issuedAt ?? r.createdAt)}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
              </TouchableOpacity>
              {index === section.data.length - 1 && <View style={styles.sectionGap} />}
            </>
          )}
        />
      )}
    </>
  );

  const renderBrowse = () => {
    if (!browseYear) {
      return (
        <View style={styles.listContent}>
          {years.length === 0 ? (
            <Text style={styles.emptySubtext}>No invoices yet</Text>
          ) : years.map(y => (
            <TouchableOpacity key={y} style={styles.drillRow} onPress={() => setBrowseYear(y)} activeOpacity={0.7}>
              <Text style={styles.drillLabel}>{y}</Text>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          ))}
        </View>
      );
    }
    if (!browseMonth) {
      return (
        <View style={styles.listContent}>
          <TouchableOpacity style={styles.backRow} onPress={() => setBrowseYear(null)}>
            <Ionicons name="chevron-back" size={16} color={COLORS.primary} />
            <Text style={styles.backLabel}>All years</Text>
          </TouchableOpacity>
          {months.map(m => (
            <TouchableOpacity key={m} style={styles.drillRow} onPress={() => setBrowseMonth(m)} activeOpacity={0.7}>
              <Text style={styles.drillLabel}>{monthName(m)} {browseYear}</Text>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          ))}
        </View>
      );
    }
    return (
      <>
        <TouchableOpacity style={styles.backRow} onPress={() => setBrowseMonth(null)}>
          <Ionicons name="chevron-back" size={16} color={COLORS.primary} />
          <Text style={styles.backLabel}>{monthName(browseMonth)} {browseYear}</Text>
        </TouchableOpacity>
        {renderList()}
      </>
    );
  };

  const renderRange = () => {
    if (!(rangeFrom && rangeTo)) {
      return (
        <View style={styles.listContent}>
          <TouchableOpacity style={styles.dateBtn} onPress={() => setPicker('from')} activeOpacity={0.7}>
            <Ionicons name="calendar-outline" size={18} color={COLORS.primary} />
            <Text style={styles.dateBtnText}>
              {rangeFrom ? `From: ${fmtShortDate(rangeFrom)}` : 'Select From Date'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.dateBtn, !rangeFrom && styles.dateBtnDisabled]}
            onPress={() => rangeFrom && setPicker('to')}
            activeOpacity={0.7}
            disabled={!rangeFrom}
          >
            <Ionicons name="calendar-outline" size={18} color={rangeFrom ? COLORS.primary : COLORS.textMuted} />
            <Text style={[styles.dateBtnText, !rangeFrom && { color: COLORS.textMuted }]}>
              {rangeTo ? `To: ${fmtShortDate(rangeTo)}` : 'Select To Date'}
            </Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <>
        <TouchableOpacity style={styles.backRow} onPress={() => { setRangeFrom(null); setRangeTo(null); }}>
          <Ionicons name="chevron-back" size={16} color={COLORS.primary} />
          <Text style={styles.backLabel}>{fmtShortDate(rangeFrom)} – {fmtShortDate(rangeTo)}</Text>
        </TouchableOpacity>
        {renderList()}
      </>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      <Appbar.Header style={styles.appbar} elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} color={COLORS.primary} />
        <Appbar.Content title={`${documentTypeName} Records`} titleStyle={styles.appbarTitle} />
      </Appbar.Header>

      <View style={styles.tabRow}>
        {(['recent', 'browse', 'range'] as Tab[]).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tabChip, tab === t && styles.tabChipActive]}
            onPress={() => selectTab(t)}
            activeOpacity={0.75}
          >
            <Text style={[styles.tabChipText, tab === t && styles.tabChipTextActive]}>
              {t === 'recent' ? 'Recent' : t === 'browse' ? 'Browse History' : 'Date Range'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'recent' && renderList()}
      {tab === 'browse' && renderBrowse()}
      {tab === 'range' && renderRange()}

      <CalendarPickerModal
        visible={picker !== null}
        initialDate={picker === 'from' ? (rangeFrom ?? undefined) : (rangeTo ?? undefined)}
        minDate={picker === 'to' ? (rangeFrom ?? undefined) : undefined}
        maxDate={picker === 'from' ? (rangeTo ?? undefined) : undefined}
        title={picker === 'from' ? 'Select From Date' : 'Select To Date'}
        onClose={() => setPicker(null)}
        onSelect={(d) => {
          if (picker === 'from') setRangeFrom(d); else setRangeTo(d);
          setPicker(null);
        }}
      />
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
  list: { flex: 1 },
  listContent: { padding: 16 },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 4,
  },
  sectionGap: { height: 16 },
  footerSpinner: { paddingVertical: 20 },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
    backgroundColor: COLORS.surface,
  },
  recordIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: `${COLORS.primary}12`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordInfo: { flex: 1 },
  recordNumber: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  recordDate: { fontSize: 13, fontWeight: '500', color: COLORS.textSecondary, marginTop: 2 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  emptyIconBox: {
    width: 80,
    height: 80,
    borderRadius: 16,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontWeight: '600', color: COLORS.text },
  emptySubtext: { color: COLORS.textSecondary },
  createBtn: { borderRadius: 14, marginTop: 8 },
  drillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  drillLabel: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backLabel: { fontSize: 14, fontWeight: '600', color: COLORS.primary },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dateBtnDisabled: { opacity: 0.5 },
  dateBtnText: { fontSize: 15, fontWeight: '600', color: COLORS.text },
});
