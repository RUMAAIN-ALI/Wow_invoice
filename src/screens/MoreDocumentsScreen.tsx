import React, { useCallback, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Appbar, Searchbar, Text, Surface, Divider } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { DocumentType, DocumentCategory } from '../types';
import { getAllDocumentTypes, getPinnedDocumentTypes } from '../services/documentTypeService';
import { createTemplate } from '../services/templateService';
import { getSession } from '../services/businessService';
import { COLORS, CATEGORY_LABELS, ALL_DOCUMENT_TYPES, detectTemplateType } from '../constants';
import { DocIcon } from '../components/DocIcon';
import { navigateToDocument } from '../navigation/documentRouter';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const CATEGORIES: DocumentCategory[] = ['billing', 'services', 'logistics', 'education'];

export function MoreDocumentsScreen() {
  const navigation = useNavigation<Nav>();
  const [userTypes, setUserTypes] = useState<DocumentType[]>([]);
  const [pinned, setPinned] = useState<DocumentType[]>([]);
  const [search, setSearch] = useState('');

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const [all, pins] = await Promise.all([getAllDocumentTypes(), getPinnedDocumentTypes()]);
        if (!active) return;
        setUserTypes(all);
        setPinned(pins);
      })();
      return () => { active = false; };
    }, [])
  );

  const handleSelect = async (name: string, icon: string, category: DocumentCategory) => {
    const existing = userTypes.find(t => t.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      navigateToDocument(navigation, existing.id, existing.name, existing.templateType, existing.category);
      return;
    }
    try {
      const { businessId } = getSession();
      const templateType = detectTemplateType(name, category);
      const dt = await createTemplate(businessId, name, category, icon, undefined, templateType);
      navigateToDocument(navigation, dt.id, dt.name, templateType, category);
    } catch {
      // Template already exists from a parallel path — find it and navigate
      const { businessId } = getSession();
      const { getAllTemplates } = await import('../services/templateService');
      const all = await getAllTemplates(businessId);
      const found = all.find(t => t.name.toLowerCase() === name.toLowerCase());
      if (found) {
        navigateToDocument(navigation, found.id, found.name, found.templateType, found.category);
      }
    }
  };

  const handleSelectUser = (dt: DocumentType) => {
    navigateToDocument(navigation, dt.id, dt.name, dt.templateType, dt.category);
  };

  const filteredAll = ALL_DOCUMENT_TYPES.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  const groupedByCategory = CATEGORIES.map(cat => ({
    category: cat,
    items: filteredAll.filter(t => t.category === cat),
  })).filter(g => g.items.length > 0);

  const pinnedIds = new Set(pinned.map(p => p.id));
  const userPinned = userTypes.filter(t => pinnedIds.has(t.id));
  const userRecent = userTypes.filter(t => !pinnedIds.has(t.id)).slice(0, 3);

  const renderDocRow = (
    name: string,
    icon: string,
    category: DocumentCategory,
    onPress: () => void,
    key: string,
    showDivider: boolean
  ) => (
    <React.Fragment key={key}>
      {showDivider && <Divider />}
      <TouchableOpacity style={styles.docRow} onPress={onPress} activeOpacity={0.7}>
        <DocIcon icon={icon} category={category} size="sm" docName={name} />
        <Text style={styles.rowName}>{name}</Text>
        <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
      </TouchableOpacity>
    </React.Fragment>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      <Appbar.Header style={styles.appbar} elevated>
        <Appbar.BackAction
          onPress={() => navigation.goBack()}
          color={COLORS.primary}
        />
        <Appbar.Content title="Documents" titleStyle={styles.appbarTitle} />
      </Appbar.Header>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.searchContainer}>
          <Searchbar
            placeholder="Search documents..."
            value={search}
            onChangeText={setSearch}
            style={styles.searchbar}
            inputStyle={styles.searchInput}
            elevation={0}
            icon={({ size, color }) => <Ionicons name="search" size={size} color={color} />}
            clearIcon={({ size, color }) => <Ionicons name="close-circle" size={size} color={color} />}
          />
        </View>

        {!search && userPinned.length > 0 && (
          <>
            <Text variant="titleSmall" style={styles.sectionTitle}>Your Documents</Text>
            <Surface style={styles.group} elevation={1}>
              {userPinned.map((dt, idx) =>
                renderDocRow(dt.name, dt.icon, dt.category, () => handleSelectUser(dt), String(dt.id), idx > 0)
              )}
            </Surface>
          </>
        )}

        {!search && userRecent.length > 0 && (
          <>
            <Text variant="titleSmall" style={styles.sectionTitle}>Recently Used</Text>
            <Surface style={styles.group} elevation={1}>
              {userRecent.map((dt, idx) =>
                renderDocRow(dt.name, dt.icon, dt.category, () => handleSelectUser(dt), `r-${dt.id}`, idx > 0)
              )}
            </Surface>
          </>
        )}

        <Text variant="titleSmall" style={styles.sectionTitle}>All Categories</Text>
        {groupedByCategory.map(group => (
          <View key={group.category}>
            <Text variant="labelSmall" style={styles.categoryLabel}>
              {CATEGORY_LABELS[group.category].toUpperCase()}
            </Text>
            <Surface style={styles.group} elevation={1}>
              {group.items.map((t, idx) =>
                renderDocRow(
                  t.name, t.icon, t.category,
                  () => handleSelect(t.name, t.icon, t.category),
                  t.name, idx > 0
                )
              )}
            </Surface>
          </View>
        ))}

        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => navigation.navigate('CreateDocumentType')}
          activeOpacity={0.7}
        >
          <Surface style={styles.createBtnSurface} elevation={1}>
            <View style={styles.createBtnIconBox}>
              <Ionicons name="add" size={22} color={COLORS.primary} />
            </View>
            <Text style={styles.createBtnText}>Create Custom Document</Text>
            <Ionicons name="chevron-forward" size={18} color={COLORS.primary} />
          </Surface>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  appbar: { backgroundColor: COLORS.surface },
  appbarTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  scroll: { flex: 1, paddingHorizontal: 16 },
  searchContainer: { marginVertical: 16 },
  searchbar: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: { fontSize: 15 },
  sectionTitle: { fontWeight: '700', color: COLORS.text, marginBottom: 8, marginTop: 8 },
  categoryLabel: {
    color: COLORS.textSecondary,
    letterSpacing: 0.8,
    marginTop: 16,
    marginBottom: 6,
  },
  group: {
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    overflow: 'hidden',
    marginBottom: 8,
  },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  rowName: { flex: 1, fontSize: 15, fontWeight: '500', color: COLORS.text },
  createBtn: { marginTop: 8 },
  createBtnSurface: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 14,
    gap: 12,
    backgroundColor: `${COLORS.primary}08`,
    borderWidth: 1.5,
    borderColor: `${COLORS.primary}40`,
    borderStyle: 'dashed',
  },
  createBtnIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: `${COLORS.primary}14`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createBtnText: { flex: 1, fontSize: 15, fontWeight: '600', color: COLORS.primary },
});
