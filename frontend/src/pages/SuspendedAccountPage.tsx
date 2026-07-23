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
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
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
  const suspensionCase = portal?.suspensionCase;

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
    <div className="workspace-shell suspension-shell">
      <div className="workspace-background" aria-hidden="true"><SilkBackground /></div>

      <div className="suspension-portal">
        <header className="suspension-portal__topbar">
          <div className="suspension-portal__brand"><BrandLogo /></div>
          <div className="suspension-portal__actions">
            <ThemeToggle compact />
            {confirmingSignOut ? (
              <div className="workspace-signout-confirmation suspension-signout-confirmation" aria-live="polite">
                <p>Are you sure you want to sign out?</p>
                <div className="workspace-signout-confirmation__actions">
                  <button type="button" onClick={() => setConfirmingSignOut(false)}>Cancel</button>
                  <button className="is-danger" type="button" onClick={() => void logout()}>Sign out</button>
                </div>
              </div>
            ) : (
              <button className="workspace-signout suspension-signout" type="button" onClick={() => setConfirmingSignOut(true)}>Sign out</button>
            )}
          </div>
        </header>

        <main className="workspace-page suspension-page">
          <header className="overview-hero suspension-hero">
            <div className="overview-hero__copy">
              <p>Restricted workspace / account support</p>
              <h1>Account access paused.</h1>
              <span>Hello, {user.displayName}. Review the decision or communicate securely with account support.</span>
            </div>
            <div className="suspension-state"><span>Account status</span><strong>Suspended</strong></div>
          </header>

          <div className="suspension-layout">
            <section id="account-review" className="suspension-summary panel">
              <div className="panel__heading">
                <div><span>Account access review</span><h2>Suspension details</h2></div>
                <small>Restricted</small>
              </div>
              <p className="suspension-lead">Your credentials remain valid, but normal workspace access is paused. The decision recorded for your account is shown below.</p>

              {suspensionCase !== null && suspensionCase !== undefined ? (
                <div className="suspension-decision-record">
                  <div className="suspension-decision-record__heading">
                    <span>Recorded suspension decision</span>
                    <strong>{suspensionCase.category.replaceAll('-', ' ')}</strong>
                  </div>
                  <h3>{suspensionCase.reasonSummary}</h3>
                  <p>{suspensionCase.details}</p>
                  <dl>
                    <div><dt>Decision recorded by</dt><dd>{suspensionCase.reviewerName ?? suspensionCase.requesterName}</dd></div>
                    <div><dt>Related ticket</dt><dd>{suspensionCase.ticketNumber ?? 'Not linked to a ticket'}</dd></div>
                    {portal !== null && <div><dt>Account record updated</dt><dd>{formatDate(portal.account.statusUpdatedAt)}</dd></div>}
                  </dl>
                  {suspensionCase.decisionNotes !== null && (
                    <div className="suspension-decision-note">
                      <span>Decision note</span>
                      <p>{suspensionCase.decisionNotes}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="suspension-decision-record suspension-decision-record--legacy">
                  <div className="suspension-decision-record__heading"><span>Recorded reason</span></div>
                  <h3>{portal?.account.statusReason ?? 'No additional reason was provided.'}</h3>
                  {portal !== null && <p>Account record updated {formatDate(portal.account.statusUpdatedAt)}.</p>}
                </div>
              )}

              <div className="suspension-access-note">
                <div><span>Available here</span><p>Suspension details, appeals, support messages, and responses.</p></div>
                <p>Ticket data and operational actions remain blocked while this suspension is active.</p>
              </div>
            </section>

            <section id="support-request" className="suspension-request panel">
              <div className="panel__heading"><div><span>Contact account support</span><h2>Appeal or ask for help</h2></div></div>
              <p className="panel__copy">Send an appeal or support question. Replies will appear in this secure portal.</p>
              {(error !== null || message !== null) && <p className={error === null ? 'page-message is-success' : 'page-message is-error'}>{error ?? message}</p>}
              <form onSubmit={(event) => void submitRequest(event)}>
                <label><span>Request type</span><select name="requestType" defaultValue={openAppeal ? 'support' : 'appeal'} required><option value="appeal" disabled={openAppeal}>{openAppeal ? 'Appeal already awaiting review' : 'Appeal this suspension'}</option><option value="support">Ask account support</option></select></label>
                <label><span>Preferred reply method</span><select name="contactPreference" required><option value="portal">Secure portal</option><option value="email" disabled={portal?.account.email === null}>Registered email{portal?.account.email === null ? ' unavailable' : ''}</option><option value="phone" disabled={portal?.account.phone === null}>Registered phone{portal?.account.phone === null ? ' unavailable' : ''}</option></select></label>
                <label className="suspension-request__message"><span>Explain your request</span><textarea name="message" minLength={20} maxLength={4000} required placeholder="Provide the relevant facts and explain what you would like account support to review." /></label>
                <button className="button button--primary" type="submit" disabled={busy}>{busy ? 'Submitting…' : 'Submit securely'}</button>
              </form>
            </section>

            <section id="request-history" className="suspension-history panel">
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
      </div>
    </div>
  );
}
