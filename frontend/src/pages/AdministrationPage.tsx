import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';

import { auditRequest, replaceScopesRequest, scopesRequest } from '../lib/administration-api';
import type { AuditItem, StaffScope } from '../lib/administration-api';
import { getApiErrorMessage } from '../lib/auth-api';
import { catalogRequest } from '../lib/master-data-api';
import { usersRequest } from '../lib/users-api';
import type { MasterCatalog } from '../types/master-data';
import type { PaginationMeta, UserProfile } from '../types/users';

type ScopeDomain = 'consumer' | 'employee';

interface ScopeDraft {
  key: number;
  domain: ScopeDomain;
  departmentId: string;
  categoryId: string;
  circleId: string;
  divisionId: string;
  subdivisionId: string;
}

let nextScopeKey = 1;

function emptyScopeDraft(domain: ScopeDomain = 'consumer'): ScopeDraft {
  return { key: nextScopeKey++, domain, departmentId: '', categoryId: '', circleId: '', divisionId: '', subdivisionId: '' };
}

function draftFromScope(scope: StaffScope): ScopeDraft {
  return {
    key: nextScopeKey++,
    domain: scope.domain,
    departmentId: scope.departmentId === null ? '' : String(scope.departmentId),
    categoryId: scope.categoryId === null ? '' : String(scope.categoryId),
    circleId: scope.circleId === null ? '' : String(scope.circleId),
    divisionId: scope.divisionId === null ? '' : String(scope.divisionId),
    subdivisionId: scope.subdivisionId === null ? '' : String(scope.subdivisionId),
  };
}

function formValue(data: FormData, name: string): string {
  const entry = data.get(name);
  return typeof entry === 'string' ? entry.trim() : '';
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-PK', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function formatJson(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value) as unknown, null, 2);
    } catch {
      return value;
    }
  }
  const serialized = JSON.stringify(value, null, 2);
  return serialized === undefined ? 'Not serializable' : serialized;
}

function hasRecordedValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return false;
    try {
      return hasRecordedValue(JSON.parse(trimmed) as unknown);
    } catch {
      return true;
    }
  }
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

function scopeDescription(scope: StaffScope): string {
  const boundaries = [
    scope.departmentName === null ? null : scope.departmentName,
    scope.categoryName === null ? null : scope.categoryName,
    scope.circleName === null ? null : scope.circleName,
    scope.divisionName === null ? null : scope.divisionName,
    scope.subdivisionName === null ? null : scope.subdivisionName,
  ].filter((value): value is string => value !== null);
  return boundaries.length === 0 ? `All ${scope.domain} tickets` : boundaries.join(' · ');
}

function actionLabel(action: string): string {
  return action
    .split('.')
    .map((part) => part.replaceAll('_', ' '))
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' / ');
}

