import React, { useCallback, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Appbar } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { RootStackParamList } from '../navigation/types';
import { BUILTIN_DESIGNS } from '../templates';
import { getTemplateId, setTemplateId } from '../services/designStorage';
import { generateInvoiceTemplate, generateTemplateFromPhoto } from '../services/aiTemplateService';
import { saveAiTemplateVersion, listAiVersionsForTemplate } from '../services/templateService';
import { sanitizeHtml } from '../services/htmlSanitizer';
import { computeStaticSignature } from '../services/templateValidator';
import { migrateAiDesignIfNeeded } from '../services/templateMigration';
import { PhotoDebugModal } from '../components/PhotoDebugModal';
import { COLORS, TEMPLATES_BY_DOCUMENT_TYPE } from '../constants';

type Nav   = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'TemplatePicker'>;

// Required placeholders sent to AI per document type (canonical %% format)
const INVOICE_REQUIRED_PLACEHOLDERS = [
  '%%DOC_NUMBER%%', '%%DOC_DATE%%', '%%ITEMS_TABLE%%', '%%TOTAL%%', '%%BUSINESS_NAME%%',
];

// ── Mini thumbnails ───────────────────────────────────────────────────────────

function ClassicThumb({ brand }: { brand: string }) {
  return (
    <View style={[thumb.card, { borderColor: brand }]}>
      <View style={[thumb.topBar, { backgroundColor: brand }]} />
      <View style={thumb.body}>
        <View style={[thumb.accentLine, { backgroundColor: brand }]} />
        {[60, 90, 70, 80].map((w, i) => (
          <View key={i} style={[thumb.row, i % 2 === 1 && thumb.rowAlt]}>
            <View style={[thumb.cell, { width: w }]} />
            <View style={[thumb.cell, { width: 40 }]} />
          </View>
        ))}
        <View style={[thumb.totalBar, { backgroundColor: brand }]} />
      </View>
    </View>
  );
}

function ModernThumb({ brand }: { brand: string }) {
  return (
    <View style={[thumb.card, { borderColor: brand }]}>
      <View style={[thumb.bigBand, { backgroundColor: brand }]}>
        <View style={thumb.bandLine} />
        <View style={[thumb.bandLine, { width: 50 }]} />
      </View>
      <View style={thumb.body}>
        {[70, 90, 60, 80].map((w, i) => (
          <View key={i} style={thumb.row}>
            <View style={[thumb.cell, { width: w }]} />
            <View style={[thumb.cell, { width: 35 }]} />
          </View>
        ))}
        <View style={[thumb.totalAmt, { borderTopColor: brand }]}>
          <Text style={{ fontSize: 7, color: brand, fontWeight: '700' }}>TOTAL ▪ ₹</Text>
        </View>
      </View>
    </View>
  );
}

function MinimalThumb() {
  return (
    <View style={[thumb.card, { borderColor: '#333' }]}>
      <View style={thumb.body}>
        <View style={thumb.minHdrLine} />
        <View style={thumb.minTitle} />
        <View style={thumb.minHdrLine} />
        {[80, 60, 75, 55].map((w, i) => (
          <View key={i} style={thumb.minRow}>
            <View style={[thumb.minCell, { width: w }]} />
            <View style={[thumb.minCell, { width: 30 }]} />
          </View>
        ))}
        <View style={thumb.minTotalLine} />
      </View>
    </View>
  );
}

function LetterheadThumb({ brand }: { brand: string }) {
  return (
    <View style={[thumb.card, { borderColor: brand }]}>
      <View style={[thumb.lhBand, { backgroundColor: brand }]}>
        <View style={thumb.lhBandLine} />
      </View>
      <View style={thumb.body}>
        {[70, 90, 60].map((w, i) => (
          <View key={i} style={thumb.row}>
            <View style={[thumb.cell, { width: w }]} />
          </View>
        ))}
        <View style={[thumb.lhSigBox, { borderColor: brand }]} />
      </View>
    </View>
  );
}

