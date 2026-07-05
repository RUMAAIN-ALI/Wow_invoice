import React, { useCallback, useState } from 'react';
import {
  View, TouchableOpacity, StyleSheet, ScrollView,
  Alert, TextInput, Image, Modal, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { BusinessSettings, BusinessType, PrintProfile, PrintPaperWidth, PrintFontSize } from '../types';
import { getBusinessSettings, updateBusinessSettings } from '../services/settingsService';
import { getActivePrintProfile, updatePrintProfile } from '../services/printProfileService';
import { ColorPickerModal } from '../components/ColorPickerModal';
import { cardShadow } from '../utils/shadow';
import { exportBackup } from '../services/backupService';

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  orange:      '#FF6B00',
  orangeLight: '#FFF8F4',
  surface:     '#FFFFFF',
  bg:          '#F7F8FA',
  border:      '#E8EAF0',
  text:        '#0F172A',
  textSub:     '#64748B',
  textMuted:   '#94A3B8',
};
const H_PAD = 20;

// ─── Business type options ────────────────────────────────────────────────────
const BUSINESS_TYPES: { value: BusinessType; label: string; icon: string }[] = [
  { value: 'pharmacy',    label: 'Pharmacy',     icon: 'medical-outline' },
  { value: 'grocery',     label: 'Grocery',      icon: 'basket-outline' },
  { value: 'garment',     label: 'Garment',      icon: 'shirt-outline' },
  { value: 'restaurant',  label: 'Restaurant',   icon: 'restaurant-outline' },
  { value: 'hardware',    label: 'Hardware',     icon: 'hammer-outline' },
  { value: 'service',     label: 'Service',      icon: 'construct-outline' },
  { value: 'wholesale',   label: 'Wholesale',    icon: 'cube-outline' },
  { value: 'other',       label: 'Other',        icon: 'ellipsis-horizontal-circle-outline' },
];

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu & Kashmir', 'Ladakh', 'Puducherry',
];

type SettingsState = BusinessSettings & { logo?: string };

const EMPTY: SettingsState = {
  id: '', name: '', type: 'service', brandColor: '#FF6B00',
  invoicePrefix: 'INV-', invoiceStartNumber: 1, customBusinessType: '', footerMessage: '',
};

const PAPER_OPTIONS: { value: PrintPaperWidth; label: string; sub: string }[] = [
  { value: 'thermal_58', label: '58mm', sub: 'Narrow thermal' },
  { value: 'thermal_80', label: '80mm', sub: 'Standard thermal' },
  { value: 'a4',         label: 'A4',   sub: 'Full page' },
];

const FONT_OPTIONS: { value: PrintFontSize; label: string }[] = [
  { value: 'small',  label: 'Small'  },
  { value: 'medium', label: 'Medium' },
  { value: 'large',  label: 'Large'  },
];

