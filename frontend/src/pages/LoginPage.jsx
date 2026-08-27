import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import PhoneField from '../components/PhoneField';
import { validatePhoneNumber } from '../utils/validation';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [countryCode, setCountryCode] = useState('+91');
  const [phone_no, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');

    const phoneError = validatePhoneNumber(phone_no);
    if (phoneError) {
      setError(phoneError);
      setBusy(false);
      return;
    }

    try {
      await login(countryCode, phone_no.trim(), password);
      navigate('/catalog');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-layout">
      <div className="panel">
        <h1>Welcome back</h1>
        <p className="lede">Sign in with the phone number on your Violet account.</p>
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
