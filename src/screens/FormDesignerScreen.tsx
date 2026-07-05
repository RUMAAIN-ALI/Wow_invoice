import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Appbar, Text, Surface } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { COLORS } from '../constants';
import { Button } from '../components/Button';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'FormDesigner'>;

export function FormDesignerScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { documentTypeName } = route.params;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      <Appbar.Header style={styles.appbar} elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} color={COLORS.primary} />
        <Appbar.Content title={documentTypeName} titleStyle={styles.appbarTitle} />
      </Appbar.Header>

      <View style={styles.container}>
        <Surface style={styles.card} elevation={1}>
          <View style={styles.iconBox}>
            <Ionicons name="construct-outline" size={40} color={COLORS.primary} />
          </View>
          <Text variant="titleLarge" style={styles.title}>Template Customization</Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            Full template editing is coming in Phase 2.{'\n\n'}
            Your document already uses a default template with Item, Qty, Price, and Amount columns.
          </Text>
          <Button
            label="Go Back"
            onPress={() => navigation.goBack()}
            style={styles.btn}
          />
        </Surface>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  appbar: { backgroundColor: COLORS.surface },
  appbarTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    width: '100%',
    gap: 16,
  },
  iconBox: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: `${COLORS.primary}12`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: { fontWeight: '700', color: COLORS.text, textAlign: 'center' },
  subtitle: { color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22 },
  btn: { marginTop: 8, width: '100%' },
});
