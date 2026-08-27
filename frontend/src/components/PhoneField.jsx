import { COUNTRY_CODES, sanitizePhoneInput } from '../utils/validation';

export default function PhoneField({
  countryCode,
  phone,
  onCountryCodeChange,
  onPhoneChange,
  id = 'phone',
}) {
  return (
    <div className="form-field">
      <label htmlFor={id}>Phone number</label>
      <div className="phone-input-row">
        <select
          className="country-code-select"
          value={countryCode}
          onChange={(e) => {
            onCountryCodeChange(e.target.value);
            e.target.blur();
          }}
          aria-label="Country code"
        >
          {COUNTRY_CODES.map((item) => (
            <option key={item.code} value={item.code}>
              {item.label}
            </option>
          ))}
        </select>
        <input
          id={id}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder="9876543210"
          maxLength={10}
          pattern="[0-9]{10}"
          value={phone}
          onChange={(e) => onPhoneChange(sanitizePhoneInput(e.target.value))}
          required
        />
      </div>
      <p className="field-hint">Enter a 10-digit mobile number without spaces.</p>
    </div>
  );
}