export function AdministrationPage() {
  const [audit, setAudit] = useState<AuditItem[]>([]);
  const [auditMeta, setAuditMeta] = useState<PaginationMeta>({ page: 1, pageSize: 30, totalItems: 0, totalPages: 1 });
  const [auditQuery, setAuditQuery] = useState({ search: '', result: '' });
  const [auditPage, setAuditPage] = useState(1);
  const [expandedAuditId, setExpandedAuditId] = useState<number | null>(null);
  const [scopes, setScopes] = useState<StaffScope[]>([]);
  const [staff, setStaff] = useState<UserProfile[]>([]);
  const [catalog, setCatalog] = useState<MasterCatalog | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [scopeDrafts, setScopeDrafts] = useState<ScopeDraft[]>(() => [emptyScopeDraft()]);
  const [scopeSearch, setScopeSearch] = useState('');
  const [scopeCoverage, setScopeCoverage] = useState<'all' | 'configured' | 'missing'>('all');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadOperations = useCallback(async () => {
    try {
      const [scopeItems, userResult, catalogResult] = await Promise.all([
        scopesRequest(),
        usersRequest({ params: { pageSize: 100 } }),
        catalogRequest(),
      ]);
      setScopes(scopeItems);
      setStaff(userResult.items.filter((item) => item.role === 'technician' || item.role === 'supervisor'));
      setCatalog(catalogResult);
      setError(null);
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    }
  }, []);

  const loadAudit = useCallback(async () => {
    try {
      const result = await auditRequest(auditPage, auditQuery.search, auditQuery.result);
      setAudit(result.items);
      setAuditMeta(result.meta);
      setExpandedAuditId(null);
      setError(null);
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    }
  }, [auditPage, auditQuery]);

  useEffect(() => { void loadOperations(); }, [loadOperations]);
  useEffect(() => { void loadAudit(); }, [loadAudit]);

  const staffGroups = useMemo(() => staff.map((member) => ({
    member,
    rules: scopes.filter((scope) => scope.userId === member.id),
  })), [scopes, staff]);

  const visibleStaffGroups = useMemo(() => {
    const normalizedSearch = scopeSearch.trim().toLowerCase();
    return staffGroups.filter(({ member, rules }) => {
      if (scopeCoverage === 'configured' && rules.length === 0) return false;
      if (scopeCoverage === 'missing' && rules.length > 0) return false;
      return normalizedSearch === ''
        || member.displayName.toLowerCase().includes(normalizedSearch)
        || member.role.toLowerCase().includes(normalizedSearch)
        || rules.some((scope) => scopeDescription(scope).toLowerCase().includes(normalizedSearch));
    });
  }, [scopeCoverage, scopeSearch, staffGroups]);

  const configuredStaff = staffGroups.filter(({ rules }) => rules.length > 0).length;
  const broadRules = scopes.filter((scope) => scope.departmentId === null && scope.categoryId === null
    && scope.circleId === null && scope.divisionId === null && scope.subdivisionId === null).length;
  const targetedRules = scopes.length - broadRules;

  const editStaffBoundaries = (userId: number) => {
    const existing = scopes.filter((scope) => scope.userId === userId);
    setSelectedStaffId(String(userId));
    setScopeDrafts(existing.length === 0 ? [emptyScopeDraft()] : existing.map(draftFromScope));
    setMessage(null);
    window.requestAnimationFrame(() => document.querySelector('#scope-builder')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const updateScopeDraft = (key: number, updates: Partial<ScopeDraft>) => {
    setScopeDrafts((current) => current.map((draft) => {
      if (draft.key !== key) return draft;
      if (updates.domain !== undefined && updates.domain !== draft.domain) {
        return { ...draft, ...updates, departmentId: '', categoryId: '', circleId: '', divisionId: '', subdivisionId: '' };
      }
      return { ...draft, ...updates };
    }));
  };

  const replaceScope = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selectedStaffId === '') {
      setError('Select a staff member before saving access rules.');
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await replaceScopesRequest(Number(selectedStaffId), scopeDrafts.map((draft) => ({
        domain: draft.domain,
        ...(draft.departmentId === '' ? {} : { departmentId: Number(draft.departmentId) }),
        ...(draft.categoryId === '' ? {} : { categoryId: Number(draft.categoryId) }),
        ...(draft.circleId === '' ? {} : { circleId: Number(draft.circleId) }),
        ...(draft.divisionId === '' ? {} : { divisionId: Number(draft.divisionId) }),
        ...(draft.subdivisionId === '' ? {} : { subdivisionId: Number(draft.subdivisionId) }),
      })));
      setMessage(`${scopeDrafts.length} access ${scopeDrafts.length === 1 ? 'rule' : 'rules'} saved.`);
      await Promise.all([loadOperations(), loadAudit()]);
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="workspace-page operations-admin-page">
      <div className="workspace-page__heading">
        <div><p>Administration / governance</p><h1>Operations controls</h1></div>
      </div>

      {(error !== null || message !== null) && (
        <p className={error === null ? 'page-message is-success' : 'page-message is-error'}>{error ?? message}</p>
      )}

      <form className="panel scope-builder" id="scope-builder" onSubmit={(event) => void replaceScope(event)}>
        <div className="panel__heading">
          <div><span>Routing coverage</span><h2>Configure staff boundaries</h2></div>
          <small>{selectedStaffId === '' ? 'Select staff' : `${scopeDrafts.length} ${scopeDrafts.length === 1 ? 'rule' : 'rules'}`}</small>
        </div>
        <p className="panel__copy scope-builder__intro">
          Boundaries control supervisor queue visibility and which technicians are eligible for matching ticket assignments. Add multiple rules when one person covers more than one area.
        </p>

        <label className="scope-builder__staff">
          <span>Staff member</span>
          <select value={selectedStaffId} onChange={(event) => {
            const value = event.target.value;
            if (value === '') {
              setSelectedStaffId('');
              setScopeDrafts([emptyScopeDraft()]);
              return;
            }
            editStaffBoundaries(Number(value));
          }} required>
            <option value="">Select a technician or supervisor</option>
            {staff.map((item) => <option key={item.id} value={item.id}>{item.displayName} · {item.role}</option>)}
          </select>
        </label>

        <div className="scope-builder__rules">
          {scopeDrafts.map((draft, index) => {
            const categories = catalog?.categories.filter((item) => item.domain === draft.domain) ?? [];
            const divisions = catalog?.circles.find((item) => String(item.id) === draft.circleId)?.divisions ?? [];
            const subdivisions = divisions.find((item) => String(item.id) === draft.divisionId)?.subdivisions ?? [];
            return (
              <fieldset className="scope-rule-editor" key={draft.key}>
                <legend>Rule {index + 1}</legend>
                <div className="scope-rule-editor__heading">
                  <p>{draft.domain === 'consumer' ? 'Consumer complaint coverage' : 'Employee support coverage'}</p>
                  <button type="button" onClick={() => setScopeDrafts((current) => current.length === 1
                    ? [emptyScopeDraft(draft.domain)]
                    : current.filter((item) => item.key !== draft.key))}>{scopeDrafts.length === 1 ? 'Reset rule' : 'Remove rule'}</button>
                </div>
                <div className="scope-rule-editor__grid">
                  <label><span>Ticket domain</span><select value={draft.domain} onChange={(event) => updateScopeDraft(draft.key, { domain: event.target.value as ScopeDomain })}><option value="consumer">Consumer complaints</option><option value="employee">Employee support</option></select></label>
                  {draft.domain === 'employee' ? (
                    <label><span>Department</span><select value={draft.departmentId} onChange={(event) => updateScopeDraft(draft.key, { departmentId: event.target.value })}><option value="">Every department</option>{catalog?.departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                  ) : (
                    <>
                      <label><span>Circle</span><select value={draft.circleId} onChange={(event) => updateScopeDraft(draft.key, { circleId: event.target.value, divisionId: '', subdivisionId: '' })}><option value="">Every circle</option>{catalog?.circles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                      <label><span>Division</span><select value={draft.divisionId} disabled={draft.circleId === ''} onChange={(event) => updateScopeDraft(draft.key, { divisionId: event.target.value, subdivisionId: '' })}><option value="">Every division</option>{divisions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                      <label><span>Sub-division</span><select value={draft.subdivisionId} disabled={draft.divisionId === ''} onChange={(event) => updateScopeDraft(draft.key, { subdivisionId: event.target.value })}><option value="">Every sub-division</option>{subdivisions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                    </>
                  )}
                  <label><span>Category</span><select value={draft.categoryId} onChange={(event) => updateScopeDraft(draft.key, { categoryId: event.target.value })}><option value="">Every category</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                </div>
              </fieldset>
            );
          })}
        </div>

        <div className="scope-builder__actions">
          <button className="scope-add-rule" disabled={scopeDrafts.length >= 20} type="button" onClick={() => setScopeDrafts((current) => [...current, emptyScopeDraft()])}>+ Add another coverage rule</button>
          <button className="button button--primary" disabled={busy || selectedStaffId === ''} type="submit">{busy ? 'Saving…' : 'Save all boundaries'}</button>
        </div>
      </form>

      <section className="panel staff-scope-panel">
        <div className="panel__heading">
          <div><span>Assignment and visibility directory</span><h2>Staff coverage</h2></div>
          <small>{configuredStaff} of {staff.length} staff configured</small>
        </div>
        <div className="scope-metrics" aria-label="Boundary summary">
          <div><strong>{scopes.length}</strong><span>Total rules</span></div>
          <div><strong>{staff.length - configuredStaff}</strong><span>Missing coverage</span></div>
          <div><strong>{broadRules}</strong><span>Broad rules</span></div>
          <div><strong>{targetedRules}</strong><span>Targeted rules</span></div>
        </div>
        <div className="scope-directory-toolbar">
          <label><span>Find staff or coverage</span><input value={scopeSearch} onChange={(event) => setScopeSearch(event.target.value)} placeholder="Search name, role, category or area" /></label>
          <label><span>Coverage status</span><select value={scopeCoverage} onChange={(event) => setScopeCoverage(event.target.value as typeof scopeCoverage)}><option value="all">All staff</option><option value="configured">Configured</option><option value="missing">Missing coverage</option></select></label>
        </div>
        <div className="scope-directory">
          {visibleStaffGroups.length === 0 ? <p className="empty-state">No staff members match these filters.</p> : visibleStaffGroups.map(({ member, rules }) => (
            <article className="scope-person" key={member.id}>
              <header>
                <div className="scope-person__identity"><span aria-hidden="true">{member.displayName.charAt(0).toUpperCase()}</span><div><strong>{member.displayName}</strong><small>{member.role}</small></div></div>
                <button type="button" onClick={() => editStaffBoundaries(member.id)}>{rules.length === 0 ? 'Configure' : 'Edit boundaries'}</button>
              </header>
              <p className="scope-person__role-note">{member.role === 'supervisor' ? 'Controls which queue tickets this supervisor can see and manage.' : 'Controls assignment eligibility; assigned tickets remain visible to this technician.'}</p>
              {rules.length === 0 ? (
                <div className="scope-person__empty"><strong>No coverage configured</strong><span>This staff member is excluded from boundary-based routing and queue coverage.</span></div>
              ) : (
                <div className="scope-person__rules">{rules.map((rule) => (
                  <div className="scope-person__rule" key={rule.id}>
                    <span className={`scope-domain scope-domain--${rule.domain}`}>{rule.domain}</span>
                    <strong>{scopeDescription(rule)}</strong>
                    <small>{rule.departmentId === null && rule.categoryId === null && rule.circleId === null && rule.divisionId === null && rule.subdivisionId === null ? 'Broad coverage' : 'Targeted coverage'}</small>
                  </div>
                ))}</div>
              )}
            </article>
          ))}
        </div>
      </section>

      <section className="panel audit-panel" aria-labelledby="audit-log-title">
        <div className="panel__heading">
          <div><span>Immutable evidence</span><h2 id="audit-log-title">Audit log</h2></div>
          <small>{auditMeta.totalItems} matching events</small>
        </div>
        <form className="audit-toolbar" onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          setAuditPage(1);
          setAuditQuery({ search: formValue(data, 'search'), result: formValue(data, 'result') });
        }}>
          <label><span>Search events</span><input name="search" defaultValue={auditQuery.search} placeholder="Action, actor, entity, request ID or IP" /></label>
          <label><span>Result</span><select name="result" defaultValue={auditQuery.result}><option value="">All results</option><option value="success">Success</option><option value="failure">Failure</option></select></label>
          <button className="button button--secondary" type="submit">Search logs</button>
        </form>

        <div className="audit-table" role="table" aria-label="Audit events">
          <div className="audit-table__head" role="row"><span>Event</span><span>Actor</span><span>Target</span><span>Time</span><span>Result</span><span aria-hidden="true" /></div>
          {audit.length === 0 ? <p className="empty-state">No audit events match these filters.</p> : audit.map((item) => {
            const expanded = expandedAuditId === item.id;
            const recordedPayloads = [
              { label: 'Metadata', value: item.metadata },
              { label: 'Before', value: item.beforeData },
              { label: 'After', value: item.afterData },
            ].filter((entry) => hasRecordedValue(entry.value));
            return (
              <article className={`audit-event${expanded ? ' is-expanded' : ''}`} key={item.id}>
                <button className="audit-event__trigger" type="button" aria-expanded={expanded} onClick={() => setExpandedAuditId(expanded ? null : item.id)}>
                  <span className="audit-event__action"><strong>{actionLabel(item.action)}</strong><code>{item.action}</code></span>
                  <span className="audit-event__actor"><strong>{item.actorName ?? 'System'}</strong><small>{item.actorRole ?? 'Automated event'}</small></span>
                  <span className="audit-event__target"><strong>{item.entityType}</strong><small>{item.entityId === null ? 'No entity ID' : `#${item.entityId}`}</small></span>
                  <time>{formatDate(item.createdAt)}</time>
                  <span className={`audit-result audit-result--${item.result}`}>{item.result}</span>
                  <span className="audit-event__chevron" aria-hidden="true">{expanded ? '−' : '+'}</span>
                </button>
                {expanded && (
                  <div className="audit-event__details">
                    <dl>
                      <div><dt>Actor</dt><dd>{item.actorName ?? 'System'}{item.actorId === null ? '' : ` (#${item.actorId})`}</dd></div>
                      <div><dt>Actor role</dt><dd>{item.actorRole ?? 'System'}</dd></div>
                      <div><dt>Target</dt><dd>{item.entityType}{item.entityId === null ? '' : ` #${item.entityId}`}</dd></div>
                      {item.requestId !== null && <div><dt>Request ID</dt><dd><code>{item.requestId}</code></dd></div>}
                      {item.ipAddress !== null && <div><dt>IP address</dt><dd><code>{item.ipAddress}</code></dd></div>}
                      <div><dt>Recorded</dt><dd>{formatDate(item.createdAt)}</dd></div>
                    </dl>
                    {recordedPayloads.length > 0 && <div className="audit-event__json">{recordedPayloads.map((entry) => <div key={entry.label}><span>{entry.label}</span><pre>{formatJson(entry.value)}</pre></div>)}</div>}
                  </div>
                )}
              </article>
            );
          })}
        </div>

        {auditMeta.totalPages > 1 && (
          <nav className="audit-pagination" aria-label="Audit log pages">
            <button type="button" disabled={auditPage <= 1} onClick={() => setAuditPage((page) => Math.max(1, page - 1))}>Previous</button>
            <span>Page {auditMeta.page} of {auditMeta.totalPages}</span>
            <button type="button" disabled={auditPage >= auditMeta.totalPages} onClick={() => setAuditPage((page) => Math.min(auditMeta.totalPages, page + 1))}>Next</button>
          </nav>
        )}
      </section>
    </main>
  );
}
