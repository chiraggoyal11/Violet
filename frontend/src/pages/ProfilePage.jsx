import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../api';
import AddressFields from '../components/AddressFields';
import ImageUploadZone from '../components/ImageUploadZone';
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
    bio: user?.bio || '',
    shopName: user?.shopName || '',
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

  async function onPhotoFiles(nextFiles) {
    const file = nextFiles?.[0];
    if (!file) return;
    setPhotoBusy(true);
    setError('');
    setOk('');
    const localUrl = URL.createObjectURL(file);
    try {
      setPreview(localUrl);
      const data = await api.updateAvatar(file, token);
      if (!data.success) throw new Error(data.msg || 'Photo upload failed');
      setUserSession(token, data.user);
      const remote = data.user.avatar || '';
      setPreview(remote || localUrl);
      if (remote) URL.revokeObjectURL(localUrl);
      setOk('Profile photo updated.');
    } catch (err) {
      URL.revokeObjectURL(localUrl);
      setPreview(user?.avatar || '');
      setError(err.message || 'Photo upload failed');
    } finally {
      setPhotoBusy(false);
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
      if (hasAnyAddress) {
        const complete = Boolean(
          addr.line1?.trim() &&
            addr.city?.trim() &&
            addr.state?.trim() &&
            addr.country?.trim() &&
            isValidPincode(addr.pincode),
        );
        if (!complete) {
          throw new Error(
            addr.pincode && !isValidPincode(addr.pincode)
              ? 'Pincode must be exactly 6 digits.'
              : 'Add a complete shipping address (line 1, city, state, country, and 6-digit pincode), or clear all address fields.',
          );
        }
      }
      const data = await api.updateProfile(
        {
          username: form.username.trim(),
          email: form.email.trim(),
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          gender: form.gender,
          date_of_birth: form.date_of_birth,
          bio: form.bio.trim(),
          shopName: form.shopName.trim(),
          address: form.address,
        },
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
    <div className="form-layout form-layout-wide form-layout-fit">
      <div className="panel wide">
        <h1>Your profile</h1>
        <p className="lede">Keep your account and shipping details up to date.</p>
        <form className="form profile-form" onSubmit={onSubmit}>
          <fieldset className="form-section">
            <legend>Account</legend>
            <div className="form-field profile-photo-field">
              <span className="field-label" id="avatar-label">
                Profile photo
              </span>
              <ImageUploadZone
                id="avatar"
                label="Upload"
                previewUrl={preview}
                busy={photoBusy}
                onFiles={onPhotoFiles}
                hint="Click or drag and drop"
              />
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
              <div className="form-field">
                <label htmlFor="shopName">Shop name</label>
                <input
                  id="shopName"
                  value={form.shopName}
                  onChange={(e) => setField('shopName', e.target.value)}
                  placeholder="Shown on your public shop"
                />
              </div>
              <div className="form-field form-field-full">
                <label htmlFor="bio">Bio</label>
                <textarea
                  id="bio"
                  rows={2}
                  maxLength={500}
                  value={form.bio}
                  onChange={(e) => setField('bio', e.target.value)}
                  placeholder="Tell buyers about your craft"
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
              required={Boolean(
                form.address?.line1 ||
                  form.address?.line2 ||
                  form.address?.city ||
                  form.address?.state ||
                  form.address?.country ||
                  form.address?.pincode,
              )}
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
