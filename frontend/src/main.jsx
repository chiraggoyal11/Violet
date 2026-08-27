import { GoogleOAuthProvider } from '@react-oauth/google';
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { api } from './api';
import { GoogleAuthReadyContext } from './googleAuthReady';
import './index.css';

function Root() {
  const envClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
  const [googleClientId, setGoogleClientId] = useState(envClientId);

  useEffect(() => {
    if (envClientId) return;
    let cancelled = false;
    api
      .authConfig()
      .then((data) => {
        if (!cancelled && data?.googleClientId) {
          setGoogleClientId(data.googleClientId);
        }
      })
      .catch(() => {
        /* Google button stays hidden if config unavailable */
      });
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
