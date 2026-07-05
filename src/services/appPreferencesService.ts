import AsyncStorage from '@react-native-async-storage/async-storage';

export type ShareFormat = 'pdf' | 'image' | 'ask';

const SHARE_FORMAT_KEY = 'inv_pref_share_format_v1';

export async function getShareFormat(): Promise<ShareFormat> {
  const v = await AsyncStorage.getItem(SHARE_FORMAT_KEY);
  return (v as ShareFormat) ?? 'pdf';
}

export async function setShareFormat(format: ShareFormat): Promise<void> {
  await AsyncStorage.setItem(SHARE_FORMAT_KEY, format);
}
