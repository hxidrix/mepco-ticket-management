import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';
import {
  directlySuspendAccount,
  reactivateRequesterAccount,
  requesterAccountsRequest,
  reviewAccountSuspension,
  suspensionCasesRequest,
} from '../lib/account-governance-api';
import type {
  RequesterAccountOption,
  SuspensionCase,
  SuspensionCaseInput,
  SuspensionCategory,
} from '../lib/account-governance-api';
import { getApiErrorMessage } from '../lib/auth-api';
import {
  reviewSuspensionRequestManagement,
  suspensionRequestsManagementRequest,
} from '../lib/suspension-api';
import type { SuspensionRequest, SuspensionRequestStatus } from '../lib/suspension-api';

const categoryOptions: Array<{ value: SuspensionCategory; label: string }> = [
  { value: 'abusive-behavior', label: 'Abusive behavior' },
  { value: 'fraudulent-information', label: 'Fraudulent information' },
  { value: 'repeated-policy-violation', label: 'Repeated policy violation' },
  { value: 'security-risk', label: 'Security risk' },
  { value: 'misuse-of-service', label: 'Misuse of service' },
  { value: 'other', label: 'Other documented reason' },
];

function formValue(data: FormData, name: string): string {
  const value = data.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

function caseInput(data: FormData): SuspensionCaseInput {
  return {
    category: formValue(data, 'category') as SuspensionCategory,
    reasonSummary: formValue(data, 'reasonSummary'),
    details: formValue(data, 'details'),
  };
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-PK', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function categoryLabel(category: SuspensionCategory): string {
  return categoryOptions.find((option) => option.value === category)?.label ?? category;
}

export function AccountGovernancePage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const initialSearch = searchParams.get('search') ?? '';
  const manager = user?.role === 'supervisor' || user?.role === 'administrator';
  const [cases, setCases] = useState<SuspensionCase[]>([]);
  const [caseStatus, setCaseStatus] = useState('');
  const [supportRequests, setSupportRequests] = useState<SuspensionRequest[]>([]);
  const [supportStatus, setSupportStatus] = useState('');
  const [requesters, setRequesters] = useState<RequesterAccountOption[]>([]);
  const [search, setSearch] = useState(initialSearch);
  const [appliedSearch, setAppliedSearch] = useState(initialSearch);
  const [expandedCaseId, setExpandedCaseId] = useState<number | null>(null);
  const [expandedSupportId, setExpandedSupportId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [busySupportId, setBusySupportId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadCases = useCallback(async () => {
    try {
      setCases(await suspensionCasesRequest(caseStatus));
      setError(null);
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    }
  }, [caseStatus]);

  const loadRequesters = useCallback(async () => {
    if (!manager) return;
    try {
      setRequesters(await requesterAccountsRequest(appliedSearch));
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    }
  }, [appliedSearch, manager]);

  const loadSupportRequests = useCallback(async () => {
    if (!manager) return;
    try {
      setSupportRequests(await suspensionRequestsManagementRequest(supportStatus));
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    }
  }, [manager, supportStatus]);

  useEffect(() => { void loadCases(); }, [loadCases]);
  useEffect(() => { void loadRequesters(); }, [loadRequesters]);
  useEffect(() => { void loadSupportRequests(); }, [loadSupportRequests]);

  const suspendDirectly = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const targetUserId = Number(formValue(data, 'targetUserId'));
    setBusyId(0); setError(null); setMessage(null);
    try {
      await directlySuspendAccount(targetUserId, caseInput(data));
      form.reset();
      setMessage('The account was suspended with a complete governance record.');
      await Promise.all([loadCases(), loadRequesters()]);
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setBusyId(null);
    }
  };

  const reviewCase = async (event: FormEvent<HTMLFormElement>, item: SuspensionCase) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusyId(item.id); setError(null); setMessage(null);
    try {
      await reviewAccountSuspension(item.id, {
        decision: formValue(data, 'decision') as 'approved' | 'rejected',
        decisionNotes: formValue(data, 'decisionNotes'),
      });
      setMessage(`Suspension request #${item.id} was reviewed.`);
      setExpandedCaseId(null);
      await Promise.all([loadCases(), loadRequesters()]);
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setBusyId(null);
    }
  };

  const reviewSupportRequest = async (event: FormEvent<HTMLFormElement>, request: SuspensionRequest) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusySupportId(request.id); setError(null); setMessage(null);
    try {
      await reviewSuspensionRequestManagement(request.id, {
        status: formValue(data, 'status') as Exclude<SuspensionRequestStatus, 'submitted'>,
        response: formValue(data, 'response'),
      });
      setMessage(`The response to request #${request.id} was saved.`);
      setExpandedSupportId(null);
      await Promise.all([loadSupportRequests(), loadRequesters()]);
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setBusySupportId(null);
    }
  };

  const reactivate = async (account: RequesterAccountOption) => {
    const reason = window.prompt(`Why should ${account.displayName}'s account be reactivated?`);
    if (reason === null) return;
    if (reason.trim().length < 10) {
      setError('The reactivation reason must contain at least 10 characters.');
      return;
    }
    setBusyId(account.id); setError(null); setMessage(null);
    try {
      await reactivateRequesterAccount(account.id, reason.trim());
      setMessage(`${account.displayName}'s account was reactivated.`);
      await loadRequesters();
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <main className="workspace-page governance-page">
      <div className="workspace-page__heading">
        <div><p>Identity / accountable decisions</p><h1>Account governance</h1></div>
      </div>
      <p className="governance-lead">Suspension is a controlled safety action. Technicians provide ticket-linked evidence; supervisors and administrators make and document the final decision.</p>
      {(message !== null || error !== null) && <p className={error === null ? 'page-message is-success' : 'page-message is-error'}>{error ?? message}</p>}

      {manager && (
        <section className="panel governance-direct">
          <div className="panel__heading"><div><span>Manager action</span><h2>Suspend an account with details</h2></div><small>Employee accounts</small></div>
          <form className="governance-search" onSubmit={(event) => { event.preventDefault(); setAppliedSearch(search); }}>
            <label><span>Find account</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name or employee ID" /></label>
            <button className="button button--secondary" type="submit">Search accounts</button>
          </form>
          <form className="governance-decision-form" onSubmit={(event) => void suspendDirectly(event)}>
            <label><span>Requester account</span><select name="targetUserId" required defaultValue=""><option value="" disabled>Select an active account</option>{requesters.filter((account) => account.status === 'active').map((account) => <option key={account.id} value={account.id}>{account.displayName} / {account.identifier} / {account.role}</option>)}</select></label>
            <label><span>Reason category</span><select name="category" required>{categoryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <label className="governance-form-wide"><span>Reason summary</span><input name="reasonSummary" minLength={10} maxLength={255} required placeholder="A clear summary shown to the suspended account holder" /></label>
            <label className="governance-form-wide"><span>Full details and evidence</span><textarea name="details" minLength={20} maxLength={4000} required placeholder="Record what happened, relevant dates, ticket references, evidence reviewed, and why suspension is proportionate." /></label>
            <button className="button button--danger governance-form-wide" type="submit" disabled={busyId === 0}>Suspend account</button>
          </form>
          {requesters.some((account) => account.status === 'suspended') && <div className="governance-reactivation-list"><span>Suspended accounts in these results</span>{requesters.filter((account) => account.status === 'suspended').map((account) => <article key={account.id}><div><strong>{account.displayName}</strong><small>{account.identifier} / {account.role}</small></div><button type="button" disabled={busyId === account.id} onClick={() => void reactivate(account)}>Reactivate</button></article>)}</div>}
        </section>
      )}

      <section className="panel governance-queue">
        <div className="panel__heading"><div><span>{manager ? 'Review queue' : 'Submitted by you'}</span><h2>{manager ? 'Technician suspension requests' : 'My suspension requests'}</h2></div><small>{cases.length} shown</small></div>
        <div className="governance-toolbar">
          <label><span>Status</span><select value={caseStatus} onChange={(event) => { setCaseStatus(event.target.value); setExpandedCaseId(null); }}><option value="">All decisions</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select></label>
          {!manager && <p>Submit new requests from the appropriate assigned ticket so the evidence remains traceable.</p>}
        </div>
        {cases.length === 0 ? <p className="empty-state">No suspension cases match this view.</p> : (
          <div className="governance-record-list">
            <div className="governance-record-list__head" aria-hidden="true"><span>Account</span><span>Source</span><span>Recorded</span><span>Status</span><span /></div>
            {cases.map((item) => {
              const expanded = expandedCaseId === item.id;
              return (
                <article className={`governance-record${expanded ? ' is-expanded' : ''}`} key={item.id}>
                  <button className="governance-record__trigger" type="button" aria-expanded={expanded} onClick={() => setExpandedCaseId(expanded ? null : item.id)}>
                    <span><strong>{item.targetName}</strong><small>{item.targetRole} / {categoryLabel(item.category)}</small></span>
                    <span><strong>{item.origin === 'technician_request' ? 'Technician request' : 'Manager decision'}</strong><small>{item.requesterName}</small></span>
                    <time>{formatDate(item.createdAt)}</time>
                    <span className={`governance-status governance-status--${item.status}`}>{item.status}</span>
                    <span className="governance-record__chevron" aria-hidden="true">{expanded ? '-' : '+'}</span>
                  </button>
                  {expanded && (
                    <div className="governance-record__details">
                      <div className="governance-case-body">
                        <div className="governance-case-copy"><span>Reason and evidence</span><strong>{item.reasonSummary}</strong><p>{item.details}</p></div>
                        <dl>
                          <div><dt>Requested or recorded by</dt><dd>{item.requesterName}</dd></div>
                          <div><dt>Category</dt><dd>{categoryLabel(item.category)}</dd></div>
                          <div><dt>Related ticket</dt><dd>{item.ticketNumber === null ? 'No ticket attached' : <Link to={`/app/tickets/${item.sourceTicketId}`}>{item.ticketNumber}</Link>}</dd></div>
                          <div><dt>Current account status</dt><dd>{item.targetStatus}</dd></div>
                        </dl>
                      </div>
                      {item.decisionNotes !== null && <blockquote><span>Decision by {item.reviewerName ?? 'manager'}</span><p>{item.decisionNotes}</p></blockquote>}
                      {manager && item.status === 'pending' && <form className="governance-review-form" onSubmit={(event) => void reviewCase(event, item)}><label><span>Decision</span><select name="decision"><option value="approved">Approve and suspend</option><option value="rejected">Reject request</option></select></label><label><span>Decision details</span><textarea name="decisionNotes" minLength={10} maxLength={4000} required placeholder="Explain the evidence considered and why the request is approved or rejected." /></label><button className="button button--secondary" type="submit" disabled={busyId === item.id}>Record decision</button></form>}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {manager && (
        <section className="panel governance-support">
          <div className="panel__heading"><div><span>Account holder communication</span><h2>Suspension appeals and support</h2></div><small>{supportRequests.length} shown</small></div>
          <div className="governance-support__intro">
            <p>Suspended employees submit appeals or questions from their restricted portal. Approving an appeal reactivates the account.</p>
            <label><span>Request status</span><select value={supportStatus} onChange={(event) => { setSupportStatus(event.target.value); setExpandedSupportId(null); }}><option value="">All requests</option><option value="submitted">Submitted</option><option value="under-review">Under review</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="resolved">Resolved</option></select></label>
          </div>
          {supportRequests.length === 0 ? <p className="empty-state">No appeals or support requests match this view.</p> : (
            <div className="governance-record-list governance-record-list--support">
              <div className="governance-record-list__head" aria-hidden="true"><span>Account</span><span>Request</span><span>Received</span><span>Status</span><span /></div>
              {supportRequests.map((request) => {
                const expanded = expandedSupportId === request.id;
                return (
                  <article className={`governance-record${expanded ? ' is-expanded' : ''}`} key={request.id}>
                    <button className="governance-record__trigger" type="button" aria-expanded={expanded} onClick={() => setExpandedSupportId(expanded ? null : request.id)}>
                      <span><strong>{request.displayName}</strong><small>{request.role} / Request #{request.id}</small></span>
                      <span><strong>{request.requestType === 'appeal' ? 'Suspension appeal' : 'Support request'}</strong><small>Reply via {request.contactPreference}</small></span>
                      <time>{formatDate(request.createdAt)}</time>
                      <span className={`suspension-request-status suspension-request-status--${request.status}`}>{request.status.replace('-', ' ')}</span>
                      <span className="governance-record__chevron" aria-hidden="true">{expanded ? '-' : '+'}</span>
                    </button>
                    {expanded && (
                      <div className="governance-record__details">
                        <div className="governance-support-list__body">
                          <div><span>Account holder message</span><p>{request.message}</p></div>
                          <div><span>Recorded suspension reason</span><p>{request.suspensionReason ?? 'No reason recorded'}</p></div>
                        </div>
                        {request.adminResponse !== null && <blockquote><span>Latest response by {request.reviewerName ?? 'account support'}</span><p>{request.adminResponse}</p></blockquote>}
                        <form className="governance-support-form" onSubmit={(event) => void reviewSupportRequest(event, request)}>
                          <label><span>Outcome</span><select name="status" defaultValue={request.status === 'submitted' ? 'under-review' : request.status}>{request.requestType === 'appeal' && <option value="approved">Approve and reactivate</option>}<option value="under-review">Keep under review</option><option value="rejected">Reject request</option><option value="resolved">Resolve request</option></select></label>
                          <label><span>Response to account holder</span><textarea name="response" minLength={3} maxLength={4000} required defaultValue={request.adminResponse ?? ''} placeholder="Explain the decision, answer the question, or request more information." /></label>
                          <button className="button button--secondary" type="submit" disabled={busySupportId === request.id}>{busySupportId === request.id ? 'Saving...' : 'Save and send response'}</button>
                        </form>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
