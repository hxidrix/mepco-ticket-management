import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate } from 'react-router-dom';

import { BrandLogo } from '../components/BrandLogo';
import { SilkBackground } from '../components/SilkBackground';
import { ThemeToggle } from '../components/ThemeToggle';
import { useAuth } from '../hooks/useAuth';
import { getApiErrorMessage } from '../lib/auth-api';
import {
  submitSuspensionRequest,
  suspensionPortalRequest,
} from '../lib/suspension-api';
import type {
  ContactPreference,
  SuspensionPortal,
  SuspensionRequestType,
} from '../lib/suspension-api';

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-PK', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function fieldValue(data: FormData, name: string): string {
  const value = data.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

export function SuspendedAccountPage() {
  const { user, logout } = useAuth();
  const [portal, setPortal] = useState<SuspensionPortal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadPortal = useCallback(async () => {
    try {
      setPortal(await suspensionPortalRequest());
      setError(null);
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    }
  }, []);

  useEffect(() => { void loadPortal(); }, [loadPortal]);

  if (user === null) return <Navigate to="/login" replace />;
  if (user.status === 'active') return <Navigate to="/app" replace />;

  const openAppeal = portal?.requests.some((request) => request.requestType === 'appeal'
    && ['submitted', 'under-review'].includes(request.status)) ?? false;

  const submitRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setError(null);
    setMessage(null);
    const data = new FormData(form);
    try {
      await submitSuspensionRequest({
        requestType: fieldValue(data, 'requestType') as SuspensionRequestType,
        message: fieldValue(data, 'message'),
        contactPreference: fieldValue(data, 'contactPreference') as ContactPreference,
      });
      form.reset();
      setMessage('Your request was submitted. You can follow its status below.');
      await loadPortal();
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="suspension-page">
      <SilkBackground className="silk-background--auth" />
      <header className="suspension-header">
        <BrandLogo />
        <div><ThemeToggle compact /><button type="button" onClick={() => void logout()}>Sign out</button></div>
      </header>

      <div className="suspension-layout">
        <section className="suspension-summary panel">
          <div className="suspension-state"><span>Account restricted</span><strong>Suspended</strong></div>
          <p className="suspension-eyebrow">Account access review</p>
          <h1>Hello, {user.displayName}.</h1>
          <p className="suspension-lead">Your credentials are valid, but normal workspace access is paused. You can still review the decision and communicate securely with account support here.</p>
          <dl>
            <div><dt>Reason provided</dt><dd>{portal?.account.statusReason ?? 'No additional reason was provided.'}</dd></div>
            {portal !== null && <div><dt>Account record updated</dt><dd>{formatDate(portal.account.statusUpdatedAt)}</dd></div>}
            <div><dt>Access available</dt><dd>Suspension details, appeals, support messages, and responses</dd></div>
          </dl>
          <p className="suspension-security-note">Ticket data and all operational actions remain blocked while the suspension is active.</p>
        </section>

        <section className="suspension-request panel">
          <div className="panel__heading"><div><span>Contact account support</span><h2>Submit a request</h2></div></div>
          <p className="panel__copy">Appeal the suspension decision or ask a support question. Replies will appear in this secure portal.</p>
          {(error !== null || message !== null) && <p className={error === null ? 'page-message is-success' : 'page-message is-error'}>{error ?? message}</p>}
          <form onSubmit={(event) => void submitRequest(event)}>
            <label><span>Request type</span><select name="requestType" defaultValue={openAppeal ? 'support' : 'appeal'} required><option value="appeal" disabled={openAppeal}>{openAppeal ? 'Appeal already awaiting review' : 'Appeal this suspension'}</option><option value="support">Ask account support</option></select></label>
            <label><span>Preferred reply method</span><select name="contactPreference" required><option value="portal">Secure portal</option><option value="email" disabled={portal?.account.email === null}>Registered email{portal?.account.email === null ? ' unavailable' : ''}</option><option value="phone" disabled={portal?.account.phone === null}>Registered phone{portal?.account.phone === null ? ' unavailable' : ''}</option></select></label>
            <label className="suspension-request__message"><span>Explain your request</span><textarea name="message" minLength={20} maxLength={4000} required placeholder="Provide the relevant facts and explain what you would like account support to review." /></label>
            <button className="button button--primary" type="submit" disabled={busy}>{busy ? 'Submitting…' : 'Submit securely'}</button>
          </form>
        </section>

        <section className="suspension-history panel">
          <div className="panel__heading"><div><span>Case history</span><h2>Your requests</h2></div><small>{portal?.requests.length ?? 0} total</small></div>
          {portal === null ? <p className="empty-state">Loading account details…</p> : portal.requests.length === 0 ? <p className="empty-state">No appeals or support requests have been submitted.</p> : <div className="suspension-history__list">{portal.requests.map((request) => (
            <article key={request.id}>
              <header><div><span>{request.requestType}</span><strong>Request #{request.id}</strong></div><span className={`suspension-request-status suspension-request-status--${request.status}`}>{request.status.replace('-', ' ')}</span></header>
              <p>{request.message}</p>
              <small>Submitted {formatDate(request.createdAt)} · reply via {request.contactPreference}</small>
              {request.adminResponse !== null && <blockquote><span>Account support response</span><p>{request.adminResponse}</p>{request.reviewerName !== null && <small>{request.reviewerName}{request.reviewedAt === null ? '' : ` · ${formatDate(request.reviewedAt)}`}</small>}</blockquote>}
            </article>
          ))}</div>}
        </section>
      </div>
    </main>
  );
}
