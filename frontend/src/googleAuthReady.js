import { createContext, useContext } from 'react';

export const GoogleAuthReadyContext = createContext(false);

export function useGoogleAuthReady() {
  return useContext(GoogleAuthReadyContext);
}
