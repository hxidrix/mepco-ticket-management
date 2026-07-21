import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';
import { getApiErrorMessage } from '../lib/auth-api';
import { activeAnnouncementsRequest } from '../lib/administration-api';
import type { Announcement } from '../lib/administration-api';
import { ticketMetricsRequest, ticketsRequest } from '../lib/tickets-api';
import type { TicketMetrics } from '../lib/tickets-api';
import type { TicketSummary } from '../types/tickets';

const roleCopy = {
  consumer: 'Track electricity-service complaints and stay informed from submission to closure.',
  employee: 'Coordinate departmental support requests with a complete, accountable history.',
  technician: 'Focus on assigned work, priority cases, and clear resolution updates.',
  supervisor: 'Control assignment queues, aging work, priorities, and closure review.',
  administrator: 'Manage identity, configuration, audit evidence, and system-wide activity.',
} as const;

function formatUpdatedAt(value: string): string {
  return new Intl.DateTimeFormat('en-PK', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function formatHours(value: number | null): string {
  if (value === null) return 'Not available';
  const hours = Number(value);
  if (!Number.isFinite(hours)) return 'Not available';
  if (hours < 24) return `${hours.toFixed(hours < 10 ? 1 : 0)} hours`;
  return `${(hours / 24).toFixed(1)} days`;
}

export function DashboardPage() {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<TicketMetrics | null>(null);
  const [pendingTickets, setPendingTickets] = useState<TicketSummary[]>([]);
  const [pendingTotal, setPendingTotal] = useState<number | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.allSettled([
      ticketMetricsRequest(),
      ticketsRequest({ params: { page: 1, pageSize: 4, status: 'pending-user', sortBy: 'updatedAt', sortOrder: 'desc' } }),
      activeAnnouncementsRequest(),
    ]).then(([metricsResult, pendingResult, announcementsResult]) => {
      if (!active) return;
      const failures: unknown[] = [];
      if (metricsResult.status === 'fulfilled') setMetrics(metricsResult.value);
      else failures.push(metricsResult.reason);
      if (pendingResult.status === 'fulfilled') {
        setPendingTickets(pendingResult.value.items);
        setPendingTotal(pendingResult.value.meta.totalItems);
      } else failures.push(pendingResult.reason);
      if (announcementsResult.status === 'fulfilled') setAnnouncements(announcementsResult.value);
      else failures.push(announcementsResult.reason);
      if (failures[0] !== undefined) setError(getApiErrorMessage(failures[0]));
    });
    return () => { active = false; };
  }, []);

  const statusMaximum = Math.max(1, ...(metrics?.byStatus.map((item) => item.count) ?? [1]));

  if (user === null) return null;
  const requester = user.role === 'consumer' || user.role === 'employee';
  const responseTitle = requester ? 'Waiting for your response' : 'Waiting on requester';
  const responseCopy = requester
    ? 'A support team member needs more information or confirmation from you.'
    : 'These tickets cannot move forward until the requester replies.';

  return (
    <motion.main
      className="workspace-page overview-page"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <header className="overview-hero">
        <div className="overview-hero__copy">
          <p>Authenticated workspace / {user.role}</p>
          <h1>Welcome, {user.displayName.split(' ')[0]}.</h1>
          <span>{roleCopy[user.role]}</span>
        </div>
        <div className="overview-hero__actions">
          {requester && <Link className="button button--primary" to="/app/tickets/new">Submit ticket</Link>}
          <Link className="button button--secondary" to="/app/tickets">Open ticket queue</Link>
        </div>
      </header>

      {error !== null && <p className="page-message is-error">Some dashboard information could not be loaded: {error}</p>}

      <section className="overview-grid overview-metrics" aria-label="Ticket metrics">
        <article>
          <div><span>Visible tickets</span><small>All in your scope</small></div>
          <strong>{metrics?.summary.total ?? '—'}</strong>
          <p>Your complete role-scoped ticket view.</p>
        </article>
        <article>
          <div><span>Open work</span><small>Currently active</small></div>
          <strong>{metrics?.summary.open ?? '—'}</strong>
          <p>Tickets still moving through the workflow.</p>
        </article>
        <article className={(pendingTotal ?? 0) > 0 ? 'overview-metric--attention' : undefined}>
          <div><span>Awaiting response</span><small>{requester ? 'Action required' : 'Requester action'}</small></div>
          <strong>{pendingTotal ?? '—'}</strong>
          <p>{requester ? 'Tickets that need your reply.' : 'Tickets paused for requester input.'}</p>
        </article>
        <article className={(metrics?.summary.overdue ?? 0) > 0 ? 'overview-metric--risk' : undefined}>
          <div><span>Past SLA</span><small>Needs attention</small></div>
          <strong>{metrics?.summary.overdue ?? '—'}</strong>
          <p>Open tickets beyond their complaint-type and priority target.</p>
        </article>
      </section>

      <section className={`panel response-watch${(pendingTotal ?? 0) > 0 ? ' response-watch--active' : ' response-watch--clear'}`} aria-labelledby="response-watch-title">
        <div className="response-watch__summary">
          <div className="response-watch__signal" aria-hidden="true"><span /></div>
          <div>
            <span className="response-watch__eyebrow">Response watch</span>
            <h2 id="response-watch-title">{(pendingTotal ?? 0) > 0 ? responseTitle : 'No responses outstanding'}</h2>
            <p>{(pendingTotal ?? 0) > 0 ? responseCopy : 'Nothing is currently blocked waiting for user information.'}</p>
          </div>
          <strong>{pendingTotal ?? '—'}</strong>
        </div>

        {pendingTickets.length > 0 ? (
          <div className="response-ticket-list">
            {pendingTickets.map((ticket) => (
              <Link to={`/app/tickets/${ticket.id}`} key={ticket.id}>
                <div>
                  <code>{ticket.ticketNumber}</code>
                  <strong>{ticket.subject}</strong>
                  <span>{ticket.categoryName} · Updated {formatUpdatedAt(ticket.updatedAt)}</span>
                </div>
                <div>
                  <span className={`priority-mark priority-mark--${ticket.prioritySlug}`}>{ticket.priorityName}</span>
                  <b>Review ticket</b>
                </div>
              </Link>
            ))}
          </div>
        ) : pendingTotal === null ? (
          <p className="response-watch__loading">Checking for tickets that need a response…</p>
        ) : null}

        {(pendingTotal ?? 0) > 0 && (
          <Link className="response-watch__all" to="/app/tickets?status=pending-user">View all awaiting-response tickets</Link>
        )}
      </section>

      <div className="overview-dashboard-grid">
        <section className="panel dashboard-activity" aria-labelledby="recent-activity-title">
          <div className="panel__heading">
            <div><span>Latest movement</span><h2 id="recent-activity-title">Recent tickets</h2></div>
            <Link to="/app/tickets">View queue</Link>
          </div>
          <div className="dashboard-ticket-list">
            {(metrics?.recent.length ?? 0) === 0 ? <p className="empty-state">No recent tickets in your view.</p> : metrics?.recent.map((ticket) => (
              <Link to={`/app/tickets/${ticket.id}`} key={ticket.id}>
                <div><code>{ticket.ticketNumber}</code><strong>{ticket.subject}</strong><span>{ticket.categoryName}</span></div>
                <div><span className={`ticket-status ticket-status--${ticket.statusSlug}`}>{ticket.statusName}</span><time>{formatUpdatedAt(ticket.updatedAt)}</time></div>
              </Link>
            ))}
          </div>
        </section>

        <aside className="panel dashboard-health" aria-labelledby="queue-health-title">
          <div className="panel__heading"><div><span>At a glance</span><h2 id="queue-health-title">Queue health</h2></div></div>
          <dl className="dashboard-health__facts">
            <div><dt>Resolved</dt><dd>{metrics?.summary.resolved ?? '—'}</dd></div>
            <div><dt>Average resolution</dt><dd>{formatHours(metrics?.summary.averageResolutionHours ?? null)}</dd></div>
          </dl>
          <div className="dashboard-status-bars">
            {metrics?.byStatus.map((item) => (
              <div key={item.label}>
                <div><span>{item.label}</span><strong>{item.count}</strong></div>
                <i><span style={{ width: `${Math.max(5, (item.count / statusMaximum) * 100)}%` }} /></i>
              </div>
            ))}
          </div>
          {(user.role === 'supervisor' || user.role === 'administrator') && <Link className="dashboard-health__link" to="/app/reports">Open reports and SLA</Link>}
        </aside>
      </div>

      {announcements.length > 0 && (
        <section className="overview-announcements" aria-labelledby="announcements-title">
          <div className="overview-section-heading"><div><span>From MEPCO</span><h2 id="announcements-title">Announcements</h2></div><small>{announcements.length} active</small></div>
          <div className="announcement-feed">{announcements.map((item) => <article key={item.id}><span>Announcement</span><strong>{item.title}</strong><p>{item.body}</p><small>{item.authorName}</small></article>)}</div>
        </section>
      )}
    </motion.main>
  );
}
