import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';

const defaults = {
  orderUpdates: true,
  messageAlerts: true,
  promoAlerts: false,
  reviewReminders: true,
  stockAlerts: true,
  showPhoneToBuyers: false,
  useProfileAddressAtCheckout: true,
  preferredCurrency: 'INR',
  defaultCheckoutNote: '',
};

function fromUser(user) {
  return { ...defaults, ...(user?.settings || {}) };
}

export default function SettingsPage() {
  const { user, token, booting, setUserSession } = useAuth();
  const [form, setForm] = useState(fromUser(user));
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setForm(fromUser(user));
  }, [user]);

  if (booting) return <p className="empty">Checking your session…</p>;
  if (!user) return <Navigate to="/login" replace />;

  function setBool(key, checked) {
    setForm((prev) => ({ ...prev, [key]: checked }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setOk('');
    try {
      const data = await api.updateSettings(form, token);
      if (!data.success) throw new Error(data.msg || 'Update failed');
      setUserSession(token, data.user);
      setOk('Settings saved.');
    } catch (err) {
      setError(err.message || 'Update failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="form-layout form-layout-wide form-layout-fit">
      <div className="panel wide">
        <h1>Settings</h1>
        <p className="lede">
          Alerts and checkout defaults. Address is in{' '}
          <Link className="text-link" to="/profile">
            Profile
          </Link>
          .
        </p>

        <form className="form settings-form" onSubmit={onSubmit}>
          <fieldset className="form-section">
            <legend>Notifications</legend>
            <label className="toggle-row">
              <span>
                <strong>Order updates</strong>
                <small>Shipping, delivery, and cancellation alerts</small>
              </span>
              <input
                type="checkbox"
                checked={Boolean(form.orderUpdates)}
                onChange={(e) => setBool('orderUpdates', e.target.checked)}
              />
            </label>
            <label className="toggle-row">
              <span>
                <strong>Message alerts</strong>
                <small>New buyer and seller messages</small>
              </span>
              <input
                type="checkbox"
                checked={Boolean(form.messageAlerts)}
                onChange={(e) => setBool('messageAlerts', e.target.checked)}
              />
            </label>
            <label className="toggle-row">
              <span>
                <strong>Promotions & deals</strong>
                <small>Limited-time marketplace offers</small>
              </span>
              <input
                type="checkbox"
                checked={Boolean(form.promoAlerts)}
                onChange={(e) => setBool('promoAlerts', e.target.checked)}
              />
            </label>
            <label className="toggle-row">
              <span>
                <strong>Review reminders</strong>
                <small>Ask for a review after a purchase is delivered</small>
              </span>
              <input
                type="checkbox"
                checked={Boolean(form.reviewReminders)}
                onChange={(e) => setBool('reviewReminders', e.target.checked)}
              />
            </label>
            <label className="toggle-row">
              <span>
                <strong>Favorite restock alerts</strong>
                <small>Notify when a favorited item is back in stock</small>
              </span>
              <input
                type="checkbox"
                checked={Boolean(form.stockAlerts)}
                onChange={(e) => setBool('stockAlerts', e.target.checked)}
              />
            </label>
          </fieldset>

          <fieldset className="form-section">
            <legend>Checkout & privacy</legend>
            <label className="toggle-row">
              <span>
                <strong>Use profile address at checkout</strong>
                <small>Prefill shipping from your saved address</small>
              </span>
              <input
                type="checkbox"
                checked={Boolean(form.useProfileAddressAtCheckout)}
                onChange={(e) =>
                  setBool('useProfileAddressAtCheckout', e.target.checked)
                }
              />
            </label>
            <label className="toggle-row">
              <span>
                <strong>Show phone to interested buyers</strong>
                <small>Lets serious buyers contact you outside chat</small>
              </span>
              <input
                type="checkbox"
                checked={Boolean(form.showPhoneToBuyers)}
                onChange={(e) => setBool('showPhoneToBuyers', e.target.checked)}
              />
            </label>
            <div className="form-grid">
              <div className="form-field">
                <label htmlFor="preferredCurrency">Preferred currency</label>
                <select
                  id="preferredCurrency"
                  value={form.preferredCurrency || 'INR'}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      preferredCurrency: e.target.value,
                    }))
                  }
                >
                  <option value="INR">INR (₹)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                </select>
              </div>
              <div className="form-field form-field-full">
                <label htmlFor="defaultCheckoutNote">Default checkout note</label>
                <textarea
                  id="defaultCheckoutNote"
                  rows={2}
                  maxLength={280}
                  value={form.defaultCheckoutNote || ''}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      defaultCheckoutNote: e.target.value,
                    }))
                  }
                  placeholder="Gift wrap, leave at door, call on arrival…"
                />
              </div>
            </div>
          </fieldset>

          {error ? <p className="status error">{error}</p> : null}
          {ok ? <p className="status ok">{ok}</p> : null}
          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Save settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
