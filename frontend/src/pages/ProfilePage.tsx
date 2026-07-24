import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';

import { PasswordInput } from '../components/PasswordInput';
import { OperationalLocationFields } from '../components/OperationalLocationFields';
import { useAuth } from '../hooks/useAuth';
import { getApiErrorMessage, registrationOptionsRequest } from '../lib/auth-api';
import {
  CNIC_LENGTH,
  CNIC_PATTERN,
  PHONE_NUMBER_LENGTH,
  PHONE_NUMBER_PATTERN,
} from '../lib/identity-format';
import { changePasswordRequest, profileRequest, updateProfileRequest } from '../lib/users-api';
import type { RegistrationOptions } from '../types/auth';
import type { UserProfile } from '../types/users';

function value(data: FormData, name: string): string {
  const entry = data.get(name);
  return typeof entry === 'string' ? entry.trim() : '';
}

export function ProfilePage() {
  const { logout, updateDisplayName } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [options, setOptions] = useState<RegistrationOptions | null>(null);
  const [circleId, setCircleId] = useState('');
  const [divisionId, setDivisionId] = useState('');
  const [subdivisionId, setSubdivisionId] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    void Promise.all([profileRequest(), registrationOptionsRequest()])
      .then(([nextProfile, nextOptions]) => {
        if (!active) return;
        setProfile(nextProfile);
        setOptions(nextOptions);
        const consumerFallback = nextProfile.role === 'consumer';
        setCircleId(String(
          nextProfile.circleId ?? (consumerFallback ? nextOptions.circles[0]?.id : '') ?? '',
        ));
        setDivisionId(String(
          nextProfile.divisionId
          ?? (consumerFallback ? nextOptions.circles[0]?.divisions[0]?.id : '')
          ?? '',
        ));
        setSubdivisionId(String(
          nextProfile.subdivisionId
          ?? (consumerFallback ? nextOptions.circles[0]?.divisions[0]?.subdivisions[0]?.id : '')
          ?? '',
        ));
      })
      .catch((caught: unknown) => { if (active) setError(getApiErrorMessage(caught)); });
    return () => { active = false; };
  }, []);

  const divisions = useMemo(
    () => options?.circles.find((circle) => String(circle.id) === circleId)?.divisions ?? [],
    [circleId, options],
  );
  const subdivisions = useMemo(
    () => divisions.find((division) => String(division.id) === divisionId)?.subdivisions ?? [],
    [divisionId, divisions],
  );

  const submitProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true); setError(null); setMessage(null);
    const data = new FormData(event.currentTarget);
    try {
      const common = {
        displayName: value(data, 'displayName'), email: value(data, 'email'),
        phone: value(data, 'phone'), cnic: value(data, 'cnic'),
      };
      const input = profile?.role === 'consumer'
        ? { ...common, address: value(data, 'address'), circleId: Number(value(data, 'circleId')),
            divisionId: Number(value(data, 'divisionId')),
            subdivisionId: Number(value(data, 'subdivisionId')) }
        : { ...common, departmentId: Number(value(data, 'departmentId')) || undefined,
            designation: value(data, 'designation'),
            circleId: Number(value(data, 'circleId')),
            divisionId: Number(value(data, 'divisionId')),
            subdivisionId: Number(value(data, 'subdivisionId')) };
      const updated = await updateProfileRequest(input);
      setProfile(updated); updateDisplayName(updated.displayName); setMessage('Profile saved successfully.');
    } catch (caught) { setError(getApiErrorMessage(caught)); }
    finally { setSaving(false); }
  };

  const submitPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSaving(true); setError(null); setMessage(null);
    const data = new FormData(event.currentTarget);
    const next = value(data, 'newPassword');
    if (next !== value(data, 'confirmPassword')) {
      setError('The new passwords do not match.'); setSaving(false); return;
    }
    try {
      await changePasswordRequest({ currentPassword: value(data, 'currentPassword'), newPassword: next });
      await logout();
    } catch (caught) { setError(getApiErrorMessage(caught)); setSaving(false); }
  };

  if (profile === null) return <div className="workspace-loading">{error ?? 'Loading your profile...'}</div>;
  const isConsumer = profile.role === 'consumer';

  return (
    <main className="workspace-page">
      <div className="workspace-page__heading"><div><p>Account settings</p><h1>My profile</h1></div><span className={`status-pill status-pill--${profile.status}`}>{profile.status}</span></div>
      {(message !== null || error !== null) && <p className={error === null ? 'page-message is-success' : 'page-message is-error'}>{error ?? message}</p>}
      <div className="settings-grid">
        <form className="panel form-grid" onSubmit={(event) => void submitProfile(event)}>
          <div className="panel__heading"><div><span>Personal details</span><h2>Profile information</h2></div><small>{profile.role}</small></div>
          <label><span>Full name</span><input name="displayName" defaultValue={profile.displayName} required /></label>
          <label><span>Email</span><input name="email" type="email" defaultValue={profile.email ?? ''} /></label>
          <label>
            <span>Phone <small>11 digits, starts with 03</small></span>
            <input
              name="phone"
              defaultValue={profile.phone ?? ''}
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
              defaultValue={profile.cnic ?? ''}
              autoComplete="off"
              inputMode="numeric"
              pattern={CNIC_PATTERN}
              minLength={CNIC_LENGTH}
              maxLength={CNIC_LENGTH}
              placeholder="3520212345671"
              title="Enter exactly 13 digits without dashes"
            />
          </label>
          {isConsumer ? (
            <>
              <label><span>Reference number</span><input value={profile.referenceNumber} disabled /></label>
              <label className="form-grid__wide"><span>Address</span><input name="address" defaultValue={profile.address} required /></label>
              <label><span>Circle</span><select name="circleId" value={circleId} onChange={(event) => {
                const nextCircleId = event.target.value;
                const nextDivisions = options?.circles.find((circle) => String(circle.id) === nextCircleId)?.divisions ?? [];
                const nextDivision = nextDivisions[0];
                setCircleId(nextCircleId);
                setDivisionId(String(nextDivision?.id ?? ''));
                setSubdivisionId(String(nextDivision?.subdivisions[0]?.id ?? ''));
              }}>{options?.circles.map((circle) => <option key={circle.id} value={circle.id}>{circle.name}</option>)}</select></label>
              <label><span>Division</span><select name="divisionId" value={divisionId} onChange={(event) => {
                const nextDivisionId = event.target.value;
                const nextSubdivision = divisions.find((division) => String(division.id) === nextDivisionId)?.subdivisions[0];
                setDivisionId(nextDivisionId);
                setSubdivisionId(String(nextSubdivision?.id ?? ''));
              }}>{divisions.map((division) => <option key={division.id} value={division.id}>{division.name}</option>)}</select></label>
              <label><span>Sub-division</span><select name="subdivisionId" value={subdivisionId} onChange={(event) => setSubdivisionId(event.target.value)}>{subdivisions.map((subdivision) => <option key={subdivision.id} value={subdivision.id}>{subdivision.name}</option>)}</select></label>
            </>
          ) : (
            <>
              {profile.employeeId !== undefined && <label><span>Employee ID</span><input value={profile.employeeId} disabled /></label>}
              {profile.username !== null && <label><span>Username</span><input value={profile.username} disabled /></label>}
              <label className="form-grid__wide"><span>Department</span><select name="departmentId" defaultValue={profile.departmentId ?? ''}><option value="">No department</option>{options?.departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>
              <label><span>Designation</span><input name="designation" defaultValue={profile.designation} required /></label>
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
          <button className="button button--primary form-grid__wide" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save profile'}</button>
        </form>

        <form className="panel form-grid form-grid--single" onSubmit={(event) => void submitPassword(event)}>
          <div className="panel__heading"><div><span>Security</span><h2>Change password</h2></div></div>
          <p className="panel__copy">Changing your password revokes every active session, including this one.</p>
          <PasswordInput name="currentPassword" label="Current password" autoComplete="current-password" />
          <PasswordInput name="newPassword" label="New password" autoComplete="new-password" minLength={10} />
          <PasswordInput name="confirmPassword" label="Confirm new password" autoComplete="new-password" minLength={10} />
          <button className="button button--danger" type="submit" disabled={saving}>Change password</button>
        </form>
      </div>
    </main>
  );
}
