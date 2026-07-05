import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, Switch, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Appbar, Surface } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { TemplateVersion } from '../types';
import { getLatestVersion } from '../services/templateService';
import { createRecord } from '../services/invoiceService';
import { getBusinessSettings } from '../services/businessService';
import { COLORS, getLocalFieldSuggestions, detectTemplateType } from '../constants';
import { Button } from '../components/Button';
import { CustomerAutocompleteField } from '../components/CustomerAutocompleteField';
import { Customer } from '../types';
import { formatCurrency, formatPercent, formatDate, formatDateIso } from '../services/formatService';
import { CalendarPickerModal } from '../components/CalendarPickerModal';
import { fieldKeyboardProps } from '../components/keyboard/fieldKeyboard';
import { KeyboardAwareScreen } from '../components/keyboard/KeyboardAwareScreen';
import { StickyBottomActionBar } from '../components/keyboard/StickyBottomActionBar';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'FillRecord'>;

interface FormField {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'currency' | 'table' | 'checkbox';
  required: boolean;
}

const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh',
  'Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka',
  'Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram',
  'Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu',
  'Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal',
  'Delhi','Jammu & Kashmir','Ladakh','Puducherry',
];

function isGstDocName(name: string): boolean {
  const n = name.toLowerCase();
  return n.includes('gst') || n === 'tax invoice';
}

// Fields that are already rendered by other parts of the form — skip them in extras
const BUILT_IN_FIELD_NAMES = new Set([
  'customer name', 'customer state', 'item table', 'parts table', 'items',
  'total', 'amount', 'grand total', 'invoice total',
]);

function buildFormFields(version: TemplateVersion | null, docTypeName: string): FormField[] {
  if (!version) return [];
  const fields: FormField[] = [];
  // Use name-based detection so seeded/imported templates with a wrong stored type still render correctly.
  // Pass 'custom' category so billing-shortcut doesn't override the keyword check.
  const isTransaction = detectTemplateType(docTypeName, 'custom') === 'transaction_document';

  // ── Customer name ────────────────────────────────────────────────────────
  const nameField = version.config.customer.fields.find(f => f.key === 'name');
  if (nameField?.visible) {
    fields.push({ id: 'customer_name', name: nameField.label, type: 'text', required: nameField.required });
  }

  // ── Items table (transaction docs only) ──────────────────────────────────
  if (isTransaction) {
    fields.push({ id: '__items__', name: 'Items', type: 'table', required: true });
  }

  // ── Extra fields: use saved config, fall back to preset for seeded templates
  const configExtras = version.config.extraFields
    .filter(f => f.visible)
    .sort((a, b) => a.order - b.order);

  if (configExtras.length > 0) {
    for (const ef of configExtras) {
      fields.push({ id: ef.id, name: ef.label, type: 'text', required: ef.required });
    }
  } else {
    // Seeded template with no customisation yet — inject doc-type-specific defaults
    const { fields: presetNames, score } = getLocalFieldSuggestions(docTypeName);
    if (score > 0) {
      presetNames
        .filter(n => !BUILT_IN_FIELD_NAMES.has(n.toLowerCase()))
        .forEach((name) => {
          fields.push({ id: `preset_${name.toLowerCase().replace(/\s+/g, '_')}`, name, type: 'text', required: false });
        });
    }
  }

  return fields;
}

type TableRow = {
  name: string; qty: string; price: string;
  hsn?: string; unit?: string; gstPct?: string; discount?: string;
  _expanded?: boolean;
};
type FieldValues = Record<string, any>;

function totalLabel(docName: string): string {
  const n = docName.toLowerCase();
  if (n.includes('quotation') || n.includes('estimate') || n.includes('proforma')) return 'Quote Total';
  if (n.includes('purchase order') || n.includes('work order'))                    return 'Order Total';
  if (n.includes('delivery') || n.includes('challan') || n.includes('dispatch'))   return 'Delivery Total';
  if (n.includes('service') || n.includes('job card'))                             return 'Service Total';
  if (n.includes('expense') || n.includes('voucher'))                              return 'Expense Total';
  if (n.includes('receipt'))                                                       return 'Receipt Total';
  return 'Invoice Total';
}