function ThermalThumb() {
  return (
    <View style={[thumb.card, { borderColor: '#333' }]}>
      <View style={[thumb.body, { alignItems: 'center' }]}>
        <View style={thumb.thmTitle} />
        <View style={thumb.thmDash} />
        {[1, 2, 3].map(i => (
          <View key={i} style={thumb.thmRow}>
            <View style={thumb.thmCell} />
            <View style={[thumb.thmCell, { width: 18 }]} />
          </View>
        ))}
        <View style={thumb.thmDash} />
      </View>
    </View>
  );
}

function GstStandardThumb({ brand }: { brand: string }) {
  return (
    <View style={[thumb.card, { borderColor: brand }]}>
      <View style={thumb.body}>
        <View style={thumb.row}>
          <View style={[thumb.cell, { width: 60 }]} />
        </View>
        <View style={[thumb.gstBand, { borderColor: brand, backgroundColor: `${brand}18` }]}>
          <View style={[thumb.gstBandLine, { backgroundColor: brand }]} />
        </View>
        {[80, 55].map((w, i) => (
          <View key={i} style={thumb.row}>
            <View style={[thumb.cell, { width: w }]} />
          </View>
        ))}
      </View>
    </View>
  );
}

function GstCompactThumb({ brand }: { brand: string }) {
  return (
    <View style={[thumb.card, { borderColor: brand }]}>
      <View style={thumb.body}>
        <View style={[thumb.gcHdr, { borderBottomColor: brand }]}>
          <View style={[thumb.cell, { width: 50, height: 6 }]} />
        </View>
        {[1, 2, 3, 4].map(i => (
          <View key={i} style={[thumb.row, { height: 5 }]}>
            <View style={[thumb.cell, { width: 70, height: 3 }]} />
          </View>
        ))}
      </View>
    </View>
  );
}

// Shape groups — mirrors the renderer's shape mapping. Many template ids share
// one representative thumbnail since they share the same visual layout shape.
const FORMAL_SHAPE_IDS = new Set([
  'letterhead', 'gst_formal', 'corporate_quote', 'sales_proposal',
  'professional_proforma', 'corporate_po', 'professional_report',
]);
const COMPACT_SHAPE_IDS = new Set(['gst_compact', 'minimal_quote', 'compact_receipt', 'simple_expense']);
const STANDARD_SHAPE_IDS = new Set([
  'standard_proforma', 'procurement_po', 'voucher', 'dispatch', 'warehouse',
  'standard_dispatch', 'transfer_sheet', 'workshop', 'service_center',
  'inspection', 'standard_work_order', 'site_inspection',
]);
const BLANK_SHAPE_IDS = new Set(['blank_template']);

function shapeThumbFor(id: string, brand: string): React.ReactNode {
  if (id === 'classic') return <ClassicThumb brand={brand} />;
  if (id === 'modern') return <ModernThumb brand={brand} />;
  if (id === 'minimal' || BLANK_SHAPE_IDS.has(id)) return <MinimalThumb />;
  if (id === 'thermal') return <ThermalThumb />;
  if (id === 'gst_standard') return <GstStandardThumb brand={brand} />;
  if (COMPACT_SHAPE_IDS.has(id)) return <GstCompactThumb brand={brand} />;
  if (FORMAL_SHAPE_IDS.has(id)) return <LetterheadThumb brand={brand} />;
  if (STANDARD_SHAPE_IDS.has(id)) return <ClassicThumb brand={brand} />;
  return <ClassicThumb brand={brand} />;
}

