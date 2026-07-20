import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';

import { useAuth } from '../hooks/useAuth';
import { getApiErrorMessage, registrationOptionsRequest } from '../lib/auth-api';
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
        setCircleId(String(nextProfile.circleId ?? nextOptions.circles[0]?.id ?? ''));
      })
      .catch((caught: unknown) => { if (active) setError(getApiErrorMessage(caught)); });
    return () => { active = false; };
  }, []);

  const cities = useMemo(
    () => options?.circles.find((circle) => String(circle.id) === circleId)?.cities ?? [],
    [circleId, options],
  );

  const submitProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true); setError(null); setMessage(null);
    const data = new FormData(event.currentTarget);
    try {
      const common = {
        displayName: value(data, 'displayName'), email: value(data, 'email'), phone: value(data, 'phone'),
      };
      const input = profile?.role === 'consumer'
        ? { ...common, address: value(data, 'address'), circleId: Number(value(data, 'circleId')),
            cityId: Number(value(data, 'cityId')) }
        : { ...common, departmentId: Number(value(data, 'departmentId')) || undefined,
            designation: value(data, 'designation'), workLocation: value(data, 'workLocation') };
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
          <label><span>Phone</span><input name="phone" defaultValue={profile.phone ?? ''} /></label>
          {isConsumer ? (
            <>
              <label><span>Reference number</span><input value={profile.referenceNumber} disabled /></label>
              <label className="form-grid__wide"><span>Address</span><input name="address" defaultValue={profile.address} required /></label>
              <label><span>Circle</span><select name="circleId" value={circleId} onChange={(event) => setCircleId(event.target.value)}>{options?.circles.map((circle) => <option key={circle.id} value={circle.id}>{circle.name}</option>)}</select></label>
              <label><span>City</span><select name="cityId" defaultValue={profile.cityId}>{cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}</select></label>
            </>
          ) : (
            <>
              {profile.employeeId !== undefined && <label><span>Employee ID</span><input value={profile.employeeId} disabled /></label>}
              {profile.username !== null && <label><span>Username</span><input value={profile.username} disabled /></label>}
              <label className="form-grid__wide"><span>Department</span><select name="departmentId" defaultValue={profile.departmentId ?? ''}><option value="">No department</option>{options?.departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>
              <label><span>Designation</span><input name="designation" defaultValue={profile.designation} required /></label>
              <label><span>Work location</span><input name="workLocation" defaultValue={profile.workLocation} required /></label>
            </>
          )}
          <button className="button button--primary form-grid__wide" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save profile'}</button>
        </form>

        <form className="panel form-grid form-grid--single" onSubmit={(event) => void submitPassword(event)}>
          <div className="panel__heading"><div><span>Security</span><h2>Change password</h2></div></div>
          <p className="panel__copy">Changing your password revokes every active session, including this one.</p>
          <label><span>Current password</span><input name="currentPassword" type="password" required autoComplete="current-password" /></label>
          <label><span>New password</span><input name="newPassword" type="password" required minLength={10} autoComplete="new-password" /></label>
          <label><span>Confirm new password</span><input name="confirmPassword" type="password" required minLength={10} autoComplete="new-password" /></label>
          <button className="button button--danger" type="submit" disabled={saving}>Change password</button>
        </form>
      </div>
    </main>
  );
}
