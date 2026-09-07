import { ADDRESS_COUNTRIES, sanitizePincode, statesForCountry } from '../data/geoAddress';

/**
 * Shared shipping address fields.
 * Country first → state dropdown → city (text) → 6-digit pincode.
 *
 * onChange receives a partial address patch object.
 */
export default function AddressFields({
  address,
  onChange,
  idPrefix = '',
  autoCompletePrefix = '',
  required = false,
}) {
  const id = (name) => (idPrefix ? `${idPrefix}-${name}` : name);
  const ac = (name) => (autoCompletePrefix ? `${autoCompletePrefix} ${name}` : name);
  const states = statesForCountry(address.country);
  const countryKnown = ADDRESS_COUNTRIES.includes(address.country);
  const stateOptions =
    address.state && !states.includes(address.state)
      ? [address.state, ...states]
      : states;
  const countryOptions =
    address.country && !countryKnown
      ? [address.country, ...ADDRESS_COUNTRIES]
      : ADDRESS_COUNTRIES;

  function onCountryChange(value) {
    const nextStates = statesForCountry(value);
    const keepState = Boolean(address.state && nextStates.includes(address.state));
    onChange({
      country: value,
      state: keepState ? address.state : '',
    });
  }

  return (
    <div className="form-grid">
      <div className="form-field form-field-full">
        <label htmlFor={id('line1')}>Address line 1</label>
        <input
          id={id('line1')}
          value={address.line1 || ''}
          onChange={(e) => onChange({ line1: e.target.value })}
          required={required}
          autoComplete={ac('address-line1')}
        />
      </div>
      <div className="form-field form-field-full">
        <label htmlFor={id('line2')}>Address line 2</label>
        <input
          id={id('line2')}
          value={address.line2 || ''}
          onChange={(e) => onChange({ line2: e.target.value })}
          autoComplete={ac('address-line2')}
        />
      </div>
      <div className="form-field">
        <label htmlFor={id('country')}>Country</label>
        <select
          id={id('country')}
          value={address.country || ''}
          onChange={(e) => onCountryChange(e.target.value)}
          required={required}
          autoComplete={ac('country-name')}
        >
          <option value="">Select country</option>
          {countryOptions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div className="form-field">
        <label htmlFor={id('state')}>State</label>
        <select
          id={id('state')}
          value={address.state || ''}
          onChange={(e) => onChange({ state: e.target.value })}
          required={required}
          disabled={!address.country}
          autoComplete={ac('address-level1')}
        >
          <option value="">
            {address.country ? 'Select state' : 'Select country first'}
          </option>
          {stateOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div className="form-field">
        <label htmlFor={id('city')}>City</label>
        <input
          id={id('city')}
          value={address.city || ''}
          onChange={(e) => onChange({ city: e.target.value })}
          required={required}
          autoComplete={ac('address-level2')}
          placeholder="Enter city"
        />
      </div>
      <div className="form-field">
        <label htmlFor={id('pincode')}>Pincode</label>
        <input
          id={id('pincode')}
          value={address.pincode || ''}
          onChange={(e) => onChange({ pincode: sanitizePincode(e.target.value) })}
          required={required}
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          minLength={6}
          autoComplete={ac('postal-code')}
          placeholder="6 digits"
        />
      </div>
    </div>
  );
}