export function FillRecordScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { documentTypeId, documentTypeName } = route.params;

  const [version,        setVersion]       = useState<TemplateVersion | null>(null);
  const [fields,         setFields]        = useState<FormField[]>([]);
  const [values,         setValues]        = useState<FieldValues>({});
  const [customerState,  setCustomerState] = useState('');
  const [sellerState,    setSellerState]   = useState('');
  const [stateModal,     setStateModal]    = useState(false);
  const [loading,        setLoading]       = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [datePickerFieldId, setDatePickerFieldId] = useState<string | null>(null);

  const isGst = isGstDocName(documentTypeName);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const [v, biz] = await Promise.all([
          getLatestVersion(documentTypeId),
          getBusinessSettings(),
        ]);
        if (!active) return;
        setVersion(v);
        if (biz?.stateName) setSellerState(biz.stateName);
        const f = buildFormFields(v, documentTypeName);
        setFields(f);
        const initial: FieldValues = {};
        for (const field of f) {
          if (field.type === 'table') initial[field.id] = [{ name: '', qty: '', price: '', _expanded: false }];
          else if (field.type === 'checkbox') initial[field.id] = false;
          else initial[field.id] = '';
        }
        setValues(initial);
      })();
      return () => { active = false; };
    }, [documentTypeId])
  );

  const isTransaction = fields.some(f => f.type === 'table');

  const runningTotal = useMemo(() => {
    const tableField = fields.find(f => f.type === 'table');
    if (!tableField) return 0;
    const rows: TableRow[] = values[tableField.id] || [];
    return rows.reduce((sum, r) => {
      const taxable = Math.max(0,
        (parseFloat(r.qty) || 0) * (parseFloat(r.price) || 0) - (parseFloat(r.discount || '0') || 0)
      );
      const pct = parseFloat(r.gstPct || '0') || 0;
      return sum + taxable * (1 + pct / 100);
    }, 0);
  }, [fields, values]);

  const setValue = (fieldId: string, value: any) => {
    setValues(prev => ({ ...prev, [fieldId]: value }));
  };

  const addTableRow = (fieldId: string) => {
    setValues(prev => ({
      ...prev,
      [fieldId]: [...(prev[fieldId] || []), { name: '', qty: '', price: '', _expanded: false }],
    }));
  };

  const setTableCell = (fieldId: string, rowIndex: number, key: string, value: string) => {
    setValues(prev => {
      const rows = [...(prev[fieldId] || [])];
      rows[rowIndex] = { ...rows[rowIndex], [key]: value };
      return { ...prev, [fieldId]: rows };
    });
  };

  const toggleRowExpand = (fieldId: string, rowIndex: number) => {
    setValues(prev => {
      const rows = [...(prev[fieldId] || [])];
      rows[rowIndex] = { ...rows[rowIndex], _expanded: !rows[rowIndex]._expanded };
      return { ...prev, [fieldId]: rows };
    });
  };

  const removeTableRow = (fieldId: string, rowIndex: number) => {
    setValues(prev => {
      const rows = (prev[fieldId] || []).filter((_: any, i: number) => i !== rowIndex);
      return { ...prev, [fieldId]: rows.length > 0 ? rows : [{ name: '', qty: '', price: '', _expanded: false }] };
    });
  };

  const handlePreview = async () => {
    if (!version) return;

    const missingRequired = fields.filter(f =>
      f.required && f.type !== 'table' && !values[f.id] && values[f.id] !== 0
    );
    if (missingRequired.length > 0) {
      Alert.alert('Required fields missing', `Please fill: ${missingRequired.map(f => f.name).join(', ')}`);
      return;
    }

    const tableField = fields.find(f => f.type === 'table');
    if (tableField) {
      const tableRows: TableRow[] = values[tableField.id] || [];
      const hasItems = tableRows.some((r: TableRow) => r.name.trim());
      if (!hasItems) {
        Alert.alert('No items', 'Please add at least one item to the table.');
        return;
      }
    }

    setLoading(true);
    try {
      const data: Record<string, any> = {};
      if (isGst && customerState) data['Customer State'] = customerState;
      for (const f of fields) {
        if (f.type === 'table') {
          data['Item Table'] = (values[f.id] || [])
            .filter((r: TableRow) => r.name.trim())
            .map((r: TableRow) => ({
              name:     r.name,
              qty:      parseFloat(r.qty) || 1,
              price:    parseFloat(r.price) || 0,
              ...(r.hsn     ? { hsn: r.hsn }                       : {}),
              ...(r.unit    ? { unit: r.unit }                     : {}),
              ...(r.gstPct  ? { gstPct: parseFloat(r.gstPct) }    : {}),
              ...(r.discount ? { discount: parseFloat(r.discount) } : {}),
            }));
        } else {
          data[f.name] = values[f.id];
        }
      }
      const customerNameField = fields.find(f => f.id === 'customer_name');
      const record = await createRecord(version.id, documentTypeName, data,
        customerNameField
          ? {
              id: selectedCustomerId ?? undefined,
              draft: { name: values['customer_name'] },
            }
          : undefined
      );
      navigation.navigate('PreviewRecord', { recordId: record.id, documentTypeName });
    } catch {
      Alert.alert('Error', 'Could not save record.');
    } finally {
      setLoading(false);
    }
  };

  const renderTableField = (field: FormField) => {
    const rows: TableRow[] = values[field.id] || [];
    return (
      <View key={field.id} style={styles.fieldBlock}>
        <Text style={styles.fieldLabel}>{field.name} *</Text>
        {rows.map((row: TableRow, ri: number) => {
          const taxable = Math.max(0,
            (parseFloat(row.qty) || 0) * (parseFloat(row.price) || 0) - (parseFloat(row.discount || '0') || 0)
          );
          const pct    = parseFloat(row.gstPct || '0') || 0;
          const amount = taxable * (1 + pct / 100);
          const showAmt = (parseFloat(row.qty) || 0) > 0 && (parseFloat(row.price) || 0) > 0;

          return (
            <Surface key={ri} style={styles.itemCard} elevation={1}>
              <View style={styles.itemCardHeader}>
                <View style={[styles.itemBadge, { backgroundColor: `${COLORS.primary}12` }]}>
                  <Text style={[styles.itemBadgeText, { color: COLORS.primary }]}>#{ri + 1}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                  <TouchableOpacity
                    onPress={() => toggleRowExpand(field.id, ri)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={styles.gstToggle}
                  >
                    <Text style={styles.gstToggleText}>GST</Text>
                    <Ionicons
                      name={row._expanded ? 'chevron-up' : 'chevron-down'}
                      size={12}
                      color={COLORS.primary}
                    />
                  </TouchableOpacity>
                  {ri > 0 && (
                    <TouchableOpacity
                      onPress={() => removeTableRow(field.id, ri)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="close-circle" size={20} color={COLORS.danger} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <TextInput
                style={styles.itemNameInput}
                value={row.name}
                onChangeText={v => setTableCell(field.id, ri, 'name', v)}
                placeholder="Item name / description"
                placeholderTextColor={COLORS.textMuted}
              />

              <View style={styles.itemNumRow}>
                <View style={styles.itemNumField}>
                  <Text style={styles.itemNumLabel}>QTY</Text>
                  <TextInput
                    style={styles.itemNumInput}
                    value={row.qty}
                    onChangeText={v => setTableCell(field.id, ri, 'qty', v)}
                    placeholder="0"
                    keyboardType="numeric"
                    placeholderTextColor={COLORS.textMuted}
                  />
                </View>
                <View style={styles.itemNumDivider} />
                <View style={styles.itemNumField}>
                  <Text style={styles.itemNumLabel}>PRICE ₹</Text>
                  <TextInput
                    style={styles.itemNumInput}
                    value={row.price}
                    onChangeText={v => setTableCell(field.id, ri, 'price', v)}
                    placeholder="0.00"
                    keyboardType="numeric"
                    placeholderTextColor={COLORS.textMuted}
                  />
                </View>
                {showAmt && (
                  <>
                    <View style={styles.itemNumDivider} />
                    <View style={[styles.itemNumField, { flex: 1.2 }]}>
                      <Text style={styles.itemNumLabel}>{pct > 0 ? 'TOTAL' : 'AMOUNT'}</Text>
                      <Text style={[styles.itemAmountText, { color: COLORS.success }]}>
                        {formatCurrency(amount)}
                      </Text>
                    </View>
                  </>
                )}
              </View>

              {row._expanded && (
                <View style={styles.gstSection}>
                  <View style={styles.gstSectionDivider} />
                  <View style={styles.itemNumRow}>
                    <View style={styles.itemNumField}>
                      <Text style={styles.itemNumLabel}>HSN/SAC</Text>
                      <TextInput
                        style={styles.itemNumInput}
                        value={row.hsn ?? ''}
                        onChangeText={v => setTableCell(field.id, ri, 'hsn', v)}
                        placeholder="—"
                        keyboardType="numeric"
                        placeholderTextColor={COLORS.textMuted}
                      />
                    </View>
                    <View style={styles.itemNumDivider} />
                    <View style={styles.itemNumField}>
                      <Text style={styles.itemNumLabel}>UNIT</Text>
                      <TextInput
                        style={styles.itemNumInput}
                        value={row.unit ?? ''}
                        onChangeText={v => setTableCell(field.id, ri, 'unit', v)}
                        placeholder="NOS"
                        autoCapitalize="characters"
                        placeholderTextColor={COLORS.textMuted}
                      />
                    </View>
                    <View style={styles.itemNumDivider} />
                    <View style={styles.itemNumField}>
                      <Text style={styles.itemNumLabel}>GST %</Text>
                      <TextInput
                        style={styles.itemNumInput}
                        value={row.gstPct ?? ''}
                        onChangeText={v => setTableCell(field.id, ri, 'gstPct', v)}
                        placeholder="0"
                        keyboardType="numeric"
                        placeholderTextColor={COLORS.textMuted}
                      />
                    </View>
                    <View style={styles.itemNumDivider} />
                    <View style={styles.itemNumField}>
                      <Text style={styles.itemNumLabel}>DISCOUNT ₹</Text>
                      <TextInput
                        style={styles.itemNumInput}
                        value={row.discount ?? ''}
                        onChangeText={v => setTableCell(field.id, ri, 'discount', v)}
                        placeholder="0"
                        keyboardType="numeric"
                        placeholderTextColor={COLORS.textMuted}
                      />
                    </View>
                  </View>
                  {pct > 0 && showAmt && (
                    <Text style={styles.gstBreakdown}>
                      Taxable: {formatCurrency(taxable)}
                      {'  '}+{'  '}GST @{formatPercent(pct)}: {formatCurrency(amount - taxable)}
                    </Text>
                  )}
                </View>
              )}
            </Surface>
          );
        })}
        <TouchableOpacity style={styles.addRowBtn} onPress={() => addTableRow(field.id)} activeOpacity={0.7}>
          <Ionicons name="add-circle-outline" size={20} color={COLORS.primary} />
          <Text style={styles.addRowText}>Add Item</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderField = (field: FormField) => {
    if (field.type === 'table') return renderTableField(field);

    if (field.type === 'checkbox') {
      return (
        <View key={field.id} style={[styles.fieldBlock, styles.checkboxRow]}>
          <Text style={styles.fieldLabel}>{field.name}</Text>
          <Switch
            value={!!values[field.id]}
            onValueChange={v => setValue(field.id, v)}
            trackColor={{ true: COLORS.primary }}
          />
        </View>
      );
    }

    if (field.type === 'currency') {
      return (
        <View key={field.id} style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>{field.name}{field.required ? ' *' : ''}</Text>
          <View style={styles.currencyRow}>
            <Text style={styles.currencySymbol}>₹</Text>
            <TextInput
              style={[styles.input, styles.currencyInput]}
              value={String(values[field.id] ?? '')}
              onChangeText={v => setValue(field.id, v)}
              {...fieldKeyboardProps('decimal')}
              placeholder="0.00"
              placeholderTextColor={COLORS.textMuted}
            />
          </View>
        </View>
      );
    }

    if (field.type === 'date') {
      const raw = values[field.id];
      return (
        <View key={field.id} style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>{field.name}{field.required ? ' *' : ''}</Text>
          <TouchableOpacity
            style={styles.input}
            onPress={() => setDatePickerFieldId(field.id)}
            activeOpacity={0.7}
          >
            <Text style={raw ? undefined : { color: COLORS.textMuted }}>
              {raw ? formatDate(raw) : `Select ${field.name.toLowerCase()}`}
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (field.id === 'customer_name') {
      return (
        <View key={field.id} style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>{field.name}{field.required ? ' *' : ''}</Text>
          <CustomerAutocompleteField
            value={String(values[field.id] ?? '')}
            onChangeText={v => { setValue(field.id, v); setSelectedCustomerId(null); }}
            onSelectCustomer={(c: Customer) => {
              setValue(field.id, c.name);
              setSelectedCustomerId(c.id);
            }}
            placeholder={`Enter ${field.name.toLowerCase()}`}
            inputStyle={styles.input}
            placeholderTextColor={COLORS.textMuted}
          />
        </View>
      );
    }

    const lowerName = field.name.toLowerCase();
    const isMultiline = lowerName.includes('notes') || lowerName.includes('address');
    const fieldKind =
      field.type === 'number' ? 'number' :
      lowerName.includes('gstin') ? 'gstin' :
      lowerName.includes('phone') || lowerName.includes('mobile') ? 'phone' :
      lowerName.includes('email') ? 'email' :
      'text';
    return (
      <View key={field.id} style={styles.fieldBlock}>
        <Text style={styles.fieldLabel}>{field.name}{field.required ? ' *' : ''}</Text>
        <TextInput
          style={[styles.input, isMultiline && styles.inputMulti]}
          value={String(values[field.id] ?? '')}
          onChangeText={v => setValue(field.id, v)}
          placeholder={`Enter ${field.name.toLowerCase()}`}
          placeholderTextColor={COLORS.textMuted}
          {...fieldKeyboardProps(fieldKind)}
          multiline={isMultiline}
        />
      </View>
    );
  };

  if (!version) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
        <Appbar.Header style={styles.appbar} elevated>
          <Appbar.BackAction onPress={() => navigation.goBack()} color={COLORS.primary} />
          <Appbar.Content title={`New ${documentTypeName}`} titleStyle={styles.appbarTitle} />
        </Appbar.Header>
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Loading form…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      <Appbar.Header style={styles.appbar} elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} color={COLORS.primary} />
        <Appbar.Content title={`New ${documentTypeName}`} titleStyle={styles.appbarTitle} />
      </Appbar.Header>

      {/* Sticky running total — only for transaction docs */}
      {isTransaction && (
        <Surface style={styles.stickyTotal} elevation={3}>
          <View>
            <Text style={styles.stickyLabel}>{totalLabel(documentTypeName)}</Text>
            <Text style={styles.stickyAmount}>
              {formatCurrency(runningTotal)}
            </Text>
          </View>
          <View style={[styles.stickyBadge, { backgroundColor: runningTotal > 0 ? `${COLORS.success}15` : COLORS.background }]}>
            <Ionicons
              name={runningTotal > 0 ? 'checkmark-circle' : 'calculator-outline'}
              size={20}
              color={runningTotal > 0 ? COLORS.success : COLORS.textMuted}
            />
          </View>
        </Surface>
      )}

      <KeyboardAwareScreen edges={[]} style={styles.scroll}>
          {fields.flatMap((field) => {
            const nodes: React.ReactNode[] = [renderField(field)];
            if (isGst && field.id === 'customer_name') {
              nodes.push(
                <View key="customer_state_picker" style={styles.fieldBlock}>
                  <Text style={styles.fieldLabel}>Customer State</Text>
                  <TouchableOpacity
                    style={styles.statePickerRow}
                    onPress={() => setStateModal(true)}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="location-outline" size={16} color={customerState ? COLORS.primary : COLORS.textMuted} />
                    <Text style={[styles.statePickerText, !customerState && { color: COLORS.textMuted }]}>
                      {customerState || 'Select customer state (for CGST/IGST)'}
                    </Text>
                    <Ionicons name="chevron-down" size={14} color={COLORS.textMuted} />
                  </TouchableOpacity>
                  {!!customerState && (
                    <Text style={styles.gstBreakdown}>
                      {sellerState && customerState.toLowerCase() === sellerState.toLowerCase()
                        ? 'Intra-state — CGST + SGST will apply'
                        : 'Inter-state — IGST will apply'}
                    </Text>
                  )}
                </View>
              );
            }
            return nodes;
          })}
          <View style={{ height: 96 }} />
      </KeyboardAwareScreen>

      <StickyBottomActionBar style={styles.previewBar}>
        <Button label="Preview →" onPress={handlePreview} loading={loading} />
      </StickyBottomActionBar>

      {/* Customer State picker modal */}
        <Modal visible={stateModal} transparent animationType="slide" onRequestClose={() => setStateModal(false)}>
          <View style={styles.modalOverlay}>
            <TouchableOpacity style={styles.modalBg} activeOpacity={1} onPress={() => setStateModal(false)} />
            <View style={styles.bottomSheet}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>Customer State</Text>
              <ScrollView showsVerticalScrollIndicator={false}>
                {INDIAN_STATES.map(state => (
                  <TouchableOpacity
                    key={state}
                    style={[styles.sheetRow, customerState === state && styles.sheetRowSelected]}
                    onPress={() => { setCustomerState(state); setStateModal(false); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.sheetRowText, customerState === state && { color: COLORS.primary, fontWeight: '700' }]}>
                      {state}
                    </Text>
                    {customerState === state && <Ionicons name="checkmark" size={18} color={COLORS.primary} />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>

      <CalendarPickerModal
        visible={datePickerFieldId !== null}
        onClose={() => setDatePickerFieldId(null)}
        onSelect={(d) => {
          if (datePickerFieldId) setValue(datePickerFieldId, formatDateIso(d.toISOString()));
          setDatePickerFieldId(null);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: COLORS.background },
  appbar:      { backgroundColor: COLORS.surface },
  appbarTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  scroll:      { flex: 1, paddingHorizontal: 16, paddingTop: 16 },

  // Sticky total
  stickyTotal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  stickyLabel:  { fontSize: 12, fontWeight: '600', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  stickyAmount: { fontSize: 20, fontWeight: '800', color: COLORS.text, marginTop: 2 },
  previewBar: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  stickyBadge:  { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  // Fields
  fieldBlock: { marginBottom: 20 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.3 },

  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.text,
    backgroundColor: COLORS.surface,
  },
  inputMulti:     { minHeight: 72, textAlignVertical: 'top' },
  currencyRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  currencySymbol: { fontSize: 20, fontWeight: '600', color: COLORS.text },
  currencyInput:  { flex: 1 },
  checkboxRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  // Item cards
  itemCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
  },
  itemCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  itemBadge:     { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 },
  itemBadgeText: { fontSize: 12, fontWeight: '700' },
  itemNameInput: {
    fontSize: 15,
    color: COLORS.text,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 10,
    marginBottom: 12,
  },
  itemNumRow:      { flexDirection: 'row', alignItems: 'center' },
  itemNumField:    { flex: 1 },
  itemNumLabel:    { fontSize: 11, fontWeight: '700', color: COLORS.textMuted, letterSpacing: 0.6, marginBottom: 4 },
  itemNumInput:    { fontSize: 15, fontWeight: '600', color: COLORS.text },
  itemNumDivider:  { width: 1, height: 32, backgroundColor: COLORS.border, marginHorizontal: 12 },
  itemAmountText:  { fontSize: 15, fontWeight: '700' },

  addRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderWidth: 1.5,
    borderColor: `${COLORS.primary}40`,
    borderRadius: 12,
    borderStyle: 'dashed',
    backgroundColor: `${COLORS.primary}05`,
  },
  addRowText: { fontSize: 14, color: COLORS.primary, fontWeight: '600' },

  gstToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: `${COLORS.primary}10`,
  },
  gstToggleText: { fontSize: 11, fontWeight: '700', color: COLORS.primary, letterSpacing: 0.4 },
  gstSection:        { marginTop: 10 },
  gstSectionDivider: { height: 1, backgroundColor: COLORS.border, marginBottom: 12 },
  gstBreakdown: {
    marginTop: 8,
    fontSize: 11,
    color: COLORS.textMuted,
    fontStyle: 'italic',
  },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: COLORS.textSecondary },

  // Customer State picker
  statePickerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: COLORS.surface,
  },
  statePickerText: { flex: 1, fontSize: 16, color: COLORS.text },

  // Bottom sheet modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBg: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.4)' },
  bottomSheet: {
    backgroundColor: COLORS.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 20, paddingBottom: 40, paddingTop: 12, maxHeight: '75%',
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: 'center', marginBottom: 16 },
  sheetTitle:  { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  sheetRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  sheetRowSelected: { backgroundColor: `${COLORS.primary}08` },
  sheetRowText:     { fontSize: 16, color: COLORS.text },
});
