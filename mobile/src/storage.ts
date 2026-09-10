import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const memory = new Map<string, string>();

function webGet(key: string) {
  try {
    if (typeof localStorage !== 'undefined') return localStorage.getItem(key);
  } catch {
    /* private mode */
  }
  return memory.get(key) ?? null;
}

function webSet(key: string, value: string) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
      return;
    }
  } catch {
    /* private mode */
  }
  memory.set(key, value);
}

function webDelete(key: string) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
  } catch {
    /* private mode */
  }
  memory.delete(key);
}

/** SecureStore on native; localStorage/memory on web (Expo web / smoke tests). */
export async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') return webGet(key);
  return SecureStore.getItemAsync(key);
}

export async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    webSet(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function deleteItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    webDelete(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
