import { GoogleLogin } from '@react-oauth/google';

export default function GoogleSignInButton({ onSuccess, onError, mode = 'signin' }) {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!clientId) return null;

  return (
    <div className="google-auth">
      <div className="auth-divider">
        <span>or</span>
      </div>
      <div className="google-button-wrap">
        <GoogleLogin
          onSuccess={onSuccess}
          onError={onError}
          text={mode === 'signup' ? 'signup_with' : 'continue_with'}
          shape="rectangular"
          theme="outline"
          size="large"
          width="320"
        />
      </div>
    </div>
  );
}
