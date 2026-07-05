import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, KeyboardAvoidingView, Platform, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Surface } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { BusinessSettings } from '../types';
import { getLatestVersion } from '../services/templateService';
import { getBusinessSettings } from '../services/businessService';
import { createRecord } from '../services/invoiceService';
import { cardShadow } from '../utils/shadow';
import { CustomerAutocompleteField } from '../components/CustomerAutocompleteField';
import { Customer } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Nav   = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'CreateGstInvoice'>;

interface GstItem {
  id: string;
  name: string;
  qty: number;
  price: number;
  hsn: string;
  unit: string;
  gstPct: number;
  discount: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const C = {
  orange:  '#F97316',
  dark:    '#111827',
  bg:      '#F8F9FB',
  card:    '#FFFFFF',
  border:  '#E5E7EB',
  sub:     '#6B7280',
  muted:   '#9CA3AF',
  success: '#16A34A',
  purple:  '#7C3AED',
};

const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh',
  'Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka',
  'Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram',
  'Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu',
  'Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal',
  'Delhi','Jammu & Kashmir','Ladakh','Puducherry',
];

const PAYMENT_METHODS = ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Credit'];
const GST_RATES = [0, 5, 12, 18, 28];

function emptyItem(): GstItem {
  return { id: Math.random().toString(36).slice(2), name: '', qty: 1, price: 0, hsn: '', unit: 'NOS', gstPct: 18, discount: 0 };
}

