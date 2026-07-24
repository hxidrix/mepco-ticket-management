import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

import { BrandLogo } from '../components/BrandLogo';
import { GlassSurface } from '../components/GlassSurface';
import { OperationalLocationFields } from '../components/OperationalLocationFields';
import { PasswordInput } from '../components/PasswordInput';
import { SilkBackground } from '../components/SilkBackground';
import { ThemeToggle } from '../components/ThemeToggle';
import { useAuth } from '../hooks/useAuth';
import {
  getApiErrorMessage,
  registerConsumerRequest,
  registerEmployeeRequest,
  registrationOptionsRequest,
} from '../lib/auth-api';
import {
  CONSUMER_REFERENCE_LENGTH,
  CNIC_LENGTH,
  CNIC_PATTERN,
  EMPLOYEE_ID_LENGTH,
  PHONE_NUMBER_LENGTH,
  PHONE_NUMBER_PATTERN,
  normalizeEmployeeId,
  normalizeLoginIdentifier,
} from '../lib/identity-format';
import type { LoginMode, RegistrationOptions } from '../types/auth';

type AuthView = 'login' | 'register';
type RegistrationMode = 'consumer' | 'employee';

const loginLabels: Record<LoginMode, { label: string; identifier: string; placeholder: string }> = {
  consumer: { label: 'Consumer', identifier: 'MEPCO Reference Number', placeholder: '10000000000001' },
  employee: { label: 'Employee', identifier: 'Employee ID', placeholder: '00000001' },
  staff: { label: 'Staff', identifier: 'Username', placeholder: 'tech.it' },
};

function fieldValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

