import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider, MD3LightTheme } from 'react-native-paper';
import { AppNavigator } from './src/navigation/AppNavigator';
import { initDatabase } from './src/database/db';
import { bootstrapIfNeeded } from './src/services/businessService';
import { ensureLocalBlocks } from './src/services/numberBlockService';
import { seedSystemTemplatesIfNeeded, deduplicateTemplates, removeDeprecatedTemplates, fixTemplateTypes } from './src/services/templateService';
import { COLORS } from './src/constants';

const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#F97316',
    onPrimary: '#FFFFFF',
    primaryContainer: '#FED7AA',
    onPrimaryContainer: '#7C2D12',
    secondary: '#64748B',
    onSecondary: '#FFFFFF',
    secondaryContainer: '#E2E8F0',
    onSecondaryContainer: '#334155',
    background: '#FAFAFA',
    onBackground: '#0F172A',
    surface: '#FFFFFF',
    onSurface: '#0F172A',
    surfaceVariant: '#F1F5F9',
    onSurfaceVariant: '#64748B',
    outline: '#E5E7EB',
    outlineVariant: '#E5E7EB',
    error: '#DC2626',
    onError: '#FFFFFF',
    errorContainer: '#FEE2E2',
    onErrorContainer: '#7F1D1D',
  },
};

export default function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initDatabase()
      .then(() => bootstrapIfNeeded())
      .then(async () => {
        const { getSession } = await import('./src/services/businessService');
        const { businessId } = getSession();
        
        // Wipe all records and templates for a fresh start during development
        const { getDb } = await import('./src/database/db');
        const db = await getDb();
        await db.runAsync('DELETE FROM payments');
        await db.runAsync('DELETE FROM invoice_snapshots');
        await db.runAsync('DELETE FROM invoice_lines');
        await db.runAsync('DELETE FROM invoices');
        await db.runAsync('DELETE FROM template_versions');
        await db.runAsync('DELETE FROM pinned_templates');
        await db.runAsync('DELETE FROM templates');
        
        await ensureLocalBlocks(businessId);
        await removeDeprecatedTemplates(businessId);
        await deduplicateTemplates(businessId);
        await fixTemplateTypes(businessId);
        await seedSystemTemplatesIfNeeded(businessId);
      })
      .then(() => setReady(true))
      .catch(e => setError(String(e)));
  }, []);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Failed to initialise database</Text>
        <Text style={styles.errorDetail}>{error}</Text>
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PaperProvider theme={theme}>
          <AppNavigator />
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
  errorText: { fontSize: 18, fontWeight: '700', color: COLORS.danger, marginBottom: 8 },
  errorDetail: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', paddingHorizontal: 24 },
});
