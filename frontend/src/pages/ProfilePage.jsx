import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../api';
import AddressFields from '../components/AddressFields';
import { isValidPincode } from '../data/geoAddress';
import { formatPhoneDisplay } from '../utils/validation';
import { useAuth } from '../AuthContext';

const emptyAddress = {
  line1: '',
  line2: '',
  city: '',
  state: '',
  country: '',
  pincode: '',
};

function fromUser(user) {
  return {
    username: user?.username || '',
    email: user?.email || '',
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    gender: user?.gender || '',
    date_of_birth: user?.date_of_birth || '',
    address: { ...emptyAddress, ...(user?.address || {}) },
  };
}

export default function ProfilePage() {
  const { user, token, booting, setUserSession } = useAuth();
  const [form, setForm] = useState(fromUser(user));
  const [preview, setPreview] = useState(user?.avatar || '');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);

  useEffect(() => {
    setForm(fromUser(user));
    setPreview(user?.avatar || '');
  }, [user]);

  if (booting) return <p className="empty">Checking your session…</p>;
  if (!user) return <Navigate to="/login" replace />;

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function patchAddress(updates) {
    setForm((prev) => ({
      ...prev,
      address: { ...prev.address, ...updates },
    }));
  }

  async function onPhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoBusy(true);
    setError('');
    setOk('');
    try {
      const localUrl = URL.createObjectURL(file);
      setPreview(localUrl);
      const data = await api.updateAvatar(file, token);
      if (!data.success) throw new Error(data.msg || 'Photo upload failed');
      setUserSession(token, data.user);
      setPreview(data.user.avatar || localUrl);
      setOk('Profile photo updated.');
    } catch (err) {
      setPreview(user?.avatar || '');
      setError(err.message || 'Photo upload failed');
    } finally {
      setPhotoBusy(false);
      e.target.value = '';
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setOk('');
    try {
      const addr = form.address || {};
      const hasAnyAddress = Boolean(
        addr.line1 || addr.line2 || addr.city || addr.state || addr.country || addr.pincode,
      );
      if (hasAnyAddress && addr.pincode && !isValidPincode(addr.pincode)) {
        throw new Error('Pincode must be exactly 6 digits.');
      }
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/9c1d7e4a-f4ce-41e3-a9d5-5fcd9f0e2a1b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c7a1'},body:JSON.stringify({sessionId:'c7a1',hypothesisId:'H1',location:'ProfilePage.jsx:onSubmit:before',message:'profile save payload address',data:{formAddress:form.address,formLine1:form.address?.line1||null,formKeys:Object.keys(form.address||{})},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      const data = await api.updateProfile(
        {
          username: form.username.trim(),
          email: form.email.trim(),
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          gender: form.gender,
          date_of_birth: form.date_of_birth,
          address: form.address,
        },
        token,
      );
      if (!data.success) throw new Error(data.msg || 'Update failed');
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/9c1d7e4a-f4ce-41e3-a9d5-5fcd9f0e2a1b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c7a1'},body:JSON.stringify({sessionId:'c7a1',hypothesisId:'H1',location:'ProfilePage.jsx:onSubmit:response',message:'profile save response address',data:{success:data.success,respAddress:data.user?.address||null,respLine1:data.user?.address?.line1||null,respKeys:Object.keys(data.user?.address||{}),hasLine1:Boolean(data.user?.address?.line1)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      setUserSession(token, data.user);
      setOk('Profile updated.');
    } catch (err) {
      setError(err.message || 'Update failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="form-layout form-layout-wide form-layout-fit">
      <div className="panel wide">
        <h1>Your profile</h1>
        <p className="lede">Keep your account and shipping details up to date.</p>
        <form className="form profile-form" onSubmit={onSubmit}>
          <fieldset className="form-section">
            <legend>Account</legend>
            <div className="profile-photo-row">
              <div className="profile-photo-preview" aria-hidden="true">
                {preview ? (
                  <img src={preview} alt="" />
                ) : (
                  <span>{(form.username || '?').slice(0, 2).toUpperCase()}</span>
                )}
              </div>
              <div className="form-field">
                <label htmlFor="avatar">Profile photo</label>
                <input
                  id="avatar"
                  type="file"
                  accept="image/*"
                  onChange={onPhotoChange}
                  disabled={photoBusy}
                />
                {photoBusy ? <p className="muted-link">Uploading…</p> : null}
              </div>
            </div>
            <div className="form-grid">
              <div className="form-field">
                <label htmlFor="username">Display name</label>
                <input
                  id="username"
                  value={form.username}
                  onChange={(e) => setField('username', e.target.value)}
                  required
                />
              </div>
              <div className="form-field">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setField('email', e.target.value)}
                  autoComplete="email"
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="form-section">
            <legend>Personal</legend>
            <div className="form-grid">
              <div className="form-field">
                <label htmlFor="first_name">First name</label>
                <input
                  id="first_name"
                  value={form.first_name}
                  onChange={(e) => setField('first_name', e.target.value)}
                  autoComplete="given-name"
                />
              </div>
              <div className="form-field">
                <label htmlFor="last_name">Last name</label>
                <input
                  id="last_name"
                  value={form.last_name}
                  onChange={(e) => setField('last_name', e.target.value)}
                  autoComplete="family-name"
                />
              </div>
              <div className="form-field">
                <label htmlFor="gender">Gender</label>
                <select
                  id="gender"
                  value={form.gender}
                  onChange={(e) => setField('gender', e.target.value)}
                >
                  <option value="">Prefer not to say</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="non_binary">Non-binary</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </div>
              <div className="form-field">
                <label htmlFor="date_of_birth">Date of birth</label>
                <input
                  id="date_of_birth"
                  type="date"
                  value={form.date_of_birth}
                  onChange={(e) => setField('date_of_birth', e.target.value)}
                  autoComplete="bday"
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="form-section">
            <legend>Shipping address</legend>
            <AddressFields
              address={form.address}
              onChange={patchAddress}
              idPrefix="profile"
            />
          </fieldset>

          {error ? <p className="status error">{error}</p> : null}
          {ok ? <p className="status ok">{ok}</p> : null}
          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={busy || photoBusy}>
              {busy ? 'Saving…' : 'Save profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
