import { useId, useState } from 'react';

interface PasswordInputProps {
  autoComplete: 'current-password' | 'new-password';
  className?: string;
  hint?: string;
  minLength?: number;
  placeholder?: string;
}

export function PasswordInput({
  autoComplete,
  className,
  hint,
  minLength,
  placeholder,
}: PasswordInputProps) {
  const inputId = useId();
  const [visible, setVisible] = useState(false);
  const classes = ['auth-password-field', className].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      <label htmlFor={inputId}><span>Password</span></label>
      <div className="auth-password-field__control">
        <input
          id={inputId}
          name="password"
          type={visible ? 'text' : 'password'}
          required
          minLength={minLength}
          autoComplete={autoComplete}
          placeholder={placeholder}
        />
        <button
          className="auth-password-field__toggle"
          type="button"
          aria-label={`${visible ? 'Hide' : 'Show'} password`}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      </div>
      {hint !== undefined && <small>{hint}</small>}
    </div>
  );
}
