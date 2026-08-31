import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import PhoneField from '../components/PhoneField';
import { validatePhoneNumber } from '../utils/validation';

export default function ForgotPasswordPage() {
  const [countryCode, setCountryCode] = useState('+91');
  const [phone_no, setPhone] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setOk('');
    setDevOtp('');

    const phoneError = validatePhoneNumber(phone_no);
    if (phoneError) {
      setError(phoneError);
      setBusy(false);
      return;
    }

    try {
      const data = await api.forgotPassword({
        country_code: countryCode,
        phone_no: phone_no.trim(),
      });
      setOk(data.msg || 'Reset code sent.');
      const code = data.resetCode || data.devOtp;
      if (code) setDevOtp(code);
    } catch (err) {
      setError(err.message || 'Could not send reset code');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-layout">
      <div className="panel">
        <h1>Reset password</h1>
        <p className="lede">
          Enter your phone number to get a 6-digit reset code. If SMS is not configured, the
          code is shown on this page once.
        </p>
        <form className="form" onSubmit={onSubmit}>
          <PhoneField
            countryCode={countryCode}
            phone={phone_no}
            onCountryCodeChange={setCountryCode}
            onPhoneChange={setPhone}
          />
          {error ? <p className="status error">{error}</p> : null}
          {ok ? <p className="status ok">{ok}</p> : null}
          {devOtp ? (
            <p className="status ok">
              Your reset code: <strong>{devOtp}</strong> — use it on the Enter code page.
            </p>
          ) : null}
          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? 'Sending…' : 'Send reset code'}
            </button>
            <Link
              className="btn btn-secondary"
              to="/reset-password"
              state={{ country_code: countryCode, phone_no: phone_no.trim() }}
            >
              Enter code
            </Link>
          </div>
        </form>
        <p className="muted-link" style={{ marginTop: '1rem' }}>
          <Link to="/login">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
