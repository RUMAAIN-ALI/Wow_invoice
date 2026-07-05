/**
 * StyleStudioScreen — Document Style Studio
 *
 * Architecture:
 *  - Logic Layer:   All state, data loading, and handlers live in this file
 *  - Gesture Layer: Reanimated 3 + RNGH v3 bottom sheet (no library dependency)
 *  - UI Layer:      Flat, token-based styles — zero inline magic numbers
 *
 * Bottom sheet has 3 snap points: Peek (28%), Default (42%), Expanded (88%)
 * Preview sits above the sheet and resizes with it via Reanimated shared values.
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  TouchableHighlight,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Switch,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';

import { RootStackParamList } from '../navigation/types';
import { HtmlPreview } from '../components/HtmlPreview';
import { cardShadow } from '../utils/shadow';
import {
  getActivePrintProfile,
  listPrintProfiles,
  createPrintProfile,
  setDefaultPrintProfile,
  updatePrintProfileById,
} from '../services/printProfileService';
import { setTemplateId } from '../services/designStorage';
import { SYSTEM_TEMPLATES } from '../invoice/templates/registry';
import { PRESETS, ThemePreset } from '../invoice/themes/registry';
import { resolveTheme } from '../invoice/themes/resolver';
import { renderInvoice } from '../invoice/renderer/renderer';
import { DocumentTheme } from '../invoice/themes/document-theme';
import { BusinessPreferences } from '../invoice/preferences/business-preferences';
import { generateThemePatch } from '../services/aiTemplateService';
import { PrintProfile } from '../types';

// ─── Design tokens ─────────────────────────────────────────────────────────
const T = {
  // Colors
  bg: '#F8FAFC',
  surface: '#FFFFFF',
  border: '#E2E8F0',
  borderStrong: '#CBD5E1',
  accent: '#F97316',
  accentLight: '#FFF7ED',
  accentDark: '#EA580C',
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  danger: '#EF4444',
  success: '#22C55E',
  // Spacing (8dp grid)
  sp2: 2,
  sp4: 4,
  sp8: 8,
  sp12: 12,
  sp16: 16,
  sp20: 20,
  sp24: 24,
  sp32: 32,
  // Radius
  r4: 4,
  r8: 8,
  r10: 10,
  r12: 12,
  r14: 14,
  r20: 20,
  r28: 28,
  r99: 999,
  // Typography
  fs11: 11,
  fs13: 13,
  fs14: 14,
  fs15: 15,
  fs17: 17,
  fs20: 20,
  fs24: 24,
};

// ─── Constants ──────────────────────────────────────────────────────────────

const ACCENT_COLORS = [
  { name: 'Saffron Orange', hex: '#F97316' },
  { name: 'Modern Blue',    hex: '#2563EB' },
  { name: 'Royal Navy',     hex: '#1E3A8A' },
  { name: 'Forest Green',   hex: '#16A34A' },
  { name: 'Deep Purple',    hex: '#7C3AED' },
  { name: 'Charcoal',       hex: '#1E293B' },
  { name: 'Crimson Red',    hex: '#DC2626' },
  { name: 'Slate',          hex: '#475569' },
];

const FONTS: { label: string; value: string; sample: string }[] = [
  { label: 'Sans Serif',   value: 'Arial',   sample: 'Aa' },
  { label: 'Inter',        value: 'Inter',   sample: 'Aa' },
  { label: 'Roboto',       value: 'Roboto',  sample: 'Aa' },
  { label: 'Serif',        value: 'Georgia', sample: 'Aa' },
];

const TABLE_STYLES: { label: string; value: string }[] = [
  { label: 'Striped',  value: 'striped'  },
  { label: 'Bordered', value: 'bordered' },
  { label: 'Clean',    value: 'minimal'  },
];

const LOGO_POSITIONS: { label: string; value: string }[] = [
  { label: 'Left',   value: 'left'   },
  { label: 'Center', value: 'center' },
  { label: 'Right',  value: 'right'  },
];

const PREVIEW_DATA = {
  recordNumber: 'INV-2026-0042',
  recordCreatedAt: '29 June 2026',
  documentTypeName: 'Tax Invoice',
  customerName: 'Eco Farms Organic Ltd',
  customerState: 'Karnataka',
  items: [
    { name: 'Organic Premium Fertilizers', qty: 50, price: 350, hsn: '3101', unit: 'BAG', gstPct: 5,  discount: 0, taxableValue: 17500 },
    { name: 'Eco Soil Booster Liquid',     qty: 10, price: 1200, hsn: '3808', unit: 'LTR', gstPct: 18, discount: 0, taxableValue: 12000 },
  ],
  extraFields: [
    { label: 'PO Number',     value: 'PO-98765' },
    { label: 'Challan Number', value: 'DC-00352' },
  ],
  sellerName:          'YourCompany Solutions Ltd',
  sellerAddress:       '101 Tech Hub, Block 4\nBengaluru, Karnataka - 560001',
  sellerGstin:         '29AAAAA1111A1Z1',
  sellerState:         'Karnataka',
  sellerPhone:         '+91 9876543210',
  sellerEmail:         'billing@yourcompany.in',
  sellerUpiId:         'yourcompany@ybl',
  sellerBankName:      'ICICI Bank Ltd',
  sellerAccountNumber: '123456789012',
  sellerIfsc:          'ICIC0001234',
};

const BASE_THEME: DocumentTheme = {
  meta:  { version: 3, id: 'base', name: 'Base', isSystem: true },
  style: { fontFamily: 'Arial', accentColor: '#F97316', density: 'comfortable', borderRadius: 'rounded-md' },
  table: { style: 'striped', density: 'comfortable' },
};

const DEFAULT_PREFS: BusinessPreferences = {
  showLogo: true, logoSize: 'medium', logoPosition: 'left', showBusinessName: true, showAddress: true,
  showPhone: true, showEmail: true, showGstin: true, showHsn: true,
  showUnit: true, showGstPct: true, showDiscount: true,
  showPaymentSection: true, showQrCode: true, qrPosition: 'payment-details',
  showBankDetails: true, showSignature: true, signaturePosition: 'bottom-right',
  paperSize: 'a4', currencyCode: 'INR', dateFormat: 'DD MMMM YYYY',
  footerMessage: 'Thank you for your business.',
};

type Tab = 'presets' | 'appearance' | 'table' | 'branding';
type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'StyleStudio'>;

// ─── Tiny mini-invoice thumbnail renderer ───────────────────────────────────

function PresetThumbnail({ templateId, accent }: { templateId: string; accent: string }) {
  const isDark = templateId === 'bold';
  const bg     = isDark ? '#1F2937' : '#FAFAFA';
  const line   = isDark ? '#374151' : '#E5E7EB';
  const muted  = isDark ? '#9CA3AF' : '#94A3B8';

  if (templateId === 'modern') {
    return (
      <View style={{ flex: 1, backgroundColor: bg }}>
        <View style={{ height: 20, backgroundColor: accent, paddingHorizontal: 6, paddingVertical: 4, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 5, color: '#fff', fontWeight: '700', letterSpacing: 0.5 }}>INVOICE</Text>
          <Text style={{ fontSize: 4, color: 'rgba(255,255,255,0.7)' }}>#1042</Text>
        </View>
        <View style={{ padding: 6 }}>
          <Text style={{ fontSize: 3.5, color: muted, marginBottom: 2 }}>Total Due</Text>
          <Text style={{ fontSize: 7, color: isDark ? '#F9FAFB' : '#0F172A', fontWeight: '700', marginBottom: 6 }}>₹29,500</Text>
          {[1, 2].map(i => (
            <View key={i} style={{ height: 7, backgroundColor: line, borderRadius: 2, marginBottom: 3 }} />
          ))}
        </View>
      </View>
    );
  }

  if (templateId === 'classic') {
    return (
      <View style={{ flex: 1, backgroundColor: bg, padding: 6 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 5 }}>
          <View style={{ width: 16, height: 16, backgroundColor: accent, borderRadius: 3 }} />
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 5, color: accent, fontWeight: '700' }}>TAX INVOICE</Text>
            <Text style={{ fontSize: 3.5, color: muted, marginTop: 1 }}>INV-2026-0042</Text>
          </View>
        </View>
        <View style={{ height: 1, backgroundColor: line, marginBottom: 5 }} />
        <View style={{ height: 6, backgroundColor: line, borderRadius: 2, marginBottom: 3 }} />
        <View style={{ height: 6, backgroundColor: line, borderRadius: 2, width: '70%' }} />
      </View>
    );
  }

  if (templateId === 'minimal') {
    return (
      <View style={{ flex: 1, backgroundColor: bg, padding: 8 }}>
        <Text style={{ fontSize: 6, color: isDark ? '#F1F5F9' : '#0F172A', fontWeight: '300', letterSpacing: 1, marginBottom: 6 }}>INVOICE</Text>
        <Text style={{ fontSize: 3.5, color: muted, marginBottom: 1 }}>Billed to: Eco Farms Ltd</Text>
        <Text style={{ fontSize: 3.5, color: muted, marginBottom: 8 }}>29 June 2026</Text>
        <View style={{ height: 1, backgroundColor: line, marginBottom: 6 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 4, color: muted }}>Total</Text>
          <Text style={{ fontSize: 5, color: isDark ? '#F9FAFB' : '#0F172A', fontWeight: '600' }}>₹29,500</Text>
        </View>
      </View>
    );
  }

  if (templateId === 'bold') {
    return (
      <View style={{ flex: 1, backgroundColor: bg, padding: 6 }}>
        <View style={{ backgroundColor: accent, alignSelf: 'flex-start', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 3, marginBottom: 7 }}>
          <Text style={{ fontSize: 4.5, color: '#fff', fontWeight: '700' }}>INVOICE</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          <View style={{ flex: 1, backgroundColor: '#374151', borderRadius: 4, padding: 3 }}>
            <Text style={{ fontSize: 3, color: '#9CA3AF' }}>Amount</Text>
            <Text style={{ fontSize: 5, color: '#F9FAFB', fontWeight: '600' }}>₹29.5k</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: '#374151', borderRadius: 4, padding: 3 }}>
            <Text style={{ fontSize: 3, color: '#9CA3AF' }}>Date</Text>
            <Text style={{ fontSize: 5, color: '#F9FAFB', fontWeight: '600' }}>Jun 29</Text>
          </View>
        </View>
      </View>
    );
  }

  // Fallback
  return (
    <View style={{ flex: 1, backgroundColor: bg, padding: 6 }}>
      <Text style={{ fontSize: 5, color: accent, fontWeight: '700', marginBottom: 4 }}>INVOICE</Text>
      <View style={{ height: 6, backgroundColor: line, borderRadius: 2, marginBottom: 3 }} />
      <View style={{ height: 6, backgroundColor: line, borderRadius: 2, width: '60%' }} />
    </View>
  );
}

// ─── Section header ─────────────────────────────────────────────────────────

function SectionHeader({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return (
    <View style={s.sectionHeader}>
      <View style={s.sectionIcon}>
        <Ionicons name={icon as any} size={18} color={T.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.sectionTitle}>{title}</Text>
        <Text style={s.sectionSub}>{subtitle}</Text>
      </View>
    </View>
  );
}

// ─── Toggle Row ─────────────────────────────────────────────────────────────

function ToggleRow({ label, description, value, onChange }: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={s.toggleRow}>
      <View style={{ flex: 1, marginRight: T.sp16 }}>
        <Text style={s.toggleLabel}>{label}</Text>
        {description ? <Text style={s.toggleDesc}>{description}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: T.border, true: T.accent }}
        thumbColor={T.surface}
        ios_backgroundColor={T.border}
      />
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export function StyleStudioScreen() {
  const navigation = useNavigation<Nav>();
  const route      = useRoute<Route>();
  const insets     = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();

  const { documentTypeId } = route.params;

  // ── State ──
  const [loading,         setLoading]         = useState(true);
  const [activeProfileId, setActiveProfileId] = useState('');
  const [templateId,      setTemplateIdState]  = useState('classic');
  const [theme,           setTheme]            = useState<Partial<DocumentTheme>>({});
  const [preferences,     setPreferences]      = useState<BusinessPreferences>(DEFAULT_PREFS);
  const [isDirty,         setIsDirty]          = useState(false);
  const [activeTab,       setActiveTab]        = useState<Tab>('presets');
  const [saving,          setSaving]           = useState(false);
  const [aiPrompt,        setAiPrompt]         = useState('');
  const [aiLoading,       setAiLoading]        = useState(false);
  const [aiResult,        setAiResult]         = useState<{ confidence: number; explanation: string } | null>(null);

  // ── Sheet geometry ──
  const SNAP_PEEK    = screenH * 0.28;
  const SNAP_DEFAULT = screenH * 0.42;
  const SNAP_FULL    = screenH * 0.88;
  const snapPoints   = [SNAP_PEEK, SNAP_DEFAULT, SNAP_FULL];

  const sheetH = useSharedValue(SNAP_DEFAULT);

  // ── Gesture ──
  let gestureStartH = 0;
  const panGesture = Gesture.Pan()
    .onStart(() => { gestureStartH = sheetH.value; })
    .onUpdate(e  => {
      const next = gestureStartH - e.translationY;
      sheetH.value = Math.max(SNAP_PEEK * 0.5, Math.min(SNAP_FULL, next));
    })
    .onEnd(e => {
      // Find nearest snap
      let nearest = SNAP_DEFAULT;
      let minDist = Infinity;
      for (const sp of snapPoints) {
        const d = Math.abs(sheetH.value - sp);
        if (d < minDist) { minDist = d; nearest = sp; }
      }
      // Velocity override
      if (e.velocityY < -600) {
        const idx = snapPoints.indexOf(nearest);
        nearest = snapPoints[Math.min(2, idx + 1)];
      } else if (e.velocityY > 600) {
        const idx = snapPoints.indexOf(nearest);
        nearest = snapPoints[Math.max(0, idx - 1)];
      }
      sheetH.value = withSpring(nearest, { damping: 22, stiffness: 220, mass: 0.8 });
    });

  const sheetStyle   = useAnimatedStyle(() => ({ height: sheetH.value }));
  const previewStyle = useAnimatedStyle(() => ({
    bottom: sheetH.value,
    top: 56 + insets.top,
  }));

  // ── Data ──
  useEffect(() => { loadProfile(); }, [documentTypeId]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const active = await getActivePrintProfile();
      setActiveProfileId(active.id);
      setTemplateIdState(active.templateId || 'classic');
      setTheme(active.themeOverridesJson ? JSON.parse(active.themeOverridesJson) : {});
      setPreferences(active.preferencesJson ? JSON.parse(active.preferencesJson) : DEFAULT_PREFS);
      setIsDirty(false);
    } catch {
      Alert.alert('Error', 'Could not load style profile.');
    } finally {
      setLoading(false);
    }
  };

  // ── Computed preview HTML ──
  const previewHtml = useMemo(() => {
    const template = SYSTEM_TEMPLATES[templateId] || SYSTEM_TEMPLATES['classic'];
    const resolved = resolveTheme(BASE_THEME, theme, preferences, {
      template, locale: 'en-IN', appVersion: '1.0.0', themeVersion: 3,
    });
    return renderInvoice(template, resolved.theme, PREVIEW_DATA as any);
  }, [templateId, theme, preferences]);

  // ── Mutations ──
  const applyPreset = useCallback((preset: ThemePreset) => {
    setTemplateIdState(preset.templateId);
    setTheme(preset.themeOverrides as any);
    setIsDirty(true);
  }, []);

  const patchStyle = useCallback((patch: Partial<typeof BASE_THEME.style>) => {
    setTheme(prev => ({ ...prev, style: { ...(prev.style || BASE_THEME.style), ...patch } as any }));
    setIsDirty(true);
  }, []);

  const patchTable = useCallback((patch: Partial<typeof BASE_THEME.table>) => {
    setTheme(prev => ({ ...prev, table: { ...(prev.table || BASE_THEME.table), ...patch } as any }));
    setIsDirty(true);
  }, []);

  const patchPref = useCallback(<K extends keyof BusinessPreferences>(key: K, val: BusinessPreferences[K]) => {
    setPreferences(prev => ({ ...prev, [key]: val }));
    setIsDirty(true);
  }, []);

  const handleApplyAiPrompt = async () => {
    const trimmed = aiPrompt.trim();
    if (!trimmed) return;
    setAiLoading(true);
    setAiResult(null);
    try {
      const res = await generateThemePatch(trimmed, theme, preferences);
      if (res.patch.style) patchStyle(res.patch.style);
      if (res.patch.table) patchTable(res.patch.table);
      if (res.patch.preferences) {
        setPreferences(prev => ({ ...prev, ...res.patch.preferences }));
        setIsDirty(true);
      }
      setAiResult({ confidence: res.confidence, explanation: res.explanation });
      setAiPrompt('');
    } catch (e: any) {
      Alert.alert('AI Error', e?.message ?? 'Could not parse style prompt.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updatePrintProfileById(activeProfileId, {
        templateId,
        themeOverridesJson: JSON.stringify(theme),
        preferencesJson:    JSON.stringify(preferences),
        showLogo:      preferences.showLogo,
        showGstin:     preferences.showGstin,
        showUpi:       preferences.showQrCode,
        showSignature: preferences.showSignature,
        paperWidth:    preferences.paperSize,
      });
      await setTemplateId(documentTypeId, templateId);
      setIsDirty(false);
      Alert.alert('Saved', 'Your style has been applied.');
    } catch {
      Alert.alert('Error', 'Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const currentAccent = (theme as any).style?.accentColor ?? BASE_THEME.style.accentColor;

  // ─── Tabs definition ───────────────────────────────────────────────────
  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: 'presets',    label: 'Presets',    icon: 'color-wand-outline'  },
    { key: 'appearance', label: 'Appearance', icon: 'options-outline'     },
    { key: 'table',      label: 'Table',      icon: 'grid-outline'        },
    { key: 'branding',   label: 'Branding',   icon: 'storefront-outline'  },
  ];

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={s.root} edges={['left', 'right']}>

        {/* ── App Bar ── */}
        <View style={[s.appBar, { paddingTop: insets.top, height: 56 + insets.top }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.barIconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="arrow-back" size={22} color={T.textPrimary} />
          </TouchableOpacity>

          <Text style={s.barTitle} numberOfLines={1}>Style Studio</Text>

          <View style={s.barRight}>
            {isDirty ? (
              <TouchableHighlight
                onPress={handleSave}
                disabled={saving}
                style={s.saveBtn}
                underlayColor={T.accentDark}
              >
                <Text style={s.saveBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
              </TouchableHighlight>
            ) : (
              <View style={s.savedBadge}>
                <Ionicons name="checkmark-circle" size={14} color={T.success} />
                <Text style={s.savedText}>Saved</Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Invoice Preview (fills space above sheet) ── */}
        <Animated.View style={[s.previewContainer, previewStyle]}>
          {loading ? (
            <View style={s.previewLoading}>
              <ActivityIndicator size="large" color={T.accent} />
            </View>
          ) : (
            <HtmlPreview html={previewHtml} style={{ flex: 1 }} />
          )}
        </Animated.View>

        {/* ── Bottom Sheet ── */}
        <Animated.View style={[s.sheet, sheetStyle]}>

          {/* Drag zone — scoped to the handle only, so it doesn't fight the tab ScrollView's own gesture */}
          <View style={s.sheetHeader}>
            <GestureDetector gesture={panGesture}>
              <View style={s.handleZone}>
                <View style={s.handle} />
              </View>
            </GestureDetector>

            {/* Tab bar */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.tabBar}
              bounces={false}
            >
              {TABS.map(tab => {
                const active = activeTab === tab.key;
                return (
                  <TouchableOpacity
                    key={tab.key}
                    style={[s.tab, active && s.tabActive]}
                    onPress={() => setActiveTab(tab.key)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={tab.icon as any}
                      size={16}
                      color={active ? T.surface : T.textSecondary}
                    />
                    <Text style={[s.tabLabel, { color: active ? T.surface : T.textSecondary }]}>
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Scrollable content */}
          <ScrollView
            style={s.sheetContent}
            contentContainerStyle={s.sheetContentPad}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >

            {/* ── PRESETS tab ── */}
            {activeTab === 'presets' && (
              <View>
                <SectionHeader
                  icon="sparkles"
                  title="Design Assistant"
                  subtitle="Describe the change you want in plain words"
                />
                <View style={s.aiBox}>
                  <View style={s.aiInputWrap}>
                    <TextInput
                      style={s.aiInput}
                      value={aiPrompt}
                      onChangeText={setAiPrompt}
                      placeholder={'e.g. "Make it look more premium with a navy accent"'}
                      placeholderTextColor={T.textMuted}
                      multiline
                      editable={!aiLoading}
                    />
                  </View>
                  <TouchableOpacity
                    style={[s.aiApplyBtn, (!aiPrompt.trim() || aiLoading) && { opacity: 0.5 }]}
                    onPress={handleApplyAiPrompt}
                    disabled={!aiPrompt.trim() || aiLoading}
                    activeOpacity={0.85}
                  >
                    {aiLoading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Ionicons name="sparkles" size={16} color="#fff" />
                    )}
                    <Text style={s.aiApplyBtnText}>{aiLoading ? 'Applying…' : 'Apply'}</Text>
                  </TouchableOpacity>
                  {aiResult && (
                    <View style={s.aiResultBox}>
                      <Text style={s.aiResultText}>{aiResult.explanation}</Text>
                    </View>
                  )}
                </View>

                <SectionHeader
                  icon="color-wand-outline"
                  title="Presets"
                  subtitle="One-tap professional invoice styles"
                />
                <View style={s.presetGrid}>
                  {PRESETS.map(p => {
                    const accent     = (p.themeOverrides as any)?.style?.accentColor || T.accent;
                    const isSelected = templateId === p.templateId &&
                      JSON.stringify(theme) === JSON.stringify(p.themeOverrides);

                    return (
                      <TouchableOpacity
                        key={p.id}
                        style={[s.presetCard, isSelected && s.presetCardActive]}
                        onPress={() => applyPreset(p)}
                        activeOpacity={0.75}
                      >
                        {/* Selection badge */}
                        {isSelected && (
                          <View style={s.presetCheck}>
                            <Ionicons name="checkmark" size={10} color="#fff" />
                          </View>
                        )}

                        {/* Thumbnail */}
                        <View style={[s.presetThumb, isSelected && { borderColor: T.accent }]}>
                          <PresetThumbnail templateId={p.templateId} accent={accent} />
                        </View>

                        {/* Meta */}
                        <Text style={[s.presetName, isSelected && { color: T.accent }]}>
                          {p.name}
                        </Text>
                        <Text style={s.presetDesc} numberOfLines={2}>{p.description}</Text>

                        {/* Style chip */}
                        <View style={[s.styleChip, { backgroundColor: accent + '18' }]}>
                          <Text style={[s.styleChipText, { color: accent }]}>
                            {p.templateId.charAt(0).toUpperCase() + p.templateId.slice(1)}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* ── APPEARANCE tab ── */}
            {activeTab === 'appearance' && (
              <View>
                <SectionHeader
                  icon="color-palette-outline"
                  title="Appearance"
                  subtitle="Brand color and typography"
                />

                {/* Accent colors */}
                <Text style={s.groupLabel}>Brand Color</Text>
                <View style={s.colorRow}>
                  {ACCENT_COLORS.map(c => (
                    <TouchableOpacity
                      key={c.hex}
                      style={[s.colorSwatch, { backgroundColor: c.hex }, currentAccent === c.hex && s.colorSwatchActive]}
                      onPress={() => patchStyle({ accentColor: c.hex })}
                      activeOpacity={0.8}
                    >
                      {currentAccent === c.hex && (
                        <Ionicons name="checkmark" size={14} color="#fff" />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={s.divider} />

                {/* Fonts */}
                <Text style={s.groupLabel}>Font</Text>
                <View style={s.fontRow}>
                  {FONTS.map(f => {
                    const active = (theme as any).style?.fontFamily === f.value;
                    return (
                      <TouchableOpacity
                        key={f.value}
                        style={[s.fontCard, active && s.fontCardActive]}
                        onPress={() => patchStyle({ fontFamily: f.value as any })}
                        activeOpacity={0.7}
                      >
                        <Text style={[s.fontSample, { fontFamily: f.value }, active && { color: T.accent }]}>
                          {f.sample}
                        </Text>
                        <Text style={[s.fontLabel, active && { color: T.accent }]}>{f.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={s.divider} />

                {/* Density */}
                <Text style={s.groupLabel}>Layout Density</Text>
                <View style={s.segmentRow}>
                  {(['compact', 'comfortable', 'spacious'] as const).map(d => {
                    const active = (theme as any).style?.density === d;
                    return (
                      <TouchableOpacity
                        key={d}
                        style={[s.segment, active && s.segmentActive]}
                        onPress={() => patchStyle({ density: d })}
                      >
                        <Text style={[s.segmentText, active && { color: T.accent, fontWeight: '600' }]}>
                          {d.charAt(0).toUpperCase() + d.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* ── TABLE tab ── */}
            {activeTab === 'table' && (
              <View>
                <SectionHeader
                  icon="grid-outline"
                  title="Table"
                  subtitle="Columns and table appearance"
                />

                <Text style={s.groupLabel}>Table Style</Text>
                <View style={s.segmentRow}>
                  {TABLE_STYLES.map(ts => {
                    const active = (theme as any).table?.style === ts.value;
                    return (
                      <TouchableOpacity
                        key={ts.value}
                        style={[s.segment, active && s.segmentActive]}
                        onPress={() => patchTable({ style: ts.value as any })}
                      >
                        <Text style={[s.segmentText, active && { color: T.accent, fontWeight: '600' }]}>
                          {ts.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={s.divider} />

                <Text style={s.groupLabel}>Columns</Text>
                <ToggleRow
                  label="HSN Code"
                  description="Show Harmonized System Number for each item"
                  value={preferences.showHsn}
                  onChange={v => patchPref('showHsn', v)}
                />
                <ToggleRow
                  label="Unit"
                  description="Show unit of measurement (BAG, LTR, NOS…)"
                  value={preferences.showUnit}
                  onChange={v => patchPref('showUnit', v)}
                />
                <ToggleRow
                  label="GST %"
                  description="Show GST rate column for each line item"
                  value={preferences.showGstPct}
                  onChange={v => patchPref('showGstPct', v)}
                />
                <ToggleRow
                  label="Discount"
                  description="Show discount column when applicable"
                  value={preferences.showDiscount}
                  onChange={v => patchPref('showDiscount', v)}
                />
              </View>
            )}

            {/* ── BRANDING tab ── */}
            {activeTab === 'branding' && (
              <View>
                <SectionHeader
                  icon="storefront-outline"
                  title="Branding"
                  subtitle="Control what appears on the invoice"
                />

                <Text style={s.groupLabel}>Header</Text>
                <ToggleRow
                  label="Business Logo"
                  description="Show logo in the invoice header"
                  value={preferences.showLogo}
                  onChange={v => patchPref('showLogo', v)}
                />
                {preferences.showLogo && (
                  <View style={{ marginBottom: T.sp12 }}>
                    <Text style={[s.groupLabel, { marginTop: 0 }]}>Logo Position</Text>
                    <View style={s.segmentRow}>
                      {LOGO_POSITIONS.map(p => {
                        const active = preferences.logoPosition === p.value;
                        return (
                          <TouchableOpacity
                            key={p.value}
                            style={[s.segment, active && s.segmentActive]}
                            onPress={() => patchPref('logoPosition', p.value as any)}
                          >
                            <Text style={[s.segmentText, active && { color: T.accent, fontWeight: '600' }]}>
                              {p.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}
                <ToggleRow
                  label="Business Name"
                  value={preferences.showBusinessName}
                  onChange={v => patchPref('showBusinessName', v)}
                />
                <ToggleRow
                  label="GSTIN"
                  description="Show GST registration number"
                  value={preferences.showGstin}
                  onChange={v => patchPref('showGstin', v)}
                />
                <ToggleRow
                  label="Address"
                  value={preferences.showAddress}
                  onChange={v => patchPref('showAddress', v)}
                />
                <ToggleRow
                  label="Phone"
                  value={preferences.showPhone}
                  onChange={v => patchPref('showPhone', v)}
                />
                <ToggleRow
                  label="Email"
                  value={preferences.showEmail}
                  onChange={v => patchPref('showEmail', v)}
                />

                <View style={s.divider} />

                <Text style={s.groupLabel}>Footer</Text>
                <ToggleRow
                  label="Payment Section"
                  value={preferences.showPaymentSection}
                  onChange={v => patchPref('showPaymentSection', v)}
                />
                <ToggleRow
                  label="UPI QR Code"
                  value={preferences.showQrCode}
                  onChange={v => patchPref('showQrCode', v)}
                />
                <ToggleRow
                  label="Bank Details"
                  value={preferences.showBankDetails}
                  onChange={v => patchPref('showBankDetails', v)}
                />
                <ToggleRow
                  label="Signature"
                  value={preferences.showSignature}
                  onChange={v => patchPref('showSignature', v)}
                />
              </View>
            )}

          </ScrollView>
        </Animated.View>

      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: T.bg,
  },

  // App Bar
  appBar: {
    backgroundColor: T.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.border,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: T.sp16,
    paddingBottom: T.sp12,
    zIndex: 10,
  },
  barIconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: T.r8,
    backgroundColor: T.bg,
  },
  barTitle: {
    flex: 1,
    fontSize: T.fs17,
    fontWeight: '700',
    color: T.textPrimary,
    marginHorizontal: T.sp12,
  },
  barRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  saveBtn: {
    height: 36,
    paddingHorizontal: T.sp16,
    backgroundColor: T.accent,
    borderRadius: T.r8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontSize: T.fs14,
    fontWeight: '600',
    color: T.surface,
  },
  savedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.sp4,
    paddingHorizontal: T.sp12,
    paddingVertical: T.sp8,
    borderRadius: T.r8,
    backgroundColor: '#F0FDF4',
  },
  savedText: {
    fontSize: T.fs13,
    fontWeight: '500',
    color: T.success,
  },

  // Preview
  previewContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: T.bg,
    paddingHorizontal: T.sp16,
    paddingTop: T.sp12,
    paddingBottom: T.sp8,
  },
  previewLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.surface,
    borderRadius: T.r14,
    borderWidth: 1,
    borderColor: T.border,
  },

  // Sheet
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: T.surface,
    borderTopLeftRadius: T.r28,
    borderTopRightRadius: T.r28,
    borderWidth: 1,
    borderColor: T.border,
    ...cardShadow('#000', -3, 0.08, 12, { elevation: 8 }),
  },
  sheetHeader: {
    paddingTop: T.sp8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.border,
  },
  handleZone: {
    paddingVertical: T.sp12,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: T.borderStrong,
    borderRadius: T.r99,
    alignSelf: 'center',
  },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: T.sp16,
    paddingBottom: T.sp12,
    gap: T.sp8,
  },
  tab: {
    height: 40,
    borderRadius: T.r10,
    paddingHorizontal: T.sp16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: T.sp8,
    backgroundColor: T.bg,
    borderWidth: 1,
    borderColor: T.border,
  },
  tabActive: {
    backgroundColor: T.accent,
    borderColor: T.accent,
  },
  tabLabel: {
    fontSize: T.fs14,
    fontWeight: '600',
  },

  // Sheet content
  sheetContent: {
    flex: 1,
    backgroundColor: T.surface,
  },
  sheetContentPad: {
    padding: T.sp16,
    paddingBottom: 40,
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.sp12,
    marginBottom: T.sp20,
    paddingBottom: T.sp16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.border,
  },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: T.r10,
    backgroundColor: T.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: T.fs17,
    fontWeight: '700',
    color: T.textPrimary,
  },
  sectionSub: {
    fontSize: T.fs13,
    color: T.textSecondary,
    marginTop: 2,
  },

  // AI Design Assistant
  aiBox: {
    backgroundColor: T.accentLight,
    borderRadius: T.r20,
    padding: T.sp16,
    marginBottom: T.sp24,
    borderWidth: 1,
    borderColor: T.accent + '30',
  },
  aiInputWrap: {
    backgroundColor: T.surface,
    borderRadius: T.r10,
    borderWidth: 1,
    borderColor: T.border,
    marginBottom: T.sp12,
  },
  aiInput: {
    minHeight: 56,
    maxHeight: 96,
    paddingHorizontal: T.sp12,
    paddingVertical: T.sp8,
    fontSize: T.fs13,
    color: T.textPrimary,
    textAlignVertical: 'top',
  },
  aiApplyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: T.sp8,
    backgroundColor: T.accent,
    borderRadius: T.r10,
    paddingVertical: T.sp12,
  },
  aiApplyBtnText: { fontSize: T.fs13, fontWeight: '700', color: '#fff' },
  aiResultBox: {
    marginTop: T.sp12,
    paddingTop: T.sp12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: T.accent + '30',
  },
  aiResultText: { fontSize: T.fs13, color: T.textSecondary, lineHeight: 18 },

  // Group label
  groupLabel: {
    fontSize: T.fs11,
    fontWeight: '700',
    color: T.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: T.sp12,
    marginTop: T.sp4,
  },

  // Preset grid
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: T.sp12,
    justifyContent: 'space-between',
  },
  presetCard: {
    width: '48%',
    borderRadius: T.r14,
    backgroundColor: T.bg,
    padding: T.sp12,
    borderWidth: 1,
    borderColor: T.border,
    marginBottom: T.sp4,
    position: 'relative',
  },
  presetCardActive: {
    borderColor: T.accent,
    backgroundColor: T.accentLight,
  },
  presetCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: T.r99,
    backgroundColor: T.accent,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  presetThumb: {
    height: 84,
    borderRadius: T.r10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: T.border,
    marginBottom: T.sp8,
    backgroundColor: '#FAFAFA',
  },
  presetName: {
    fontSize: T.fs14,
    fontWeight: '700',
    color: T.textPrimary,
    marginBottom: 3,
  },
  presetDesc: {
    fontSize: T.fs13,
    lineHeight: 18,
    color: T.textSecondary,
    marginBottom: T.sp8,
  },
  styleChip: {
    alignSelf: 'flex-start',
    height: 22,
    borderRadius: T.r99,
    paddingHorizontal: T.sp8,
    justifyContent: 'center',
  },
  styleChipText: {
    fontSize: T.fs11,
    fontWeight: '600',
  },

  // Appearance
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: T.border,
    marginVertical: T.sp20,
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: T.sp8,
    marginBottom: T.sp4,
  },
  colorSwatch: {
    width: 40,
    height: 40,
    borderRadius: T.r99,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSwatchActive: {
    borderWidth: 3,
    borderColor: T.surface,
    ...cardShadow(T.textPrimary, 0, 0.4, 4, { elevation: 4 }),
  },
  fontRow: {
    flexDirection: 'row',
    gap: T.sp8,
    flexWrap: 'wrap',
  },
  fontCard: {
    flex: 1,
    minWidth: 72,
    borderRadius: T.r12,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.bg,
    paddingVertical: T.sp12,
    paddingHorizontal: T.sp8,
    alignItems: 'center',
  },
  fontCardActive: {
    borderColor: T.accent,
    backgroundColor: T.accentLight,
  },
  fontSample: {
    fontSize: 22,
    color: T.textPrimary,
    marginBottom: 4,
  },
  fontLabel: {
    fontSize: T.fs11,
    fontWeight: '600',
    color: T.textSecondary,
    textAlign: 'center',
  },

  // Segment control
  segmentRow: {
    flexDirection: 'row',
    backgroundColor: T.bg,
    borderRadius: T.r12,
    borderWidth: 1,
    borderColor: T.border,
    overflow: 'hidden',
    marginBottom: T.sp4,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: T.accentLight,
    borderRadius: T.r12,
  },
  segmentText: {
    fontSize: T.fs13,
    fontWeight: '400',
    color: T.textSecondary,
  },

  // Toggle rows
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: T.sp12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.border,
  },
  toggleLabel: {
    fontSize: T.fs15,
    fontWeight: '500',
    color: T.textPrimary,
  },
  toggleDesc: {
    fontSize: T.fs13,
    color: T.textSecondary,
    marginTop: 2,
  },
});