const thumb = StyleSheet.create({
  card:         { width: 90, height: 120, borderRadius: 8, overflow: 'hidden', borderWidth: 1.5, backgroundColor: '#fff' },
  topBar:       { height: 18 },
  bigBand:      { height: 38, padding: 6, justifyContent: 'flex-end', gap: 3 },
  bandLine:     { height: 3, backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 2, width: 70 },
  body:         { flex: 1, padding: 6, gap: 3 },
  accentLine:   { height: 2, borderRadius: 1, marginBottom: 4 },
  row:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 8 },
  rowAlt:       { backgroundColor: '#f5f5f5' },
  cell:         { height: 5, backgroundColor: '#ddd', borderRadius: 2 },
  totalBar:     { height: 10, borderRadius: 2, marginTop: 4 },
  totalAmt:     { marginTop: 4, alignSelf: 'flex-end', paddingTop: 3, borderTopWidth: 1.5 },
  minHdrLine:   { height: 1.5, backgroundColor: '#111', marginVertical: 3 },
  minTitle:     { height: 6, backgroundColor: '#ddd', borderRadius: 1, width: 70, marginBottom: 3 },
  minRow:       { flexDirection: 'row', justifyContent: 'space-between', height: 7, alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: '#eee' },
  minCell:      { height: 4, backgroundColor: '#ccc', borderRadius: 1 },
  minTotalLine: { height: 1.5, backgroundColor: '#111', marginTop: 4 },
  lhBand:       { height: 24, alignItems: 'center', justifyContent: 'center' },
  lhBandLine:   { height: 4, width: 40, backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 2 },
  lhSigBox:     { height: 14, borderRadius: 2, borderWidth: 1, marginTop: 4, width: 36, alignSelf: 'flex-end' },
  thmTitle:     { height: 6, width: 50, backgroundColor: '#111', borderRadius: 1, marginBottom: 4 },
  thmDash:      { height: 1, width: '90%', backgroundColor: '#999', marginVertical: 3 },
  thmRow:       { flexDirection: 'row', justifyContent: 'space-between', width: '90%', marginBottom: 3 },
  thmCell:      { height: 4, width: 40, backgroundColor: '#ccc', borderRadius: 1 },
  gstBand:      { height: 14, borderRadius: 3, borderWidth: 1, justifyContent: 'center', paddingHorizontal: 6, marginVertical: 4 },
  gstBandLine:  { height: 4, width: 44, borderRadius: 2 },
  gcHdr:        { borderBottomWidth: 1.5, paddingBottom: 4, marginBottom: 4 },
});

// ── Screen ────────────────────────────────────────────────────────────────────

