import { ThemePatch } from './document-theme';

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  templateId: string;
  themeOverrides: ThemePatch;
  recommendedFor?: string[];
}

export const THEME_REGISTRY: Record<string, ThemePreset> = {
  minimal: {
    id: 'minimal',
    name: 'Minimal',
    description: 'Clean, monochrome design with generous whitespace. Ideal for freelancers and modern digital services.',
    templateId: 'minimal',
    themeOverrides: {
      style: { fontFamily: 'Inter', accentColor: '#111111', density: 'spacious', borderRadius: 'none' },
      table: { style: 'minimal', density: 'spacious' }
    },
    recommendedFor: ['Freelancers', 'Digital Services', 'Consultants']
  },
  professional: {
    id: 'professional',
    name: 'Professional',
    description: 'Structured and highly readable. A trustworthy blue layout perfect for B2B, GST businesses, and agencies.',
    templateId: 'modern',
    themeOverrides: {
      style: { fontFamily: 'Helvetica Neue', accentColor: '#1D4ED8', density: 'comfortable', borderRadius: 'rounded-md' },
      table: { style: 'striped', density: 'comfortable' }
    },
    recommendedFor: ['B2B', 'Agencies', 'Corporate']
  },
  shop: {
    id: 'shop',
    name: 'Shop',
    description: 'Compact layout optimized for fast billing and retail counters with more items per page.',
    templateId: 'classic',
    themeOverrides: {
      style: { fontFamily: 'Arial', accentColor: '#EA580C', density: 'compact', borderRadius: 'rounded-sm' },
      table: { style: 'minimal', density: 'compact' }
    },
    recommendedFor: ['Retail', 'Kirana Stores', 'Supermarkets']
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    description: 'Elegant typography with generous spacing. Best for boutiques, jewelry, salons, and luxury services.',
    templateId: 'minimal',
    themeOverrides: {
      style: { fontFamily: 'Georgia', accentColor: '#B45309', density: 'spacious', borderRadius: 'rounded-lg' },
      table: { style: 'minimal', density: 'comfortable' }
    },
    recommendedFor: ['Boutiques', 'Jewelry', 'Salons', 'Luxury Services']
  },
  restaurant: {
    id: 'restaurant',
    name: 'Restaurant',
    description: 'Focused on itemized lists and totals. Clean, narrow-friendly layout for food and beverage businesses.',
    templateId: 'modern',
    themeOverrides: {
      style: { fontFamily: 'Helvetica Neue', accentColor: '#DC2626', density: 'compact', borderRadius: 'rounded-md' },
      table: { style: 'striped', density: 'compact' }
    },
    recommendedFor: ['Restaurants', 'Cafes', 'Cloud Kitchens']
  },
  healthcare: {
    id: 'healthcare',
    name: 'Healthcare',
    description: 'Trustworthy teal layout with clean tabular data. Great for clinics, pharmacies, and medical practitioners.',
    templateId: 'classic',
    themeOverrides: {
      style: { fontFamily: 'Inter', accentColor: '#0F766E', density: 'comfortable', borderRadius: 'rounded-md' },
      table: { style: 'striped', density: 'comfortable' }
    },
    recommendedFor: ['Clinics', 'Pharmacies', 'Doctors']
  },
  wholesale: {
    id: 'wholesale',
    name: 'Wholesale',
    description: 'High density, highly structured template with detailed tax columns for large distribution businesses.',
    templateId: 'classic',
    themeOverrides: {
      style: { fontFamily: 'Inter', accentColor: '#334155', density: 'compact', borderRadius: 'none' },
      table: { style: 'bordered', density: 'compact' }
    },
    recommendedFor: ['Wholesale', 'Distributors', 'Manufacturing']
  }
};

export const PRESETS: ThemePreset[] = Object.values(THEME_REGISTRY);
