import { GoogleOAuthProvider } from '@react-oauth/google';
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { api } from './api';
import { GoogleAuthReadyContext } from './googleAuthReady';
import './index.css';

const CONFIG_RETRY_MS = [0, 1500, 3000, 6000, 12000];

function Root() {
  const envClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
  const [googleClientId, setGoogleClientId] = useState(envClientId);

  useEffect(() => {
    if (envClientId) return;
    let cancelled = false;

    (async () => {
      for (const delay of CONFIG_RETRY_MS) {
        if (cancelled) return;
        if (delay) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
        if (cancelled) return;
        try {
          const data = await api.authConfig();
          if (!cancelled && data?.googleClientId) {
            setGoogleClientId(data.googleClientId);
            return;
          }
        } catch {
          /* Retry — Render free tier often 502s while waking */
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [envClientId]);

  const app = (
    <StrictMode>
      <App />
    </StrictMode>
  );

  return (
    <GoogleAuthReadyContext.Provider value={Boolean(googleClientId)}>
      {googleClientId ? (
        <GoogleOAuthProvider clientId={googleClientId}>{app}</GoogleOAuthProvider>
      ) : (
        app
      )}
    </GoogleAuthReadyContext.Provider>
  );
}

createRoot(document.getElementById('root')).render(<Root />);
