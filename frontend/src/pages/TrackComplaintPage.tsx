import { useState } from 'react';
import type { FormEvent } from 'react';
import { PublicFlowLayout } from '../components/PublicFlowLayout';
import { getApiErrorMessage } from '../lib/auth-api';
import { trackPublicComplaintRequest } from '../lib/public-complaints-api';
import type { PublicTrackedComplaint } from '../lib/public-complaints-api';

function fieldValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

export function TrackComplaintPage() {
  const [ticket, setTicket] = useState<PublicTrackedComplaint | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const track = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError(null); setTicket(null);
    const data = new FormData(event.currentTarget);
    try {
      setTicket(await trackPublicComplaintRequest({
        ticketNumber: fieldValue(data, 'ticketNumber'),
        referenceNumber: fieldValue(data, 'referenceNumber'),
        consumerId: fieldValue(data, 'consumerId'),
      }));
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PublicFlowLayout
      eyebrow="Complaint tracking"
      title="Check complaint progress"
      description="Use the tracking number issued at submission together with the billing identifiers for the same service connection."
      wide={ticket !== null}
      className={ticket === null ? '' : 'public-flow-page--tracking-result'}
    >
        <div className="public-flow-card__heading">
          <span>Private status lookup</span>
          <h2>Enter complaint details</h2>
          <p>All three values must match before any complaint information is displayed.</p>
        </div>
        <form className="public-flow-form public-track-form" onSubmit={(event) => void track(event)}>
          <label><span>Tracking number</span><input name="ticketNumber" required inputMode="numeric" placeholder="2026100001" pattern="[0-9]{10}" minLength={10} maxLength={10} /></label>
          <label><span>Reference Number</span><input name="referenceNumber" required inputMode="numeric" pattern="[0-9]{14}" minLength={14} maxLength={14} placeholder="Enter 14 digits" /></label>
          <label><span>Consumer ID</span><input name="consumerId" required inputMode="numeric" pattern="[0-9]{10}" minLength={10} maxLength={10} placeholder="Enter 10 digits" /></label>
          {error !== null && <p className="auth-message auth-message--error">{error}</p>}
          <button className="button button--primary public-flow-form__submit" type="submit" disabled={busy}>{busy ? 'Checking...' : 'Track complaint'}</button>
        </form>
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
