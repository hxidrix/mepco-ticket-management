import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';
import { requestAccountSuspension } from '../lib/account-governance-api';
import type { SuspensionCategory } from '../lib/account-governance-api';
import { getApiErrorMessage } from '../lib/auth-api';
import { catalogRequest } from '../lib/master-data-api';
import {
  addCommentRequest,
  assignTicketRequest,
  changePriorityRequest,
  closeTicketWithReviewRequest,
  deleteTicketRequest,
  downloadAttachmentRequest,
  techniciansRequest,
  ticketDetailRequest,
  transitionTicketRequest,
  uploadAttachmentRequest,
} from '../lib/tickets-api';
import type { TechnicianOption } from '../lib/tickets-api';
import type { MasterCatalog } from '../types/master-data';
import type { TicketDetail } from '../types/tickets';

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-PK', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function formatSlaTarget(hours: number): string {
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'}`;
  const days = hours / 24;
  return `${Number.isInteger(days) ? days : days.toFixed(1)} day${days === 1 ? '' : 's'}`;
}

function eventLabel(value: string): string { return value.replaceAll('_', ' ').replace(/\b\w/gu, (letter) => letter.toUpperCase()); }
function formValue(data: FormData, name: string): string {
  const entry = data.get(name);
  return typeof entry === 'string' ? entry.trim() : '';
}

