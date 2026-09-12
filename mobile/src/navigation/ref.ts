import { createNavigationContainerRef } from '@react-navigation/native';
import type { AuthStackParamList, RootStackParamList } from './types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function openAuth(screen?: keyof AuthStackParamList) {
  if (!navigationRef.isReady()) return;
  if (screen) {
    navigationRef.navigate('Auth', { screen });
  } else {
    navigationRef.navigate('Auth');
  }
}

export function closeAuth() {
  if (navigationRef.isReady() && navigationRef.canGoBack()) {
    navigationRef.goBack();
  }
}
