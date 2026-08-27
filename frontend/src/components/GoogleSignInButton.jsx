import { GoogleLogin } from '@react-oauth/google';
import { useGoogleAuthReady } from '../googleAuthReady';

export default function GoogleSignInButton({ onSuccess, onError, mode = 'signin' }) {
  const ready = useGoogleAuthReady();
  if (!ready) return null;

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
          ux_mode="popup"
          use_fedcm_for_button
          use_fedcm_for_prompt
        />
      </div>
    </div>
  );
}
