import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { PasswordInput } from '../components/PasswordInput';
import { getApiErrorMessage, registrationOptionsRequest } from '../lib/auth-api';
import {
  createStaffRequest,
  deleteUserRequest,
  resetPasswordRequest,
  updateUserRequest,
  usersRequest,
} from '../lib/users-api';
import type { RegistrationOptions, UserRole } from '../types/auth';
import type { PaginationMeta, UserProfile } from '../types/users';

function formValue(data: FormData, name: string): string {
  const entry = data.get(name);
  return typeof entry === 'string' ? entry.trim() : '';
}

const emptyMeta: PaginationMeta = { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 };

export function UserManagementPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [meta, setMeta] = useState(emptyMeta);
  const [options, setOptions] = useState<RegistrationOptions | null>(null);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [filters, setFilters] = useState({ search: '', role: '', status: '' });
  const [showCreate, setShowCreate] = useState(false);
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
    void registrationOptionsRequest().then(setOptions).catch((caught: unknown) => {
      setError(getApiErrorMessage(caught));
    });
  }, []);

  const createAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null); setMessage(null); setBusyId(0);
    const data = new FormData(event.currentTarget);
    try {
      await createStaffRequest({
        role: formValue(data, 'role'),
        username: formValue(data, 'username'),
        displayName: formValue(data, 'displayName'),
        email: formValue(data, 'email'),
        phone: formValue(data, 'phone'),
        password: formValue(data, 'password'),
        departmentId: Number(formValue(data, 'departmentId')) || undefined,
        designation: formValue(data, 'designation'),
        workLocation: formValue(data, 'workLocation'),
      });
      event.currentTarget.reset();
      setShowCreate(false);
      setMessage('Staff account created.');
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
        status: 'active',
        statusReason: '',
        ...(['technician', 'supervisor', 'administrator'].includes(profile.role) ? {
          role: profile.role,
          departmentId: profile.departmentId ?? undefined,
          designation: profile.designation,
          workLocation: profile.workLocation,
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
        status: 'suspended',
        statusReason: reason.trim(),
        role: profile.role,
        departmentId: profile.departmentId ?? undefined,
        designation: profile.designation,
        workLocation: profile.workLocation,
      });
      setMessage(`${profile.displayName} is now suspended.`);
      await loadUsers(meta.page);
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setBusyId(null);
    }
  };

  const resetPassword = async (profile: UserProfile) => {
    if (!window.confirm(`Reset ${profile.displayName}'s password to the documented demo password?`)) return;
    setBusyId(profile.id); setError(null); setMessage(null);
    try {
      await resetPasswordRequest(profile.id, 'Demo@12345');
      setMessage(`Password reset for ${profile.displayName}; their sessions were revoked.`);
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
        <button className="button button--primary" type="button" onClick={() => setShowCreate((shown) => !shown)}>{showCreate ? 'Close form' : 'Add staff account'}</button>
      </div>
      {(message !== null || error !== null) && <p className={error === null ? 'page-message is-success' : 'page-message is-error'}>{error ?? message}</p>}

      {showCreate && (
        <form className="panel form-grid admin-create" onSubmit={(event) => void createAccount(event)}>
          <div className="panel__heading form-grid__wide"><div><span>New identity</span><h2>Create staff account</h2></div></div>
          <label><span>Role</span><select name="role" required><option value="technician">Technician</option><option value="supervisor">Supervisor</option><option value="administrator">Administrator</option></select></label>
          <label><span>Username</span><input name="username" required /></label>
          <label><span>Full name</span><input name="displayName" required /></label>
          <label><span>Email</span><input name="email" type="email" /></label>
          <label><span>Phone</span><input name="phone" /></label>
          <PasswordInput name="password" label="Temporary password" autoComplete="new-password" defaultValue="Demo@12345" minLength={10} />
          <label className="form-grid__wide"><span>Department</span><select name="departmentId"><option value="">No department</option>{options?.departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>
          <label><span>Designation</span><input name="designation" required /></label>
          <label><span>Work location</span><input name="workLocation" required /></label>
          <button className="button button--primary form-grid__wide" type="submit" disabled={busyId === 0}>Create account</button>
        </form>
      )}

      <section className="panel user-directory">
        <form className="directory-filters" onSubmit={(event) => {
          event.preventDefault();
          setFilters({ search, role, status });
        }}>
          <label><span>Search</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, username, email, reference or employee ID" /></label>
          <label><span>Role</span><select value={role} onChange={(event) => setRole(event.target.value)}><option value="">All roles</option>{(['consumer', 'employee', 'technician', 'supervisor', 'administrator'] as UserRole[]).map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
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
                  {profile.status === 'active' && (profile.role === 'consumer' || profile.role === 'employee') && <Link to={`/app/account-governance?search=${encodeURIComponent(profile.referenceNumber ?? profile.employeeId ?? profile.displayName)}`}>Suspend with details</Link>}
                  {profile.status === 'suspended' && (profile.role === 'consumer' || profile.role === 'employee') && <Link to={`/app/account-governance?search=${encodeURIComponent(profile.referenceNumber ?? profile.employeeId ?? profile.displayName)}`}>Review suspension</Link>}
                  {profile.status === 'active' && !['consumer', 'employee'].includes(profile.role) && <button type="button" disabled={busyId === profile.id} onClick={() => void suspendStaffAccount(profile)}>Suspend staff</button>}
                  {profile.status !== 'active' && !['consumer', 'employee'].includes(profile.role) && <button type="button" disabled={busyId === profile.id} onClick={() => void activateAccount(profile)}>Activate</button>}
                  <button type="button" disabled={busyId === profile.id} onClick={() => void resetPassword(profile)}>Reset password</button>
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
