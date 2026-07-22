import { useId, useState } from 'react';

interface PasswordInputProps {
  autoComplete: 'current-password' | 'new-password';
  className?: string;
  defaultValue?: string;
  hint?: string;
  label?: string;
  minLength?: number;
  name?: string;
  placeholder?: string;
  required?: boolean;
}

export function PasswordInput({
  autoComplete,
  className,
  defaultValue,
  hint,
  label = 'Password',
  minLength,
  name = 'password',
  placeholder,
  required = true,
}: PasswordInputProps) {
  const inputId = useId();
  const [visible, setVisible] = useState(false);
  const classes = ['auth-password-field', className].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      <label htmlFor={inputId}><span>{label}</span></label>
      <div className="auth-password-field__control">
        <input
          id={inputId}
          name={name}
          type={visible ? 'text' : 'password'}
          required={required}
          defaultValue={defaultValue}
          minLength={minLength}
          autoComplete={autoComplete}
          placeholder={placeholder}
        />
        <button
          className="auth-password-field__toggle"
          type="button"
          aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
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
