import { useState } from 'react';
import type { FormEvent } from 'react';

import { PublicFlowLayout } from '../components/PublicFlowLayout';
import { getApiErrorMessage } from '../lib/auth-api';
import {
  findPublicComplaintsRequest,
  trackPublicComplaintRequest,
} from '../lib/public-complaints-api';
import type {
  PublicComplaintSummary,
  PublicTrackedComplaint,
} from '../lib/public-complaints-api';

interface LookupIdentity {
  referenceNumber: string;
  consumerId: string;
}

function fieldValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

export function TrackComplaintPage() {
  const [ticket, setTicket] = useState<PublicTrackedComplaint | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAlternative, setShowAlternative] = useState(false);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupIdentity, setLookupIdentity] = useState<LookupIdentity | null>(null);
  const [matches, setMatches] = useState<PublicComplaintSummary[] | null>(null);

  const loadTicket = async (input: LookupIdentity & { ticketNumber: string }) => {
    setBusy(true);
    setError(null);
    setTicket(null);
    try {
      setTicket(await trackPublicComplaintRequest(input));
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const track = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await loadTicket({
      ticketNumber: fieldValue(data, 'ticketNumber'),
      referenceNumber: fieldValue(data, 'referenceNumber'),
      consumerId: fieldValue(data, 'consumerId'),
    });
  };

  const findComplaints = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLookupBusy(true);
    setLookupError(null);
    setMatches(null);
    setTicket(null);
    const data = new FormData(event.currentTarget);
    const identity = {
      referenceNumber: fieldValue(data, 'lookupReferenceNumber'),
      consumerId: fieldValue(data, 'lookupConsumerId'),
    };
    try {
      const tickets = await findPublicComplaintsRequest(identity);
      setLookupIdentity(identity);
      setMatches(tickets);
    } catch (caught) {
      setLookupIdentity(null);
      setLookupError(getApiErrorMessage(caught));
    } finally {
      setLookupBusy(false);
    }
  };

  const hasResults = ticket !== null || matches !== null;

  return (
    <PublicFlowLayout
      eyebrow="Complaint tracking"
      title="Check complaint progress"
      description="Use the tracking number issued at submission together with the billing identifiers for the same service connection."
      wide={hasResults}
      className={hasResults ? 'public-flow-page--tracking-result' : ''}
    >
      <div className="public-flow-card__heading">
        <span>Primary lookup</span>
        <h2>Track with your tracking number</h2>
        <p>This is the quickest way to open one complaint. All three values must match.</p>
      </div>
      <form className="public-flow-form public-track-form" onSubmit={(event) => void track(event)}>
        <label><span>Tracking number</span><input name="ticketNumber" required inputMode="numeric" placeholder="2026100001" pattern="[0-9]{10}" minLength={10} maxLength={10} /></label>
        <label><span>Reference Number</span><input name="referenceNumber" required inputMode="numeric" pattern="[0-9]{14}" minLength={14} maxLength={14} placeholder="Enter 14 digits" /></label>
        <label><span>Consumer ID</span><input name="consumerId" required inputMode="numeric" pattern="[0-9]{10}" minLength={10} maxLength={10} placeholder="Enter 10 digits" /></label>
        {error !== null && <p className="auth-message auth-message--error">{error}</p>}
        <button className="button button--primary public-flow-form__submit" type="submit" disabled={busy}>{busy ? 'Checking...' : 'Track complaint'}</button>
      </form>

      <section className="public-ticket-discovery">
        <div className="public-ticket-discovery__heading">
          <div>
            <span>Alternative lookup</span>
            <h3>Forgot your tracking number?</h3>
            <p>Use the Reference Number and Consumer ID for the same connection to find its complaints.</p>
          </div>
          <button
            className="button button--secondary"
            type="button"
            onClick={() => setShowAlternative((current) => !current)}
          >
            {showAlternative ? 'Hide lookup' : 'Find my complaints'}
          </button>
        </div>

        {showAlternative && (
          <form className="public-ticket-discovery__form" onSubmit={(event) => void findComplaints(event)}>
            <label><span>Reference Number</span><input name="lookupReferenceNumber" required inputMode="numeric" pattern="[0-9]{14}" minLength={14} maxLength={14} placeholder="Enter 14 digits" /></label>
            <label><span>Consumer ID</span><input name="lookupConsumerId" required inputMode="numeric" pattern="[0-9]{10}" minLength={10} maxLength={10} placeholder="Enter 10 digits" /></label>
            {lookupError !== null && <p className="auth-message auth-message--error">{lookupError}</p>}
            <button className="button button--secondary" type="submit" disabled={lookupBusy}>{lookupBusy ? 'Searching...' : 'Find complaints'}</button>
          </form>
        )}

        {matches !== null && (
          <div className="public-ticket-discovery__results" aria-live="polite">
            <div><strong>Your complaints</strong><span>{matches.length} found</span></div>
            {matches.length === 0
              ? <p>No complaints have been submitted for this connection.</p>
              : matches.map((match) => (
                <article key={match.ticketNumber}>
                  <div>
                    <code>{match.ticketNumber}</code>
                    <strong>{match.subject}</strong>
                    <span>{match.categoryName} / {match.complaintTypeName}</span>
                    <small>Submitted {new Date(match.createdAt).toLocaleString()}</small>
                  </div>
                  <div>
                    <span className={`status-badge status-${match.statusSlug}`}>{match.statusName}</span>
                    <button
                      className="button button--secondary"
                      type="button"
                      disabled={busy || lookupIdentity === null}
                      onClick={() => {
                        if (lookupIdentity !== null) {
                          void loadTicket({ ...lookupIdentity, ticketNumber: match.ticketNumber });
                        }
                      }}
                    >
                      View complaint
                    </button>
                  </div>
                </article>
              ))}
          </div>
        )}
      </section>

      {ticket !== null && (
        <section className="tracked-complaint" aria-live="polite">
          <header className="tracked-complaint__heading">
            <div><span>Tracking number</span><code>{ticket.ticketNumber}</code></div>
            <span className={`status-badge status-${ticket.statusSlug}`}>{ticket.statusName}</span>
            <h2>{ticket.subject}</h2>
            <p>{ticket.description}</p>
          </header>
          <dl>
            <div><dt>Category</dt><dd>{ticket.categoryName}</dd></div>
            <div><dt>Complaint type</dt><dd>{ticket.complaintTypeName}</dd></div>
            <div><dt>Priority</dt><dd>{ticket.priorityName}</dd></div>
            <div><dt>Submitted</dt><dd>{new Date(ticket.createdAt).toLocaleString()}</dd></div>
            <div><dt>Last updated</dt><dd>{new Date(ticket.updatedAt).toLocaleString()}</dd></div>
            <div><dt>Circle</dt><dd>{ticket.circleName}</dd></div>
            <div><dt>Division</dt><dd>{ticket.divisionName}</dd></div>
            <div><dt>Sub-division</dt><dd>{ticket.subdivisionName}</dd></div>
            <div><dt>Service detail</dt><dd>{ticket.locationDetails ?? 'No additional location detail provided'}</dd></div>
            <div><dt>SLA target</dt><dd>{ticket.slaTargetHours} hours</dd></div>
            <div><dt>Target time</dt><dd>{new Date(ticket.slaDueAt).toLocaleString()}</dd></div>
            {ticket.resolvedAt !== null && <div><dt>Resolved</dt><dd>{new Date(ticket.resolvedAt).toLocaleString()}</dd></div>}
            {ticket.closedAt !== null && <div><dt>Closed</dt><dd>{new Date(ticket.closedAt).toLocaleString()}</dd></div>}
          </dl>
          {ticket.resolutionSummary !== null && <div className="tracked-complaint__resolution"><strong>Resolution</strong><p>{ticket.resolutionSummary}</p></div>}
        </section>
      )}
    </PublicFlowLayout>
  );
}
