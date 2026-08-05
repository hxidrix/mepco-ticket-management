import { useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

import { PasswordInput } from '../components/PasswordInput';
import { PublicFlowLayout } from '../components/PublicFlowLayout';
import { useAuth } from '../hooks/useAuth';
import { getApiErrorMessage, verifyEmployeeRequest } from '../lib/auth-api';
import { normalizeEmployeeId } from '../lib/identity-format';
import type { EmployeeVerificationPreview } from '../types/auth';

interface EmployeeCredentials {
  employeeId: string;
  cnicLastFour: string;
}

function fieldValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

export function EmployeeComplaintVerificationPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [credentials, setCredentials] = useState<EmployeeCredentials | null>(null);
  const [employee, setEmployee] = useState<EmployeeVerificationPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user !== null) {
    if (user.status === 'suspended') return <Navigate to="/suspension" replace />;
    return <Navigate to={user.role === 'employee' ? '/app/tickets/new' : '/app'} replace />;
  }

  const verify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const data = new FormData(event.currentTarget);
    const nextCredentials = {
      employeeId: normalizeEmployeeId(fieldValue(data, 'employeeId')),
      cnicLastFour: fieldValue(data, 'cnicLastFour'),
    };
    try {
      setEmployee(await verifyEmployeeRequest(nextCredentials.employeeId, nextCredentials.cnicLastFour));
      setCredentials(nextCredentials);
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const continueToComplaint = async () => {
    if (credentials === null) return;
    setBusy(true);
    setError(null);
    try {
      const authenticatedUser = await login('employee', credentials.employeeId, credentials.cnicLastFour);
      void navigate(authenticatedUser.status === 'suspended' ? '/suspension' : '/app/tickets/new', { replace: true });
    } catch (caught) {
      setError(getApiErrorMessage(caught));
      setEmployee(null);
      setCredentials(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <PublicFlowLayout
      eyebrow="Employee verification"
      title="Confirm your employee details"
      description="Enter your MEPCO Employee ID and the last four digits of your CNIC. A secure employee session is created before the complaint is submitted."
    >
      <div className="public-flow-card__heading">
        <span>Step 1 of 2</span>
        <h2>{employee === null ? 'Verify your identity' : 'Review the matched employee'}</h2>
        <p>{employee === null
          ? 'Your Employee ID may be entered without leading zeroes; it is normalized to eight digits automatically.'
          : 'Confirm the masked employee record before continuing to the complaint form.'}</p>
      </div>
      {employee === null ? (
        <form className="public-flow-form employee-complaint-verification" onSubmit={(event) => void verify(event)}>
          <label>
            <span>Employee ID</span>
            <input name="employeeId" required inputMode="numeric" pattern="[0-9]{1,8}" maxLength={8} placeholder="Enter up to 8 digits" autoComplete="username" />
          </label>
          <PasswordInput
            name="cnicLastFour"
            label="Last 4 digits of CNIC"
            autoComplete="current-password"
            inputMode="numeric"
            pattern="[0-9]{4}"
            minLength={4}
            maxLength={4}
            placeholder="Enter 4 digits"
          />
          {error !== null && <p className="auth-message auth-message--error">{error}</p>}
          <button className="button button--primary public-flow-form__submit" type="submit" disabled={busy}>{busy ? 'Verifying...' : 'Verify employee'}</button>
        </form>
      ) : (
        <div className="verification-preview employee-preview">
          <dl>
            <div><dt>Employee ID</dt><dd>{employee.employeeId}</dd></div>
            <div><dt>Name</dt><dd>{employee.name}</dd></div>
            <div><dt>Department</dt><dd>{employee.department}</dd></div>
            <div><dt>Office</dt><dd>{employee.office}</dd></div>
          </dl>
          {error !== null && <p className="auth-message auth-message--error">{error}</p>}
          <div className="verification-preview__actions">
            <button className="button" type="button" onClick={() => { setEmployee(null); setCredentials(null); }}>Back</button>
            <button className="button button--primary" type="button" disabled={busy} onClick={() => void continueToComplaint()}>{busy ? 'Signing in...' : 'Continue to complaint'}</button>
          </div>
        </div>
      )}
    </PublicFlowLayout>
  );
}
