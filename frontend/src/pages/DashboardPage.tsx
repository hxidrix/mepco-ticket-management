import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';
import { getApiErrorMessage } from '../lib/auth-api';
import { activeAnnouncementsRequest } from '../lib/administration-api';
import type { Announcement } from '../lib/administration-api';
import { ticketMetricsRequest } from '../lib/tickets-api';
import type { TicketMetrics } from '../lib/tickets-api';

const roleCopy = {
  consumer: 'Track electricity-service complaints and stay informed from submission to closure.',
  employee: 'Coordinate departmental support requests with a complete, accountable history.',
  technician: 'Focus on assigned work, priority cases, and clear resolution updates.',
  supervisor: 'Control assignment queues, aging work, priorities, and closure review.',
  administrator: 'Manage identity, configuration, audit evidence, and system-wide activity.',
} as const;

export function DashboardPage() {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<TicketMetrics | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { void ticketMetricsRequest().then(setMetrics).catch((caught: unknown) => setError(getApiErrorMessage(caught))); }, []);
  useEffect(() => { void activeAnnouncementsRequest().then(setAnnouncements).catch((caught: unknown) => setError(getApiErrorMessage(caught))); }, []);
  if (user === null) return null;

  return (
    <motion.main
      className="workspace-page overview-page"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="workspace-page__heading">
        <div><p>Authenticated workspace / {user.role}</p><h1>Welcome, {user.displayName.split(' ')[0]}.</h1></div>
        <Link className="button button--secondary" to="/app/tickets">Open ticket queue</Link>
      </div>
      <p className="overview-page__lead">{roleCopy[user.role]}</p>
      {error !== null && <p className="page-message is-error">{error}</p>}
      <section className="overview-grid" aria-label="Ticket metrics">
        <article><span>Visible tickets</span><strong>{metrics?.summary.total ?? '—'}</strong><p>Your complete role-scoped ticket view.</p></article>
        <article><span>Open work</span><strong>{metrics?.summary.open ?? '—'}</strong><p>Tickets still moving through the workflow.</p></article>
        <article><span>Past SLA</span><strong>{metrics?.summary.overdue ?? '—'}</strong><p>Open tickets beyond their priority target.</p></article>
      </section>
      <section className="panel dashboard-breakdown"><div className="panel__heading"><div><span>Live queue</span><h2>Status breakdown</h2></div>{(user.role === 'supervisor' || user.role === 'administrator') && <Link to="/app/reports">View reports</Link>}</div>
        <div>{metrics?.byStatus.map((item) => <article key={item.label}><span>{item.label}</span><strong>{item.count}</strong></article>)}</div>
      </section>
      {announcements.length > 0 && <section className="announcement-feed" aria-label="Announcements">{announcements.map((item) => <article key={item.id}><span>Announcement</span><strong>{item.title}</strong><p>{item.body}</p><small>{item.authorName}</small></article>)}</section>}
    </motion.main>
  );
}