function fmtMoney(n: number): string {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function todayStr(): string {
  return new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── GST calculations ─────────────────────────────────────────────────────────

function computeTotals(items: GstItem[], sellerState: string, customerState: string) {
  const isInterState = !!(sellerState && customerState &&
    sellerState.trim().toLowerCase() !== customerState.trim().toLowerCase());

  const buckets = new Map<number, { taxable: number; tax: number }>();
  let grandTaxable = 0;

  for (const item of items) {
    if (!item.name) continue;
    const tv  = Math.max(0, item.qty * item.price - item.discount);
    const pct = item.gstPct || 0;
    grandTaxable += tv;
    if (pct > 0) {
      const tax = tv * pct / 100;
      const b = buckets.get(pct) ?? { taxable: 0, tax: 0 };
      buckets.set(pct, { taxable: b.taxable + tv, tax: b.tax + tax });
    }
  }

  let cgst = 0, sgst = 0, igst = 0, totalTax = 0;
  for (const [, { tax }] of buckets) {
    totalTax += tax;
    if (isInterState) igst += tax;
    else { cgst += tax / 2; sgst += tax / 2; }
  }

  const beforeRound  = grandTaxable + totalTax;
  const rounded      = Math.round(beforeRound);
  const roundOff     = +(rounded - beforeRound).toFixed(2);

  return { grandTaxable, cgst, sgst, igst, totalTax, roundOff, grandTotal: rounded, isInterState };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const STATUS_DOT: Record<string, string> = {
  unpaid:  '#F97316',
  partial: '#3B82F6',
  paid:    '#16A34A',
};

function CardHeader({
  icon, title, subtitle, expanded, onToggle, accent, statusDot,
}: {
  icon: string; title: string; subtitle?: string;
  expanded: boolean; onToggle: () => void; accent?: string; statusDot?: string;
}) {
  return (
    <TouchableOpacity style={S.cardHeader} onPress={onToggle} activeOpacity={0.75}>
      <View style={[S.cardHeaderIcon, { backgroundColor: `${accent ?? C.orange}15` }]}>
        <Ionicons name={icon as any} size={18} color={accent ?? C.orange} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={S.cardHeaderTitle}>{title}</Text>
        {!expanded && !!subtitle && (
          <Text style={S.cardHeaderSub} numberOfLines={1}>{subtitle}</Text>
        )}
      </View>
      {!!statusDot && <View style={[S.statusDot, { backgroundColor: statusDot }]} />}
      <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={C.muted} />
    </TouchableOpacity>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={S.fieldRow}>
      <Text style={S.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function StyledInput({ value, onChange, placeholder, keyboard, style, multiline }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
  keyboard?: any; style?: any; multiline?: boolean;
}) {
  return (
    <TextInput
      style={[S.input, style]}
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={C.muted}
      keyboardType={keyboard}
      multiline={multiline}
    />
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function CreateGstInvoiceScreen() {
  const navigation = useNavigation<Nav>();
  const route      = useRoute<Route>();
  const { documentTypeId, documentTypeName } = route.params;

  // ── Business
  const [business, setBusiness] = useState<BusinessSettings | null>(null);
  const [versionId, setVersionId] = useState('');

  // ── Customer card
  const [customerExpanded, setCustomerExpanded] = useState(true);
  const [customerName,     setCustomerName]     = useState('');
  const [customerGstin,    setCustomerGstin]    = useState('');
  const [customerPhone,    setCustomerPhone]    = useState('');
  const [customerState,    setCustomerState]    = useState('');
  const [stateModal,       setStateModal]       = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  // ── Items
  const [items,          setItems]         = useState<GstItem[]>([]);
  const [itemModal,      setItemModal]     = useState(false);
  const [editIdx,        setEditIdx]       = useState<number | null>(null);
  const [draft,          setDraft]         = useState<GstItem>(emptyItem());
  const [draftExpanded,  setDraftExpanded] = useState(false);

  // ── GST card
  const [gstExpanded,     setGstExpanded]     = useState(false);
  const [placeOfSupply,   setPlaceOfSupply]   = useState('');
  const [supplyModal,     setSupplyModal]     = useState(false);

  // ── Payment card
  const [paymentExpanded, setPaymentExpanded] = useState(false);
  const [paymentStatus,   setPaymentStatus]   = useState<'unpaid'|'partial'|'paid'>('unpaid');
  const [paymentMethod,   setPaymentMethod]   = useState('');
  const [methodModal,     setMethodModal]     = useState(false);
  const [upiRef,          setUpiRef]          = useState('');
  const [notes,           setNotes]           = useState('');

  // ── Save / validation
  const [saving,          setSaving]          = useState(false);
  const [validationModal, setValidationModal] = useState(false);

  useFocusEffect(useCallback(() => {
    let active = true;
    Promise.all([getBusinessSettings(), getLatestVersion(documentTypeId)]).then(([biz, ver]) => {
      if (!active) return;
      if (biz) setBusiness(biz);
      if (ver) setVersionId(ver.id);
    });
    return () => { active = false; };
  }, [documentTypeId]));

  // ── Live totals
  const totals = useMemo(() =>
    computeTotals(items, business?.stateName ?? '', customerState),
    [items, business?.stateName, customerState]
  );

  // GST collapsed header subtitle: "CGST+SGST · 18%" or "IGST · ₹1,250"
  const gstSubtitle = useMemo(() => {
    const filledItems = items.filter(i => i.name);
    if (!filledItems.length) return 'Auto detect';
    const mode = totals.isInterState ? 'IGST' : 'CGST+SGST';
    const rates = [...new Set(filledItems.filter(i => i.gstPct > 0).map(i => i.gstPct))];
    if (rates.length === 0) return `${mode} · Nil`;
    if (rates.length === 1) return `${mode} · ${rates[0]}%`;
    return `${mode} · ${fmtMoney(totals.totalTax)}`;
  }, [items, totals.isInterState, totals.totalTax]);

  // Validation: show bottom sheet instead of Alert
  const handleGenerateTap = () => {
    const hasCustomer = !!customerName.trim();
    const hasItems    = items.some(i => i.name.trim());
    if (!hasCustomer || !hasItems) { setValidationModal(true); return; }
    handleSave();
  };

  // ── Item modal helpers
  const openAddItem = () => {
    setDraft(emptyItem());
    setDraftExpanded(false);
    setEditIdx(null);
    setItemModal(true);
  };

  const openEditItem = (idx: number) => {
    setDraft({ ...items[idx] });
    setDraftExpanded(false);
    setEditIdx(idx);
    setItemModal(true);
  };

  const saveItem = () => {
    if (!draft.name.trim()) { Alert.alert('Item name required'); return; }
    if (editIdx !== null) {
      setItems(prev => prev.map((it, i) => i === editIdx ? draft : it));
    } else {
      setItems(prev => [...prev, draft]);
    }
    setItemModal(false);
  };

  const deleteItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const setDraftField = <K extends keyof GstItem>(k: K, v: GstItem[K]) =>
    setDraft(prev => ({ ...prev, [k]: v }));

  // ── Save invoice
  const handleSave = async () => {
    if (!customerName.trim()) { Alert.alert('Customer name required'); return; }
    const filled = items.filter(it => it.name.trim());
    if (!filled.length) { Alert.alert('Add at least one item'); return; }
    if (!versionId) { Alert.alert('Template not loaded'); return; }

    setSaving(true);
    try {
      const data: Record<string, any> = {
        'Customer Name':   customerName,
        'Customer GSTIN':  customerGstin,
        'Customer Phone':  customerPhone,
        'Customer State':  customerState,
        'Place of Supply': placeOfSupply || customerState,
        'Payment Method':  paymentMethod,
        'Notes':           notes,
        'Item Table': filled.map(it => ({
          name:     it.name,
          qty:      it.qty,
          price:    it.price,
          hsn:      it.hsn || undefined,
          unit:     it.unit || 'NOS',
          gstPct:   it.gstPct || undefined,
          discount: it.discount || undefined,
        })),
      };
      const record = await createRecord(versionId, documentTypeName, data, {
        id: selectedCustomerId ?? undefined,
        draft: {
          name: customerName,
          phone: customerPhone,
          gstin: customerGstin,
          stateName: customerState,
        },
      });
      navigation.replace('PreviewRecord', { recordId: record.id, documentTypeName });
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not save invoice.');
    } finally {
      setSaving(false);
    }
  };

  const itemTaxable = (it: GstItem) =>
    Math.max(0, it.qty * it.price - it.discount);

  const itemTotal = (it: GstItem) =>
    itemTaxable(it) * (1 + (it.gstPct || 0) / 100);

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={S.safe} edges={['top', 'bottom']}>

      {/* ── Header ── */}
      <View style={S.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={24} color={C.dark} />
        </TouchableOpacity>
        <Text style={S.headerTitle}>{documentTypeName}</Text>
        <TouchableOpacity
          style={[S.saveBtn, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          <Text style={S.saveBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          style={S.scroll}
          contentContainerStyle={S.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* ── Invoice Info Card ── */}
          <View style={S.card}>
            <View style={S.infoRow}>
              <View style={S.infoLeft}>
                <Text style={S.infoLabel}>Invoice No</Text>
                <Text style={S.infoValue}>Auto</Text>
              </View>
              <View style={S.infoDivider} />
              <View style={S.infoRight}>
                <Text style={S.infoLabel}>Date</Text>
                <Text style={S.infoValue}>{todayStr()}</Text>
              </View>
            </View>
          </View>

          {/* ── Items Card ── */}
          <View style={S.card}>
            <View style={S.cardHeader}>
              <View style={[S.cardHeaderIcon, { backgroundColor: `${C.orange}15` }]}>
                <Ionicons name="list-outline" size={18} color={C.orange} />
              </View>
              <Text style={S.cardHeaderTitle}>Items</Text>
              {items.some(i => i.name) && (
                <View style={S.itemCountBadge}>
                  <Text style={S.itemCountText}>{items.filter(i => i.name).length}</Text>
                </View>
              )}
            </View>

            {items.filter(i => i.name).map((item, idx) => (
              <TouchableOpacity key={item.id} style={S.itemCard} onPress={() => openEditItem(idx)} activeOpacity={0.8}>
                <View style={S.itemCardTop}>
                  <Text style={S.itemName} numberOfLines={1}>{item.name}</Text>
                  <TouchableOpacity onPress={() => deleteItem(idx)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle-outline" size={18} color={C.muted} />
                  </TouchableOpacity>
                </View>
                <View style={S.itemCardMid}>
                  <Text style={S.itemMeta}>{item.qty} {item.unit} × {fmtMoney(item.price)}</Text>
                  {item.gstPct > 0 && <Text style={S.itemGst}>GST {item.gstPct}%</Text>}
                </View>
                <Text style={S.itemAmount}>{fmtMoney(itemTotal(item))}</Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity style={S.addItemBtn} onPress={openAddItem} activeOpacity={0.75}>
              <Ionicons name="add-circle-outline" size={20} color={C.orange} />
              <Text style={S.addItemText}>Add Item</Text>
            </TouchableOpacity>
          </View>

          {/* ── Summary Card — appears as soon as items exist ── */}
          {items.some(i => i.name) && (
            <View style={[S.card, S.summaryCard]}>
              <SummaryRow label="Taxable Amount" value={fmtMoney(totals.grandTaxable)} />
              {totals.isInterState
                ? <SummaryRow label="IGST" value={fmtMoney(totals.igst)} />
                : <>
                    <SummaryRow label="CGST" value={fmtMoney(totals.cgst)} />
                    <SummaryRow label="SGST" value={fmtMoney(totals.sgst)} />
                  </>
              }
              {totals.roundOff !== 0 && (
                <SummaryRow label="Round Off" value={(totals.roundOff >= 0 ? '+' : '') + fmtMoney(totals.roundOff)} muted />
              )}
              <View style={S.summaryDivider} />
              <View style={S.grandTotalRow}>
                <Text style={S.grandTotalLabel}>Grand Total</Text>
                <Text style={S.grandTotalValue}>{fmtMoney(totals.grandTotal)}</Text>
              </View>
            </View>
          )}

          {/* ── Customer Card ── */}
          <View style={S.card}>
            <CardHeader
              icon="person-outline"
              title={customerName || 'Customer'}
              subtitle={customerName || undefined}
              expanded={customerExpanded}
              onToggle={() => setCustomerExpanded(v => !v)}
            />
            {customerExpanded && (
              <View style={S.cardBody}>
                <FieldRow label="Customer Name">
                  <CustomerAutocompleteField
                    value={customerName}
                    onChangeText={v => { setCustomerName(v); setSelectedCustomerId(null); }}
                    onSelectCustomer={(c: Customer) => {
                      setCustomerName(c.name);
                      setCustomerGstin(c.gstin ?? '');
                      setCustomerPhone(c.phone ?? '');
                      setCustomerState(c.stateName ?? '');
                      setSelectedCustomerId(c.id);
                    }}
                    placeholder="ABC Traders"
                    inputStyle={S.input}
                    placeholderTextColor={C.muted}
                  />
                </FieldRow>
                <FieldRow label="GSTIN">
                  <StyledInput value={customerGstin} onChange={v => setCustomerGstin(v.toUpperCase())}
                    placeholder="29ABCDE1234F1Z5" />
                </FieldRow>
                <FieldRow label="Phone">
                  <StyledInput value={customerPhone} onChange={setCustomerPhone}
                    placeholder="+91 XXXXX XXXXX" keyboard="phone-pad" />
                </FieldRow>
                <FieldRow label="State">
                  <TouchableOpacity
                    style={[S.input, S.selectInput]}
                    onPress={() => setStateModal(true)}
                    activeOpacity={0.75}
                  >
                    <Text style={customerState ? S.selectText : S.selectPlaceholder} numberOfLines={1}>
                      {customerState || 'Select state'}
                    </Text>
                    <Ionicons name="chevron-down" size={14} color={C.muted} />
                  </TouchableOpacity>
                </FieldRow>
              </View>
            )}
          </View>

          {/* ── Payment Card ── */}
          <View style={S.card}>
            <CardHeader
              icon="card-outline"
              title="Payment"
              subtitle={paymentMethod ? `${paymentStatus.charAt(0).toUpperCase() + paymentStatus.slice(1)} · ${paymentMethod}` : paymentStatus.charAt(0).toUpperCase() + paymentStatus.slice(1)}
              expanded={paymentExpanded}
              onToggle={() => setPaymentExpanded(v => !v)}
              accent={C.success}
              statusDot={STATUS_DOT[paymentStatus]}
            />
            {paymentExpanded && (
              <View style={S.cardBody}>
                <FieldRow label="Payment Status">
                  <View style={S.statusChips}>
                    {(['unpaid','partial','paid'] as const).map(s => (
                      <TouchableOpacity
                        key={s}
                        style={[S.statusChip, paymentStatus === s && S.statusChipActive, { borderColor: paymentStatus === s ? STATUS_DOT[s] : C.border }]}
                        onPress={() => setPaymentStatus(s)}
                        activeOpacity={0.75}
                      >
                        <View style={[S.statusDotSmall, { backgroundColor: STATUS_DOT[s] }]} />
                        <Text style={[S.statusChipText, paymentStatus === s && { color: STATUS_DOT[s], fontWeight: '700' }]}>
                          {s.charAt(0).toUpperCase() + s.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </FieldRow>
                <FieldRow label="Payment Method">
                  <TouchableOpacity
                    style={[S.input, S.selectInput]}
                    onPress={() => setMethodModal(true)}
                    activeOpacity={0.75}
                  >
                    <Text style={paymentMethod ? S.selectText : S.selectPlaceholder}>
                      {paymentMethod || 'Select method'}
                    </Text>
                    <Ionicons name="chevron-down" size={14} color={C.muted} />
                  </TouchableOpacity>
                </FieldRow>
                <FieldRow label="Transaction Ref">
                  <StyledInput value={upiRef} onChange={setUpiRef} placeholder="UPI / cheque ref" />
                </FieldRow>
                <FieldRow label="Notes">
                  <StyledInput value={notes} onChange={setNotes} placeholder="Any notes for the customer"
                    multiline style={{ minHeight: 56, textAlignVertical: 'top' }} />
                </FieldRow>
              </View>
            )}
          </View>

          {/* ── GST Card — collapsed by default, auto-detects mode ── */}
          <View style={S.card}>
            <CardHeader
              icon="shield-checkmark-outline"
              title="GST"
              subtitle={gstSubtitle}
              expanded={gstExpanded}
              onToggle={() => setGstExpanded(v => !v)}
              accent="#7C3AED"
            />
            {gstExpanded && (
              <View style={S.cardBody}>
                <FieldRow label="Place of Supply">
                  <TouchableOpacity
                    style={[S.input, S.selectInput]}
                    onPress={() => setSupplyModal(true)}
                    activeOpacity={0.75}
                  >
                    <Text style={placeOfSupply ? S.selectText : S.selectPlaceholder} numberOfLines={1}>
                      {placeOfSupply || customerState || 'Select state'}
                    </Text>
                    <Ionicons name="chevron-down" size={14} color={C.muted} />
                  </TouchableOpacity>
                </FieldRow>
                <View style={S.gstModeRow}>
                  <View>
                    <Text style={S.fieldLabel}>GST Mode</Text>
                    <Text style={S.gstModeAuto}>
                      {totals.isInterState ? 'Inter-state → IGST' : 'Intra-state → CGST + SGST'}
                    </Text>
                  </View>
                  <View style={[S.gstModeChip, { backgroundColor: totals.isInterState ? '#EFF6FF' : '#F0FDF4' }]}>
                    <Text style={[S.gstModeChipText, { color: totals.isInterState ? '#1D4ED8' : '#15803D' }]}>
                      {totals.isInterState ? 'IGST' : 'CGST+SGST'}
                    </Text>
                  </View>
                </View>
                {totals.totalTax > 0 && (
                  <View style={S.gstChips}>
                    {totals.isInterState ? (
                      <View style={S.chip}><Text style={S.chipText}>IGST {fmtMoney(totals.igst)}</Text></View>
                    ) : (
                      <>
                        <View style={S.chip}><Text style={S.chipText}>CGST {fmtMoney(totals.cgst)}</Text></View>
                        <View style={S.chip}><Text style={S.chipText}>SGST {fmtMoney(totals.sgst)}</Text></View>
                      </>
                    )}
                  </View>
                )}
              </View>
            )}
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Sticky CTA ── */}
      <Surface style={S.stickyBar} elevation={2}>
        <TouchableOpacity
          style={[S.generateBtn, saving && { opacity: 0.6 }]}
          onPress={handleGenerateTap}
          disabled={saving}
          activeOpacity={0.85}
        >
          <Ionicons name="document-text" size={20} color="#fff" />
          <Text style={S.generateBtnText}>{saving ? 'Generating…' : 'Generate GST Invoice'}</Text>
        </TouchableOpacity>
      </Surface>

      {/* ── Add / Edit Item Modal ── */}
      <Modal visible={itemModal} transparent animationType="slide" onRequestClose={() => setItemModal(false)}>
        <View style={S.modalOverlay}>
          <TouchableOpacity style={S.modalBg} activeOpacity={1} onPress={() => setItemModal(false)} />
          <View style={S.bottomSheet}>
            <View style={S.sheetHandle} />
            <Text style={S.sheetTitle}>{editIdx !== null ? 'Edit Item' : 'Add Item'}</Text>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={S.fieldLabel}>Item Name *</Text>
              <TextInput
                style={[S.input, { marginBottom: 14 }]}
                value={draft.name}
                onChangeText={v => setDraftField('name', v)}
                placeholder="Rice, Wheat flour, Labour charges…"
                placeholderTextColor={C.muted}
                autoFocus
              />
              <View style={S.draftRow}>
                <View style={{ flex: 1 }}>
                  <Text style={S.fieldLabel}>Qty</Text>
                  <TextInput
                    style={S.input}
                    value={String(draft.qty)}
                    onChangeText={v => setDraftField('qty', parseFloat(v) || 0)}
                    keyboardType="numeric"
                    placeholderTextColor={C.muted}
                  />
                </View>
                <View style={{ width: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={S.fieldLabel}>Unit</Text>
                  <TextInput
                    style={S.input}
                    value={draft.unit}
                    onChangeText={v => setDraftField('unit', v.toUpperCase())}
                    placeholder="NOS"
                    placeholderTextColor={C.muted}
                    autoCapitalize="characters"
                  />
                </View>
                <View style={{ width: 12 }} />
                <View style={{ flex: 1.5 }}>
                  <Text style={S.fieldLabel}>Rate ₹</Text>
                  <TextInput
                    style={S.input}
                    value={String(draft.price)}
                    onChangeText={v => setDraftField('price', parseFloat(v) || 0)}
                    keyboardType="numeric"
                    placeholderTextColor={C.muted}
                  />
                </View>
              </View>

              {/* GST% chips */}
              <Text style={[S.fieldLabel, { marginTop: 14 }]}>GST Rate</Text>
              <View style={S.rateChips}>
                {GST_RATES.map(r => (
                  <TouchableOpacity
                    key={r}
                    style={[S.rateChip, draft.gstPct === r && S.rateChipActive]}
                    onPress={() => setDraftField('gstPct', r)}
                    activeOpacity={0.75}
                  >
                    <Text style={[S.rateChipText, draft.gstPct === r && S.rateChipTextActive]}>
                      {r === 0 ? 'Nil' : `${r}%`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={S.advancedToggle}
                onPress={() => setDraftExpanded(v => !v)}
                activeOpacity={0.75}
              >
                <Text style={S.advancedToggleText}>HSN / Discount</Text>
                <Ionicons name={draftExpanded ? 'chevron-up' : 'chevron-down'} size={14} color={C.orange} />
              </TouchableOpacity>

              {draftExpanded && (
                <View style={S.draftRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={S.fieldLabel}>HSN / SAC</Text>
                    <TextInput
                      style={S.input}
                      value={draft.hsn}
                      onChangeText={v => setDraftField('hsn', v)}
                      placeholder="1006"
                      keyboardType="numeric"
                      placeholderTextColor={C.muted}
                    />
                  </View>
                  <View style={{ width: 12 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={S.fieldLabel}>Discount ₹</Text>
                    <TextInput
                      style={S.input}
                      value={draft.discount ? String(draft.discount) : ''}
                      onChangeText={v => setDraftField('discount', parseFloat(v) || 0)}
                      placeholder="0"
                      keyboardType="numeric"
                      placeholderTextColor={C.muted}
                    />
                  </View>
                </View>
              )}

              {/* Line preview */}
              {(draft.name.trim().length > 0) && (
                <View style={S.linePreview}>
                  <Text style={S.linePreviewLabel}>Line Total</Text>
                  <Text style={S.linePreviewValue}>{fmtMoney(itemTotal(draft))}</Text>
                  {draft.gstPct > 0 && (
                    <Text style={S.linePreviewSub}>
                      Taxable {fmtMoney(itemTaxable(draft))} + GST {fmtMoney(itemTotal(draft) - itemTaxable(draft))}
                    </Text>
                  )}
                </View>
              )}

              <TouchableOpacity style={S.sheetSaveBtn} onPress={saveItem} activeOpacity={0.85}>
                <Text style={S.sheetSaveBtnText}>{editIdx !== null ? 'Update Item' : 'Add to Invoice'}</Text>
              </TouchableOpacity>
              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Customer State picker ── */}
      <Modal visible={stateModal} transparent animationType="slide" onRequestClose={() => setStateModal(false)}>
        <View style={S.modalOverlay}>
          <TouchableOpacity style={S.modalBg} activeOpacity={1} onPress={() => setStateModal(false)} />
          <View style={[S.bottomSheet, { maxHeight: '75%' }]}>
            <View style={S.sheetHandle} />
            <Text style={S.sheetTitle}>Customer State</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {INDIAN_STATES.map(st => (
                <TouchableOpacity
                  key={st}
                  style={[S.sheetRow, customerState === st && S.sheetRowSelected]}
                  onPress={() => { setCustomerState(st); setStateModal(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={[S.sheetRowText, customerState === st && { color: C.orange, fontWeight: '700' }]}>{st}</Text>
                  {customerState === st && <Ionicons name="checkmark" size={18} color={C.orange} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Place of Supply picker ── */}
      <Modal visible={supplyModal} transparent animationType="slide" onRequestClose={() => setSupplyModal(false)}>
        <View style={S.modalOverlay}>
          <TouchableOpacity style={S.modalBg} activeOpacity={1} onPress={() => setSupplyModal(false)} />
          <View style={[S.bottomSheet, { maxHeight: '75%' }]}>
            <View style={S.sheetHandle} />
            <Text style={S.sheetTitle}>Place of Supply</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {INDIAN_STATES.map(st => (
                <TouchableOpacity
                  key={st}
                  style={[S.sheetRow, placeOfSupply === st && S.sheetRowSelected]}
                  onPress={() => { setPlaceOfSupply(st); setSupplyModal(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={[S.sheetRowText, placeOfSupply === st && { color: C.orange, fontWeight: '700' }]}>{st}</Text>
                  {placeOfSupply === st && <Ionicons name="checkmark" size={18} color={C.orange} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Validation bottom sheet ── */}
      <Modal visible={validationModal} transparent animationType="slide" onRequestClose={() => setValidationModal(false)}>
        <View style={S.modalOverlay}>
          <TouchableOpacity style={S.modalBg} activeOpacity={1} onPress={() => setValidationModal(false)} />
          <View style={S.bottomSheet}>
            <View style={S.sheetHandle} />
            <Text style={S.sheetTitle}>Complete Required Fields</Text>
            <ValidationRow label="Customer" done={!!customerName.trim()} />
            <ValidationRow label="Items"    done={items.some(i => i.name.trim())} />
            <View style={{ height: 24 }} />
            {!items.some(i => i.name.trim()) ? (
              <TouchableOpacity
                style={S.sheetSaveBtn}
                onPress={() => { setValidationModal(false); openAddItem(); }}
                activeOpacity={0.85}
              >
                <Text style={S.sheetSaveBtnText}>Add Item</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={S.sheetSaveBtn}
                onPress={() => { setValidationModal(false); setCustomerExpanded(true); }}
                activeOpacity={0.85}
              >
                <Text style={S.sheetSaveBtnText}>Add Customer</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Payment Method picker ── */}
      <Modal visible={methodModal} transparent animationType="slide" onRequestClose={() => setMethodModal(false)}>
        <View style={S.modalOverlay}>
          <TouchableOpacity style={S.modalBg} activeOpacity={1} onPress={() => setMethodModal(false)} />
          <View style={S.bottomSheet}>
            <View style={S.sheetHandle} />
            <Text style={S.sheetTitle}>Payment Method</Text>
            {PAYMENT_METHODS.map(m => (
              <TouchableOpacity
                key={m}
                style={[S.sheetRow, paymentMethod === m && S.sheetRowSelected]}
                onPress={() => { setPaymentMethod(m); setMethodModal(false); }}
                activeOpacity={0.7}
              >
                <Text style={[S.sheetRowText, paymentMethod === m && { color: C.orange, fontWeight: '700' }]}>{m}</Text>
                {paymentMethod === m && <Ionicons name="checkmark" size={18} color={C.orange} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

// ─── Summary row helper ───────────────────────────────────────────────────────

function SummaryRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <View style={S.summaryRow}>
      <Text style={[S.summaryLabel, muted && { color: C.muted }]}>{label}</Text>
      <Text style={[S.summaryValue, muted && { color: C.muted }]}>{value}</Text>
    </View>
  );
}

function ValidationRow({ label, done }: { label: string; done: boolean }) {
  return (
    <View style={S.validationRow}>
      <View style={[S.validationIcon, { backgroundColor: done ? '#F0FDF4' : '#FFF7ED' }]}>
        <Ionicons name={done ? 'checkmark' : 'close'} size={16} color={done ? C.success : C.orange} />
      </View>
      <Text style={[S.validationLabel, { color: done ? C.success : C.dark }]}>{label}</Text>
      <Text style={[S.validationStatus, { color: done ? C.success : C.orange }]}>
        {done ? 'Ready' : 'Missing'}
      </Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: C.bg },
  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: C.dark, flex: 1, textAlign: 'center' },
  saveBtn:     { backgroundColor: C.orange, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 7 },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  // Cards
  card: {
    backgroundColor: C.card, borderRadius: 20, marginBottom: 12,
    ...cardShadow('#000', 1, 0.05, 8, { elevation: 1 }),
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 16,
  },
  cardHeaderIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardHeaderTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: C.dark },
  cardBody: { paddingHorizontal: 16, paddingBottom: 16, gap: 12 },

  // Item count badge
  itemCountBadge: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: C.orange, alignItems: 'center', justifyContent: 'center',
  },
  itemCountText: { fontSize: 12, fontWeight: '700', color: '#fff' },

  // Info Card
  infoRow:    { flexDirection: 'row', padding: 16 },
  infoLeft:   { flex: 1 },
  infoRight:  { flex: 1, alignItems: 'flex-end' },
  infoDivider: { width: 1, backgroundColor: C.border, marginHorizontal: 16 },
  infoLabel:  { fontSize: 11, fontWeight: '600', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue:  { fontSize: 16, fontWeight: '600', color: C.dark, marginTop: 4 },

  // Field rows
  fieldRow:  { gap: 6 },
  fieldLabel: { fontSize: 11, fontWeight: '600', color: C.sub, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: {
    fontSize: 15, color: C.dark,
    borderWidth: 1, borderColor: C.border, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11,
    backgroundColor: '#FAFAFA',
  },
  selectInput:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectText:       { flex: 1, fontSize: 15, color: C.dark },
  selectPlaceholder: { flex: 1, fontSize: 15, color: C.muted },

  // Items
  itemCard: {
    marginHorizontal: 16, marginBottom: 10,
    padding: 14, borderRadius: 16,
    backgroundColor: '#FAFBFC', borderWidth: 1, borderColor: C.border,
  },
  itemCardTop:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  itemName:     { flex: 1, fontSize: 15, fontWeight: '600', color: C.dark },
  itemCardMid:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  itemMeta:     { fontSize: 13, color: C.sub },
  itemGst:      { fontSize: 11, color: C.purple, fontWeight: '600', backgroundColor: '#F5F3FF', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  itemAmount:   { fontSize: 18, fontWeight: '700', color: C.dark },

  addItemBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    margin: 16, marginTop: 8,
    paddingVertical: 14, borderRadius: 14,
    borderWidth: 1.5, borderColor: `${C.orange}50`,
    borderStyle: 'dashed', backgroundColor: `${C.orange}05`,
  },
  addItemText: { fontSize: 15, fontWeight: '600', color: C.orange },

  // GST section
  gstModeRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  gstModeAuto:     { fontSize: 14, color: C.sub, marginTop: 2 },
  gstModeChip:     { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  gstModeChipText: { fontSize: 12, fontWeight: '700' },
  gstChips:        { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip:            { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#F0FDF4' },
  chipText:        { fontSize: 12, fontWeight: '600', color: C.success },

  // (payment status chips defined below with statusDot)

  // Summary card
  summaryCard:    { padding: 20 },
  summaryRow:     { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  summaryLabel:   { fontSize: 14, color: C.sub },
  summaryValue:   { fontSize: 14, fontWeight: '600', color: C.dark },
  summaryDivider: { height: 1, backgroundColor: C.border, marginVertical: 10 },
  grandTotalRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  grandTotalLabel: { fontSize: 16, fontWeight: '700', color: C.dark },
  grandTotalValue: { fontSize: 30, fontWeight: '800', color: C.orange },

  // Sticky CTA
  stickyBar: {
    backgroundColor: C.card, paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: C.border,
  },
  generateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: C.orange, borderRadius: 16, height: 52,
  },
  generateBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  // Item modal
  draftRow:       { flexDirection: 'row', alignItems: 'flex-end' },
  rateChips:      { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 4 },
  rateChip:       { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.bg },
  rateChipActive: { borderColor: C.orange, backgroundColor: `${C.orange}12` },
  rateChipText:   { fontSize: 13, fontWeight: '600', color: C.sub },
  rateChipTextActive: { color: C.orange },
  advancedToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, marginVertical: 12 },
  advancedToggleText: { fontSize: 13, fontWeight: '600', color: C.orange },
  linePreview: {
    marginTop: 12, padding: 14, borderRadius: 14,
    backgroundColor: `${C.orange}08`, borderWidth: 1, borderColor: `${C.orange}25`,
  },
  linePreviewLabel: { fontSize: 11, color: C.sub, textTransform: 'uppercase', letterSpacing: 0.4 },
  linePreviewValue: { fontSize: 24, fontWeight: '800', color: C.dark, marginTop: 2 },
  linePreviewSub:   { fontSize: 12, color: C.sub, marginTop: 4 },
  sheetSaveBtn: {
    backgroundColor: C.orange, borderRadius: 14, height: 52,
    alignItems: 'center', justifyContent: 'center', marginTop: 16,
  },
  sheetSaveBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  // Modals
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBg:      { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.45)' },
  bottomSheet: {
    backgroundColor: C.card, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingBottom: 40, paddingTop: 12, maxHeight: '85%',
  },
  sheetHandle:      { width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginBottom: 16 },
  sheetTitle:       { fontSize: 20, fontWeight: '700', color: C.dark, marginBottom: 16 },
  sheetRow:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  sheetRowSelected: { backgroundColor: `${C.orange}08` },
  sheetRowText:     { fontSize: 16, color: C.dark },

  // CardHeader subtitle + status dot
  cardHeaderSub:  { fontSize: 12, color: C.sub, marginTop: 1 },
  statusDot:      { width: 10, height: 10, borderRadius: 5, marginRight: 4 },
  statusDotSmall: { width: 8, height: 8, borderRadius: 4 },

  // Status chips with dot
  statusChips:         { flexDirection: 'row', gap: 8 },
  statusChip:          { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.bg },
  statusChipActive:    { backgroundColor: C.bg },
  statusChipText:      { fontSize: 13, fontWeight: '600', color: C.sub },

  // Validation modal
  validationRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  validationIcon:  { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  validationLabel: { flex: 1, fontSize: 16, fontWeight: '600' },
  validationStatus: { fontSize: 13, fontWeight: '700' },
});
