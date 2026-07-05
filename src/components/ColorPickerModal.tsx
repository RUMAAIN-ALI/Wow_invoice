import React, { useCallback, useRef, useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, StyleSheet,
  TextInput, PanResponder, LayoutChangeEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../constants';
import { cardShadow } from '../utils/shadow';

// ─── HSV ↔ HEX helpers ───────────────────────────────────────────────────────

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  h = h % 360;
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  let r = 0, g = 0, b = 0;
  if      (h < 60)  { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else              { r = c; g = 0; b = x; }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function hexToRgb(hex: string): [number, number, number] | null {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return null;
  const n = parseInt(clean, 16);
  if (isNaN(n)) return null;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
    if (h < 0) h += 360;
  }
  return [h, max === 0 ? 0 : d / max, max];
}

function hueToHex(hue: number): string {
  const [r, g, b] = hsvToRgb(hue, 1, 1);
  return rgbToHex(r, g, b);
}

// ─── Preset palette ───────────────────────────────────────────────────────────

const PRESETS = [
  '#F97316','#EA580C','#EF4444','#DC2626','#EC4899',
  '#D946EF','#8B5CF6','#7C3AED','#6366F1','#3B82F6',
  '#2563EB','#0EA5E9','#06B6D4','#14B8A6','#10B981',
  '#22C55E','#84CC16','#EAB308','#F59E0B','#FBBF24',
  '#A16207','#78350F','#7F1D1D','#1E1B4B','#0F172A',
  '#334155','#64748B','#94A3B8','#CBD5E1','#FFFFFF',
];

// ─── Hue gradient stops ───────────────────────────────────────────────────────

const HUE_STOPS = Array.from({ length: 13 }, (_, i) =>
  hueToHex(i * 30)
) as any;

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  initial: string;
  onClose: () => void;
  onSelect: (hex: string) => void;
}

