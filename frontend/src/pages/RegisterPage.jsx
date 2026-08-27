import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import PhoneField from '../components/PhoneField';
import PasswordField from '../components/PasswordField';
import GoogleSignInButton from '../components/GoogleSignInButton';
import { validatePassword, validatePhoneNumber } from '../utils/validation';

export default function RegisterPage() {
  const { register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [phone_no, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');

    const phoneError = validatePhoneNumber(phone_no);
    const passwordError = validatePassword(password);
    if (phoneError || passwordError) {
      setError(phoneError || passwordError);
      setBusy(false);
      return;
    }

    try {
      await register(username.trim(), countryCode, phone_no.trim(), password, email.trim());
      navigate('/sell');
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle(response) {
    if (!response?.credential) return;
    setBusy(true);
    setError('');
    try {
      await loginWithGoogle(response.credential);
      navigate('/sell');
    } catch (err) {
      setError(err.message || 'Google sign-in failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-layout">
      <div className="panel">
        <h1>Join Violet</h1>
        <p className="lede">Continue with Google or create a seller profile with phone and password.</p>
        <GoogleSignInButton
          mode="signup"
          onSuccess={handleGoogle}
          onError={() => setError('Google sign-in was cancelled or failed')}
        />
        <form className="form" onSubmit={onSubmit}>
          <div className="form-field">
            <label htmlFor="username">Display name</label>
            <input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="nickname"
            />
          </div>
          <PhoneField
            countryCode={countryCode}
            phone={phone_no}
            onCountryCodeChange={setCountryCode}
            onPhoneChange={setPhone}
          />
          <div className="form-field">
            <label htmlFor="email">Email (optional)</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <PasswordField value={password} onChange={setPassword} />
          {error ? <p className="status error">{error}</p> : null}
          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? 'Creating…' : 'Create account'}
            </button>
          </div>
        </form>
        <p className="muted-link" style={{ marginTop: '1rem' }}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
