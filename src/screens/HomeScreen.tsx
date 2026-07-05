import React, { useCallback, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  StatusBar, Animated, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { DocumentType } from '../types';
import { getPinnedTemplates } from '../services/templateService';
import { getRecentRecords, deleteRecord, getBusinessSnapshot, BusinessSnapshot } from '../services/invoiceService';
import { getBusinessSettings, getSession } from '../services/businessService';
import { DOC_TYPE_COLORS } from '../constants';
import { navigateToDocument } from '../navigation/documentRouter';
import { cardShadow } from '../utils/shadow';
import { formatCurrencyFromPaise, formatDateWeekday, formatDate as formatDateStd } from '../services/formatService';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// ─── Design tokens ────────────────────────────────────────────────────────────

const T = {
  bg:      '#F8FAFC',
  surface: '#FFFFFF',
  primary: '#F97316',
  text:    '#0F172A',
  sub:     '#64748B',
  muted:   '#94A3B8',
  border:  '#F1F5F9',
  blue:    '#1D4ED8',
  purple:  '#7C3AED',
};

const CARD_SHADOW = cardShadow('#0F172A', 4, 0.06, 12, { elevation: 2 });

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function fmtMoney(paise: number): string {
  return formatCurrencyFromPaise(paise);
}

function getTodayLabel(): string {
  return formatDateWeekday(new Date().toISOString());
}

const CATEGORY_ICON: Record<string, string> = {
  billing:   'receipt-outline',
  services:  'construct-outline',
  logistics: 'car-outline',
  education: 'school-outline',
  custom:    'document-text-outline',
};

function resolveIcon(typeIcon: string, typeCategory: string): string {
  return typeIcon && typeIcon !== 'cart-outline'
    ? typeIcon
    : (CATEGORY_ICON[typeCategory] ?? 'document-text-outline');
}

// ─── ScaleCard ────────────────────────────────────────────────────────────────

function ScaleCard({
  onPress, style, children,
}: { onPress?: () => void; style?: any; children: React.ReactNode }) {
  const scale   = useRef(new Animated.Value(1)).current;
  const pressIn  = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
  const pressOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 30, bounciness: 4 }).start();
  return (
    <TouchableOpacity activeOpacity={1} onPress={onPress} onPressIn={pressIn} onPressOut={pressOut}>
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const [pinned,       setPinned]       = useState<DocumentType[]>([]);
  const [recent,       setRecent]       = useState<Array<any>>([]);
  const [businessName, setBusinessName] = useState('My Business');
  const [snapshot,     setSnapshot]     = useState<BusinessSnapshot | null>(null);

  useFocusEffect(useCallback(() => {
    let active = true;
    (async () => {
      const { businessId } = getSession();
      const [p, r, s, snap] = await Promise.all([
        getPinnedTemplates(businessId),
        getRecentRecords(5),
        getBusinessSettings(),
        getBusinessSnapshot(businessId),
      ]);
      if (!active) return;
      setPinned(p as DocumentType[]);
      setRecent(r);
      setBusinessName(s?.name ?? 'My Business');
      setSnapshot(snap);
    })();
    return () => { active = false; };
  }, []));

  const handleDeleteRecord = (id: string) => {
    Alert.alert('Delete record?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteRecord(id);
            setRecent(prev => prev.filter(r => r.id !== id));
          } catch (e) {
            Alert.alert('Error', 'Could not delete record. It may have associated payments.');
          }
        },
      },
    ]);
  };

  const handleCreateDocument = () => navigation.navigate('MoreDocuments');

  const handleAiDesign = () => {
    const featured = pinned[0] as any;
    if (featured) {
      navigation.navigate('TemplatePicker', {
        documentTypeId:   featured.id,
        documentTypeName: featured.name,
      });
    } else {
      navigation.navigate('CreateDocumentType');
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return formatDateStd(iso);
  };

  const docColors = (typeName: string) =>
    DOC_TYPE_COLORS[typeName?.toLowerCase().trim()] ?? { bg: '#F1F5F9', icon: T.sub };

  const initials = businessName
    .split(' ')
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={S.safe} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor={T.bg} />

      {/* ── Header ── */}
      <View style={S.header}>
        <View style={S.headerLeft}>
          <Text style={S.headerGreeting}>{getGreeting()}</Text>
          <Text style={S.headerBusiness} numberOfLines={1}>{businessName}</Text>
        </View>
        <TouchableOpacity
          style={S.searchBtn}
          onPress={() => (navigation as any).navigate('GlobalSearch')}
          activeOpacity={0.8}
        >
          <Ionicons name="search" size={20} color={T.text} />
        </TouchableOpacity>
        <TouchableOpacity
          style={S.avatar}
          onPress={() => (navigation as any).navigate('Settings')}
          activeOpacity={0.8}
        >
          <Text style={S.avatarText}>{initials}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={S.scroll}
        contentContainerStyle={S.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Date strip ── */}
        <View style={S.dateStrip}>
          <Ionicons name="calendar-outline" size={13} color={T.muted} />
          <Text style={S.dateText}>{getTodayLabel()}</Text>
        </View>

        {/* ── Primary CTA ── */}
        <TouchableOpacity style={S.cta} onPress={handleCreateDocument} activeOpacity={0.88}>
          <Ionicons name="add-circle" size={22} color="#fff" />
          <Text style={S.ctaText}>Create Document</Text>
          <View style={S.ctaArrow}>
            <Ionicons name="arrow-forward" size={15} color="rgba(255,255,255,0.8)" />
          </View>
        </TouchableOpacity>

        {/* ── AI Design secondary action ── */}
        <ScaleCard style={S.aiCard} onPress={handleAiDesign}>
          <View style={[S.quickIconBox, { backgroundColor: '#F5F3FF' }]}>
            <Ionicons name="sparkles" size={22} color={T.purple} />
          </View>
          <View style={S.aiCardText}>
            <Text style={S.aiCardTitle}>Design with AI</Text>
            <Text style={S.aiCardSub}>Generate smart templates in seconds</Text>
          </View>
          <View style={[S.ctaArrow, { backgroundColor: 'rgba(124,58,237,0.12)' }]}>
            <Ionicons name="arrow-forward" size={15} color={T.purple} />
          </View>
        </ScaleCard>

        {/* ── Business Snapshot ── */}
        {snapshot && (snapshot.documentsToday > 0 || snapshot.pendingPaymentsCount > 0) && (
          <View style={S.snapshotRow}>
            <View style={S.snapshotBox}>
              <Text style={S.snapshotValue}>{snapshot.documentsToday}</Text>
              <Text style={S.snapshotLabel}>Today</Text>
            </View>
            <View style={S.snapshotDivider} />
            <View style={S.snapshotBox}>
              <Text style={S.snapshotValue}>{fmtMoney(snapshot.amountTodayPaise)}</Text>
              <Text style={S.snapshotLabel}>Today's Amount</Text>
            </View>
            <View style={S.snapshotDivider} />
            <View style={S.snapshotBox}>
              <Text style={[S.snapshotValue, snapshot.pendingPaymentsCount > 0 && { color: T.primary }]}>
                {snapshot.pendingPaymentsCount}
              </Text>
              <Text style={S.snapshotLabel}>Pending</Text>
            </View>
          </View>
        )}

        {/* ── Pinned Documents ── */}
        {pinned.length > 0 && (
          <>
            <View style={S.sectionHeader}>
              <Text style={S.sectionTitle}>Your Documents</Text>
              <TouchableOpacity onPress={handleCreateDocument} activeOpacity={0.7}>
                <Text style={S.viewAll}>See all</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={S.pinnedScroll}
              contentContainerStyle={S.pinnedContent}
            >
              {pinned.map(doc => {
                const dc   = docColors(doc.name);
                const icon = resolveIcon((doc as any).icon ?? '', (doc as any).category ?? '');
                return (
                  <TouchableOpacity
                    key={doc.id}
                    style={S.pinnedCard}
                    onPress={() =>
                      navigateToDocument(
                        navigation, doc.id, doc.name,
                        (doc as any).templateType, (doc as any).category,
                      )
                    }
                    activeOpacity={0.8}
                  >
                    <View style={[S.pinnedIconBox, { backgroundColor: dc.bg }]}>
                      <Ionicons name={icon as any} size={20} color={dc.icon} />
                    </View>
                    <Text style={S.pinnedName} numberOfLines={2}>{doc.name}</Text>
                  </TouchableOpacity>
                );
              })}
              {/* Add More card */}
              <TouchableOpacity
                style={[S.pinnedCard, S.pinnedAddCard]}
                onPress={handleCreateDocument}
                activeOpacity={0.8}
              >
                <View style={[S.pinnedIconBox, { backgroundColor: `${T.primary}12` }]}>
                  <Ionicons name="add" size={20} color={T.primary} />
                </View>
                <Text style={[S.pinnedName, { color: T.primary }]}>Add More</Text>
              </TouchableOpacity>
            </ScrollView>
          </>
        )}

        {/* ── Recent Activity / Empty State ── */}
        {recent.length > 0 ? (
          <>
            <View style={S.sectionHeader}>
              <Text style={S.sectionTitle}>Recent</Text>
              <TouchableOpacity onPress={() => (navigation as any).navigate('Records')} activeOpacity={0.7}>
                <Text style={S.viewAll}>View all</Text>
              </TouchableOpacity>
            </View>
            <View style={S.recentCard}>
              {recent.map((r, idx) => {
                const dc = docColors(r.typeName);
                return (
                  <React.Fragment key={r.id}>
                    {idx > 0 && <View style={S.rowDivider} />}
                    <TouchableOpacity
                      style={S.recentRow}
                      onPress={() => navigation.navigate('PreviewRecord', {
                        recordId: r.id, documentTypeName: r.typeName,
                      })}
                      onLongPress={() => handleDeleteRecord(r.id)}
                      activeOpacity={0.7}
                    >
                      <View style={[S.recentIconBox, { backgroundColor: dc.bg }]}>
                        <Ionicons name={resolveIcon(r.typeIcon, r.typeCategory) as any} size={18} color={dc.icon} />
                      </View>
                      <View style={S.recentInfo}>
                        <Text style={S.recentNumber}>{r.number}</Text>
                        <Text style={S.recentType}>{r.typeName}</Text>
                      </View>
                      <Text style={S.recentDate}>{formatDate(r.createdAt)}</Text>
                    </TouchableOpacity>
                  </React.Fragment>
                );
              })}
            </View>
          </>
        ) : (
          <View style={S.emptyCard}>
            <View style={S.emptyIconBox}>
              <Ionicons name="document-text-outline" size={32} color={T.muted} />
            </View>
            <Text style={S.emptyTitle}>No documents yet</Text>
            <Text style={S.emptySub}>Create your first document to start tracking invoices and records.</Text>
            <TouchableOpacity style={S.emptyBtn} onPress={handleCreateDocument} activeOpacity={0.85}>
              <Text style={S.emptyBtnText}>Create Document</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: T.bg },
  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 24 },

  // Header — 2-line greeting + business name, avatar button
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 2,
    backgroundColor: T.bg,
  },
  headerLeft:     { flex: 1, marginRight: 12 },
  headerGreeting: { fontSize: 12, fontWeight: '500', color: T.muted, letterSpacing: 0.2 },
  headerBusiness: { fontSize: 20, fontWeight: '700', color: T.text, marginTop: 1 },

  // Avatar button (orange circle with initials → Settings tab)
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: T.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 14, fontWeight: '700', color: '#fff', letterSpacing: 0.5 },

  searchBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: T.surface, borderWidth: 1, borderColor: T.border,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 8,
  },

  // Date strip
  dateStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingVertical: 12,
  },
  dateText: { fontSize: 12, color: T.muted, fontWeight: '500' },

  // Primary CTA (M3: 52dp, 14dp radius, orange shadow)
  cta: {
    height: 52, borderRadius: 14, marginBottom: 12,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 18,
    backgroundColor: T.primary,
    ...cardShadow(T.primary, 6, 0.25, 16, { elevation: 6 }),
  },
  ctaText:  { flex: 1, fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  ctaArrow: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },

  // AI Design secondary card (full-width row, purple tint)
  aiCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 16, padding: 16, marginBottom: 12,
    backgroundColor: T.surface,
    borderWidth: 1, borderColor: 'rgba(124,58,237,0.12)',
    ...CARD_SHADOW,
  },
  aiCardText:  { flex: 1 },
  aiCardTitle: { fontSize: 15, fontWeight: '700', color: T.purple },
  aiCardSub:   { fontSize: 12, color: T.sub, marginTop: 2 },
  quickIconBox: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },

  // Business Snapshot
  snapshotRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 16, backgroundColor: T.surface,
    paddingVertical: 14, marginBottom: 12,
    ...CARD_SHADOW,
  },
  snapshotBox: { flex: 1, alignItems: 'center' },
  snapshotValue: { fontSize: 16, fontWeight: '700', color: T.text },
  snapshotLabel: { fontSize: 11, color: T.sub, marginTop: 2 },
  snapshotDivider: { width: 1, height: 32, backgroundColor: T.border },

  // Section headers
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 10, marginTop: 8,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: T.text },
  viewAll:      { fontSize: 13, fontWeight: '600', color: T.primary },

  // Pinned Documents — horizontal scroll cards
  pinnedScroll:  { marginHorizontal: -16, marginBottom: 12 },
  pinnedContent: { paddingHorizontal: 16, gap: 10, paddingBottom: 4 },
  pinnedCard: {
    width: 84, borderRadius: 16, padding: 12,
    backgroundColor: T.surface, alignItems: 'center',
    ...CARD_SHADOW,
  },
  pinnedAddCard: {
    borderWidth: 1.5, borderColor: `${T.primary}30`,
    borderStyle: 'dashed', backgroundColor: `${T.primary}05`,
  },
  pinnedIconBox: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  pinnedName: {
    fontSize: 11, fontWeight: '600', color: T.text,
    textAlign: 'center', lineHeight: 14,
  },

  // Recent Activity — card with M3 60dp rows
  recentCard: {
    borderRadius: 16, backgroundColor: T.surface,
    overflow: 'hidden', marginBottom: 12,
    ...CARD_SHADOW,
  },
  recentRow: {
    height: 60, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, gap: 12,
  },
  recentIconBox: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  recentInfo:   { flex: 1 },
  recentNumber: { fontSize: 14, fontWeight: '700', color: T.text },
  recentType:   { fontSize: 12, color: T.sub, marginTop: 1 },
  recentDate:   { fontSize: 12, fontWeight: '500', color: T.muted },
  rowDivider:   { height: 1, backgroundColor: T.border, marginHorizontal: 14 },

  // Empty state card
  emptyCard: {
    borderRadius: 16, backgroundColor: T.surface,
    padding: 32, alignItems: 'center', marginTop: 8, marginBottom: 12,
    ...CARD_SHADOW,
  },
  emptyIconBox: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: T.border,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: T.text, marginBottom: 6, textAlign: 'center' },
  emptySub:   { fontSize: 14, color: T.sub, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  emptyBtn: {
    height: 44, borderRadius: 12, paddingHorizontal: 24,
    backgroundColor: T.primary, alignItems: 'center', justifyContent: 'center',
  },
  emptyBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
});
