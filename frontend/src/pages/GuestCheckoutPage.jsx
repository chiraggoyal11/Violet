import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import AddressFields from '../components/AddressFields';
import PhoneField from '../components/PhoneField';
import { isValidPincode } from '../data/geoAddress';

const emptyAddress = {
  line1: '',
  line2: '',
  city: '',
  state: '',
  country: '',
  pincode: '',
};

export default function GuestCheckoutPage() {
  const { user, setUserSession } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState(emptyAddress);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user && !user.isGuest) {
    return (
      <section className="section">
        <div className="panel wide">
          <h1>Already signed in</h1>
          <p className="lede">Continue to cart or checkout with your account.</p>
          <div className="form-actions">
            <Link className="btn btn-accent" to="/checkout">
              Go to checkout
            </Link>
            <Link className="btn btn-secondary" to="/cart">
              Open cart
            </Link>
          </div>
        </div>
      </section>
    );
  }

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (!isValidPincode(address.pincode)) {
        throw new Error('Pincode must be exactly 6 digits.');
      }
      if (!address.line1?.trim() || !address.city?.trim() || !address.state?.trim() || !address.country?.trim()) {
        throw new Error('Add a complete shipping address.');
      }
      const data = await api.guestSession({
        email: email.trim(),
        phone_no: phone,
        country_code: countryCode,
        ...address,
      });
      if (!data.success || !data.token) {
        throw new Error(data.msg || 'Could not start guest checkout');
      }
      setUserSession(data.token, data.user);
      navigate('/cart');
    } catch (err) {
      setError(err.message || 'Could not start guest checkout');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="form-layout form-layout-wide form-layout-fit">
      <div className="panel wide">
        <h1>Guest checkout</h1>
        <p className="lede">
          Enter email, phone, and shipping address to continue without creating a full account.
          You can add a password later in Profile.
        </p>
        <form className="form" onSubmit={onSubmit}>
          <div className="form-field">
            <label htmlFor="guest-email">Email</label>
            <input
              id="guest-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <PhoneField
            countryCode={countryCode}
            phone={phone}
            onCountryCodeChange={setCountryCode}
            onPhoneChange={setPhone}
            id="guest-phone"
          />
          <fieldset className="form-section">
            <legend>Shipping address</legend>
            <AddressFields
              address={address}
              onChange={(patch) => setAddress((prev) => ({ ...prev, ...patch }))}
              idPrefix="guest"
              required
            />
          </fieldset>
          {error ? <p className="status error">{error}</p> : null}
          <div className="form-actions">
            <button className="btn btn-accent" type="submit" disabled={busy}>
              {busy ? 'Starting…' : 'Continue to cart'}
            </button>
            <Link className="btn btn-secondary" to="/login">
              Sign in instead
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
