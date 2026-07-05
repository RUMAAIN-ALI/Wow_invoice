import React, { useEffect, useState } from 'react';
import { View, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Appbar, Text } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { TemplateType } from '../types';
import { getLocalFieldSuggestions, LOCAL_THRESHOLD, templateTypeLabel, COLORS } from '../constants';
import { getAiFieldSuggestions } from '../services/aiSuggestionsService';
import { Button } from '../components/Button';

type Nav   = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'SuggestedFields'>;

export function SuggestedFieldsScreen() {
  const navigation = useNavigation<Nav>();
  const route      = useRoute<Route>();
  const { documentTypeId, documentTypeName, templateType } = route.params;

  const [fields, setFields]     = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading]   = useState(true);
  const [source, setSource]     = useState<'local' | 'ai' | 'none'>('none');

  useEffect(() => {
    let active = true;
    (async () => {
      // 1. Try local presets
      const local = getLocalFieldSuggestions(documentTypeName);
      if (local.score >= LOCAL_THRESHOLD && local.fields.length > 0) {
        if (!active) return;
        setFields(local.fields);
        setSelected(new Set(local.fields.map((_, i) => i)));
        setSource('local');
        setLoading(false);
        return;
      }

      // 2. AI fallback
      try {
        const aiFields = await getAiFieldSuggestions(
          documentTypeName,
          'custom',
          templateType as TemplateType
        );
        if (!active) return;
        if (aiFields.length > 0) {
          setFields(aiFields);
          setSelected(new Set(aiFields.map((_, i) => i)));
          setSource('ai');
        } else {
          setSource('none');
        }
      } catch {
        if (!active) return;
        setSource('none');
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [documentTypeName, templateType]);

  const toggle = (i: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const handleContinue = () => {
    const chosen = fields.filter((_, i) => selected.has(i));
    navigation.replace('SimpleTemplateEditor', {
      documentTypeId,
      documentTypeName,
      initialFields: chosen,
    });
  };

  const handleSkip = () => {
    navigation.replace('SimpleTemplateEditor', {
      documentTypeId,
      documentTypeName,
      initialFields: [],
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      <Appbar.Header style={styles.appbar} elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} color={COLORS.primary} />
        <Appbar.Content title={documentTypeName} titleStyle={styles.appbarTitle} />
      </Appbar.Header>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text variant="bodyMedium" style={styles.loadingText}>Finding the right fields…</Text>
          </View>
        ) : fields.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text variant="bodyMedium" style={styles.emptyText}>
              No suggestions found. You can add your own fields in the next step.
            </Text>
          </View>
        ) : (
          <>
            <Text variant="bodyMedium" style={styles.hint}>
              {templateTypeLabel(templateType as TemplateType)} · Select the fields to include:
            </Text>
            {source === 'ai' && (
              <View style={styles.aiBadge}>
                <Ionicons name="sparkles" size={13} color="#7C3AED" />
                <Text style={styles.aiBadgeText}>AI suggested</Text>
              </View>
            )}
            {fields.map((fieldName, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.row, selected.has(i) && styles.rowSelected]}
                onPress={() => toggle(i)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, selected.has(i) && styles.checkboxSelected]}>
                  {selected.has(i) && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={[styles.fieldName, selected.has(i) && styles.fieldNameSelected]}>
                  {fieldName}
                </Text>
              </TouchableOpacity>
            ))}
          </>
        )}

        {!loading && (
          <>
            <View style={{ height: 24 }} />
            <Button
              label={fields.length === 0
                ? 'Add fields →'
                : selected.size > 0
                  ? `Use ${selected.size} Field${selected.size !== 1 ? 's' : ''} →`
                  : 'Continue with no fields →'}
              onPress={handleContinue}
            />
            {fields.length > 0 && (
              <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
                <Text style={styles.skipText}>Skip — I'll add fields myself</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: COLORS.background },
  appbar:      { backgroundColor: COLORS.surface },
  appbarTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  scroll:      { flex: 1, paddingHorizontal: 16, paddingTop: 20 },
  loadingBox:  { alignItems: 'center', paddingTop: 60, gap: 16 },
  loadingText: { color: COLORS.textSecondary },
  emptyBox:    { paddingTop: 40 },
  emptyText:   { color: COLORS.textSecondary, textAlign: 'center' },
  hint:        { color: COLORS.textSecondary, marginBottom: 12 },
  aiBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-start', backgroundColor: '#F5F3FF',
    borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4,
    marginBottom: 12,
  },
  aiBadgeText:       { fontSize: 11, fontWeight: '600', color: '#7C3AED' },
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surface, borderRadius: 12,
    padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: COLORS.border,
    gap: 12,
  },
  rowSelected:       { borderColor: COLORS.primary, backgroundColor: `${COLORS.primary}08` },
  checkbox: {
    width: 22, height: 22, borderRadius: 8,
    borderWidth: 2, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxSelected:  { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  checkmark:         { color: '#fff', fontSize: 13, fontWeight: '700' },
  fieldName:         { fontSize: 15, fontWeight: '500', color: COLORS.text },
  fieldNameSelected: { color: COLORS.primary },
  skipBtn:    { padding: 16, alignItems: 'center' },
  skipText:   { fontSize: 13, color: COLORS.textSecondary },
});
