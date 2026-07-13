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
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';

import { RootStackParamList } from '../navigation/types';
import { HtmlPreview } from '../components/HtmlPreview';
import { ColorPickerPanel } from '../components/ColorPickerPanel';
import { cardShadow } from '../utils/shadow';
import { PRESETS, ThemePreset } from '../invoice/themes/registry';
import {
  getActivePrintProfile,
  listPrintProfiles,
  createPrintProfile,
  setDefaultPrintProfile,
  updatePrintProfileById,
} from '../services/printProfileService';
import { setTemplateId } from '../services/designStorage';
import { getBusinessSettings } from '../services/businessService';
import { SYSTEM_TEMPLATES } from '../invoice/templates/registry';
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

// Sample invoice content (items/customer/document number) — a style preview
// doesn't need a real invoice, just realistic-looking table/GST content.
// Seller fields below are placeholder fallbacks, overridden with the
// business's real settings once loaded (see `buildPreviewData` / `business`
// state) so the preview reflects the user's actual current business instead
// of a fake company.
const SAMPLE_DOC_DATA = {
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
};

const FALLBACK_SELLER = {
  sellerName:          'Your Business Name',
  sellerAddress:       'Add your business address in Settings',
  sellerGstin:         undefined as string | undefined,
  sellerState:         undefined as string | undefined,
  sellerPhone:         undefined as string | undefined,
  sellerEmail:         undefined as string | undefined,
  sellerUpiId:         undefined as string | undefined,
  sellerBankName:      undefined as string | undefined,
  sellerAccountNumber: undefined as string | undefined,
  sellerIfsc:          undefined as string | undefined,
  sellerLogoUri:       undefined as string | undefined,
  sellerSignatureUri:  undefined as string | undefined,
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

type Tab = 'appearance' | 'table' | 'branding';
type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'StyleStudio'>;

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

// ─── Group Card ─────────────────────────────────────────────────────────────
// Wraps a labeled group of controls in a soft card, replacing flat dividers
// so related settings read as one visual unit instead of a dense list.

function GroupCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={s.groupCard}>
      <Text style={s.groupLabel}>{label}</Text>
      {children}
    </View>
  );
}

// ─── Toggle Row ─────────────────────────────────────────────────────────────