export function TicketDetailPage() {
  const { user } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const ticketId = Number(id);
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [catalog, setCatalog] = useState<MasterCatalog | null>(null);
  const [technicians, setTechnicians] = useState<TechnicianOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [suspensionFormOpen, setSuspensionFormOpen] = useState(false);
  const manager = user?.role === 'supervisor' || user?.role === 'administrator';
  const requester = user?.role === 'employee';

  const load = useCallback(async () => {
    if (!Number.isSafeInteger(ticketId)) { setError('The ticket identifier is invalid.'); return; }
    try { setDetail(await ticketDetailRequest(ticketId)); }
    catch (caught) { setError(getApiErrorMessage(caught)); }
  }, [ticketId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void catalogRequest().then(setCatalog).catch(() => undefined); }, []);
  useEffect(() => {
    if ((user?.role === 'supervisor' || user?.role === 'administrator') && Number.isSafeInteger(ticketId)) {
      void techniciansRequest(ticketId).then(setTechnicians).catch(() => setTechnicians([]));
    }
  }, [ticketId, user?.role]);

  const mutate = async (operation: () => Promise<void>, success: string) => {
    setBusy(true); setError(null); setMessage(null);
    try { await operation(); setMessage(success); await load(); }
    catch (caught) { setError(getApiErrorMessage(caught)); }
    finally { setBusy(false); }
  };

  const submitAssignment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (detail === null) return;
    const data = new FormData(event.currentTarget);
    void mutate(() => assignTicketRequest(ticketId, {
      technicianId: Number(formValue(data, 'technicianId')), reason: formValue(data, 'reason'),
      version: detail.ticket.version,
    }), 'Assignment updated.');
  };

  const submitTransition = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (detail === null) return;
    const data = new FormData(event.currentTarget);
    const summary = formValue(data, 'resolutionSummary');
    void mutate(() => transitionTicketRequest(ticketId, {
      status: formValue(data, 'status'), reason: formValue(data, 'reason'),
      ...(summary === '' ? {} : { resolutionSummary: summary }), version: detail.ticket.version,
    }), 'Ticket status updated.');
  };

  const submitPriority = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (detail === null) return;
    const data = new FormData(event.currentTarget);
    void mutate(() => changePriorityRequest(ticketId, {
      priorityId: Number(formValue(data, 'priorityId')), reason: formValue(data, 'reason'),
      version: detail.ticket.version,
    }), 'Priority updated.');
  };

  const submitClosureReview = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (detail === null) return;
    const data = new FormData(event.currentTarget);
    const reviewText = formValue(data, 'reviewText');
    void mutate(() => closeTicketWithReviewRequest(ticketId, {
      issueResolved: formValue(data, 'issueResolved') === 'yes',
      satisfactionRating: Number(formValue(data, 'satisfactionRating')),
      ...(reviewText === '' ? {} : { reviewText }),
      version: detail.ticket.version,
    }), 'Ticket closed and feedback submitted.');
  };

  const submitDeletion = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (detail === null) return;
    const data = new FormData(event.currentTarget);
    if (!window.confirm('Delete this ticket? It will disappear from all ticket lists.')) return;
    setBusy(true); setError(null); setMessage(null);
    try {
      await deleteTicketRequest(ticketId, {
        reason: formValue(data, 'reason'),
        version: detail.ticket.version,
      });
      void navigate('/app/tickets', { replace: true });
    } catch (caught) {
      setError(getApiErrorMessage(caught));
      setBusy(false);
    }
  };

  const submitComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
    const selectedVisibility = formValue(data, 'visibility');
    await mutate(() => addCommentRequest(ticketId, {
      body: formValue(data, 'body'),
      visibility: requester || selectedVisibility !== 'internal' ? 'public' : 'internal',
    }), 'Comment added.');
    form.reset();
  };

  const submitAttachment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); const file = data.get('file');
    if (!(file instanceof File) || file.size === 0) { setError('Select a file to upload.'); return; }
    await mutate(() => uploadAttachmentRequest(ticketId, file), 'Attachment uploaded.');
    form.reset();
  };

  const submitSuspensionRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true); setError(null); setMessage(null);
    try {
      await requestAccountSuspension(ticketId, {
        category: formValue(data, 'category') as SuspensionCategory,
        reasonSummary: formValue(data, 'reasonSummary'),
        details: formValue(data, 'details'),
      });
      form.reset();
      setSuspensionFormOpen(false);
      setMessage('The suspension request was sent to supervisors and administrators for review.');
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  if (detail === null) return <div className="workspace-loading">{error ?? 'Loading ticket...'}</div>;
  const { ticket } = detail;
  const requesterReadOnly = requester && ['closed', 'cancelled'].includes(ticket.statusSlug);
  const transitions = detail.allowedStatusTransitions;
  return (
    <main className="workspace-page ticket-detail">
      <Link className="back-link" to="/app/tickets">Back to tickets</Link>
      <div className="workspace-page__heading"><div><p>{ticket.ticketNumber} / {ticket.domain}</p><h1>{ticket.subject}</h1></div><div className="ticket-detail__badges"><span className={`priority-mark priority-mark--${ticket.prioritySlug}`}>{ticket.priorityName}</span><span className={`ticket-status ticket-status--${ticket.statusSlug}`}>{ticket.statusName}</span></div></div>
      {(message !== null || error !== null) && <p className={error === null ? 'page-message is-success' : 'page-message is-error'}>{error ?? message}</p>}
      {(manager || transitions.length > 0) && <section className="workflow-bar">
        {manager && <form key={`assign-${ticket.version}`} onSubmit={submitAssignment}><label><span>Assign technician</span><select name="technicianId" defaultValue={ticket.assigneeId ?? ''} required><option value="">Select technician</option>{technicians.map((technician) => <option key={technician.id} value={technician.id}>{technician.displayName} · {technician.activeAssignments} active</option>)}</select></label><label><span>Assignment reason</span><input name="reason" defaultValue="Queue ownership update" required /></label><button className="button button--secondary" type="submit" disabled={busy}>Assign</button></form>}
        {transitions.length > 0 && <form key={`status-${ticket.version}`} onSubmit={submitTransition}><label><span>Change status to</span><select name="status" required>{transitions.map((status) => <option key={status} value={status}>{catalog?.statuses.find((item) => item.slug === status)?.name ?? eventLabel(status)}</option>)}</select></label><label><span>Reason</span><input name="reason" defaultValue="Workflow update" required /></label>{transitions.includes('resolved') && <label><span>Resolution summary</span><input name="resolutionSummary" placeholder="Required when resolving" /></label>}<button className="button button--primary" type="submit" disabled={busy}>Update status</button></form>}
        {manager && <form key={`priority-${ticket.version}`} onSubmit={submitPriority}><label><span>Priority</span><select name="priorityId" defaultValue={ticket.priorityId}>{catalog?.priorities.map((priority) => <option key={priority.id} value={priority.id}>{priority.name}</option>)}</select></label><label><span>Reason</span><input name="reason" defaultValue="Priority review" required /></label><button className="button button--secondary" type="submit" disabled={busy}>Set priority</button></form>}
      </section>}
      {requester && !['closed', 'cancelled'].includes(ticket.statusSlug) && <section className="panel ticket-closure">
        <div className="panel__heading"><div><span>Requester action</span><h2>Closure and feedback</h2></div></div>
        {!reviewOpen
          ? <div className="ticket-closure__prompt"><p>Review the resolution, then close the ticket and tell us about your experience.</p><button className="button button--primary" type="button" onClick={() => setReviewOpen(true)}>Close ticket</button></div>
          : <form className="ticket-review-form" onSubmit={submitClosureReview}>
              <fieldset><legend>Was the issue resolved?</legend><label><input type="radio" name="issueResolved" value="yes" defaultChecked required /> Yes</label><label><input type="radio" name="issueResolved" value="no" required /> No</label></fieldset>
              <label><span>Satisfaction rating</span><select name="satisfactionRating" defaultValue="5" required><option value="5">5 - Very satisfied</option><option value="4">4 - Satisfied</option><option value="3">3 - Neutral</option><option value="2">2 - Dissatisfied</option><option value="1">1 - Very dissatisfied</option></select></label>
              <label className="ticket-review-form__wide"><span>Review <small>optional</small></span><textarea name="reviewText" maxLength={2000} rows={4} placeholder="Tell us what went well or what could be improved." /></label>
              <div className="ticket-review-form__actions"><button className="button button--secondary" type="button" onClick={() => setReviewOpen(false)}>Cancel</button><button className="button button--primary" type="submit" disabled={busy}>{busy ? 'Closing...' : 'Close ticket and submit review'}</button></div>
            </form>}
      </section>}
      {detail.review !== null && <section className="panel ticket-review-summary"><div className="panel__heading"><div><span>Requester feedback</span><h2>Closure review</h2></div></div><dl><div><dt>Issue resolved</dt><dd>{detail.review.issueResolved ? 'Yes' : 'No'}</dd></div><div><dt>Satisfaction</dt><dd>{detail.review.satisfactionRating} / 5</dd></div><div><dt>Submitted by</dt><dd>{detail.review.requesterName}</dd></div></dl>{detail.review.reviewText !== null && <p>{detail.review.reviewText}</p>}</section>}
      {user?.role === 'technician' && <section className="panel ticket-suspension-request"><div className="panel__heading"><div><span>Account safety</span><h2>Request account suspension</h2></div><small>Manager review required</small></div><div className="ticket-suspension-request__summary"><p>If {ticket.requesterName}'s conduct or account activity requires formal review, submit complete details linked to this ticket. This does not suspend the account immediately.</p><button className="button button--secondary" type="button" onClick={() => setSuspensionFormOpen((open) => !open)}>{suspensionFormOpen ? 'Cancel request' : 'Prepare request'}</button></div>{suspensionFormOpen && <form onSubmit={(event) => void submitSuspensionRequest(event)}><label><span>Reason category</span><select name="category" required><option value="abusive-behavior">Abusive behavior</option><option value="fraudulent-information">Fraudulent information</option><option value="repeated-policy-violation">Repeated policy violation</option><option value="security-risk">Security risk</option><option value="misuse-of-service">Misuse of service</option><option value="other">Other documented reason</option></select></label><label><span>Reason summary</span><input name="reasonSummary" minLength={10} maxLength={255} required placeholder="Clear summary for the review queue" /></label><label className="ticket-suspension-request__wide"><span>Full details and evidence</span><textarea name="details" minLength={20} maxLength={4000} required placeholder="Describe the conduct, dates, conversation or attachments that support this request." /></label><button className="button button--danger ticket-suspension-request__wide" type="submit" disabled={busy}>Send for review</button></form>}</section>}
      {user?.role === 'administrator' && <section className="panel ticket-danger-zone"><div className="panel__heading"><div><span>Administrator action</span><h2>Delete ticket</h2></div></div><p>Soft-delete this ticket from operational lists. The audit record is retained.</p><form onSubmit={(event) => void submitDeletion(event)}><label><span>Deletion reason</span><input name="reason" minLength={3} maxLength={500} required placeholder="Explain why this ticket should be deleted" /></label><button className="button button--danger" type="submit" disabled={busy}>Delete ticket</button></form></section>}
      <div className="ticket-detail__grid">
        <div className="ticket-detail__main">
          <section className="panel ticket-section"><div className="panel__heading"><div><span>Request</span><h2>Issue details</h2></div></div><p className="ticket-description">{ticket.description}</p><dl className="ticket-facts"><div><dt>Category</dt><dd>{ticket.categoryName}</dd></div><div><dt>Complaint type</dt><dd>{ticket.complaintTypeName}</dd></div><div><dt>Effective SLA</dt><dd>{formatSlaTarget(ticket.slaTargetHours)}{ticket.isOverdue === 1 ? ' · Overdue' : ''}</dd></div><div><dt>SLA due</dt><dd>{formatDate(ticket.slaDueAt)}</dd></div><div><dt>Department / location</dt><dd>{ticket.departmentName ?? [ticket.circleName, ticket.divisionName, ticket.subdivisionName].filter(Boolean).join(' / ')}</dd></div><div><dt>Assigned to</dt><dd>{ticket.assigneeName ?? 'Awaiting assignment'}</dd></div></dl></section>
          <section className="panel ticket-section"><div className="panel__heading"><div><span>Conversation</span><h2>Ticket updates</h2></div></div>
            {!requesterReadOnly && <form className={requester ? 'ticket-comment-form ticket-comment-form--requester' : 'ticket-comment-form'} onSubmit={(event) => void submitComment(event)}><label><span>Add comment</span><textarea name="body" minLength={1} maxLength={10000} required placeholder="Share an update or ask for more information" /></label>
              {!requester && <label><span>Visibility</span><select name="visibility" defaultValue="public"><option value="public">Public — requester can see</option>{(user?.role === 'technician' || manager) && <option value="internal">Internal — staff only</option>}</select></label>}
              <button className="button button--primary" type="submit" disabled={busy}>Post comment</button></form>}
            {detail.comments.length === 0 ? <p className="empty-state">No updates yet.</p> : <div className="comment-list">{detail.comments.map((comment) => <article key={comment.id}><div><strong>{comment.authorName}</strong><span>{comment.authorRole}{!requester && ` · ${comment.visibility}`}</span><time>{formatDate(comment.createdAt)}</time></div><p>{comment.body}</p></article>)}</div>}
          </section>
          <section className="panel ticket-section"><div className="panel__heading"><div><span>Evidence</span><h2>Attachments</h2></div></div>
            {!requesterReadOnly && <><form className="ticket-attachment-form" onSubmit={(event) => void submitAttachment(event)}><input name="file" type="file" accept=".jpg,.jpeg,.png,.pdf,.txt,.doc,.docx" required /><button className="button button--secondary" type="submit" disabled={busy}>Upload</button></form>
            <p className="field-hint">JPG, PNG, PDF, TXT, DOC or DOCX. Maximum 5 MB.</p></>}
            {detail.attachments.length === 0 ? <p className="empty-state">No evidence files uploaded.</p> : <ul className="attachment-list">{detail.attachments.map((attachment) => <li key={attachment.id}><div><strong>{attachment.originalName}</strong><span>{Math.max(1, Math.round(attachment.sizeBytes / 1024))} KB · {formatDate(attachment.createdAt)}</span></div><button type="button" onClick={() => void downloadAttachmentRequest(attachment.id, attachment.originalName).catch((caught) => setError(getApiErrorMessage(caught)))}>Download</button></li>)}</ul>}
          </section>
        </div>
        <aside className="panel ticket-timeline"><div className="panel__heading"><div><span>Audit trail</span><h2>History</h2></div></div><ol>{detail.history.map((event) => <li key={event.id}><span /><div><strong>{eventLabel(event.eventType)}</strong><p>{event.reason ?? 'Workflow event recorded'}</p><time>{event.actorName ?? 'System'} · {formatDate(event.createdAt)}</time></div></li>)}</ol></aside>
      </div>
    </main>
  );
}
