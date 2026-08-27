import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../api';
import { formatPhoneDisplay } from '../utils/validation';
import { useAuth } from '../AuthContext';

export default function ProfilePage() {
  const { user, token, booting, setUserSession } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user?.username) setUsername(user.username);
    if (user?.email) setEmail(user.email);
  }, [user]);

  if (booting) return <p className="empty">Checking your session…</p>;
  if (!user) return <Navigate to="/login" replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setOk('');
    try {
      const data = await api.updateProfile(
        { username: username.trim(), email: email.trim() },
        token,
      );
      if (!data.success) throw new Error(data.msg || 'Update failed');
      setUserSession(token, data.user);
      setOk('Profile updated.');
    } catch (err) {
      setError(err.message || 'Update failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="form-layout">
      <div className="panel">
        <h1>Your profile</h1>
        <p className="lede">
          Phone {formatPhoneDisplay(user)} is used to sign in and cannot be changed here.
        </p>
        <form className="form" onSubmit={onSubmit}>
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
          <div className="form-field">
            <label htmlFor="username">Display name</label>
            <input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          {error ? <p className="status error">{error}</p> : null}
          {ok ? <p className="status ok">{ok}</p> : null}
          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Save profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
