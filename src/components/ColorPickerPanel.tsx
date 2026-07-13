import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, runOnJS } from 'react-native-reanimated';

interface Props {
  value: string; // hex, e.g. "#F97316"
  onChange: (hex: string) => void;
}

const SQUARE_SIZE = 220;
const THUMB_SIZE = 22;
const HUE_BAR_HEIGHT = 28;
const HUE_THUMB_SIZE = 26;

// ─── HSV <-> hex — no existing HSV utility elsewhere in the codebase to
// reuse (totals.ts's hexToRgba is unrelated alpha-blending), so these are
// small, self-contained pure functions local to this component.

function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60)       { r = c; g = x; b = 0; }
  else if (h < 120)  { r = x; g = c; b = 0; }
  else if (h < 180)  { r = 0; g = c; b = x; }
  else if (h < 240)  { r = 0; g = x; b = c; }
  else if (h < 300)  { r = x; g = 0; b = c; }
  else                { r = c; g = 0; b = x; }
  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r)      h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else                 h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  const v = max;
  return { h, s, v };
}

const HUE_STOPS = ['#FF0000', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#FF00FF', '#FF0000'] as const;

export function ColorPickerPanel({ value, onChange }: Props) {
  const initial = hexToHsv(value);
  const [hue, setHue] = useState(initial.h);
  const [sat, setSat] = useState(initial.s);
  const [val, setVal] = useState(initial.v);

  // Re-sync if `value` changes from outside (e.g. a preset applied elsewhere)
  // and doesn't match what dragging here would have produced.
  useEffect(() => {
    if (hsvToHex(hue, sat, val) === value.toUpperCase()) return;
    const next = hexToHsv(value);
    setHue(next.h); setSat(next.s); setVal(next.v);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const squareX = useSharedValue(sat * SQUARE_SIZE);
  const squareY = useSharedValue((1 - val) * SQUARE_SIZE);
  const hueX = useSharedValue((hue / 360) * SQUARE_SIZE);

  const updateFromSquare = (s: number, v: number) => {
    setSat(s); setVal(v);
    onChange(hsvToHex(hue, s, v));
  };
  const updateFromHue = (h: number) => {
    setHue(h);
    onChange(hsvToHex(h, sat, val));
  };

  // onBegin sets the thumb to the initial touch point (tap-to-jump),
  // onChange tracks the drag from there — one unified RNGH gesture, so it
  // doesn't mix with the legacy React Native Responder System (which would
  // conflict with GestureDetector's own native recognizers if both were
  // attached to the same view).
  const squareGesture = Gesture.Pan()
    .onBegin(e => {
      squareX.value = Math.max(0, Math.min(SQUARE_SIZE, e.x));
      squareY.value = Math.max(0, Math.min(SQUARE_SIZE, e.y));
      runOnJS(updateFromSquare)(squareX.value / SQUARE_SIZE, 1 - squareY.value / SQUARE_SIZE);
    })
    .onChange(e => {
      squareX.value = Math.max(0, Math.min(SQUARE_SIZE, squareX.value + e.changeX));
      squareY.value = Math.max(0, Math.min(SQUARE_SIZE, squareY.value + e.changeY));
      runOnJS(updateFromSquare)(squareX.value / SQUARE_SIZE, 1 - squareY.value / SQUARE_SIZE);
    });

  const hueGesture = Gesture.Pan()
    .onBegin(e => {
      hueX.value = Math.max(0, Math.min(SQUARE_SIZE, e.x));
      runOnJS(updateFromHue)((hueX.value / SQUARE_SIZE) * 360);
    })
    .onChange(e => {
      hueX.value = Math.max(0, Math.min(SQUARE_SIZE, hueX.value + e.changeX));
      runOnJS(updateFromHue)((hueX.value / SQUARE_SIZE) * 360);
    });

  const squareThumbStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: squareX.value - THUMB_SIZE / 2 },
      { translateY: squareY.value - THUMB_SIZE / 2 },
    ],
  }));
  const hueThumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: hueX.value - HUE_THUMB_SIZE / 2 }],
  }));

  const pureHue = hsvToHex(hue, 1, 1);
  const currentHex = hsvToHex(hue, sat, val);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={[styles.swatch, { backgroundColor: currentHex }]} />
        <Text style={styles.hexText}>{currentHex}</Text>
      </View>

      {/* Saturation / Brightness square */}
      <GestureDetector gesture={squareGesture}>
        <View style={styles.square}>
          <LinearGradient
            colors={['#FFFFFF', pureHue]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={['transparent', '#000000']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Animated.View style={[styles.squareThumb, squareThumbStyle, { backgroundColor: currentHex }]} />
        </View>
      </GestureDetector>

      {/* Hue slider */}
      <GestureDetector gesture={hueGesture}>
        <View style={styles.hueBar}>
          <LinearGradient
            colors={HUE_STOPS}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          <Animated.View style={[styles.hueThumb, hueThumbStyle, { backgroundColor: pureHue }]} />
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  swatch: { width: 28, height: 28, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  hexText: { fontSize: 14, fontWeight: '700', color: '#0F172A', letterSpacing: 0.5 },
  square: {
    width: SQUARE_SIZE, height: SQUARE_SIZE, borderRadius: 14, overflow: 'hidden',
    borderWidth: 1, borderColor: '#E2E8F0', alignSelf: 'center',
  },
  squareThumb: {
    position: 'absolute', width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: THUMB_SIZE / 2,
    borderWidth: 3, borderColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 3, elevation: 4,
  },
  hueBar: {
    width: SQUARE_SIZE, height: HUE_BAR_HEIGHT, borderRadius: HUE_BAR_HEIGHT / 2, overflow: 'hidden',
    alignSelf: 'center', justifyContent: 'center',
  },
  hueThumb: {
    position: 'absolute', top: (HUE_BAR_HEIGHT - HUE_THUMB_SIZE) / 2,
    width: HUE_THUMB_SIZE, height: HUE_THUMB_SIZE, borderRadius: HUE_THUMB_SIZE / 2,
    borderWidth: 3, borderColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 3, elevation: 4,
  },
});
