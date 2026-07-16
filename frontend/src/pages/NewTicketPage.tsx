import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';
import { getApiErrorMessage } from '../lib/auth-api';
import { catalogRequest } from '../lib/master-data-api';
import { createTicketRequest } from '../lib/tickets-api';
import type { MasterCatalog } from '../types/master-data';

function value(data: FormData, name: string): string {
  const entry = data.get(name); return typeof entry === 'string' ? entry.trim() : '';
}

export function NewTicketPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState<MasterCatalog | null>(null);
  const [categoryId, setCategoryId] = useState('');
  const [complaintTypeId, setComplaintTypeId] = useState('');
  const [circleId, setCircleId] = useState('');
  const [priorityId, setPriorityId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const domain = user?.role === 'consumer' || user?.role === 'employee' ? user.role : null;

  useEffect(() => {
    void catalogRequest().then((next) => {
      setCatalog(next);
      const firstCategory = next.categories.find((category) => category.domain === domain);
      setCategoryId(String(firstCategory?.id ?? ''));
      setComplaintTypeId(String(firstCategory?.complaintTypes[0]?.id ?? ''));
      setCircleId(String(next.circles[0]?.id ?? ''));
      setPriorityId(String(next.priorities.find((priority) => priority.slug === 'medium')?.id ?? next.priorities[0]?.id ?? ''));
    }).catch((caught: unknown) => setError(getApiErrorMessage(caught)));
  }, [domain]);

  const categories = useMemo(() => catalog?.categories.filter((category) => category.domain === domain) ?? [], [catalog, domain]);
  const selectedCategory = categories.find((category) => String(category.id) === categoryId);
  const complaintTypes = selectedCategory?.complaintTypes ?? [];
  const selectedType = complaintTypes.find((type) => String(type.id) === complaintTypeId);
  const cities = catalog?.circles.find((circle) => String(circle.id) === circleId)?.cities ?? [];

  if (domain === null) return <Navigate to="/app/tickets" replace />;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError(null);
    const data = new FormData(event.currentTarget);
    try {
      const ticket = await createTicketRequest({
        subject: value(data, 'subject'), description: value(data, 'description'),
        categoryId: Number(value(data, 'categoryId')), complaintTypeId: Number(value(data, 'complaintTypeId')),
        locationDetails: value(data, 'locationDetails'),
        otherCategory: value(data, 'otherCategory'), otherComplaintType: value(data, 'otherComplaintType'),
        ...(domain === 'consumer' ? { circleId: Number(value(data, 'circleId')), cityId: Number(value(data, 'cityId')) }
          : { departmentId: Number(value(data, 'departmentId')), priorityId: Number(value(data, 'priorityId')) }),
        idempotencyKey: crypto.randomUUID(),
      });
      void navigate(`/app/tickets/${ticket.id}`, { replace: true });
    } catch (caught) { setError(getApiErrorMessage(caught)); setBusy(false); }
  };

  return (
    <main className="workspace-page">
      <div className="workspace-page__heading"><div><p>Tickets / new {domain} request</p><h1>Submit a ticket</h1></div></div>
      {error !== null && <p className="page-message is-error">{error}</p>}
      <form className="panel form-grid ticket-form" onSubmit={(event) => void submit(event)}>
        <div className="panel__heading form-grid__wide"><div><span>Request details</span><h2>Tell us what needs attention</h2></div><small>{domain}</small></div>
        <label className="form-grid__wide"><span>Subject</span><input name="subject" required minLength={5} maxLength={180} placeholder="Briefly summarize the issue" /></label>
        <label className="form-grid__wide"><span>Description</span><textarea name="description" required minLength={10} maxLength={10000} rows={6} placeholder="Include the symptoms, impact, and anything already tried." /></label>
        <label><span>Category</span><select name="categoryId" value={categoryId} required onChange={(event) => { const next = event.target.value; setCategoryId(next); const category = categories.find((item) => String(item.id) === next); setComplaintTypeId(String(category?.complaintTypes[0]?.id ?? '')); }}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
        <label><span>Complaint type</span><select name="complaintTypeId" value={complaintTypeId} required onChange={(event) => setComplaintTypeId(event.target.value)}>{complaintTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></label>
        {selectedCategory?.name === 'Other' && <label className="form-grid__wide"><span>Describe the other category</span><input name="otherCategory" required /></label>}
        {selectedType?.name === 'Other' && <label className="form-grid__wide"><span>Describe the other complaint type</span><input name="otherComplaintType" required /></label>}
        {domain === 'consumer' ? <><label><span>Circle</span><select name="circleId" value={circleId} onChange={(event) => setCircleId(event.target.value)} required>{catalog?.circles.map((circle) => <option key={circle.id} value={circle.id}>{circle.name}</option>)}</select></label><label><span>City</span><select name="cityId" required>{cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}</select></label></> : <label className="form-grid__wide"><span>Department</span><input name="departmentName" value={selectedCategory?.parentName ?? 'Select a departmental category'} disabled /><input name="departmentId" type="hidden" value={selectedCategory?.departmentId ?? ''} /></label>}
        {domain === 'consumer'
          ? <div className="ticket-form__auto-priority"><strong>Priority is assigned automatically</strong><p>We use the selected issue type and your description to identify routine, important, urgent, and safety-critical complaints. Support staff can review it later.</p></div>
          : <label><span>Priority</span><select name="priorityId" required value={priorityId} onChange={(event) => setPriorityId(event.target.value)}>{catalog?.priorities.map((priority) => <option key={priority.id} value={priority.id}>{priority.name}</option>)}</select></label>}
        <label><span>Location / context</span><input name="locationDetails" placeholder="Office, feeder, landmark, or room" /></label>
        <div className="ticket-form__note form-grid__wide"><strong>Before submitting</strong><p>Use only fictional or demonstration information in this local environment. A unique ticket number and complete history will be created.</p></div>
        <button className="button button--primary form-grid__wide" type="submit" disabled={busy || catalog === null}>{busy ? 'Submitting...' : 'Submit ticket'}</button>
      </form>
    </main>
  );
}