export function TemplatePickerScreen() {
  const navigation = useNavigation<Nav>();
  const route      = useRoute<Route>();
  const { documentTypeId, documentTypeName } = route.params;

  const availableTemplateIds = TEMPLATES_BY_DOCUMENT_TYPE[documentTypeName.toLowerCase().trim()];
  const availableDesigns = availableTemplateIds
    ? BUILTIN_DESIGNS.filter(d => availableTemplateIds.includes(d.id))
    : BUILTIN_DESIGNS;

  const [selectedId,  setSelectedId]  = useState('classic');
  const [aiTemplates, setAiTemplates] = useState<Array<{ id: string; name: string }>>([]);
  const [prompt,      setPrompt]      = useState('');
  const [generating,  setGenerating]  = useState(false);
  const [photoDebug,  setPhotoDebug]  = useState<{
    photoUri: string; metadata: any; html: string;
  } | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        // Migrate any legacy AsyncStorage AI template to SQLite on first open
        await migrateAiDesignIfNeeded(documentTypeId);
        const [id, versions] = await Promise.all([
          getTemplateId(documentTypeId),
          listAiVersionsForTemplate(documentTypeId),
        ]);
        if (!active) return;
        setSelectedId(id);
        setAiTemplates(versions.map(v => ({ id: `ai_${v.id}`, name: v.name })));
      })();
      return () => { active = false; };
    }, [documentTypeId])
  );

  const selectDesign = async (id: string) => {
    setSelectedId(id);
    await setTemplateId(documentTypeId, id);
  };

  const persistGeneratedTemplate = async (
    displayName: string,
    rawHtml: string,
    metadata: any,
  ) => {
    // Sanitize
    const sanitized = sanitizeHtml(rawHtml);
    if (!sanitized.safe) {
      console.warn('[TemplatePicker] Sanitizer removed content from AI output', {
        removedScripts:          sanitized.removedScripts,
        removedEventHandlers:    sanitized.removedEventHandlers,
        removedExternalResources:sanitized.removedExternalResources,
        removedDangerousTags:    sanitized.removedDangerousTags,
      });
    }

    // Static signature (validation deferred to ensureValidated on first preview open)
    const signature = computeStaticSignature(sanitized.html, 'html', displayName);

    // Persist to SQLite
    const versionId = await saveAiTemplateVersion(
      documentTypeId,
      displayName,
      sanitized.html,
      metadata,
      undefined,   // validation: lazy
      signature,
    );

    // Select the new design
    const aiDesignId = `ai_${versionId}`;
    await setTemplateId(documentTypeId, aiDesignId);
    setSelectedId(aiDesignId);
    setAiTemplates(prev => [...prev, { id: aiDesignId, name: displayName }]);

    Alert.alert(
      'Template saved',
      'Preview the invoice to run a quality check, then publish when ready.',
    );
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    try {
      const displayName = prompt.trim().slice(0, 60);
      const { metadata, html: rawHtml } = await generateInvoiceTemplate({
        templateType:         'invoice',
        language:             'en-IN',
        pageSize:             'a4',
        theme:                { useThemeColor: true },
        requiredPlaceholders: INVOICE_REQUIRED_PLACEHOLDERS,
        businessContext:      prompt.trim(),
      });
      await persistGeneratedTemplate(displayName, rawHtml, metadata);
      setPrompt('');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not generate template. Check proxy is running.');
    } finally {
      setGenerating(false);
    }
  };

  const handlePickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', 'Allow photo access to scan a bill book.'); return; }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      base64: true,
    });
    if (result.canceled || !result.assets[0]?.base64) return;

    const asset = result.assets[0];
    const mediaType = asset.mimeType === 'image/png' ? 'image/png' : 'image/jpeg';

    setGenerating(true);
    try {
      const { metadata, html: rawHtml } = await generateTemplateFromPhoto(
        asset.base64!,
        mediaType,
        {
          templateType:         'invoice',
          language:             'en-IN',
          pageSize:             'a4',
          theme:                { useThemeColor: true },
          requiredPlaceholders: INVOICE_REQUIRED_PLACEHOLDERS,
        },
      );
      setPhotoDebug({ photoUri: asset.uri, metadata, html: rawHtml });
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not analyze the photo. Check proxy is running.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSavePhotoTemplate = async () => {
    if (!photoDebug) return;
    await persistGeneratedTemplate('Bill Book Design', photoDebug.html, photoDebug.metadata);
    setPhotoDebug(null);
  };

  const brand = COLORS.primary;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      <Appbar.Header style={styles.appbar} elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} color={COLORS.primary} />
        <Appbar.Content title="Invoice Template" titleStyle={styles.appbarTitle} />
      </Appbar.Header>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Built-in */}
        <Text style={styles.sectionTitle}>Built-in Designs</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.builtinScroll}
          contentContainerStyle={styles.builtinRow}
        >
          {availableDesigns.map(d => {
            const isSelected = selectedId === d.id;
            return (
              <TouchableOpacity
                key={d.id}
                style={[styles.designCard, isSelected && { borderColor: brand, backgroundColor: `${brand}08` }]}
                onPress={() => selectDesign(d.id)}
                activeOpacity={0.7}
              >
                {shapeThumbFor(d.id, brand)}
                <View style={styles.designMeta}>
                  <Text style={[styles.designName, isSelected && { color: brand }]}>{d.name}</Text>
                  {isSelected && (
                    <View style={[styles.checkBadge, { backgroundColor: brand }]}>
                      <Ionicons name="checkmark" size={11} color="#fff" />
                    </View>
                  )}
                </View>
                <Text style={styles.designDesc} numberOfLines={2}>{d.description}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Saved AI templates */}
        {aiTemplates.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Your AI Designs</Text>
            <View style={styles.aiList}>
              {aiTemplates.map(t => {
                const isSelected = selectedId === t.id;
                return (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.aiCard, isSelected && { borderColor: brand, backgroundColor: `${brand}08` }]}
                    onPress={() => selectDesign(t.id)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="sparkles" size={18} color={isSelected ? brand : COLORS.textSecondary} />
                    <Text style={[styles.aiCardName, isSelected && { color: brand }]} numberOfLines={1}>{t.name}</Text>
                    {isSelected && <Ionicons name="checkmark-circle" size={20} color={brand} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {/* AI generator */}
        <Text style={styles.sectionTitle}>Design with AI</Text>
        <View style={styles.aiBox}>
          <View style={styles.aiHeader}>
            <Ionicons name="sparkles" size={16} color="#7C3AED" />
            <Text style={styles.aiHeaderText}>Describe your ideal invoice style</Text>
          </View>
          <TextInput
            style={styles.aiInput}
            value={prompt}
            onChangeText={setPrompt}
            placeholder={'e.g. "Modern GST invoice with saffron accent and two-column layout"'}
            placeholderTextColor={COLORS.textMuted}
            multiline
            numberOfLines={3}
          />
          <TouchableOpacity
            style={[styles.genBtn, (!prompt.trim() || generating) && styles.genBtnDisabled]}
            onPress={handleGenerate}
            disabled={!prompt.trim() || generating}
            activeOpacity={0.8}
          >
            {generating ? (
              <>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.genBtnText}>Generating…</Text>
              </>
            ) : (
              <>
                <Ionicons name="sparkles" size={16} color="#fff" />
                <Text style={styles.genBtnText}>Generate Template</Text>
              </>
            )}
          </TouchableOpacity>
          {generating && (
            <Text style={styles.genHint}>This may take 15–30 seconds…</Text>
          )}

          <View style={styles.orDivider}>
            <View style={styles.orLine} />
            <Text style={styles.orText}>OR</Text>
            <View style={styles.orLine} />
          </View>

          <TouchableOpacity
            style={[styles.photoBtn, generating && styles.genBtnDisabled]}
            onPress={handlePickPhoto}
            disabled={generating}
            activeOpacity={0.8}
          >
            <Ionicons name="camera-outline" size={16} color="#7C3AED" />
            <Text style={styles.photoBtnText}>Upload Bill Book Photo</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 48 }} />
      </ScrollView>

      <PhotoDebugModal
        visible={photoDebug !== null}
        photoUri={photoDebug?.photoUri ?? null}
        metadata={photoDebug?.metadata}
        html={photoDebug?.html ?? ''}
        onSave={handleSavePhotoTemplate}
        onDiscard={() => setPhotoDebug(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: COLORS.background },
  appbar:      { backgroundColor: COLORS.surface },
  appbarTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  scroll:      { flex: 1, paddingHorizontal: 16, paddingTop: 20 },
  sectionTitle:{ fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 12, marginTop: 8 },

  builtinScroll: { marginBottom: 24, marginHorizontal: -16 },
  builtinRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 16 },
  designCard: {
    width: 122, alignItems: 'center',
    backgroundColor: COLORS.surface, borderRadius: 16,
    padding: 16, borderWidth: 1.5, borderColor: COLORS.border,
  },
  designMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  designName: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  checkBadge: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  designDesc: { fontSize: 10, color: COLORS.textMuted, textAlign: 'center', marginTop: 3 },

  aiList: { gap: 8, marginBottom: 24 },
  aiCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.surface, borderRadius: 16, padding: 16,
    borderWidth: 1.5, borderColor: COLORS.border,
  },
  aiCardName: { flex: 1, fontSize: 14, fontWeight: '500', color: COLORS.text },

  aiBox: {
    backgroundColor: COLORS.surface, borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: COLORS.border,
    marginBottom: 16,
  },
  aiHeader:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  aiHeaderText:{ fontSize: 13, fontWeight: '600', color: '#7C3AED' },
  aiInput: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 12,
    padding: 12, fontSize: 13, color: COLORS.text,
    backgroundColor: COLORS.background, minHeight: 72,
    textAlignVertical: 'top', marginBottom: 12,
  },
  genBtn:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#7C3AED', borderRadius: 14, paddingVertical: 13 },
  genBtnDisabled:{ opacity: 0.5 },
  genBtnText:    { fontSize: 14, fontWeight: '700', color: '#fff' },
  genHint:       { fontSize: 12, color: COLORS.textMuted, textAlign: 'center', marginTop: 8 },
  orDivider:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, marginBottom: 10 },
  orLine:        { flex: 1, height: 1, backgroundColor: COLORS.border },
  orText:        { fontSize: 11, fontWeight: '700', color: COLORS.textMuted },
  photoBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#F5F3FF', borderRadius: 14, paddingVertical: 13,
    borderWidth: 1, borderColor: 'rgba(124,58,237,0.25)',
  },
  photoBtnText:  { fontSize: 14, fontWeight: '700', color: '#7C3AED' },
});