export function ColorPickerModal({ visible, initial, onClose, onSelect }: Props) {

  // Derive initial HSV from the hex prop
  const initHsv = useCallback((): [number, number, number] => {
    const rgb = hexToRgb(initial);
    return rgb ? rgbToHsv(...rgb) : [22, 1, 0.976];
  }, [initial]);

  const [hue, setHue]    = useState(() => initHsv()[0]);
  const [sat, setSat]    = useState(() => initHsv()[1]);
  const [val, setVal]    = useState(() => initHsv()[2]);
  const [hexInput, setHexInput] = useState(initial.toUpperCase());

  // Reset state when modal opens
  const onShow = () => {
    const [h, s, v] = initHsv();
    setHue(h); setSat(s); setVal(v);
    setHexInput(initial.toUpperCase());
  };

  const currentHex = rgbToHex(...hsvToRgb(hue, sat, val));
  const pureHueHex = hueToHex(hue);

  // ── SV panel (saturation × value 2-D picker) ─────────────────────────────
  const svSize = useRef({ w: 1, h: 1 });
  const svPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: (e) => handleSvTouch(e.nativeEvent.locationX, e.nativeEvent.locationY),
      onPanResponderMove: (e) => handleSvTouch(e.nativeEvent.locationX, e.nativeEvent.locationY),
    })
  ).current;

  const handleSvTouch = (x: number, y: number) => {
    const newS = Math.min(1, Math.max(0, x / svSize.current.w));
    const newV = Math.min(1, Math.max(0, 1 - y / svSize.current.h));
    setSat(newS); setVal(newV);
    const hex = rgbToHex(...hsvToRgb(hue, newS, newV));
    setHexInput(hex.toUpperCase());
  };

  // ── Hue bar ───────────────────────────────────────────────────────────────
  const hueBarWidth = useRef(1);
  const huePan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: (e) => handleHueTouch(e.nativeEvent.locationX),
      onPanResponderMove: (e) => handleHueTouch(e.nativeEvent.locationX),
    })
  ).current;

  const handleHueTouch = (x: number) => {
    const newH = Math.min(359.9, Math.max(0, (x / hueBarWidth.current) * 360));
    setHue(newH);
    const hex = rgbToHex(...hsvToRgb(newH, sat, val));
    setHexInput(hex.toUpperCase());
  };

  // ── Hex input ─────────────────────────────────────────────────────────────
  const onHexChange = (text: string) => {
    setHexInput(text.toUpperCase());
    const clean = text.startsWith('#') ? text : '#' + text;
    const rgb = hexToRgb(clean);
    if (rgb) {
      const [h, s, v] = rgbToHsv(...rgb);
      setHue(h); setSat(s); setVal(v);
    }
  };

  // ── Confirm ───────────────────────────────────────────────────────────────
  const confirm = () => { onSelect(currentHex); onClose(); };

  return (
    <Modal visible={visible} transparent animationType="slide" onShow={onShow} onRequestClose={onClose}>
      <TouchableOpacity style={S.backdrop} activeOpacity={1} onPress={onClose} />

      <View style={S.sheet}>
        {/* Header */}
        <View style={S.header}>
          <Text style={S.title}>Brand Color</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={S.cancel}>Cancel</Text>
          </TouchableOpacity>
        </View>

        {/* ── SV Panel ── */}
        <View
          style={S.svPanel}
          onLayout={(e: LayoutChangeEvent) => {
            svSize.current = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height };
          }}
          {...svPan.panHandlers}
        >
          <LinearGradient
            colors={['#FFFFFF', pureHueHex]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={['transparent', '#000000']}
            start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          {/* Thumb */}
          <View style={[S.svThumb, {
            left:  sat  * (svSize.current.w  || 0) - 10,
            top:   (1 - val) * (svSize.current.h || 0) - 10,
            borderColor: val > 0.5 ? '#000' : '#fff',
          }]} />
        </View>

        {/* ── Hue bar ── */}
        <View style={S.hueRow}>
          {/* Preview swatch */}
          <View style={[S.previewSwatch, { backgroundColor: currentHex }]} />

          <View style={{ flex: 1 }}>
            <View
              style={S.hueBar}
              onLayout={e => { hueBarWidth.current = e.nativeEvent.layout.width; }}
              {...huePan.panHandlers}
            >
              <LinearGradient colors={HUE_STOPS} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
              <View style={[S.hueThumb, { left: (hue / 360) * (hueBarWidth.current || 0) - 10 }]} />
            </View>
          </View>
        </View>

        {/* ── Hex input ── */}
        <View style={S.hexRow}>
          <View style={[S.hexSwatch, { backgroundColor: currentHex }]} />
          <TextInput
            style={S.hexInput}
            value={hexInput}
            onChangeText={onHexChange}
            placeholder="#F97316"
            maxLength={7}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <TouchableOpacity style={S.applyBtn} onPress={confirm} activeOpacity={0.82}>
            <Text style={S.applyText}>Apply</Text>
          </TouchableOpacity>
        </View>

        {/* ── Preset palette ── */}
        <Text style={S.presetLabel}>PALETTE</Text>
        <View style={S.presetGrid}>
          {PRESETS.map(hex => (
            <TouchableOpacity
              key={hex}
              style={[S.presetDot, { backgroundColor: hex },
                hex === currentHex && S.presetDotSelected,
                hex === '#FFFFFF' && S.presetDotWhite,
              ]}
              onPress={() => {
                const rgb = hexToRgb(hex)!;
                const [h, s, v] = rgbToHsv(...rgb);
                setHue(h); setSat(s); setVal(v);
                setHexInput(hex.toUpperCase());
              }}
              activeOpacity={0.8}
            />
          ))}
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title:  { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  cancel: { fontSize: 15, color: COLORS.primary, fontWeight: '600' },

  // SV panel
  svPanel: {
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  svThumb: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    backgroundColor: 'transparent',
  },

  // Hue bar
  hueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  previewSwatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  hueBar: {
    height: 20,
    borderRadius: 10,
    overflow: 'hidden',
  },
  hueThumb: {
    position: 'absolute',
    top: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: 'transparent',
    ...cardShadow('#000', 1, 0.3, 2, { elevation: 3 }),
  },

  // Hex input row
  hexRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  hexSwatch: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  hexInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
    letterSpacing: 1,
  },
  applyBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  applyText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  // Presets
  presetLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 1,
    marginBottom: 10,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  presetDotSelected: {
    borderWidth: 3,
    borderColor: '#0F172A',
  },
  presetDotWhite: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
});
