import * as Crypto from 'expo-crypto';

export const generateId = (): string => Crypto.randomUUID();
export const nowIso = (): string => new Date().toISOString();
