import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api';
import PhoneField from '../components/PhoneField';
import PasswordField from '../components/PasswordField';
import { validatePassword, validatePhoneNumber } from '../utils/validation';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [countryCode, setCountryCode] = useState(location.state?.country_code || '+91');
  const [phone_no, setPhone] = useState(location.state?.phone_no || '');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setOk('');

    const phoneError = validatePhoneNumber(phone_no);
    const passwordError = validatePassword(password);
    if (phoneError || passwordError) {
      setError(phoneError || passwordError);
      setBusy(false);
      return;
    }

    try {
      const data = await api.resetPassword({
        country_code: countryCode,
        phone_no: phone_no.trim(),
        otp: otp.trim(),
        password,
      });
      setOk(data.msg || 'Password updated.');
      setTimeout(() => navigate('/login'), 1200);
    } catch (err) {
      setError(err.message || 'Could not reset password');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-layout">
      <div className="panel">
        <h1>Enter reset code</h1>
        <p className="lede">Use the 6-digit code sent to your phone.</p>
        <form className="form" onSubmit={onSubmit}>
          <PhoneField
            countryCode={countryCode}
            phone={phone_no}
            onCountryCodeChange={setCountryCode}
            onPhoneChange={setPhone}
          />
          <div className="form-field">
            <label htmlFor="otp">Reset code</label>
            <input
              id="otp"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              required
              inputMode="numeric"
              autoComplete="one-time-code"
            />
          </div>
          <PasswordField id="new-password" label="New password" value={password} onChange={setPassword} />
          {error ? <p className="status error">{error}</p> : null}
          {ok ? <p className="status ok">{ok}</p> : null}
          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? 'Updating…' : 'Update password'}
            </button>
          </div>
        </form>
        <p className="muted-link" style={{ marginTop: '1rem' }}>
          <Link to="/forgot-password">Request a new code</Link>
        </p>
      </div>
    </div>
  );
}
