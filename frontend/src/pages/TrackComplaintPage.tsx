import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { BrandLogo } from '../components/BrandLogo';
import { GlassSurface } from '../components/GlassSurface';
import { SilkBackground } from '../components/SilkBackground';
import { ThemeToggle } from '../components/ThemeToggle';
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
        ticketNumber: fieldValue(data, 'ticketNumber').toUpperCase(),
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
    <main className="public-flow-page">
      <SilkBackground className="silk-background--auth" />
      <header className="public-flow-header"><Link to="/"><BrandLogo /></Link><ThemeToggle compact /></header>
      <GlassSurface className="public-flow-card public-flow-card--wide" borderRadius={24}>
        <div className="auth-card__heading"><p>Complaint tracking</p><h1>Check complaint progress</h1><span>All three details are required to protect your complaint information.</span></div>
        <form className="auth-form public-track-form" onSubmit={(event) => void track(event)}>
          <label><span>Tracking number</span><input name="ticketNumber" required placeholder="MEPCO-2026-123456" pattern="MEPCO-[0-9]{4}-[0-9]{6}" /></label>
          <label><span>Reference Number</span><input name="referenceNumber" required inputMode="numeric" pattern="[0-9]{14}" minLength={14} maxLength={14} /></label>
          <label><span>Consumer ID</span><input name="consumerId" required inputMode="numeric" pattern="[0-9]{10}" minLength={10} maxLength={10} /></label>
          {error !== null && <p className="auth-message auth-message--error">{error}</p>}
          <button className="auth-submit" type="submit" disabled={busy}>{busy ? 'Checking...' : 'Track complaint'}</button>
        </form>
        {ticket !== null && (
          <section className="tracked-complaint" aria-live="polite">
            <div><p>{ticket.ticketNumber}</p><h2>{ticket.subject}</h2><span className={`status-badge status-${ticket.statusSlug}`}>{ticket.statusName}</span></div>
            <dl>
              <div><dt>Category</dt><dd>{ticket.categoryName}</dd></div>
              <div><dt>Complaint type</dt><dd>{ticket.complaintTypeName}</dd></div>
              <div><dt>Priority</dt><dd>{ticket.priorityName}</dd></div>
              <div><dt>Submitted</dt><dd>{new Date(ticket.createdAt).toLocaleString()}</dd></div>
              <div><dt>Last updated</dt><dd>{new Date(ticket.updatedAt).toLocaleString()}</dd></div>
              <div><dt>Location</dt><dd>{ticket.subdivisionName}, {ticket.divisionName}</dd></div>
            </dl>
            {ticket.resolutionSummary !== null && <div className="tracked-complaint__resolution"><strong>Resolution</strong><p>{ticket.resolutionSummary}</p></div>}
          </section>
        )}
        <Link className="auth-switch" to="/">Back to home</Link>
      </GlassSurface>
    </main>
  );
}