function ToggleRow({ label, description, value, onChange, last }: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  last?: boolean;
}) {
  return (
    <View style={[s.toggleRow, last && { borderBottomWidth: 0 }]}>
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
  const [activeTab,       setActiveTab]        = useState<Tab>('appearance');
  const [saving,          setSaving]           = useState(false);
  const [aiPrompt,        setAiPrompt]         = useState('');
  const [aiLoading,       setAiLoading]        = useState(false);
  const [aiResult,        setAiResult]         = useState<{ confidence: number; explanation: string } | null>(null);
  const [business,        setBusiness]         = useState<Awaited<ReturnType<typeof getBusinessSettings>> | null>(null);
  const [activePresetIndex, setActivePresetIndex] = useState(0);

  // ── Sheet geometry ──
  // FOOTER_H is reserved, fixed space for the tab bar (now a persistent
  // footer, not part of the draggable sheet — see the JSX below). Snap
  // fractions are based on the space actually available above it, not raw
  // screenH, so Full (88%) doesn't try to claim space the footer now owns.
  const FOOTER_H      = 64 + insets.bottom;
  const AVAILABLE_H   = screenH - 56 - insets.top - FOOTER_H;
  const SNAP_PEEK    = AVAILABLE_H * 0.28;
  const SNAP_DEFAULT = AVAILABLE_H * 0.42;
  const SNAP_FULL    = AVAILABLE_H * 0.88;
  const snapPoints   = [SNAP_PEEK, SNAP_DEFAULT, SNAP_FULL];

  const sheetH = useSharedValue(SNAP_PEEK);
  const [snapIndex, setSnapIndex] = useState(0); // 0=Peek, 1=Default, 2=Full — starts minimal, expands on selection

  const snapTo = useCallback((idx: number) => {
    const clamped = Math.max(0, Math.min(2, idx));
    sheetH.value = withSpring(snapPoints[clamped], { damping: 22, stiffness: 220, mass: 0.8 });
    setSnapIndex(clamped);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screenH]);

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
      runOnJS(setSnapIndex)(snapPoints.indexOf(nearest));
    });

  const sheetStyle   = useAnimatedStyle(() => ({ height: sheetH.value }));
  const previewStyle = useAnimatedStyle(() => ({
    bottom: sheetH.value + FOOTER_H,
    top: 56 + insets.top,
  }));

  // ── Swipe-to-change-template ──
  // Lives on the preview's own Animated.View (s.previewContainer), which has
  // no other gesture attached — panGesture above is scoped only to the
  // sheet's drag handle, so these two never compete for the same touches.
  const overlayOpacity = useSharedValue(0);
  let overlayHideTimer: ReturnType<typeof setTimeout> | null = null;

  const showPresetOverlay = useCallback(() => {
    overlayOpacity.value = withTiming(1, { duration: 150 });
    if (overlayHideTimer) clearTimeout(overlayHideTimer);
    overlayHideTimer = setTimeout(() => {
      overlayOpacity.value = withTiming(0, { duration: 250 });
    }, 1200);
  }, []);

  const goToPreset = useCallback((index: number) => {
    const wrapped = ((index % PRESETS.length) + PRESETS.length) % PRESETS.length;
    setActivePresetIndex(wrapped);
    applyPreset(PRESETS[wrapped]);
    showPresetOverlay();
  }, [showPresetOverlay]);

  const SWIPE_THRESHOLD = 50;
  const previewSwipeGesture = Gesture.Pan()
    .onEnd(e => {
      if (Math.abs(e.translationX) <= Math.abs(e.translationY)) return;
      if (Math.abs(e.translationX) < SWIPE_THRESHOLD) return;
      const direction = e.translationX < 0 ? 1 : -1; // swipe left → next, right → previous
      runOnJS(goToPreset)(activePresetIndex + direction);
    });

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));

  // ── Data ──
  useEffect(() => { loadProfile(); }, [documentTypeId]);
  useEffect(() => { getBusinessSettings().then(setBusiness); }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const active = await getActivePrintProfile();
      const loadedTemplateId = active.templateId || 'classic';
      const loadedTheme = active.themeOverridesJson ? JSON.parse(active.themeOverridesJson) : {};
      setActiveProfileId(active.id);
      setTemplateIdState(loadedTemplateId);
      setTheme(loadedTheme);
      setPreferences(active.preferencesJson ? JSON.parse(active.preferencesJson) : DEFAULT_PREFS);
      setIsDirty(false);

      // Start swipe cycling from whichever preset matches the loaded style
      // (falls back to index 0 if the theme was hand-tweaked and doesn't
      // correspond to any preset).
      const matchIndex = PRESETS.findIndex(p =>
        p.templateId === loadedTemplateId && JSON.stringify(p.themeOverrides) === JSON.stringify(loadedTheme)
      );
      setActivePresetIndex(matchIndex >= 0 ? matchIndex : 0);
    } catch {
      Alert.alert('Error', 'Could not load style profile.');
    } finally {
      setLoading(false);
    }
  };

  // Sample invoice content + the business's real seller identity (name,
  // address, GSTIN, logo, etc.) — this is what makes the preview show the
  // user's *current* business instead of a hardcoded fake company.
  const previewData = useMemo(() => ({
    ...SAMPLE_DOC_DATA,
    sellerName:          business?.name ?? FALLBACK_SELLER.sellerName,
    sellerAddress:       business?.address ?? FALLBACK_SELLER.sellerAddress,
    sellerGstin:         business?.gstin ?? FALLBACK_SELLER.sellerGstin,
    sellerState:         business?.stateName ?? FALLBACK_SELLER.sellerState,
    sellerPhone:         business?.phone ?? FALLBACK_SELLER.sellerPhone,
    sellerEmail:         business?.email ?? FALLBACK_SELLER.sellerEmail,
    sellerUpiId:         business?.upiId ?? FALLBACK_SELLER.sellerUpiId,
    sellerBankName:      business?.bankName ?? FALLBACK_SELLER.sellerBankName,
    sellerAccountNumber: business?.accountNumber ?? FALLBACK_SELLER.sellerAccountNumber,
    sellerIfsc:          business?.ifsc ?? FALLBACK_SELLER.sellerIfsc,
    sellerLogoUri:       business?.logo ?? FALLBACK_SELLER.sellerLogoUri,
    sellerSignatureUri:  business?.signature ?? FALLBACK_SELLER.sellerSignatureUri,
  }), [business]);

  // ── Computed preview HTML ──
  const previewHtml = useMemo(() => {
    const template = SYSTEM_TEMPLATES[templateId] || SYSTEM_TEMPLATES['classic'];
    const resolved = resolveTheme(BASE_THEME, theme, preferences, {
      template, locale: 'en-IN', appVersion: '1.0.0', themeVersion: 3,
    });
    return renderInvoice(template, resolved.theme, previewData as any);
  }, [templateId, theme, preferences, previewData]);

  // ── Mutations ──
  const applyPreset = useCallback((preset: ThemePreset) => {
    setTemplateIdState(preset.templateId);
    setTheme(preset.themeOverrides as any);
    setIsDirty(true);
  }, []);

  // Sheet starts Peek (minimal) so the preview gets maximum room; the first
  // time the user selects/edits anything, it expands to Default so there's
  // space to see what they're doing without them having to drag it open.
  const expandFromPeek = useCallback(() => {
    if (snapIndex === 0) snapTo(1);
  }, [snapIndex, snapTo]);

  const patchStyle = useCallback((patch: Partial<typeof BASE_THEME.style>) => {
    setTheme(prev => ({ ...prev, style: { ...(prev.style || BASE_THEME.style), ...patch } as any }));
    setIsDirty(true);
    expandFromPeek();
  }, [expandFromPeek]);

  const patchTable = useCallback((patch: Partial<typeof BASE_THEME.table>) => {
    setTheme(prev => ({ ...prev, table: { ...(prev.table || BASE_THEME.table), ...patch } as any }));
    setIsDirty(true);
    expandFromPeek();
  }, [expandFromPeek]);

  const patchPref = useCallback(<K extends keyof BusinessPreferences>(key: K, val: BusinessPreferences[K]) => {
    setPreferences(prev => ({ ...prev, [key]: val }));
    setIsDirty(true);
    expandFromPeek();
  }, [expandFromPeek]);

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

          {/*
            Transparent touch-capturing layer, on top of the WebView/iframe.
            A WebView (native) or iframe (web) swallows its own touch/pointer
            events and never lets them bubble to a gesture recognizer that
            merely wraps it — this is why the swipe gesture had no effect
            when it was attached to the outer Animated.View above. Sitting
            an empty, gesture-bound View directly over the preview (after it
            in paint order, so it's on top) intercepts the swipe before the
            WebView ever sees it.
          */}
          <GestureDetector gesture={previewSwipeGesture}>
            <Animated.View style={StyleSheet.absoluteFill} />
          </GestureDetector>

          {/* Swipe feedback: preset name + dot index, fades in/out */}
          <Animated.View style={[s.presetOverlay, overlayStyle]} pointerEvents="none">
            <Text style={s.presetOverlayName}>{PRESETS[activePresetIndex]?.name}</Text>
            <View style={s.presetOverlayDots}>
              {PRESETS.map((p, i) => (
                <View key={p.id} style={[s.presetOverlayDot, i === activePresetIndex && s.presetOverlayDotActive]} />
              ))}
            </View>
          </Animated.View>
        </Animated.View>

        {/* ── Bottom Sheet ── */}
        <Animated.View style={[s.sheet, { bottom: FOOTER_H }, sheetStyle]}>

          {/* Drag zone — scoped to the handle only, so it doesn't fight the tab bar's touches */}
          <View style={s.sheetHeader}>
            <View style={s.handleRow}>
              <GestureDetector gesture={panGesture}>
                <View style={s.handleZone}>
                  <View style={s.handle} />
                </View>
              </GestureDetector>
              <TouchableOpacity
                style={s.expandBtn}
                onPress={() => snapTo(snapIndex === 2 ? 1 : 2)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel={snapIndex === 2 ? 'Collapse panel' : 'Expand panel'}
              >
                <Ionicons name={snapIndex === 2 ? 'contract-outline' : 'expand-outline'} size={16} color={T.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Scrollable content */}
          <KeyboardAwareScrollView
            style={s.sheetContent}
            contentContainerStyle={s.sheetContentPad}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            bottomOffset={24}
          >

            {/* ── APPEARANCE tab ── */}
            {activeTab === 'appearance' && (
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
                  icon="color-palette-outline"
                  title="Appearance"
                  subtitle="Brand color and typography"
                />

                {/* Accent color */}
                <GroupCard label="Brand Color">
                  <ColorPickerPanel value={currentAccent} onChange={hex => patchStyle({ accentColor: hex })} />
                </GroupCard>

                {/* Fonts */}
                <GroupCard label="Font">
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
                </GroupCard>

                {/* Density */}
                <GroupCard label="Layout Density">
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
                </GroupCard>
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

                <GroupCard label="Table Style">
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
                </GroupCard>

                <GroupCard label="Columns">
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
                  last
                />
                </GroupCard>
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

                <GroupCard label="Header">
                <ToggleRow
                  label="Business Logo"
                  description="Show logo in the invoice header"
                  value={preferences.showLogo}
                  onChange={v => patchPref('showLogo', v)}
                />
                {preferences.showLogo && (
                  <View style={s.nestedControl}>
                    <Text style={s.nestedLabel}>Logo Position</Text>
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
                  last
                />
                </GroupCard>

                <GroupCard label="Footer">
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
                  last
                />
                </GroupCard>
              </View>
            )}

          </KeyboardAwareScrollView>
        </Animated.View>

        {/*
          ── Footer tab bar ──
          Fixed, always visible regardless of sheet position (rendered after
          the sheet, so it paints on top if the sheet is dragged toward Full
          and would otherwise reach the bottom edge). No shared "track" card
          wrapping all three items — only the active tab gets a pill
          highlight, the rest float flat, per the reference design.
        */}
        <View style={[s.footer, { height: FOOTER_H, paddingBottom: insets.bottom }]}>
          {TABS.map(tab => {
            const active = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[s.footerTab, active && s.footerTabActive]}
                onPress={() => { setActiveTab(tab.key); expandFromPeek(); }}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={tab.icon as any}
                  size={16}
                  color={active ? T.accent : T.textSecondary}
                />
                {active && (
                  <Text style={s.footerTabLabelActive} numberOfLines={1}>
                    {tab.label}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

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
    // bottom is set inline (FOOTER_H) — depends on runtime safe-area insets
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
  handleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  handleZone: {
    flex: 1,
    paddingVertical: T.sp12,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: T.borderStrong,
    borderRadius: T.r99,
    alignSelf: 'center',
  },
  expandBtn: {
    width: 32,
    height: 32,
    borderRadius: T.r10,
    backgroundColor: T.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: T.sp16,
  },

  // Fixed footer tab bar — flat, no shared "track" wrapper; only the
  // active item gets its own pill highlight.
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: T.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: T.border,
    paddingHorizontal: T.sp16,
  },
  footerTab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 38,
    paddingHorizontal: T.sp12,
    borderRadius: T.r12,
  },
  footerTabActive: {
    backgroundColor: T.bg,
  },
  footerTabLabelActive: {
    fontSize: T.fs13,
    fontWeight: '700',
    color: T.accent,
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

  // Group card — wraps a labeled set of controls so related settings read as
  // one visual unit instead of a flat, divider-separated list.
  groupCard: {
    backgroundColor: T.bg,
    borderRadius: T.r14,
    padding: T.sp16,
    marginBottom: T.sp16,
  },
  groupLabel: {
    fontSize: T.fs13,
    fontWeight: '700',
    color: T.textPrimary,
    marginBottom: T.sp8,
  },
  nestedControl: {
    marginBottom: T.sp12,
    marginTop: -T.sp4,
  },
  nestedLabel: {
    fontSize: T.fs11,
    fontWeight: '600',
    color: T.textSecondary,
    marginBottom: T.sp8,
  },

  // Swipe-to-change-template feedback overlay
  presetOverlay: {
    position: 'absolute',
    top: 16,
    alignSelf: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(17,24,39,0.85)',
    borderRadius: T.r99,
    paddingHorizontal: T.sp16,
    paddingVertical: T.sp8,
    gap: 6,
  },
  presetOverlayName: {
    fontSize: T.fs13,
    fontWeight: '700',
    color: '#fff',
  },
  presetOverlayDots: {
    flexDirection: 'row',
    gap: 4,
  },
  presetOverlayDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  presetOverlayDotActive: {
    backgroundColor: '#fff',
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
    backgroundColor: T.surface,
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
    backgroundColor: T.surface,
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
