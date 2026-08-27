import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import PhoneField from '../components/PhoneField';
import GoogleSignInButton from '../components/GoogleSignInButton';
import { validatePhoneNumber } from '../utils/validation';

export default function LoginPage() {
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [countryCode, setCountryCode] = useState('+91');
  const [phone_no, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setStatus('Signing in — waiting for server…');

    const phoneError = validatePhoneNumber(phone_no);
    if (phoneError) {
      setError(phoneError);
      setStatus('');
      setBusy(false);
      return;
    }

    try {
      await login(countryCode, phone_no.trim(), password);
      navigate('/catalog');
    } catch (err) {
      setStatus('');
      setError(err.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle(response) {
    if (!response?.credential) return;
    setBusy(true);
    setError('');
    setStatus('Signing in with Google — waiting for server…');
    try {
      await loginWithGoogle(response.credential);
      navigate('/catalog');
    } catch (err) {
      setStatus('');
      setError(err.message || 'Google sign-in failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-layout">
      <div className="panel">
        <h1>Welcome back</h1>
        <p className="lede">Sign in with Google or the phone number on your Violet account.</p>
        <GoogleSignInButton
          mode="signin"
          onSuccess={handleGoogle}
          onError={() => setError('Google sign-in was cancelled or failed')}
        />
        <form className="form" onSubmit={onSubmit}>
          <PhoneField
            countryCode={countryCode}
            phone={phone_no}
            onCountryCodeChange={setCountryCode}
            onPhoneChange={setPhone}
          />
          <div className="form-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          {status ? <p className="status">{status}</p> : null}
          {error ? <p className="status error">{error}</p> : null}
          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </div>
        </form>
        <p className="muted-link" style={{ marginTop: '1rem' }}>
          New here? <Link to="/register">Create an account</Link>
          {' · '}
          <Link to="/forgot-password">Forgot password?</Link>
        </p>
      </div>
    </div>
  );
}
