import { PASSWORD_HINT, validatePassword } from '../utils/validation';

export default function PasswordField({
  id = 'password',
  label = 'Password',
  value,
  onChange,
  autoComplete = 'new-password',
  showHint = true,
}) {
  const issue = value ? validatePassword(value) : '';

  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        minLength={8}
        autoComplete={autoComplete}
        aria-describedby={showHint ? `${id}-hint` : undefined}
      />
      {showHint ? (
        <p className="field-hint" id={`${id}-hint`}>
          {PASSWORD_HINT}
        </p>
      ) : null}
      {issue && value ? <p className="status error">{issue}</p> : null}
    </div>
  );
}
