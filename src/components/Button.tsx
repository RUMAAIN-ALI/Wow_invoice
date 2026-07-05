import React from 'react';
import { ViewStyle } from 'react-native';
import { Button as PaperButton } from 'react-native-paper';
import { COLORS } from '../constants';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

const MODE_MAP = {
  primary: 'contained',
  secondary: 'outlined',
  ghost: 'text',
  danger: 'contained',
} as const;

export function Button({ label, onPress, variant = 'primary', disabled, loading, style }: ButtonProps) {
  return (
    <PaperButton
      mode={MODE_MAP[variant]}
      onPress={onPress}
      disabled={disabled || loading}
      loading={loading}
      buttonColor={variant === 'danger' ? COLORS.danger : undefined}
      textColor={variant === 'danger' ? '#fff' : undefined}
      contentStyle={{ height: 52 }}
      style={[{ borderRadius: 12 }, style]}
    >
      {label}
    </PaperButton>
  );
}