export function AuthPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const reduceMotion = useReducedMotion();
  const [view, setView] = useState<AuthView>('login');
  const [loginMode, setLoginMode] = useState<LoginMode>('consumer');
  const [registrationMode, setRegistrationMode] = useState<RegistrationMode>('consumer');
  const [options, setOptions] = useState<RegistrationOptions | null>(null);
  const [circleId, setCircleId] = useState('');
  const [divisionId, setDivisionId] = useState('');
  const [subdivisionId, setSubdivisionId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    registrationOptionsRequest()
      .then((result) => {
        setOptions(result);
        const firstCircle = result.circles[0];
        const firstDivision = firstCircle?.divisions[0];
        setCircleId(String(firstCircle?.id ?? ''));
        setDivisionId(String(firstDivision?.id ?? ''));
        setSubdivisionId(String(firstDivision?.subdivisions[0]?.id ?? ''));
      })
      .catch(() => setOptions(null));
  }, []);

  const divisions = useMemo(
    () => options?.circles.find((circle) => String(circle.id) === circleId)?.divisions ?? [],
    [circleId, options],
  );
  const subdivisions = useMemo(
    () => divisions.find((division) => String(division.id) === divisionId)?.subdivisions ?? [],
    [divisionId, divisions],
  );

  if (user !== null) return <Navigate to={user.status === 'suspended' ? '/suspension' : '/app'} replace />;

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);
    const data = new FormData(event.currentTarget);
    try {
      const authenticatedUser = await login(
        loginMode,
        normalizeLoginIdentifier(loginMode, fieldValue(data, 'identifier')),
        fieldValue(data, 'password'),
      );
      if (authenticatedUser.status === 'suspended') {
        void navigate('/suspension', { replace: true });
        return;
      }
      const from = (location.state as { from?: string } | null)?.from ?? '/app';
      void navigate(from, { replace: true });
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegistration = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);
    const data = new FormData(event.currentTarget);
    try {
      if (registrationMode === 'consumer') {
        await registerConsumerRequest({
          referenceNumber: fieldValue(data, 'referenceNumber'),
          name: fieldValue(data, 'name'),
          email: fieldValue(data, 'email') || undefined,
          phone: fieldValue(data, 'phone'),
          cnic: fieldValue(data, 'cnic'),
          password: fieldValue(data, 'password'),
          address: fieldValue(data, 'address'),
          circleId: Number(fieldValue(data, 'circleId')),
          divisionId: Number(fieldValue(data, 'divisionId')),
          subdivisionId: Number(fieldValue(data, 'subdivisionId')),
          serviceAddress: fieldValue(data, 'serviceAddress') || undefined,
        });
        setLoginMode('consumer');
      } else {
        await registerEmployeeRequest({
          employeeId: normalizeEmployeeId(fieldValue(data, 'employeeId')),
          name: fieldValue(data, 'name'),
          email: fieldValue(data, 'email'),
          phone: fieldValue(data, 'phone'),
          cnic: fieldValue(data, 'cnic'),
          password: fieldValue(data, 'password'),
          departmentId: Number(fieldValue(data, 'departmentId')),
          designation: fieldValue(data, 'designation'),
          circleId: Number(fieldValue(data, 'circleId')),
          divisionId: Number(fieldValue(data, 'divisionId')),
          subdivisionId: Number(fieldValue(data, 'subdivisionId')),
        });
        setLoginMode('employee');
      }
      setSuccess('Account created. Sign in with your new credentials.');
      setView('login');
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className={`auth-page auth-page--${view}`}>
      <SilkBackground className="silk-background--auth" />
      <section className="auth-hero" aria-labelledby="auth-hero-title">
        <div className="auth-hero__content">
          <BrandLogo />
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 22, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.58, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="auth-hero__eyebrow">MEPCO Integrated Help Desk</p>
            <h1 id="auth-hero-title">
              Report. Track. <span>Resolve.</span>
            </h1>
            <p className="auth-hero__lead">
              One secure help desk for MEPCO consumers and employees—with clear ownership,
              complete history, and accountable resolution.
            </p>
          </motion.div>
          <div className="auth-hero__trust">
            <span>Five-role access</span>
            <span>Traceable workflows</span>
            <span>Local-first demonstration</span>
          </div>
        </div>
      </section>

      <section className="auth-form-side" aria-label="Authentication">
        <div className="auth-form-side__top">
          <span>Secure portal</span>
          <div className="auth-form-side__actions">
            <ThemeToggle compact />
            <a href="http://localhost:5000/api-docs">API docs <span aria-hidden="true">↗</span></a>
          </div>
        </div>

        <motion.div
          className="auth-card-wrap"
          initial={reduceMotion ? false : { opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
        >
          <GlassSurface
            className="auth-card"
            borderRadius={24}
          >
          <div className="auth-card__heading">
            <p>{view === 'login' ? 'Welcome back' : 'Create an account'}</p>
            <h2>{view === 'login' ? 'Sign in to continue' : 'Join the help desk'}</h2>
            <span>
              {view === 'login'
                ? 'Choose the identity type that matches your MEPCO account.'
                : 'Consumer and employee self-registration uses fictional local data.'}
            </span>
          </div>

          {view === 'login' ? (
            <div className="auth-tabs" aria-label="Login type">
              {(Object.keys(loginLabels) as LoginMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={loginMode === mode}
                  className={loginMode === mode ? 'is-active' : ''}
                  onClick={() => {
                    setLoginMode(mode);
                    setError(null);
                  }}
                >
                  {loginLabels[mode].label}
                </button>
              ))}
            </div>
          ) : (
            <div className="auth-tabs" aria-label="Registration type">
              {(['consumer', 'employee'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={registrationMode === mode}
                  className={registrationMode === mode ? 'is-active' : ''}
                  onClick={() => {
                    setRegistrationMode(mode);
                    setError(null);
                  }}
                >
                  {mode === 'consumer' ? 'Consumer' : 'Employee'}
                </button>
              ))}
            </div>
          )}

          <AnimatePresence mode="wait" initial={false}>
            {view === 'login' ? (
              <motion.form
                key={`login-${loginMode}`}
                className="auth-form"
                onSubmit={(event) => void handleLogin(event)}
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
              >
                <label>
                  <span>{loginLabels[loginMode].identifier}</span>
                  <input
                    name="identifier"
                    required
                    autoComplete="username"
                    placeholder={loginLabels[loginMode].placeholder}
                    inputMode={loginMode === 'staff' ? 'text' : 'numeric'}
                    pattern={loginMode === 'consumer' ? '[0-9]{14}' : loginMode === 'employee' ? '[0-9]{1,8}' : undefined}
                    minLength={loginMode === 'consumer' ? CONSUMER_REFERENCE_LENGTH : undefined}
                    maxLength={loginMode === 'consumer' ? CONSUMER_REFERENCE_LENGTH : loginMode === 'employee' ? EMPLOYEE_ID_LENGTH : 80}
                    title={loginMode === 'consumer'
                      ? 'Enter exactly 14 digits'
                      : loginMode === 'employee'
                        ? 'Enter up to 8 digits; leading zeroes are added automatically'
                        : undefined}
                    onBlur={loginMode === 'employee'
                      ? (event) => {
                          event.currentTarget.value = normalizeEmployeeId(event.currentTarget.value);
                        }
                      : undefined}
                  />
                </label>
                <PasswordInput autoComplete="current-password" placeholder="Enter your password" />
                {error !== null && <p className="auth-message auth-message--error">{error}</p>}
                {success !== null && <p className="auth-message auth-message--success">{success}</p>}
                <button className="auth-submit" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Signing in…' : `Continue as ${loginLabels[loginMode].label}`}
                  <span aria-hidden="true">→</span>
                </button>
                {loginMode !== 'staff' && (
                  <button className="auth-switch" type="button" onClick={() => setView('register')}>
                    Need an account? <strong>Register here</strong>
                  </button>
                )}
              </motion.form>
            ) : (
              <motion.form
                key={`register-${registrationMode}`}
                className="auth-form auth-form--registration"
                onSubmit={(event) => void handleRegistration(event)}
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
              >
                {registrationMode === 'consumer' ? (
                  <>
                    <label>
                      <span>MEPCO Reference Number <small>14 digits</small></span>
                      <input
                        name="referenceNumber"
                        required
                        inputMode="numeric"
                        pattern="[0-9]{14}"
                        minLength={CONSUMER_REFERENCE_LENGTH}
                        maxLength={CONSUMER_REFERENCE_LENGTH}
                        placeholder="10000000000001"
                        title="Enter exactly 14 digits"
                      />
                    </label>
                    <label><span>Full name</span><input name="name" required autoComplete="name" /></label>
                    <label>
                      <span>Phone <small>11 digits, starts with 03</small></span>
                      <input
                        name="phone"
                        required
                        autoComplete="tel"
                        inputMode="tel"
                        pattern={PHONE_NUMBER_PATTERN}
                        minLength={PHONE_NUMBER_LENGTH}
                        maxLength={PHONE_NUMBER_LENGTH}
                        placeholder="03001234567"
                        title="Enter exactly 11 digits beginning with 03"
                      />
                    </label>
                    <label><span>Email <small>optional</small></span><input name="email" type="email" autoComplete="email" /></label>
                    <label>
                      <span>CNIC <small>13 digits</small></span>
                      <input
                        name="cnic"
                        required
                        autoComplete="off"
                        inputMode="numeric"
                        pattern={CNIC_PATTERN}
                        minLength={CNIC_LENGTH}
                        maxLength={CNIC_LENGTH}
                        placeholder="3520212345671"
                        title="Enter exactly 13 digits without dashes"
                      />
                    </label>
                    <label className="auth-form__wide"><span>Address</span><input name="address" required /></label>
                    <label>
                      <span>Circle</span>
                      <select name="circleId" required value={circleId} onChange={(event) => {
                        const nextCircleId = event.target.value;
                        const nextDivisions = options?.circles.find((circle) => String(circle.id) === nextCircleId)?.divisions ?? [];
                        const nextDivision = nextDivisions[0];
                        setCircleId(nextCircleId);
                        setDivisionId(String(nextDivision?.id ?? ''));
                        setSubdivisionId(String(nextDivision?.subdivisions[0]?.id ?? ''));
                      }}>
                        {options?.circles.map((circle) => <option key={circle.id} value={circle.id}>{circle.name}</option>)}
                      </select>
                    </label>
                    <label>
                      <span>Division</span>
                      <select name="divisionId" required value={divisionId} onChange={(event) => {
                        const nextDivisionId = event.target.value;
                        const nextSubdivision = divisions.find((division) => String(division.id) === nextDivisionId)?.subdivisions[0];
                        setDivisionId(nextDivisionId);
                        setSubdivisionId(String(nextSubdivision?.id ?? ''));
                      }}>
                        {divisions.map((division) => <option key={division.id} value={division.id}>{division.name}</option>)}
                      </select>
                    </label>
                    <label className="auth-form__wide">
                      <span>Sub-division</span>
                      <select name="subdivisionId" required value={subdivisionId} onChange={(event) => setSubdivisionId(event.target.value)}>
                        {subdivisions.map((subdivision) => <option key={subdivision.id} value={subdivision.id}>{subdivision.name}</option>)}
                      </select>
                    </label>
                    <label className="auth-form__wide"><span>Service address <small>optional</small></span><input name="serviceAddress" /></label>
                  </>
                ) : (
                  <>
                    <label>
                      <span>Employee ID <small>up to 8 digits</small></span>
                      <input
                        name="employeeId"
                        required
                        inputMode="numeric"
                        pattern="[0-9]{1,8}"
                        maxLength={EMPLOYEE_ID_LENGTH}
                        placeholder="00000001"
                        title="Enter up to 8 digits; leading zeroes are added automatically"
                        onBlur={(event) => {
                          event.currentTarget.value = normalizeEmployeeId(event.currentTarget.value);
                        }}
                      />
                    </label>
                    <label><span>Full name</span><input name="name" required autoComplete="name" /></label>
                    <label><span>Work email</span><input name="email" type="email" required /></label>
                    <label>
                      <span>Phone <small>11 digits, starts with 03</small></span>
                      <input
                        name="phone"
                        required
                        autoComplete="tel"
                        inputMode="tel"
                        pattern={PHONE_NUMBER_PATTERN}
                        minLength={PHONE_NUMBER_LENGTH}
                        maxLength={PHONE_NUMBER_LENGTH}
                        placeholder="03001234567"
                        title="Enter exactly 11 digits beginning with 03"
                      />
                    </label>
                    <label>
                      <span>CNIC <small>13 digits</small></span>
                      <input
                        name="cnic"
                        required
                        autoComplete="off"
                        inputMode="numeric"
                        pattern={CNIC_PATTERN}
                        minLength={CNIC_LENGTH}
                        maxLength={CNIC_LENGTH}
                        placeholder="3520212345671"
                        title="Enter exactly 13 digits without dashes"
                      />
                    </label>
                    <label className="auth-form__wide">
                      <span>Department</span>
                      <select name="departmentId" required>
                        {options?.departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                      </select>
                    </label>
                    <label><span>Designation</span><input name="designation" required /></label>
                    <OperationalLocationFields
                      options={options}
                      circleId={circleId}
                      divisionId={divisionId}
                      subdivisionId={subdivisionId}
                      onChange={(nextCircleId, nextDivisionId, nextSubdivisionId) => {
                        setCircleId(nextCircleId);
                        setDivisionId(nextDivisionId);
                        setSubdivisionId(nextSubdivisionId);
                      }}
                    />
                  </>
                )}
                <PasswordInput
                  className="auth-form__wide"
                  autoComplete="new-password"
                  minLength={10}
                  hint="10+ characters with uppercase, lowercase, number, and symbol."
                />
                {error !== null && <p className="auth-message auth-message--error auth-form__wide">{error}</p>}
                <button className="auth-submit auth-form__wide" type="submit" disabled={isSubmitting || options === null}>
                  {isSubmitting ? 'Creating account…' : 'Create account'} <span aria-hidden="true">→</span>
                </button>
                <button className="auth-switch auth-form__wide" type="button" onClick={() => setView('login')}>
                  Already registered? <strong>Sign in</strong>
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          <div className="auth-card__demo">
            <span>Development demo</span>
            <code>{loginLabels[loginMode].placeholder}</code>
            <code>Demo@12345</code>
          </div>
          </GlassSurface>
        </motion.div>
      </section>
    </main>
  );
}
