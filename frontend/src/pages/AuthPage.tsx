import { motion, useReducedMotion } from 'framer-motion';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';

import { BrandLogo } from '../components/BrandLogo';
import { GlassSurface } from '../components/GlassSurface';
import { PasswordInput } from '../components/PasswordInput';
import { SilkBackground } from '../components/SilkBackground';
import { ThemeToggle } from '../components/ThemeToggle';
import { useAuth } from '../hooks/useAuth';
import { getApiErrorMessage, verifyEmployeeRequest } from '../lib/auth-api';
import { normalizeEmployeeId } from '../lib/identity-format';
import type { EmployeeVerificationPreview, LoginMode } from '../types/auth';

function fieldValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

export function AuthPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const reduceMotion = useReducedMotion();
  const [mode, setMode] = useState<LoginMode>('employee');
  const [employeeCredentials, setEmployeeCredentials] = useState<{ employeeId: string; cnicLastFour: string } | null>(null);
  const [preview, setPreview] = useState<EmployeeVerificationPreview | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user !== null) return <Navigate to={user.status === 'suspended' ? '/suspension' : '/app'} replace />;

  const finishLogin = async (loginMode: LoginMode, identifier: string, secret: string) => {
    const authenticatedUser = await login(loginMode, identifier, secret);
    if (authenticatedUser.status === 'suspended') {
      void navigate('/suspension', { replace: true });
      return;
    }
    const from = (location.state as { from?: string } | null)?.from ?? '/app';
    void navigate(from, { replace: true });
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setIsSubmitting(true); setError(null);
    const data = new FormData(event.currentTarget);
    try {
      if (mode === 'staff') {
        await finishLogin('staff', fieldValue(data, 'identifier'), fieldValue(data, 'password'));
        return;
      }
      const credentials = {
        employeeId: normalizeEmployeeId(fieldValue(data, 'identifier')),
        cnicLastFour: fieldValue(data, 'cnicLastFour'),
      };
      setPreview(await verifyEmployeeRequest(credentials.employeeId, credentials.cnicLastFour));
      setEmployeeCredentials(credentials);
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setIsSubmitting(false);
    }
  };

  const continueEmployee = async () => {
    if (employeeCredentials === null) return;
    setIsSubmitting(true); setError(null);
    try {
      await finishLogin('employee', employeeCredentials.employeeId, employeeCredentials.cnicLastFour);
    } catch (caught) {
      setError(getApiErrorMessage(caught));
      setPreview(null);
      setEmployeeCredentials(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-page auth-page--login">
      <SilkBackground className="silk-background--auth" />
      <section className="auth-hero" aria-labelledby="auth-hero-title">
        <div className="auth-hero__content">
          <BrandLogo />
          <motion.div initial={reduceMotion ? false : { opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }}>
            <p className="auth-hero__eyebrow">MEPCO Integrated Help Desk</p>
            <h1 id="auth-hero-title">Report. Track. <span>Resolve.</span></h1>
            <p className="auth-hero__lead">One secure help desk for MEPCO consumers and employees with clear ownership, complete history and accountable resolution.</p>
          </motion.div>
          <div className="auth-hero__trust"><span>Role based access</span><span>Traceable workflows</span><span>Secure account access</span></div>
        </div>
      </section>
      <section className="auth-form-side" aria-label="Employee and staff authentication">
        <div className="auth-form-side__top"><Link to="/">Public complaint portal</Link><ThemeToggle compact /></div>
        <motion.div className="auth-card-wrap" initial={reduceMotion ? false : { opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }}>
          <GlassSurface className="auth-card" borderRadius={24}>
            <div className="auth-card__heading"><p>Secure workspace</p><h2>Sign in to continue</h2><span>Employees verify with their ID and CNIC. Staff use their assigned credentials.</span></div>
            <div className="auth-tabs" aria-label="Sign-in type">
              {(['employee', 'staff'] as const).map((item) => <button key={item} type="button" aria-pressed={mode === item} className={mode === item ? 'is-active' : ''} onClick={() => { setMode(item); setPreview(null); setEmployeeCredentials(null); setError(null); }}>{item === 'employee' ? 'Employee' : 'Staff'}</button>)}
            </div>
            {preview === null ? (
              <form className="auth-form" onSubmit={(event) => void submit(event)}>
                <label><span>{mode === 'employee' ? 'Employee ID' : 'Username'}</span><input name="identifier" required autoComplete="username" inputMode={mode === 'employee' ? 'numeric' : 'text'} pattern={mode === 'employee' ? '[0-9]{1,8}' : undefined} maxLength={mode === 'employee' ? 8 : 80} placeholder={mode === 'employee' ? 'Up to 8 digits' : 'Enter username'} /></label>
                {mode === 'employee'
                  ? <PasswordInput name="cnicLastFour" label="Last 4 digits of CNIC" autoComplete="current-password" minLength={4} maxLength={4} inputMode="numeric" pattern="[0-9]{4}" placeholder="4 digits" />
                  : <PasswordInput autoComplete="current-password" placeholder="Enter your password" />}
                {error !== null && <p className="auth-message auth-message--error">{error}</p>}
                <button className="auth-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Checking...' : mode === 'employee' ? 'Verify employee' : 'Continue as Staff'}</button>
              </form>
            ) : (
              <div className="verification-preview employee-preview">
                <dl>
                  <div><dt>Employee ID</dt><dd>{preview.employeeId}</dd></div><div><dt>Name</dt><dd>{preview.name}</dd></div>
                  <div><dt>Email</dt><dd>{preview.email}</dd></div><div><dt>Phone</dt><dd>{preview.phone}</dd></div>
                  <div><dt>Department</dt><dd>{preview.department}</dd></div><div><dt>Office</dt><dd>{preview.office}</dd></div>
                </dl>
                {error !== null && <p className="auth-message auth-message--error">{error}</p>}
                <div className="verification-preview__actions"><button className="button" type="button" onClick={() => { setPreview(null); setEmployeeCredentials(null); }}>Back</button><button className="button button--primary" type="button" disabled={isSubmitting} onClick={() => void continueEmployee()}>{isSubmitting ? 'Signing in...' : 'Continue'}</button></div>
              </div>
            )}
          </GlassSurface>
        </motion.div>
      </section>
    </main>
  );
}
