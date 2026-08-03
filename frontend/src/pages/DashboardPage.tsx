import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';
import { activeAnnouncementsRequest } from '../lib/administration-api';
import type { Announcement } from '../lib/administration-api';
import { getApiErrorMessage } from '../lib/auth-api';
import { ticketMetricsRequest } from '../lib/tickets-api';
import type { TicketMetrics } from '../lib/tickets-api';

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

export function DashboardPage() {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<TicketMetrics | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.allSettled([ticketMetricsRequest(), activeAnnouncementsRequest()]).then(
      ([metricsResult, announcementsResult]) => {
        if (!active) return;
        const failures: unknown[] = [];
        if (metricsResult.status === 'fulfilled') setMetrics(metricsResult.value);
        else failures.push(metricsResult.reason);
        if (announcementsResult.status === 'fulfilled') setAnnouncements(announcementsResult.value);
        else failures.push(announcementsResult.reason);
        setError(failures[0] === undefined ? null : getApiErrorMessage(failures[0]));
      },
    );
    return () => { active = false; };
  }, []);

  if (user === null) return null;
  const requester = user.role === 'consumer' || user.role === 'employee';

  return (
    <motion.main className="workspace-page overview-page" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <header className="overview-hero">
        <div className="overview-hero__copy">
          <p>Authenticated workspace / {user.role}</p>
          <h1>Welcome, {user.displayName.split(' ')[0]}.</h1>
          <span>{roleCopy[user.role]}</span>
        </div>
        <div className="overview-hero__actions">
          {requester ? <Link className="button button--primary" to="/app/tickets/new">Submit ticket</Link> : null}
          <Link className="button button--secondary" to="/app/tickets">Open ticket queue</Link>
        </div>
      </header>

      {error !== null ? <p className="page-message is-error">Some dashboard information could not be loaded: {error}</p> : null}

      <section className="overview-grid overview-metrics" aria-label="Ticket metrics">
        <article>
          <Link className="overview-metric-link" to="/app/tickets" aria-label="View all visible tickets">
            <div><span>Visible tickets</span><small>All in your scope</small></div>
            <strong>{metrics?.summary.total ?? '—'}</strong>
            <p>Your complete role-scoped ticket view.</p>
          </Link>
        </article>
        <article>
          <Link className="overview-metric-link" to="/app/tickets?view=open" aria-label="View open tickets">
            <div><span>Open work</span><small>Currently active</small></div>
            <strong>{metrics?.summary.open ?? '—'}</strong>
            <p>Tickets still moving through the workflow.</p>
          </Link>
        </article>
        <article className={(metrics?.summary.overdue ?? 0) > 0 ? 'overview-metric--risk' : undefined}>
          <Link className="overview-metric-link" to="/app/tickets?view=overdue" aria-label="View tickets past SLA">
            <div><span>Past SLA</span><small>Needs attention</small></div>
            <strong>{metrics?.summary.overdue ?? '—'}</strong>
            <p>Open tickets beyond their complaint-type and priority target.</p>
          </Link>
        </article>
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

        <aside className="panel dashboard-announcements" aria-labelledby="announcements-title">
          <div className="panel__heading">
            <div><span>From MEPCO</span><h2 id="announcements-title">Announcements</h2></div>
            {user.role === 'supervisor' || user.role === 'administrator'
              ? <Link to="/app/announcements">Manage</Link>
              : <small>{announcements.length} active</small>}
          </div>
          {announcements.length > 0 ? (
            <div className="announcement-feed">
              {announcements.map((item) => (
                <article key={item.id}>
                  <span>Announcement</span><strong>{item.title}</strong><p>{item.body}</p><small>{item.authorName}</small>
                </article>
              ))}
            </div>
          ) : <p className="empty-state">No active announcements right now.</p>}
        </aside>
      </div>
    </motion.main>
  );
}
