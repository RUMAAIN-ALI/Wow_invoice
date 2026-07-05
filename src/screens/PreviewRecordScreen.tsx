import React, { useCallback, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Share, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Appbar, Surface } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { HtmlPreview } from '../components/HtmlPreview';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { RootStackParamList } from '../navigation/types';
import { DocRecord, BusinessSettings } from '../types';
import { getRecordById, deleteRecord } from '../services/invoiceService';
import { getVersionById } from '../services/templateService';
import { getBusinessSettings } from '../services/businessService';
import { getTemplateId, getAiTemplateHtml } from '../services/designStorage';
import { getAiTemplateHtmlById } from '../services/templateService';
import { getActivePrintProfile } from '../services/printProfileService';
import { renderInvoice, RenderInput } from '../templates';
import { COLORS } from '../constants';

type Nav   = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'PreviewRecord'>;

type DataMap = Record<string, any>;

export function PreviewRecordScreen() {
  const navigation = useNavigation<Nav>();
  const route      = useRoute<Route>();
  const { recordId, documentTypeName } = route.params;

  const [record,       setRecord]       = useState<DocRecord | null>(null);
  const [data,         setData]         = useState<DataMap>({});
  const [docName,      setDocName]      = useState(documentTypeName);
  const [business,     setBusiness]     = useState<BusinessSettings | null>(null);
  const [templateId,   setTemplateIdState] = useState('classic');
  const [printProfile, setPrintProfile] = useState<any>(null);
  const [aiHtml,       setAiHtml]       = useState<string | null>(null);
  const [templateType, setTemplateType] = useState<'transaction_document' | 'record_form'>('transaction_document');
  const [loading,      setLoading]      = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      (async () => {
        const r = await getRecordById(recordId);
        if (!r || !active) return;

        const parsedData = r.data ? JSON.parse(r.data) : {};

        let name = documentTypeName;
        let tplType: 'transaction_document' | 'record_form' = 'transaction_document';
        let parentTemplateId = r.documentTypeId; // initialize with version id, will update to parent below

        if (r.documentTypeId) {
          const ver = await getVersionById(r.documentTypeId);
          if (ver) {
            parentTemplateId = ver.templateId; // <-- correct parent ID
            name    = ver.config.meta.name ?? documentTypeName;
            tplType = (ver.config.meta.templateType as any) ?? 'transaction_document';
          }
        }

        const [b, dId, activeProfile] = await Promise.all([
          getBusinessSettings(),
          getTemplateId(parentTemplateId),
          getActivePrintProfile(),
        ]);
        if (!active) return;

        let ai: string | null = null;
        if (dId.startsWith('ai_')) {
          const versionId = dId.replace('ai_', '');
          // SQLite-backed versions (new system); fall back to AsyncStorage (pre-migration)
          ai = await getAiTemplateHtmlById(versionId);
          if (!ai) ai = await getAiTemplateHtml(versionId);
        }

        setRecord(r);
        setData(parsedData);
        setDocName(name);
        setBusiness(b);
        setTemplateIdState(dId);
        setPrintProfile(activeProfile);
        setAiHtml(ai);
        setTemplateType(tplType);
        
        // Ensure record has the true parent template ID so handleDesign works correctly
        r.documentTypeId = parentTemplateId;
        setRecord(r);
        setLoading(false);
      })();
      return () => { active = false; };
    }, [recordId])
  );

  const getHtml = () => {
    if (!record || !business) return '';
    const input: RenderInput = { 
      record, 
      data, 
      docName, 
      business, 
      templateType,
      themeOverrides: printProfile?.themeOverridesJson ? JSON.parse(printProfile.themeOverridesJson) : undefined,
      preferences: printProfile?.preferencesJson ? JSON.parse(printProfile.preferencesJson) : undefined,
    };
    return renderInvoice(templateId, input, aiHtml);
  };

  const handlePdf = async () => {
    if (!record || !business) return;
    try {
      const { uri } = await Print.printToFileAsync({ html: getHtml() });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf' });
    } catch {
      Alert.alert('Error', 'Could not generate PDF.');
    }
  };

  const handleShare = async () => {
    if (!record || !business) return;
    let text = `${business.name}\n${docName}: ${record.number}\n\n`;
    for (const [key, val] of Object.entries(data)) {
      if (!val && val !== 0) continue;
      if (Array.isArray(val)) {
        text += `${key}:\n`;
        for (const row of val.filter((r: any) => r.name)) {
          text += `  ${row.name} x${row.qty} = ₹${(Number(row.qty) * Number(row.price)).toLocaleString('en-IN')}\n`;
        }
      } else {
        text += `${key}: ${val}\n`;
      }
    }
    await Share.share({ message: text });
  };

  const handlePrint = async () => {
    if (!record || !business) return;
    await Print.printAsync({ html: getHtml() });
  };

  const handleDesign = () => {
    if (!record) return;
    navigation.navigate('StyleStudio', {
      documentTypeId:   record.documentTypeId,
      documentTypeName: docName,
    });
  };

  const handleDelete = () => {
    if (!record) return;
    Alert.alert('Delete record?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteRecord(record.id);
            navigation.goBack();
          } catch (e) {
            Alert.alert('Error', 'Could not delete record.');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      <Appbar.Header style={styles.appbar} elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} color={COLORS.primary} />
        <Appbar.Content title={docName} titleStyle={styles.appbarTitle} />
        <Appbar.Action icon="trash-can-outline" onPress={handleDelete} color={COLORS.danger || '#EF4444'} />
      </Appbar.Header>

      <View style={styles.webviewContainer}>
        {loading || !record || !business ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading preview…</Text>
          </View>
        ) : (
          <HtmlPreview html={getHtml()} style={styles.webview} />
        )}
      </View>

      <Surface style={styles.actions} elevation={4}>
        <TouchableOpacity style={styles.actionBtn} onPress={handleDesign}>
          <View style={[styles.actionIconBox, { backgroundColor: '#F5F3FF' }]}>
            <Ionicons name="sparkles" size={22} color="#7C3AED" />
          </View>
          <Text style={styles.actionLabel}>Design</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={handlePdf}>
          <View style={[styles.actionIconBox, { backgroundColor: '#EFF6FF' }]}>
            <Ionicons name="document-text" size={22} color="#1D4ED8" />
          </View>
          <Text style={styles.actionLabel}>PDF</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={handleShare}>
          <View style={[styles.actionIconBox, { backgroundColor: '#F0FDF4' }]}>
            <Ionicons name="share-social" size={22} color="#15803D" />
          </View>
          <Text style={styles.actionLabel}>Share</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={handlePrint}>
          <View style={[styles.actionIconBox, { backgroundColor: '#FFF7ED' }]}>
            <Ionicons name="print" size={22} color="#C2410C" />
          </View>
          <Text style={styles.actionLabel}>Print</Text>
        </TouchableOpacity>
      </Surface>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:             { flex: 1, backgroundColor: COLORS.background },
  appbar:           { backgroundColor: COLORS.surface },
  appbarTitle:      { fontSize: 20, fontWeight: '700', color: COLORS.text },
  webviewContainer: { flex: 1, backgroundColor: '#f0f0f0' },
  webview:          { flex: 1 },
  loadingBox:       { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText:      { fontSize: 14, color: COLORS.textSecondary },
  actions: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  actionIconBox: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  actionLabel:   { fontSize: 12, fontWeight: '600', color: COLORS.text },
});
