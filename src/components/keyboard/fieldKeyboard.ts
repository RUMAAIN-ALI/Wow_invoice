import { KeyboardTypeOptions, TextInputProps } from 'react-native';

export type FieldKind = 'text' | 'number' | 'decimal' | 'phone' | 'email' | 'gstin' | 'multiline';

/**
 * Standard keyboard/autocapitalize/autocorrect props per field kind — the
 * single mapping every screen's TextInput should pull from, instead of each
 * screen guessing its own keyboardType per field.
 */
export function fieldKeyboardProps(kind: FieldKind): Pick<TextInputProps, 'keyboardType' | 'autoCapitalize' | 'autoCorrect'> {
  switch (kind) {
    case 'number':   return { keyboardType: 'number-pad' as KeyboardTypeOptions };
    case 'decimal':  return { keyboardType: 'decimal-pad' as KeyboardTypeOptions };
    case 'phone':    return { keyboardType: 'phone-pad' as KeyboardTypeOptions };
    case 'email':    return { keyboardType: 'email-address' as KeyboardTypeOptions, autoCapitalize: 'none', autoCorrect: false };
    case 'gstin':    return { autoCapitalize: 'characters', autoCorrect: false };
    case 'multiline':
    case 'text':
    default:         return { keyboardType: 'default' as KeyboardTypeOptions };
  }
}
