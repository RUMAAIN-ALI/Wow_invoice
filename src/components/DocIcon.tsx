import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { DocumentCategory } from '../types';
import { CATEGORY_COLORS, DOC_TYPE_COLORS } from '../constants';

interface DocIconProps {
  icon: string;
  category?: DocumentCategory;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  docName?: string;
}

const SIZES = {
  xs: { container: 32, icon: 16, radius: 9 },
  sm: { container: 40, icon: 20, radius: 11 },
  md: { container: 56, icon: 28, radius: 16 },
  lg: { container: 64, icon: 32, radius: 18 },
};

function isVectorIcon(name: string): boolean {
  return /^[a-z0-9-]+$/.test(name);
}

export function DocIcon({ icon, category = 'custom', size = 'md', docName }: DocIconProps) {
  const { container, icon: iconSize, radius } = SIZES[size];

  // Name-based semantic color takes priority over category color
  const colors =
    (docName ? DOC_TYPE_COLORS[docName.toLowerCase().trim()] : undefined) ??
    CATEGORY_COLORS[category] ??
    CATEGORY_COLORS['custom'];

  return (
    <View
      style={[
        styles.container,
        {
          width: container,
          height: container,
          borderRadius: radius,
          backgroundColor: colors.bg,
        },
      ]}
    >
      {isVectorIcon(icon) ? (
        <Ionicons name={icon as any} size={iconSize} color={colors.icon} />
      ) : (
        <Text style={{ fontSize: iconSize * 0.85 }}>{icon}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
