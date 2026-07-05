import React, { useCallback, useRef, useState } from 'react';
import {
  View, StyleSheet, ScrollView, Alert, TouchableOpacity,
  Animated, Text, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { DocumentType, DocRecord } from '../types';
import {
  getTemplateById, isTemplatePinned, pinTemplate, unpinTemplate,
  getInvoiceCountByTemplate,
} from '../services/templateService';
import { getRecordsByDocumentType, deleteRecord } from '../services/invoiceService';
import { navigateToDocument } from '../navigation/documentRouter';
import { cardShadow } from '../utils/shadow';

// ─── Design tokens ────────────────────────────────────────────────────────────

const T = {
  bg:      '#F8FAFC',
  surface: '#FFFFFF',
  primary: '#F97316',
  text:    '#0F172A',
  sub:     '#64748B',
  success: '#22C55E',
  border:  '#F1F5F9',
};

// Single consistent shadow system — applied to every card
const CARD_SHADOW = cardShadow('#0F172A', 4, 0.06, 12, { elevation: 2 });

// ─── ScaleCard ────────────────────────────────────────────────────────────────

function ScaleCard({
  onPress, style, children,
}: { onPress?: () => void; style?: any; children: React.ReactNode }) {
  const scale = useRef(new Animated.Value(1)).current;
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

// ─── Types ────────────────────────────────────────────────────────────────────

type Nav   = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'DocumentDashboard'>;

// ─── Chip metadata ────────────────────────────────────────────────────────────

const GST_CHIPS: Array<{ label: string; icon: string }> = [
  { label: 'GST Ready',   icon: 'shield-checkmark-outline' },
  { label: 'Auto Tax',    icon: 'calculator-outline'        },
  { label: 'PDF Export',  icon: 'document-outline'          },
];

const DEFAULT_CHIPS: Array<{ label: string; icon: string }> = [
  { label: 'Quick Create', icon: 'flash-outline'    },
  { label: 'PDF Export',   icon: 'document-outline' },
];

// ─── Screen ───────────────────────────────────────────────────────────────────

export function DocumentDashboardScreen() {
  const navigation = useNavigation<Nav>();
  const route      = useRoute<Route>();
  const { documentTypeId, documentTypeName } = route.params;

  const [docType,       setDocType]       = useState<DocumentType | null>(null);
  const [recordCount,   setRecordCount]   = useState(0);
  const [pinned,        setPinned]        = useState(false);
  const [recentRecords, setRecentRecords] = useState<DocRecord[]>([]);

  useFocusEffect(useCallback(() => {
    let active = true;
    (async () => {
      const [dt, count, pin, records] = await Promise.all([
        getTemplateById(documentTypeId),
        getInvoiceCountByTemplate(documentTypeId),
        isTemplatePinned(documentTypeId),
        getRecordsByDocumentType(documentTypeId, { limit: 3 }),
      ]);
      if (!active) return;
      setDocType(dt as DocumentType);
      setRecordCount(count);
      setPinned(pin);
      setRecentRecords(records.items as unknown as DocRecord[]);
    })();
    return () => { active = false; };
  }, [documentTypeId]));

  const togglePin = async () => {
    if (pinned) { await unpinTemplate(documentTypeId); setPinned(false); }
    else        { await pinTemplate(documentTypeId);   setPinned(true); }
  };

  const handleDeleteRecord = (id: string) => {
    Alert.alert('Delete record?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await deleteRecord(id);
          const updated = await getRecordsByDocumentType(documentTypeId, { limit: 3 });
          setRecentRecords(updated.items as unknown as DocRecord[]);
          setRecordCount(prev => prev - 1);
        },
      },
    ]);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    if (d.toDateString() === new Date().toDateString()) {
      return `Today ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
    }
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  if (!docType) return null;

  const displayName = documentTypeName ?? docType.name;
  const category    = ((docType as any).category as string) ?? 'billing';
  const isGst       = displayName.toLowerCase().includes('gst');

  const handleCreate = () =>
    navigateToDocument(navigation, documentTypeId, displayName, (docType as any).templateType, (docType as any).category);

  const ctaLabel = isGst ? 'Create GST Invoice' : `Create ${displayName}`;
  const heroDesc = isGst
    ? 'Create GST-compliant invoices for customers and businesses.'
    : `Create, manage and share your ${displayName.toLowerCase()}s.`;
  const chips    = isGst ? GST_CHIPS : DEFAULT_CHIPS;
  const hasRecords = recentRecords.length > 0;

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={S.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor={T.bg} />

      {/* ── App Bar ── */}
      <View style={S.appBar}>
        <TouchableOpacity style={S.appBarBtn} onPress={() => navigation.goBack()} activeOpacity={0.75}>
          <Ionicons name="arrow-back" size={22} color={T.text} />
        </TouchableOpacity>
        <Text style={S.appBarTitle}>{displayName}</Text>
        <TouchableOpacity style={S.appBarBtn} onPress={togglePin} activeOpacity={0.75}>
          <Ionicons
            name={pinned ? 'bookmark' : 'bookmark-outline'}
            size={22}
            color={pinned ? T.primary : T.sub}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={S.scroll}
        contentContainerStyle={S.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Hero Card ── */}
        <ScaleCard onPress={handleCreate} style={S.heroCard}>
          <LinearGradient
            colors={['#FFFFFF', '#FFF7ED']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={S.heroBlob} />

          <View style={S.heroContent}>
            {/* Category + record count badges */}
            <View style={S.heroBadgeRow}>
              <View style={S.heroBadge}>
                <Text style={S.heroBadgeText}>{category.charAt(0).toUpperCase() + category.slice(1)}</Text>
              </View>
              {recordCount > 0 && (
                <View style={[S.heroBadge, { backgroundColor: '#F0FDF4' }]}>
                  <Text style={[S.heroBadgeText, { color: T.success }]}>{recordCount} Records</Text>
                </View>
              )}
            </View>

            {/* Title + description */}
            <Text style={S.heroTitle}>{displayName}</Text>
            <Text style={S.heroSub}>{heroDesc}</Text>

            {/* Insight chips */}
            <View style={S.chipsRow}>
              {chips.map(({ label, icon }) => (
                <View key={label} style={S.chip}>
                  <Ionicons name={icon as any} size={11} color={T.primary} style={{ marginRight: 3 }} />
                  <Text style={S.chipText}>{label}</Text>
                </View>
              ))}
            </View>
          </View>
        </ScaleCard>

        {/* ── Primary CTA ── */}
        <TouchableOpacity style={S.cta} onPress={handleCreate} activeOpacity={0.88}>
          <Ionicons name="add-circle" size={22} color="#fff" />
          <Text style={S.ctaText}>{ctaLabel}</Text>
        </TouchableOpacity>

        {/* ── Recent Invoices ── */}
        {hasRecords ? (
          <>
            <Text style={S.sectionTitle}>Recent</Text>
            <View style={S.recentCard}>
              {recentRecords.map((r, idx) => (
                <React.Fragment key={r.id}>
                  {idx > 0 && <View style={S.rowDivider} />}
                  <TouchableOpacity
                    style={S.recordRow}
                    onPress={() => navigation.navigate('PreviewRecord', { recordId: r.id, documentTypeName: displayName })}
                    onLongPress={() => handleDeleteRecord(r.id)}
                    activeOpacity={0.7}
                  >
                    <View style={S.docIconBox}>
                      <Ionicons name="document-text-outline" size={16} color="#475569" />
                    </View>
                    <View style={S.recordInfo}>
                      <Text style={S.recordNumber}>{r.number}</Text>
                      <Text style={S.recordDate}>{formatDate(r.createdAt)}</Text>
                    </View>
                    <View style={S.chevronCircle}>
                      <Ionicons name="chevron-forward" size={14} color={T.sub} />
                    </View>
                  </TouchableOpacity>
                </React.Fragment>
              ))}

              {/* View All footer */}
              <View style={S.rowDivider} />
              <TouchableOpacity
                style={S.viewAllRow}
                onPress={() => navigation.navigate('RecordList', { documentTypeId, documentTypeName: displayName })}
                activeOpacity={0.7}
              >
                <Text style={S.viewAllLabel}>View All Invoices</Text>
                <View style={S.viewAllRight}>
                  <View style={S.countBadge}>
                    <Text style={S.countBadgeText}>{recordCount}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={T.primary} />
                </View>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          /* ── Empty State ── */
          <View style={S.emptyCard}>
            <View style={S.emptyIconBox}>
              <Ionicons name="document-text-outline" size={32} color={T.sub} />
            </View>
            <Text style={S.emptyTitle}>
              {isGst ? 'No GST invoices yet' : `No ${displayName.toLowerCase()}s yet`}
            </Text>
            <Text style={S.emptySub}>
              {isGst
                ? 'Create your first invoice to start tracking sales.'
                : `Create your first ${displayName.toLowerCase()} to get started.`}
            </Text>
          </View>
        )}

        {/* ── Action Group ── */}
        <View style={S.actionGroup}>
          {!hasRecords && (
            <>
              <ActionRow
                icon="list-outline"
                iconBg="#EFF6FF"
                iconColor="#1D4ED8"
                title="View All Invoices"
                subtitle={`${recordCount} total`}
                badge={recordCount > 0 ? String(recordCount) : undefined}
                onPress={() => navigation.navigate('RecordList', { documentTypeId, documentTypeName: displayName })}
              />
              <View style={S.rowDivider} />
            </>
          )}
          <ActionRow
            icon="brush-outline"
            iconBg="#F5F3FF"
            iconColor="#7C3AED"
            title="Invoice Design"
            subtitle="Fields, labels, layout"
            onPress={() => navigation.navigate('FormDesigner', { documentTypeId, documentTypeName: displayName })}
          />
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── FAB ── */}
      <TouchableOpacity style={S.fab} onPress={handleCreate} activeOpacity={0.85}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// ─── Action Row ───────────────────────────────────────────────────────────────

function ActionRow({
  icon, iconBg, iconColor, title, subtitle, badge, onPress,
}: {
  icon: string; iconBg: string; iconColor: string;
  title: string; subtitle: string; badge?: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={S.actionRow} onPress={onPress} activeOpacity={0.7}>
      <View style={[S.actionIconBox, { backgroundColor: iconBg }]}>
        <Ionicons name={icon as any} size={20} color={iconColor} />
      </View>
      <View style={S.actionText}>
        <Text style={S.actionTitle}>{title}</Text>
        <Text style={S.actionSub}>{subtitle}</Text>
      </View>
      {badge !== undefined && (
        <View style={S.countBadge}>
          <Text style={S.countBadgeText}>{badge}</Text>
        </View>
      )}
      <View style={S.chevronCircle}>
        <Ionicons name="chevron-forward" size={14} color={T.sub} />
      </View>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: T.bg },
  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24 },

  // App Bar (M3: 56dp)
  appBar: {
    height: 56,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12,
    backgroundColor: T.bg,
  },
  appBarBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: T.surface,
    alignItems: 'center', justifyContent: 'center',
    ...CARD_SHADOW,
  },
  appBarTitle: {
    flex: 1, textAlign: 'center',
    fontSize: 20, fontWeight: '700', color: T.text,
  },

  // Hero Card
  heroCard: {
    borderRadius: 16, marginBottom: 12,
    overflow: 'hidden',
    ...CARD_SHADOW,
  },
  heroBlob: {
    position: 'absolute', width: 140, height: 140,
    borderRadius: 70, backgroundColor: '#FFDDB5',
    bottom: -40, right: -40, opacity: 0.35,
  },
  heroContent:  { padding: 20 },
  heroBadgeRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  heroBadge: {
    height: 26, borderRadius: 13, paddingHorizontal: 10,
    backgroundColor: '#FFF7ED',
    alignItems: 'center', justifyContent: 'center',
  },
  heroBadgeText: { fontSize: 11, fontWeight: '700', color: T.primary },
  heroTitle:     { fontSize: 22, fontWeight: '700', color: T.text, marginBottom: 6 },
  heroSub:       { fontSize: 14, color: T.sub, lineHeight: 20, marginBottom: 14 },

  // Insight chips
  chipsRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row', alignItems: 'center',
    height: 26, borderRadius: 13, paddingHorizontal: 10,
    backgroundColor: 'rgba(249,115,22,0.08)',
    borderWidth: 1, borderColor: 'rgba(249,115,22,0.18)',
  },
  chipText: { fontSize: 11, fontWeight: '600', color: T.primary },

  // Primary CTA (M3: 52dp, 14dp radius)
  cta: {
    height: 52, borderRadius: 14, marginBottom: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: T.primary,
    ...cardShadow(T.primary, 6, 0.25, 16, { elevation: 6 }),
  },
  ctaText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },

  // Section title
  sectionTitle: {
    fontSize: 15, fontWeight: '700', color: T.text,
    marginBottom: 8, marginTop: 4,
  },

  // Recent card
  recentCard: {
    borderRadius: 16, backgroundColor: T.surface,
    marginBottom: 12, overflow: 'hidden',
    ...CARD_SHADOW,
  },

  // Record rows (M3: 60dp, 40dp icon box)
  recordRow: {
    height: 60, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, gap: 12,
  },
  docIconBox: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center', justifyContent: 'center',
  },
  recordInfo:   { flex: 1 },
  recordNumber: { fontSize: 14, fontWeight: '700', color: T.text },
  recordDate:   { fontSize: 12, color: T.sub, marginTop: 1 },

  // View All footer row
  viewAllRow: {
    height: 48, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14,
  },
  viewAllLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: T.primary },
  viewAllRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  // Count badge (orange pill)
  countBadge: {
    minWidth: 24, height: 22, borderRadius: 11, paddingHorizontal: 7,
    backgroundColor: 'rgba(249,115,22,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  countBadgeText: { fontSize: 11, fontWeight: '700', color: T.primary },

  // Empty state card
  emptyCard: {
    borderRadius: 16, backgroundColor: T.surface,
    padding: 32, marginBottom: 12,
    alignItems: 'center',
    ...CARD_SHADOW,
  },
  emptyIconBox: {
    width: 64, height: 64, borderRadius: 16,
    backgroundColor: T.border,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: T.text, marginBottom: 6, textAlign: 'center' },
  emptySub:   { fontSize: 14, color: T.sub, textAlign: 'center', lineHeight: 20 },

  // Action Group (M3: 16dp radius, 60dp rows, 40dp icon boxes)
  actionGroup: {
    borderRadius: 16, backgroundColor: T.surface, padding: 6,
    marginBottom: 12,
    ...CARD_SHADOW,
  },
  actionRow: {
    height: 60, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, gap: 12,
  },
  actionIconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actionText:    { flex: 1 },
  actionTitle:   { fontSize: 15, fontWeight: '600', color: T.text },
  actionSub:     { fontSize: 12, color: T.sub, marginTop: 1 },
  chevronCircle: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: T.border,
    alignItems: 'center', justifyContent: 'center',
  },
  rowDivider: { height: 1, backgroundColor: T.border, marginHorizontal: 10 },

  // FAB (M3: 56dp)
  fab: {
    position: 'absolute', bottom: 24, right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: T.primary,
    alignItems: 'center', justifyContent: 'center',
    ...cardShadow(T.primary, 8, 0.30, 20, { elevation: 8 }),
  },
});
