import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { PasswordInput } from '../components/PasswordInput';
import { OperationalLocationFields } from '../components/OperationalLocationFields';
import { getApiErrorMessage, locationCatalogRequest } from '../lib/auth-api';
import {
  createEmployeeRequest,
  createStaffRequest,
  deleteUserRequest,
  resetPasswordRequest,
  updateUserRequest,
  usersRequest,
} from '../lib/users-api';
import {
  CNIC_LENGTH,
  CNIC_PATTERN,
  PHONE_NUMBER_LENGTH,
  PHONE_NUMBER_PATTERN,
} from '../lib/identity-format';
import type { LocationCatalogOptions, UserRole } from '../types/auth';
import type { PaginationMeta, UserProfile } from '../types/users';

function formValue(data: FormData, name: string): string {
  const entry = data.get(name);
  return typeof entry === 'string' ? entry.trim() : '';
}

const emptyMeta: PaginationMeta = { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 };

export function UserManagementPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [meta, setMeta] = useState(emptyMeta);
  const [options, setOptions] = useState<LocationCatalogOptions | null>(null);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [filters, setFilters] = useState({ search: '', role: '', status: '' });
  const [showCreate, setShowCreate] = useState(false);
  const [createRole, setCreateRole] = useState<'employee' | 'technician' | 'supervisor' | 'administrator'>('employee');
  const [resetTarget, setResetTarget] = useState<UserProfile | null>(null);
  const [circleId, setCircleId] = useState('');
  const [divisionId, setDivisionId] = useState('');
  const [subdivisionId, setSubdivisionId] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadUsers = useCallback(async (page = 1) => {
    setError(null);
    try {
      const result = await usersRequest({ params: {
        page, pageSize: 20, ...(filters.search === '' ? {} : { search: filters.search }),
        ...(filters.role === '' ? {} : { role: filters.role }),
        ...(filters.status === '' ? {} : { status: filters.status }),
      } });
      setUsers(result.items);
      setMeta(result.meta);
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    }
  }, [filters]);

  useEffect(() => { void loadUsers(); }, [loadUsers]);
  useEffect(() => {
    void locationCatalogRequest().then((result) => {
      setOptions(result);
      const firstCircle = result.circles[0];
      const firstDivision = firstCircle?.divisions[0];
      setCircleId(String(firstCircle?.id ?? ''));
      setDivisionId(String(firstDivision?.id ?? ''));
      setSubdivisionId(String(firstDivision?.subdivisions[0]?.id ?? ''));
    }).catch((caught: unknown) => {
      setError(getApiErrorMessage(caught));
    });
  }, []);

  const createAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null); setMessage(null); setBusyId(0);
    const data = new FormData(event.currentTarget);
    try {
      const common = {
        displayName: formValue(data, 'displayName'), email: formValue(data, 'email'),
        phone: formValue(data, 'phone'), cnic: formValue(data, 'cnic'),
        departmentId: Number(formValue(data, 'departmentId')) || undefined,
        designation: formValue(data, 'designation'), circleId: Number(formValue(data, 'circleId')),
        divisionId: Number(formValue(data, 'divisionId')), subdivisionId: Number(formValue(data, 'subdivisionId')),
      };
      if (createRole === 'employee') {
        await createEmployeeRequest({ ...common, employeeId: formValue(data, 'employeeId') });
      } else {
        await createStaffRequest({ ...common, role: createRole,
          username: formValue(data, 'username'), password: formValue(data, 'password') });
      }
      event.currentTarget.reset();
      setShowCreate(false);
      setMessage(createRole === 'employee' ? 'Employee account created.' : 'Staff account created.');
      await loadUsers();
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setBusyId(null);
    }
  };

  const activateAccount = async (profile: UserProfile) => {
    setBusyId(profile.id); setError(null); setMessage(null);
    try {
      await updateUserRequest(profile.id, {
        displayName: profile.displayName,
        email: profile.email ?? '',
        phone: profile.phone ?? '',
        cnic: profile.cnic ?? undefined,
        status: 'active',
        statusReason: '',
        ...(['technician', 'supervisor', 'administrator'].includes(profile.role) ? {
          role: profile.role,
          departmentId: profile.departmentId ?? undefined,
          designation: profile.designation,
          circleId: profile.circleId,
          divisionId: profile.divisionId,
          subdivisionId: profile.subdivisionId,
        } : {}),
      });
      setMessage(`${profile.displayName} is now active.`);
      await loadUsers(meta.page);
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setBusyId(null);
    }
  };

  const suspendStaffAccount = async (profile: UserProfile) => {
    const reason = window.prompt(`Provide the specific reason for suspending ${profile.displayName}:`);
    if (reason === null) return;
    if (reason.trim().length < 10) {
      setError('The suspension reason must contain at least 10 characters.');
      return;
    }
    setBusyId(profile.id); setError(null); setMessage(null);
    try {
      await updateUserRequest(profile.id, {
        displayName: profile.displayName,
        email: profile.email ?? '',
        phone: profile.phone ?? '',
        cnic: profile.cnic ?? undefined,
        status: 'suspended',
        statusReason: reason.trim(),
        role: profile.role,
        departmentId: profile.departmentId ?? undefined,
        designation: profile.designation,
        circleId: profile.circleId,
        divisionId: profile.divisionId,
        subdivisionId: profile.subdivisionId,
      });
      setMessage(`${profile.displayName} is now suspended.`);
      await loadUsers(meta.page);
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setBusyId(null);
    }
  };

  const resetPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (resetTarget === null) return;
    const profile = resetTarget;
    const password = formValue(new FormData(event.currentTarget), 'password');
    if (!window.confirm(`Reset the password for ${profile.displayName} and revoke existing sessions?`)) return;
    setBusyId(profile.id); setError(null); setMessage(null);
    try {
      await resetPasswordRequest(profile.id, password);
      setMessage(`Password reset for ${profile.displayName}; their sessions were revoked.`);
      setResetTarget(null);
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setBusyId(null);
    }
  };

  const deleteAccount = async (profile: UserProfile) => {
    if (!window.confirm(`Soft-delete ${profile.displayName}? Their historical records remain available.`)) return;
    setBusyId(profile.id); setError(null); setMessage(null);
    try {
      await deleteUserRequest(profile.id);
      setMessage('Account deleted.');
      await loadUsers(meta.page);
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <main className="workspace-page">
      <div className="workspace-page__heading">
        <div><p>Administration / identity</p><h1>User accounts</h1></div>
        <button className="button button--primary" type="button" onClick={() => setShowCreate((shown) => !shown)}>{showCreate ? 'Close form' : 'Add account'}</button>
      </div>
      {(message !== null || error !== null) && <p className={error === null ? 'page-message is-success' : 'page-message is-error'}>{error ?? message}</p>}

      {showCreate && (
        <form className="panel form-grid admin-create" onSubmit={(event) => void createAccount(event)}>
          <div className="panel__heading form-grid__wide"><div><span>New identity</span><h2>Create employee or staff account</h2></div></div>
          <label><span>Role</span><select name="role" required value={createRole} onChange={(event) => setCreateRole(event.target.value as typeof createRole)}><option value="employee">Employee</option><option value="technician">Technician</option><option value="supervisor">Supervisor</option><option value="administrator">Administrator</option></select></label>
          {createRole === 'employee'
            ? <label><span>Employee ID</span><input name="employeeId" required inputMode="numeric" pattern="[0-9]{1,8}" maxLength={8} placeholder="Up to 8 digits" /></label>
            : <label><span>Username</span><input name="username" required /></label>}
          <label><span>Full name</span><input name="displayName" required /></label>
          <label><span>Email</span><input name="email" type="email" /></label>
          <label>
            <span>Phone <small>11 digits, starts with 03</small></span>
            <input
              name="phone"
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
          {createRole !== 'employee' && <PasswordInput name="password" label="Temporary password" autoComplete="new-password" minLength={10} hint="10+ characters with uppercase, lowercase, number, and symbol." />}
          <label className="form-grid__wide"><span>Department</span><select name="departmentId" required={createRole === 'employee'}><option value="">{createRole === 'employee' ? 'Select department' : 'No department'}</option>{options?.departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>
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
          <button className="button button--primary form-grid__wide" type="submit" disabled={busyId === 0}>Create account</button>
        </form>
      )}

      {resetTarget !== null && (
        <form className="panel form-grid admin-create" onSubmit={(event) => void resetPassword(event)}>
          <div className="panel__heading form-grid__wide">
            <div>
              <span>Security action</span>
              <h2>Reset password for {resetTarget.displayName}</h2>
              <p>Choose a unique temporary password and deliver it through an approved secure channel.</p>
            </div>
            <button className="button button--secondary" type="button" onClick={() => setResetTarget(null)}>Cancel</button>
          </div>
          <PasswordInput
            className="form-grid__wide"
            name="password"
            label="New temporary password"
            autoComplete="new-password"
            minLength={10}
            hint="10+ characters with uppercase, lowercase, number, and symbol."
          />
          <button className="button button--primary form-grid__wide" type="submit" disabled={busyId === resetTarget.id}>
            Reset password and revoke sessions
          </button>
        </form>
      )}

      <section className="panel user-directory">
        <form className="directory-filters" onSubmit={(event) => {
          event.preventDefault();
          setFilters({ search, role, status });
        }}>
          <label><span>Search</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, username, email, CNIC, or employee ID" /></label>
          <label><span>Role</span><select value={role} onChange={(event) => setRole(event.target.value)}><option value="">All roles</option>{(['employee', 'technician', 'supervisor', 'administrator'] as UserRole[]).map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="inactive">Inactive</option></select></label>
          <button className="button button--secondary" type="submit">Apply filters</button>
        </form>
        <div className="directory-summary"><strong>{meta.totalItems}</strong><span>accounts found</span></div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>User</th><th>Identity</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>{users.map((profile) => (
              <tr key={profile.id}>
                <td><strong>{profile.displayName}</strong><span>{profile.email ?? 'No email'}</span></td>
                <td><code>{profile.username ?? profile.referenceNumber ?? profile.employeeId ?? `#${profile.id}`}</code></td>
                <td>{profile.role}</td>
                <td><span className={`status-pill status-pill--${profile.status}`}>{profile.status}</span></td>
                <td><div className="row-actions">
                  {profile.status === 'active' && profile.role === 'employee' && <Link to={`/app/account-governance?search=${encodeURIComponent(profile.employeeId ?? profile.displayName)}`}>Suspend with details</Link>}
                  {profile.status === 'suspended' && profile.role === 'employee' && <Link to={`/app/account-governance?search=${encodeURIComponent(profile.employeeId ?? profile.displayName)}`}>Review suspension</Link>}
                  {profile.status === 'active' && profile.role !== 'employee' && <button type="button" disabled={busyId === profile.id} onClick={() => void suspendStaffAccount(profile)}>Suspend staff</button>}
                  {profile.status !== 'active' && profile.role !== 'employee' && <button type="button" disabled={busyId === profile.id} onClick={() => void activateAccount(profile)}>Activate</button>}
                  {profile.role !== 'employee' && <button type="button" disabled={busyId === profile.id} onClick={() => setResetTarget(profile)}>Reset password</button>}
                  <button className="is-danger" type="button" disabled={busyId === profile.id} onClick={() => void deleteAccount(profile)}>Delete</button>
                </div></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <div className="pagination"><button type="button" disabled={meta.page <= 1} onClick={() => void loadUsers(meta.page - 1)}>Previous</button><span>Page {meta.page} of {Math.max(1, meta.totalPages)}</span><button type="button" disabled={meta.page >= meta.totalPages} onClick={() => void loadUsers(meta.page + 1)}>Next</button></div>
      </section>
    </main>
  );
}