export function SettingsScreen() {
  const [s, setS]                   = useState<SettingsState>(EMPTY);
  const [print, setPrint]           = useState<PrintProfile | null>(null);
  const [saving, setSaving]         = useState(false);
  const [pickerVisible, setPicker]  = useState(false);
  const [stateModal, setStateModal] = useState(false);
  const [typeModal, setTypeModal]   = useState(false);
  const [backingUp, setBackingUp]   = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.all([getBusinessSettings(), getActivePrintProfile()]).then(([loaded, profile]) => {
        if (!active) return;
        if (loaded) setS({ ...EMPTY, ...loaded });
        setPrint(profile);
      });
      return () => { active = false; };
    }, [])
  );

  const setPrintField = <K extends keyof PrintProfile>(key: K, value: PrintProfile[K]) =>
    setPrint(prev => prev ? { ...prev, [key]: value } : prev);

  const set = <K extends keyof SettingsState>(key: K, value: SettingsState[K]) =>
    setS(prev => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    if (!s.name.trim()) { Alert.alert('Business name required'); return; }
    setSaving(true);
    try {
      await Promise.all([
        updateBusinessSettings({
          name:               s.name,
          type:               s.type,
          brandColor:         s.brandColor,
          address:            s.address,
          city:               s.city,
          stateName:          s.stateName,
          phone:              s.phone,
          email:              s.email,
          gstin:              s.gstin,
          licenseNumber:      s.licenseNumber,
          logo:               s.logo,
          upiId:              s.upiId,
          bankName:           s.bankName,
          accountNumber:      s.accountNumber,
          ifsc:               s.ifsc,
          invoicePrefix:       s.invoicePrefix,
          invoiceStartNumber:  s.invoiceStartNumber,
          customBusinessType:  s.type === 'other' ? s.customBusinessType : undefined,
          footerMessage:       s.footerMessage,
        }),
        print ? updatePrintProfile({
          paperWidth:    print.paperWidth,
          fontSize:      print.fontSize,
          showLogo:      print.showLogo,
          showGstin:     print.showGstin,
          showUpi:       print.showUpi,
          showSignature: print.showSignature,
        }) : Promise.resolve(),
      ]);
      Alert.alert('Saved', 'Settings updated.');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not save settings.');
    } finally {
      setSaving(false);
    }
  };

  const pickLogo = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', 'Allow photo access to upload a logo.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      set('logo', result.assets[0].uri);
    }
  };

  const handleBackup = async () => {
    setBackingUp(true);
    try {
      await exportBackup();
    } catch (e: any) {
      Alert.alert('Backup failed', e?.message ?? 'Could not create backup.');
    } finally {
      setBackingUp(false);
    }
  };

  const initial     = s.name.trim().charAt(0).toUpperCase() || 'B';
  const bizType     = BUSINESS_TYPES.find(b => b.value === s.type) ?? BUSINESS_TYPES[5];
  const bizLabel    = s.type === 'other' && s.customBusinessType?.trim()
                        ? s.customBusinessType.trim()
                        : bizType.label;
  const gstVerified = s.gstin && s.gstin.length === 15;

  return (
    <SafeAreaView style={ST.safe} edges={['top', 'bottom']}>

      {/* ── Page title ── */}
      <View style={ST.pageHeader}>
        <Text style={ST.pageTitle}>Settings</Text>
        <TouchableOpacity
          style={[ST.saveBtn, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.82}
        >
          <Text style={ST.saveBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={ST.scroll}
        contentContainerStyle={ST.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        {/* ── Profile Card ── */}
        <View style={ST.profileCard}>
          <TouchableOpacity onPress={pickLogo} activeOpacity={0.82} style={ST.logoWrap}>
            {s.logo ? (
              <Image source={{ uri: s.logo }} style={ST.logoImg} />
            ) : (
              <View style={[ST.logoAvatar, { backgroundColor: s.brandColor }]}>
                <Text style={ST.logoInitial}>{initial}</Text>
              </View>
            )}
            <View style={ST.logoBadge}>
              <Ionicons name="camera" size={12} color="#fff" />
            </View>
          </TouchableOpacity>

          <View style={ST.profileInfo}>
            <Text style={ST.profileName} numberOfLines={1}>{s.name || 'Your Business'}</Text>
            <View style={ST.profileMeta}>
              <Ionicons name={bizType.icon as any} size={13} color={C.textSub} />
              <Text style={ST.profileMetaText}>{bizLabel}</Text>
              <View style={ST.dot} />
              <View style={[ST.gstBadge, gstVerified ? ST.gstBadgeOk : ST.gstBadgeWarn]}>
                <Text style={[ST.gstBadgeText, { color: gstVerified ? '#16A34A' : '#B45309' }]}>
                  {gstVerified ? 'GST Verified' : 'GST not set'}
                </Text>
              </View>
            </View>
            {(s.city || s.stateName) && (
              <Text style={ST.profileLocation}>
                <Ionicons name="location-outline" size={12} color={C.textMuted} />
                {' '}{[s.city, s.stateName].filter(Boolean).join(', ')}
              </Text>
            )}
          </View>
        </View>

        {/* ═══════════ 1. Business Profile ═══════════ */}
        <SectionLabel icon="business-outline" title="Business Profile" />
        <View style={ST.card}>
          <Field label="Business Name" required>
            <TextInput style={ST.input} value={s.name} onChangeText={v => set('name', v)}
              placeholder="Your business name" placeholderTextColor={C.textMuted} />
          </Field>
          <Divider />
          <Field label="Business Type">
            <TouchableOpacity style={ST.selectRow} onPress={() => setTypeModal(true)} activeOpacity={0.7}>
              <Ionicons name={bizType.icon as any} size={18} color={C.orange} />
              <Text style={ST.selectText}>{bizType.label}</Text>
              <Ionicons name="chevron-down" size={16} color={C.textMuted} />
            </TouchableOpacity>
          </Field>
          {s.type === 'other' && (
            <>
              <Divider />
              <Field label="Specify Business" hint="e.g. Car Workshop, Electrician">
                <TextInput
                  style={ST.input}
                  value={s.customBusinessType ?? ''}
                  onChangeText={v => set('customBusinessType', v)}
                  placeholder="Describe your business"
                  placeholderTextColor={C.textMuted}
                  autoFocus
                />
              </Field>
            </>
          )}
          <Divider />
          <Field label="Address">
            <TextInput style={[ST.input, ST.inputMulti]} value={s.address ?? ''} onChangeText={v => set('address', v)}
              placeholder="Street address" placeholderTextColor={C.textMuted} multiline numberOfLines={2} />
          </Field>
          <Divider />
          <View style={ST.rowFields}>
            <View style={{ flex: 1 }}>
              <Field label="City">
                <TextInput style={ST.input} value={s.city ?? ''} onChangeText={v => set('city', v)}
                  placeholder="City" placeholderTextColor={C.textMuted} />
              </Field>
            </View>
            <View style={ST.rowDivider} />
            <View style={{ flex: 1 }}>
              <Field label="State">
                <TouchableOpacity style={ST.selectRow} onPress={() => setStateModal(true)} activeOpacity={0.7}>
                  <Text style={[ST.selectText, !s.stateName && { color: C.textMuted }]} numberOfLines={1}>
                    {s.stateName || 'Select state'}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color={C.textMuted} />
                </TouchableOpacity>
              </Field>
            </View>
          </View>
          <Divider />
          <Field label="Phone">
            <TextInput style={ST.input} value={s.phone ?? ''} onChangeText={v => set('phone', v)}
              placeholder="+91 XXXXX XXXXX" placeholderTextColor={C.textMuted} keyboardType="phone-pad" />
          </Field>
          <Divider />
          <Field label="Email">
            <TextInput style={ST.input} value={s.email ?? ''} onChangeText={v => set('email', v)}
              placeholder="business@email.com" placeholderTextColor={C.textMuted}
              keyboardType="email-address" autoCapitalize="none" />
          </Field>
          <Divider />
          <Field label="Footer Message" hint="Printed at bottom of every document">
            <TextInput style={[ST.input, ST.inputMulti]} value={s.footerMessage ?? ''}
              onChangeText={v => set('footerMessage', v)}
              placeholder="e.g. Thank you for your business!"
              placeholderTextColor={C.textMuted} multiline numberOfLines={2} />
          </Field>
        </View>

        {/* ═══════════ 2. Invoice Settings ═══════════ */}
        <SectionLabel icon="document-text-outline" title="Invoice Settings" />
        <View style={ST.card}>
          <Field label="Invoice Prefix" hint="e.g. INV-, GST-, RC-">
            <TextInput style={ST.input} value={s.invoicePrefix ?? 'INV-'} onChangeText={v => set('invoicePrefix', v)}
              placeholder="INV-" placeholderTextColor={C.textMuted} autoCapitalize="characters" />
          </Field>
          <Divider />
          <Field label="Starting Number" hint="Next invoice will be this number">
            <TextInput style={ST.input} value={String(s.invoiceStartNumber ?? 1)}
              onChangeText={v => set('invoiceStartNumber', parseInt(v) || 1)}
              placeholder="1" placeholderTextColor={C.textMuted} keyboardType="number-pad" />
          </Field>
        </View>

        {/* ═══════════ 3. Payment Methods ═══════════ */}
        <SectionLabel icon="card-outline" title="Payment Methods" />
        <View style={ST.card}>
          <Field label="UPI ID" hint="Shows QR code on invoices">
            <TextInput style={ST.input} value={s.upiId ?? ''} onChangeText={v => set('upiId', v)}
              placeholder="merchant@upi" placeholderTextColor={C.textMuted} autoCapitalize="none" />
          </Field>
          <Divider />
          <Field label="Bank Name">
            <TextInput style={ST.input} value={s.bankName ?? ''} onChangeText={v => set('bankName', v)}
              placeholder="State Bank of India" placeholderTextColor={C.textMuted} />
          </Field>
          <Divider />
          <Field label="Account Number">
            <TextInput style={ST.input} value={s.accountNumber ?? ''} onChangeText={v => set('accountNumber', v)}
              placeholder="XXXX XXXX XXXX" placeholderTextColor={C.textMuted} keyboardType="number-pad" />
          </Field>
          <Divider />
          <Field label="IFSC Code">
            <TextInput style={ST.input} value={s.ifsc ?? ''} onChangeText={v => set('ifsc', v.toUpperCase())}
              placeholder="SBIN0001234" placeholderTextColor={C.textMuted} autoCapitalize="characters" />
          </Field>
        </View>

        {/* ═══════════ 4. GST & Compliance ═══════════ */}
        <SectionLabel icon="shield-checkmark-outline" title="GST & Compliance" />
        <View style={ST.card}>
          <Field label="GSTIN">
            <TextInput style={ST.input} value={s.gstin ?? ''} onChangeText={v => set('gstin', v.toUpperCase())}
              placeholder="27AAAAA0000A1Z5" placeholderTextColor={C.textMuted} autoCapitalize="characters" />
          </Field>
          <Divider />
          <Field label="License Number" hint="Shop Act / Trade License">
            <TextInput style={ST.input} value={s.licenseNumber ?? ''} onChangeText={v => set('licenseNumber', v)}
              placeholder="License / registration number" placeholderTextColor={C.textMuted} />
          </Field>
        </View>

        {/* ═══════════ 5. Print & Receipt ═══════════ */}
        <SectionLabel icon="print-outline" title="Print & Receipt" />
        {print && (
          <View style={ST.card}>
            <Field label="Paper Width" hint="Default for all printed receipts">
              <View style={ST.chipRow}>
                {PAPER_OPTIONS.map(opt => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[ST.chip, print.paperWidth === opt.value && ST.chipSelected]}
                    onPress={() => setPrintField('paperWidth', opt.value)}
                    activeOpacity={0.75}
                  >
                    <Text style={[ST.chipLabel, print.paperWidth === opt.value && ST.chipLabelSelected]}>
                      {opt.label}
                    </Text>
                    <Text style={[ST.chipSub, print.paperWidth === opt.value && { color: C.orange }]}>
                      {opt.sub}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Field>
            <Divider />
            <Field label="Font Size">
              <View style={ST.chipRowSmall}>
                {FONT_OPTIONS.map(opt => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[ST.chipSmall, print.fontSize === opt.value && ST.chipSelected]}
                    onPress={() => setPrintField('fontSize', opt.value)}
                    activeOpacity={0.75}
                  >
                    <Text style={[ST.chipLabel, print.fontSize === opt.value && ST.chipLabelSelected]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Field>
            <Divider />
            <ToggleRow
              label="Show Logo"
              hint="Print business logo on receipts"
              value={print.showLogo}
              onChange={v => setPrintField('showLogo', v)}
            />
            <Divider />
            <ToggleRow
              label="Show GSTIN"
              hint="Print GSTIN number on receipts"
              value={print.showGstin}
              onChange={v => setPrintField('showGstin', v)}
            />
            <Divider />
            <ToggleRow
              label="Show UPI / QR"
              hint="Print UPI ID for payment"
              value={print.showUpi}
              onChange={v => setPrintField('showUpi', v)}
            />
            <Divider />
            <ToggleRow
              label="Show Signature"
              hint="Signature line at bottom"
              value={print.showSignature}
              onChange={v => setPrintField('showSignature', v)}
            />
          </View>
        )}

        {/* ═══════════ 6. Branding ═══════════ */}
        <SectionLabel icon="color-palette-outline" title="Branding" />
        <View style={ST.card}>
          <Field label="Brand Color" hint="Used on all invoice templates">
            <TouchableOpacity style={ST.colorRow} onPress={() => setPicker(true)} activeOpacity={0.82}>
              <View style={[ST.colorSwatch, { backgroundColor: s.brandColor }]} />
              <Text style={ST.colorHex}>{s.brandColor.toUpperCase()}</Text>
              <Text style={ST.colorChange}>Change →</Text>
            </TouchableOpacity>
          </Field>
        </View>

        {/* ═══════════ 7. Data & Backup ═══════════ */}
        <SectionLabel icon="cloud-upload-outline" title="Data & Backup" />
        <View style={ST.card}>
          <Field label="Export Backup" hint="Save a copy of all your data — share it to Google Drive, email, or any app">
            <TouchableOpacity
              style={ST.selectRow}
              onPress={handleBackup}
              activeOpacity={0.7}
              disabled={backingUp}
            >
              <Ionicons name="cloud-upload-outline" size={18} color={C.orange} />
              <Text style={ST.selectText}>{backingUp ? 'Preparing backup…' : 'Export & Share'}</Text>
              {!backingUp && <Ionicons name="chevron-forward" size={16} color={C.textMuted} />}
            </TouchableOpacity>
          </Field>
        </View>

        <View style={{ height: 48 }} />
      </ScrollView>

      {/* ── Modals ── */}
      <ColorPickerModal
        visible={pickerVisible}
        initial={s.brandColor}
        onClose={() => setPicker(false)}
        onSelect={hex => set('brandColor', hex)}
      />

      {/* Business Type bottom sheet */}
      <Modal visible={typeModal} transparent animationType="slide" onRequestClose={() => setTypeModal(false)}>
        <View style={ST.modalOverlay}>
          <TouchableOpacity style={ST.modalBg} onPress={() => setTypeModal(false)} activeOpacity={1} />
          <View style={ST.bottomSheet}>
            <View style={ST.sheetHandle} />
            <Text style={ST.sheetTitle}>Business Type</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {BUSINESS_TYPES.map(bt => (
                <TouchableOpacity
                  key={bt.value}
                  style={[ST.sheetRow, s.type === bt.value && ST.sheetRowSelected]}
                  onPress={() => { set('type', bt.value); setTypeModal(false); }}
                  activeOpacity={0.7}
                >
                  <Ionicons name={bt.icon as any} size={20} color={s.type === bt.value ? C.orange : C.textSub} />
                  <Text style={[ST.sheetRowText, s.type === bt.value && { color: C.orange, fontWeight: '700' }]}>
                    {bt.label}
                  </Text>
                  {s.type === bt.value && <Ionicons name="checkmark" size={18} color={C.orange} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* State picker bottom sheet */}
      <Modal visible={stateModal} transparent animationType="slide" onRequestClose={() => setStateModal(false)}>
        <View style={ST.modalOverlay}>
          <TouchableOpacity style={ST.modalBg} onPress={() => setStateModal(false)} activeOpacity={1} />
          <View style={[ST.bottomSheet, ST.bottomSheetTall]}>
            <View style={ST.sheetHandle} />
            <Text style={ST.sheetTitle}>Select State</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {INDIAN_STATES.map(state => (
                <TouchableOpacity
                  key={state}
                  style={[ST.sheetRow, s.stateName === state && ST.sheetRowSelected]}
                  onPress={() => { set('stateName', state); setStateModal(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={[ST.sheetRowText, s.stateName === state && { color: C.orange, fontWeight: '700' }]}>
                    {state}
                  </Text>
                  {s.stateName === state && <Ionicons name="checkmark" size={18} color={C.orange} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ icon, title }: { icon: string; title: string }) {
  return (
    <View style={ST.sectionLabel}>
      <Ionicons name={icon as any} size={16} color={C.orange} />
      <Text style={ST.sectionLabelText}>{title}</Text>
    </View>
  );
}

function Divider() {
  return <View style={ST.divider} />;
}

function ToggleRow({ label, hint, value, onChange }: {
  label: string; hint?: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <View style={[ST.field, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
      <View style={{ flex: 1, marginRight: 12 }}>
        <Text style={ST.fieldLabel}>{label}</Text>
        {hint && <Text style={[ST.fieldHint, { marginTop: 2 }]}>{hint}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: C.orange, false: C.border }}
        thumbColor="#fff"
      />
    </View>
  );
}

function Field({ label, hint, required, children }: {
  label: string; hint?: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <View style={ST.field}>
      <View style={ST.fieldLabelRow}>
        <Text style={ST.fieldLabel}>{label}{required ? <Text style={{ color: C.orange }}> *</Text> : null}</Text>
        {hint && <Text style={ST.fieldHint}>{hint}</Text>}
      </View>
      {children}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const ST = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: C.bg },
  scroll:  { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 24 },

  // Page header
  pageHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: H_PAD, paddingTop: 16, paddingBottom: 8,
  },
  pageTitle: { fontSize: 20, fontWeight: '800', color: C.text },
  saveBtn: {
    backgroundColor: C.orange, borderRadius: 14,
    paddingHorizontal: 20, paddingVertical: 9,
  },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  // Profile card
  profileCard: {
    backgroundColor: C.surface, borderRadius: 16, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 16,
    marginBottom: 28,
    ...cardShadow('#000', 2, 0.06, 12, { elevation: 2 }),
  },
  logoWrap:    { position: 'relative' },
  logoImg:     { width: 64, height: 64, borderRadius: 16 },
  logoAvatar:  { width: 64, height: 64, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  logoInitial: { fontSize: 28, fontWeight: '800', color: '#fff' },
  logoBadge: {
    position: 'absolute', bottom: -4, right: -4,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: C.orange, borderWidth: 2, borderColor: C.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  profileInfo:     { flex: 1 },
  profileName:     { fontSize: 18, fontWeight: '700', color: C.text, marginBottom: 6 },
  profileMeta:     { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  profileMetaText: { fontSize: 13, color: C.textSub },
  dot:             { width: 3, height: 3, borderRadius: 2, backgroundColor: C.textMuted },
  gstBadge:        { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  gstBadgeOk:      { backgroundColor: '#F0FDF4' },
  gstBadgeWarn:    { backgroundColor: '#FFFBEB' },
  gstBadgeText:    { fontSize: 11, fontWeight: '600' },
  profileLocation: { fontSize: 12, color: C.textMuted, marginTop: 4 },

  // Section label
  sectionLabel: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: 10, marginTop: 4,
  },
  sectionLabelText: { fontSize: 13, fontWeight: '700', color: C.textSub, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Card
  card: {
    backgroundColor: C.surface, borderRadius: 16,
    overflow: 'hidden', marginBottom: 20,
    ...cardShadow('#000', 1, 0.04, 8, { elevation: 1 }),
  },

  // Field
  field:        { paddingHorizontal: 16, paddingVertical: 14 },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  fieldLabel:   { fontSize: 12, fontWeight: '600', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  fieldHint:    { fontSize: 12, color: C.textMuted },
  input:        { fontSize: 15, color: C.text, paddingVertical: 0 },
  inputMulti:   { minHeight: 40, textAlignVertical: 'top' },

  divider: { height: 1, backgroundColor: C.border, marginHorizontal: 16 },

  // Row layout for city/state
  rowFields:  { flexDirection: 'row' },
  rowDivider: { width: 1, backgroundColor: C.border },

  // Select row (type, state)
  selectRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  selectText: { flex: 1, fontSize: 15, color: C.text },

  // Color row
  colorRow:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  colorSwatch: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, borderColor: C.border },
  colorHex:   { flex: 1, fontSize: 15, fontWeight: '600', color: C.text },
  colorChange: { fontSize: 13, color: C.orange, fontWeight: '600' },

  // Chip selectors (paper width, font size)
  chipRow:      { flexDirection: 'row', gap: 10, marginTop: 4 },
  chipRowSmall: { flexDirection: 'row', gap: 8, marginTop: 4 },
  chip: {
    flex: 1, borderWidth: 1.5, borderColor: C.border, borderRadius: 12,
    paddingVertical: 10, paddingHorizontal: 8, alignItems: 'center',
    backgroundColor: C.bg,
  },
  chipSmall: {
    flex: 1, borderWidth: 1.5, borderColor: C.border, borderRadius: 10,
    paddingVertical: 8, alignItems: 'center', backgroundColor: C.bg,
  },
  chipSelected:      { borderColor: C.orange, backgroundColor: '#FFF8F4' },
  chipLabel:         { fontSize: 13, fontWeight: '700', color: C.textSub },
  chipLabelSelected: { color: C.orange },
  chipSub:           { fontSize: 10, color: C.textMuted, marginTop: 2 },

  // Bottom sheet modals
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBg:      { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.4)' },
  bottomSheet: {
    backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: H_PAD, paddingBottom: 40, paddingTop: 12,
    maxHeight: '60%',
  },
  bottomSheetTall: { maxHeight: '80%' },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginBottom: 16 },
  sheetTitle:  { fontSize: 18, fontWeight: '700', color: C.text, marginBottom: 12 },
  sheetRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  sheetRowSelected: { backgroundColor: '#FFF8F4' },
  sheetRowText:     { flex: 1, fontSize: 16, color: C.text },
});
