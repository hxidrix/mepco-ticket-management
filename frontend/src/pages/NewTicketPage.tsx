import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';

import { PublicFlowLayout } from '../components/PublicFlowLayout';
import { useAuth } from '../hooks/useAuth';
import { usePublicComplaint } from '../hooks/usePublicComplaint';
import { getApiErrorMessage } from '../lib/auth-api';
import { catalogRequest } from '../lib/master-data-api';
import { submitPublicComplaintRequest } from '../lib/public-complaints-api';
import { createTicketRequest } from '../lib/tickets-api';
import type { MasterCatalog } from '../types/master-data';

function value(data: FormData, name: string): string {
  const entry = data.get(name); return typeof entry === 'string' ? entry.trim() : '';
}

export function NewTicketPage() {
  const { user } = useAuth();
  const { verification, setVerification } = usePublicComplaint();
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState<MasterCatalog | null>(null);
  const [categoryId, setCategoryId] = useState('');
  const [complaintTypeId, setComplaintTypeId] = useState('');
  const [priorityId, setPriorityId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState<{ ticketNumber: string; smsQueued: boolean } | null>(null);
  const domain = verification !== null ? 'consumer' : user?.role === 'employee' ? 'employee' : null;

  useEffect(() => {
    if (domain === null) return;
    void catalogRequest().then((next) => {
      setCatalog(next);
      const firstCategory = next.categories.find((category) => category.domain === domain);
      setCategoryId(String(firstCategory?.id ?? ''));
      setComplaintTypeId(String(firstCategory?.complaintTypes[0]?.id ?? ''));
      setPriorityId(String(next.priorities.find((priority) => priority.slug === 'medium')?.id ?? next.priorities[0]?.id ?? ''));
    }).catch((caught: unknown) => setError(getApiErrorMessage(caught)));
  }, [domain]);

  const categories = useMemo(
    () => catalog?.categories.filter((category) => category.domain === domain) ?? [],
    [catalog, domain],
  );
  const selectedCategory = categories.find((category) => String(category.id) === categoryId);
  const complaintTypes = selectedCategory?.complaintTypes ?? [];
  const selectedType = complaintTypes.find((type) => String(type.id) === complaintTypeId);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError(null);
    const data = new FormData(event.currentTarget);
    const common = {
      subject: value(data, 'subject'),
      description: value(data, 'description'),
      categoryId: Number(value(data, 'categoryId')),
      complaintTypeId: Number(value(data, 'complaintTypeId')),
      locationDetails: value(data, 'locationDetails'),
      otherCategory: value(data, 'otherCategory'),
      otherComplaintType: value(data, 'otherComplaintType'),
      idempotencyKey: crypto.randomUUID(),
    };
    try {
      if (domain === 'consumer' && verification !== null) {
        const attachments = data.getAll('attachments').filter(
          (entry): entry is File => entry instanceof File && entry.size > 0,
        );
        const ticket = await submitPublicComplaintRequest({
          ...common,
          referenceNumber: verification.referenceNumber,
          consumerId: verification.consumerId,
          contactPhone: value(data, 'contactPhone'),
        }, attachments);
        setSubmitted(ticket);
        setVerification(null);
        return;
      }
      const ticket = await createTicketRequest({
        ...common,
        departmentId: Number(value(data, 'departmentId')),
        priorityId: Number(value(data, 'priorityId')),
      });
      void navigate(`/app/tickets/${ticket.id}`, { replace: true });
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  if (submitted !== null) {
    return (
      <PublicFlowLayout
        eyebrow="Complaint submitted"
        title="Your complaint is in the queue"
        description="Save the tracking number below. You will need it with your Reference Number and Consumer ID whenever you check progress."
        className="public-flow-page--success"
      >
        <section className="complaint-success" aria-live="polite">
          <span>Tracking number</span>
          <code>{submitted.ticketNumber}</code>
          <p>The complaint has been recorded and routed to the appropriate MEPCO team.</p>
          {submitted.smsQueued && <p className="complaint-success__sms">An SMS update has been queued for the registered or supplied mobile number.</p>}
          <div><Link className="button button--primary" to="/complaints/track">Track complaint</Link><Link className="button" to="/">Return home</Link></div>
        </section>
      </PublicFlowLayout>
    );
  }

  if (domain === null) return <Navigate to="/complaints/verify" replace />;

  const fields = (
    <>
      {domain === 'consumer' && verification !== null && (
        <div className="verified-consumer-summary form-grid__wide">
          <div><span>Verified consumer</span><strong>{verification.consumer.name}</strong></div>
          <div><span>Sub-division</span><strong>{verification.consumer.subdivision}</strong></div>
          <div><span>Tariff</span><strong>{verification.consumer.tariff}</strong></div>
        </div>
      )}
      <label className="form-grid__wide"><span>Subject</span><input name="subject" required minLength={5} maxLength={180} placeholder="Briefly summarize the issue" /></label>
      <label className="form-grid__wide"><span>Description</span><textarea name="description" required minLength={10} maxLength={10000} rows={6} placeholder="Describe what happened, its impact, and anything already tried." /></label>
      <label><span>Category</span><select name="categoryId" value={categoryId} required onChange={(event) => { const next = event.target.value; setCategoryId(next); const category = categories.find((item) => String(item.id) === next); setComplaintTypeId(String(category?.complaintTypes[0]?.id ?? '')); }}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
      <label><span>Complaint type</span><select name="complaintTypeId" value={complaintTypeId} required onChange={(event) => setComplaintTypeId(event.target.value)}>{complaintTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></label>
      {selectedCategory?.name === 'Other' && <label className="form-grid__wide"><span>Describe the other category</span><input name="otherCategory" required /></label>}
      {selectedType?.name === 'Other' && <label className="form-grid__wide"><span>Describe the other complaint type</span><input name="otherComplaintType" required /></label>}
      {domain === 'employee' && <label className="form-grid__wide"><span>Department</span><input name="departmentName" value={selectedCategory?.parentName ?? 'Select a departmental category'} disabled /><input name="departmentId" type="hidden" value={selectedCategory?.departmentId ?? ''} /></label>}
      {domain === 'consumer'
        ? <div className="ticket-form__auto-priority"><strong>Priority is assigned automatically</strong><p>The issue type and description determine the initial priority. Staff can review it later.</p></div>
        : <label><span>Priority</span><select name="priorityId" required value={priorityId} onChange={(event) => setPriorityId(event.target.value)}>{catalog?.priorities.map((priority) => <option key={priority.id} value={priority.id}>{priority.name}</option>)}</select></label>}
      <label><span>Location details <small>optional</small></span><input name="locationDetails" placeholder="Feeder, landmark, office, or room" /></label>
      {domain === 'consumer' && verification?.consumer.hasRegisteredPhone === false && <label><span>Mobile number for updates</span><input name="contactPhone" required inputMode="tel" pattern="03[0-9]{9}" minLength={11} maxLength={11} placeholder="03001234567" /></label>}
      {domain === 'consumer' && <label className="public-file-field form-grid__wide"><span>Supporting attachments <small>optional, up to 3 files</small></span><input name="attachments" type="file" multiple accept=".jpg,.jpeg,.png,.pdf,.txt,.doc,.docx" /><em>Accepted: JPG, PNG, PDF, TXT, DOC and DOCX. Maximum 5 MB per file.</em></label>}
      <div className="ticket-form__note form-grid__wide"><strong>Before submitting</strong><p>Check the details carefully. A unique tracking number and traceable history will be created.</p></div>
      <button className="button button--primary form-grid__wide" type="submit" disabled={busy || catalog === null}>{busy ? 'Submitting...' : domain === 'consumer' ? 'Submit complaint' : 'Submit ticket'}</button>
      {domain === 'consumer' && <Link className="button form-grid__wide" to="/">Cancel</Link>}
    </>
  );

  if (domain === 'consumer') {
    return (
      <PublicFlowLayout
        eyebrow="Complaint details"
        title="Tell us what needs attention"
        description="Provide a clear description and any useful evidence. Category, location, and issue details help route the complaint correctly."
        wide
        hideIntro
        className="public-flow-page--form"
      >
        <div className="public-flow-card__heading">
          <span>Step 2 of 2</span>
          <h2>Complaint information</h2>
          <p>Your verified connection is attached automatically. Priority and routing are calculated from the issue.</p>
        </div>
        {error !== null && <p className="page-message is-error">{error}</p>}
        <form className="public-ticket-form" onSubmit={(event) => void submit(event)}>
          {fields}
        </form>
      </PublicFlowLayout>
    );
  }

  return (
    <main className="workspace-page public-complaint-form">
      <div className="workspace-page__heading"><div><p>Tickets / new employee request</p><h1>Submit a ticket</h1></div></div>
      {error !== null && <p className="page-message is-error">{error}</p>}
      <form className="panel form-grid ticket-form" onSubmit={(event) => void submit(event)}>
        <div className="panel__heading form-grid__wide"><div><span>Request details</span><h2>Tell us what needs attention</h2></div><small>employee</small></div>
        {fields}
      </form>
    </main>
  );
}
