import React, { useMemo, useState } from 'react';
import {
  View, TouchableOpacity, StyleSheet, ScrollView, Alert,
  TextInput, ActivityIndicator, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { DocumentCategory } from '../types';
import { createTemplate } from '../services/templateService';
import { getSession } from '../services/businessService';
import { ICON_OPTIONS, detectTemplateType, templateTypeLabel } from '../constants';
import { cardShadow } from '../utils/shadow';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const C = {
  orange:      '#FF6B00',
  orangeLight: '#FFF8F4',
  orangeFaint: '#FFF4EC',
  surface:     '#FFFFFF',
  bg:          '#F7F8FA',
  border:      '#E8EAF0',
  text:        '#0F172A',
  textSub:     '#64748B',
  textMuted:   '#94A3B8',
};

const SCREEN_W = Dimensions.get('window').width;
const H_PAD    = 24;
const CONTENT  = SCREEN_W - H_PAD * 2;

const CATEGORIES: { value: DocumentCategory; label: string; icon: string }[] = [
  { value: 'billing',   label: 'Billing',   icon: 'receipt-outline' },
  { value: 'services',  label: 'Services',  icon: 'construct-outline' },
  { value: 'logistics', label: 'Logistics', icon: 'car-outline' },
  { value: 'education', label: 'Education', icon: 'school-outline' },
  { value: 'custom',    label: 'Other',     icon: 'ellipsis-horizontal-circle-outline' },
];

const CATEGORY_DEFAULT_ICON: Record<DocumentCategory, string> = {
  billing:   'receipt-outline',
  services:  'construct-outline',
  logistics: 'car-outline',
  education: 'school-outline',
  custom:    'document-outline',
};

export function CreateDocumentTypeScreen() {
  const navigation = useNavigation<Nav>();

  const [name,         setName]         = useState('');
  const [category,     setCategory]     = useState<DocumentCategory>('billing');
  const [icon,         setIcon]         = useState('receipt-outline');
  const [loading,      setLoading]      = useState(false);
  const [iconExpanded, setIconExpanded] = useState(false);
  const [aiPrompt,     setAiPrompt]     = useState('');
  const [typeOverride, setTypeOverride] = useState<'transaction_document' | 'record_form' | null>(null);

  const detectedType  = useMemo(() => detectTemplateType(name, category), [name, category]);
  const effectiveType = typeOverride ?? detectedType;

  const handleCategorySelect = (cat: DocumentCategory) => {
    setCategory(cat);
    setTypeOverride(null);
    setIcon(CATEGORY_DEFAULT_ICON[cat]);
  };

  const handleContinue = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Name required', 'Please enter a document name.');
      return;
    }
    setLoading(true);
    try {
      const { businessId } = getSession();
      let dt: any;
      try {
        dt = await createTemplate(businessId, trimmed, category, icon, undefined, effectiveType);
      } catch {
        const { getAllTemplates } = await import('../services/templateService');
        const all = await getAllTemplates(businessId);
        dt = all.find((t: any) => t.name.toLowerCase() === trimmed.toLowerCase());
        if (!dt) throw new Error('Failed to create or find document type.');
      }
      navigation.replace('SuggestedFields', {
        documentTypeId:   dt.id,
        documentTypeName: dt.name,
        templateType:     effectiveType,
      });
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not create document type.');
    } finally {
      setLoading(false);
    }
  };

  const catCardW = (CONTENT - 8 * 2) / 3;

  return (
    <SafeAreaView style={S.safe} edges={['top', 'bottom']}>

      {/* ── Header ── */}
      <View style={S.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={S.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={C.orange} />
        </TouchableOpacity>
        <View>
          <Text style={S.headerTitle}>Create Document</Text>
          <Text style={S.headerSub}>Choose a category and name your document</Text>
        </View>
      </View>

      <ScrollView
        style={S.scroll}
        contentContainerStyle={S.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        {/* ── AI prompt strip ── */}
        <View style={S.aiStrip}>
          <Ionicons name="sparkles" size={20} color="#7C3AED" />
          <TextInput
            style={S.aiInput}
            value={aiPrompt}
            onChangeText={setAiPrompt}
            placeholder="Describe your document and AI will build it…"
            placeholderTextColor={C.textMuted}
            returnKeyType="done"
          />
          <TouchableOpacity
            style={S.aiBtn}
            activeOpacity={0.82}
            onPress={() => Alert.alert('Coming Soon', 'AI generation is coming in the next update.')}
          >
            <Text style={S.aiBtnText}>Generate</Text>
          </TouchableOpacity>
        </View>

        {/* ── Document Name ── */}
        <Text style={S.label}>Document Name</Text>
        <View style={S.nameInputWrap}>
          <Ionicons name="document-text-outline" size={22} color={C.textSub} />
          <TextInput
            style={S.nameInput}
            value={name}
            onChangeText={setName}
            placeholder="e.g. GST Invoice, Service Report…"
            placeholderTextColor={C.textMuted}
            returnKeyType="done"
            autoCorrect={false}
          />
          {name.length > 0 && (
            <TouchableOpacity onPress={() => setName('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={20} color={C.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Type badge */}
        {name.trim().length > 0 && (
          <TouchableOpacity
            style={S.typeBadge}
            onPress={() => {
              const cur = typeOverride ?? detectedType;
              setTypeOverride(cur === 'transaction_document' ? 'record_form' : 'transaction_document');
            }}
            activeOpacity={0.7}
          >
            <Ionicons
              name={effectiveType === 'transaction_document' ? 'receipt-outline' : 'clipboard-outline'}
              size={12}
              color={effectiveType === 'transaction_document' ? '#2563EB' : '#7C3AED'}
            />
            <Text style={[S.typeBadgeText, { color: effectiveType === 'transaction_document' ? '#2563EB' : '#7C3AED' }]}>
              {templateTypeLabel(effectiveType)}
            </Text>
            <Text style={S.typeBadgeChange}>· tap to change</Text>
          </TouchableOpacity>
        )}

        {/* ── Category ── */}
        <Text style={S.label}>Category</Text>
        <View style={S.categoryGrid}>
          {CATEGORIES.map(cat => {
            const sel = category === cat.value;
            return (
              <TouchableOpacity
                key={cat.value}
                style={[S.categoryCard, { width: catCardW }, sel && S.categoryCardSelected]}
                onPress={() => handleCategorySelect(cat.value)}
                activeOpacity={0.82}
              >
                {sel && (
                  <View style={S.selBadge}>
                    <Ionicons name="checkmark" size={12} color="#fff" />
                  </View>
                )}
                <View style={[S.catIconBox, sel && S.catIconBoxSelected]}>
                  <Ionicons name={cat.icon as any} size={26} color={sel ? '#fff' : C.textSub} />
                </View>
                <Text style={[S.catLabel, sel && S.catLabelSelected]}>{cat.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Icon ── */}
        <View style={S.iconHeader}>
          <Text style={S.label}>Icon</Text>
          <TouchableOpacity onPress={() => setIconExpanded(v => !v)} activeOpacity={0.7}>
            <Text style={S.customizeLink}>{iconExpanded ? 'Collapse' : 'Customize'}</Text>
          </TouchableOpacity>
        </View>

        {!iconExpanded ? (
          <TouchableOpacity style={S.iconPreviewRow} onPress={() => setIconExpanded(true)} activeOpacity={0.82}>
            <View style={S.iconPreviewBox}>
              <Ionicons name={icon as any} size={28} color={C.orange} />
            </View>
            <Text style={S.iconPreviewLabel}>{icon.replace(/-outline$/, '').replace(/-/g, ' ')}</Text>
            <Ionicons name="chevron-down" size={16} color={C.textMuted} />
          </TouchableOpacity>
        ) : (
          <View style={S.iconGrid}>
            {ICON_OPTIONS.map(iconName => {
              const sel = icon === iconName;
              return (
                <TouchableOpacity
                  key={iconName}
                  style={[S.iconItem, sel && S.iconItemSelected]}
                  onPress={() => setIcon(iconName)}
                  activeOpacity={0.82}
                >
                  <Ionicons name={iconName as any} size={26} color={sel ? C.orange : C.textSub} />
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ── Create button ── */}
        <View style={S.ctaRow}>
          <TouchableOpacity
            style={[S.createBtn, (!name.trim() || loading) && S.createBtnDisabled]}
            onPress={handleContinue}
            activeOpacity={0.82}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Text style={S.createBtnText}>Create Document</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: C.bg },
  scroll:  { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 24 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    paddingHorizontal: H_PAD, paddingTop: 12, paddingBottom: 20,
    backgroundColor: C.bg,
  },
  backBtn:     { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: C.text },
  headerSub:   { fontSize: 14, color: C.textSub, marginTop: 2 },

  // AI strip
  aiStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.surface,
    borderRadius: 12, borderWidth: 1.5, borderColor: '#EDE9FE',
    paddingHorizontal: 14, height: 52,
    marginBottom: 24,
  },
  aiInput:   { flex: 1, fontSize: 14, color: C.text },
  aiBtn: {
    backgroundColor: '#7C3AED', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  aiBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  // Labels
  label: { fontSize: 12, fontWeight: '600', color: C.text, marginBottom: 10 },

  // Name input
  nameInputWrap: {
    height: 56,
    backgroundColor: C.surface,
    borderRadius: 12, borderWidth: 1.5, borderColor: C.border,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, gap: 10,
    marginBottom: 8,
  },
  nameInput: { flex: 1, fontSize: 15, color: C.text },

  // Type badge
  typeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: C.surface,
    borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4,
    marginBottom: 20, borderWidth: 1, borderColor: C.border,
  },
  typeBadgeText:   { fontSize: 12, fontWeight: '600' },
  typeBadgeChange: { fontSize: 11, color: C.textMuted },

  // Category
  categoryGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: 8, marginBottom: 24,
  },
  categoryCard: {
    height: 100,
    backgroundColor: C.surface,
    borderRadius: 16, padding: 12,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: C.border,
    gap: 8, position: 'relative',
  },
  categoryCardSelected: {
    backgroundColor: C.orangeFaint,
    borderColor: C.orange, borderWidth: 2,
  },
  selBadge: {
    position: 'absolute', top: 8, right: 8,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: C.orange,
    alignItems: 'center', justifyContent: 'center',
  },
  catIconBox:         { width: 46, height: 46, borderRadius: 12, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  catIconBoxSelected: { backgroundColor: C.orange },
  catLabel:           { fontSize: 12, fontWeight: '500', color: C.textSub },
  catLabelSelected:   { color: C.orange, fontWeight: '700' },

  // Icon
  iconHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  customizeLink: { fontSize: 14, fontWeight: '600', color: C.orange },

  iconPreviewRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: C.surface,
    borderRadius: 14, borderWidth: 1.5, borderColor: C.border,
    padding: 14, marginBottom: 28,
  },
  iconPreviewBox: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: C.orangeLight,
    alignItems: 'center', justifyContent: 'center',
  },
  iconPreviewLabel: { flex: 1, fontSize: 15, fontWeight: '500', color: C.text, textTransform: 'capitalize' },

  iconGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 12,
    backgroundColor: C.surface,
    borderRadius: 16, padding: 16, marginBottom: 28,
  },
  iconItem: {
    width: (CONTENT - 32 - 3 * 12) / 4,
    height: (CONTENT - 32 - 3 * 12) / 4,
    borderRadius: 12, backgroundColor: C.bg,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'transparent',
  },
  iconItemSelected: { backgroundColor: C.orangeLight, borderColor: C.orange },

  // CTA
  ctaRow:    { alignItems: 'center', marginTop: 4 },
  createBtn: {
    width: 220, height: 56,
    backgroundColor: C.orange, borderRadius: 18,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    ...cardShadow(C.orange, 6, 0.3, 16, { elevation: 5 }),
  },
  createBtnDisabled: { opacity: 0.45 },
  createBtnText:     { fontSize: 17, fontWeight: '700', color: '#fff' },
});
