import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

export default function ForgotPasswordPage() {
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
    try {
      const data = await api.forgotPassword(phone_no.trim());
      setOk(data.msg || 'Reset code sent.');
      if (data.devOtp) setDevOtp(data.devOtp);
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
        <p className="lede">Enter your phone number. We will send a 6-digit reset code.</p>
        <form className="form" onSubmit={onSubmit}>
          <div className="form-field">
            <label htmlFor="phone">Phone number</label>
            <input
              id="phone"
              value={phone_no}
              onChange={(e) => setPhone(e.target.value)}
              required
              autoComplete="tel"
            />
          </div>
          {error ? <p className="status error">{error}</p> : null}
          {ok ? <p className="status ok">{ok}</p> : null}
          {devOtp ? (
            <p className="status ok">
              Dev mode code: <strong>{devOtp}</strong> — use it on the reset page.
            </p>
          ) : null}
          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? 'Sending…' : 'Send reset code'}
            </button>
            <Link
              className="btn btn-secondary"
              to="/reset-password"
              state={{ phone_no: phone_no.trim() }}
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
