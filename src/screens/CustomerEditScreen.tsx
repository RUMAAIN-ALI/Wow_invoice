import React, { useCallback, useState } from 'react';
import { View, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Appbar, Text } from 'react-native-paper';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { getCustomerById, createCustomer, updateCustomer } from '../services/customerService';
import { getSession } from '../services/businessService';
import { COLORS } from '../constants';
import { KeyboardAwareScreen } from '../components/keyboard/KeyboardAwareScreen';
import { StickyBottomActionBar } from '../components/keyboard/StickyBottomActionBar';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'CustomerEdit'>;

export function CustomerEditScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { customerId } = route.params ?? {};
  const isEditing = !!customerId;

  const [name,      setName]      = useState('');
  const [phone,     setPhone]     = useState('');
  const [email,     setEmail]     = useState('');
  const [gstin,     setGstin]     = useState('');
  const [address,   setAddress]   = useState('');
  const [city,      setCity]      = useState('');
  const [stateName, setStateName] = useState('');
  const [loading,   setLoading]   = useState(isEditing);
  const [saving,    setSaving]    = useState(false);

  useFocusEffect(useCallback(() => {
    if (!customerId) return;
    let active = true;
    getCustomerById(customerId).then(c => {
      if (!active || !c) return;
      setName(c.name);
      setPhone(c.phone ?? '');
      setEmail(c.email ?? '');
      setGstin(c.gstin ?? '');
      setAddress(c.address ?? '');
      setCity(c.city ?? '');
      setStateName(c.stateName ?? '');
      setLoading(false);
    });
    return () => { active = false; };
  }, [customerId]));

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Name required'); return; }
    setSaving(true);
    try {
      const data = {
        name: name.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        gstin: gstin.trim() || undefined,
        address: address.trim() || undefined,
        city: city.trim() || undefined,
        stateName: stateName.trim() || undefined,
      };
      if (isEditing) {
        await updateCustomer(customerId!, data);
      } else {
        const { businessId } = getSession();
        await createCustomer(businessId, data);
      }
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not save customer.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      <Appbar.Header style={styles.appbar} elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} color={COLORS.primary} />
        <Appbar.Content title={isEditing ? 'Edit Customer' : 'Add Customer'} titleStyle={styles.appbarTitle} />
      </Appbar.Header>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <KeyboardAwareScreen edges={[]} style={styles.scroll} contentContainerStyle={styles.content}>
          <Field label="Name" required>
            <TextInput style={styles.input} value={name} onChangeText={setName}
              placeholder="Customer name" placeholderTextColor={COLORS.textMuted} />
          </Field>
          <Field label="Phone">
            <TextInput style={styles.input} value={phone} onChangeText={setPhone}
              placeholder="+91 XXXXX XXXXX" placeholderTextColor={COLORS.textMuted} keyboardType="phone-pad" />
          </Field>
          <Field label="Email">
            <TextInput style={styles.input} value={email} onChangeText={setEmail}
              placeholder="customer@email.com" placeholderTextColor={COLORS.textMuted}
              keyboardType="email-address" autoCapitalize="none" />
          </Field>
          <Field label="GSTIN">
            <TextInput style={styles.input} value={gstin} onChangeText={v => setGstin(v.toUpperCase())}
              placeholder="29ABCDE1234F1Z5" placeholderTextColor={COLORS.textMuted} autoCapitalize="characters" />
          </Field>
          <Field label="Address">
            <TextInput style={[styles.input, styles.inputMulti]} value={address} onChangeText={setAddress}
              placeholder="Street address" placeholderTextColor={COLORS.textMuted} multiline numberOfLines={2} />
          </Field>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Field label="City">
                <TextInput style={styles.input} value={city} onChangeText={setCity}
                  placeholder="City" placeholderTextColor={COLORS.textMuted} />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="State">
                <TextInput style={styles.input} value={stateName} onChangeText={setStateName}
                  placeholder="State" placeholderTextColor={COLORS.textMuted} />
              </Field>
            </View>
          </View>
          <View style={{ height: 72 }} />
        </KeyboardAwareScreen>
      )}
      {!loading && (
        <StickyBottomActionBar style={styles.stickyBar}>
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save Customer'}</Text>
          </TouchableOpacity>
        </StickyBottomActionBar>
      )}
    </SafeAreaView>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}{required ? <Text style={{ color: COLORS.primary }}> *</Text> : null}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  appbar: { backgroundColor: COLORS.surface },
  appbarTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  field: { marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.text,
  },
  inputMulti: { minHeight: 64, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 12 },
  stickyBar: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  saveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
