import { useEffect, useState } from 'react';

import { getApiErrorMessage } from '../lib/auth-api';
import { exportTicketsRequest, ticketMetricsRequest } from '../lib/tickets-api';
import type { TicketMetrics } from '../lib/tickets-api';

export function ReportsPage() {
  const [metrics, setMetrics] = useState<TicketMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'csv' | 'pdf' | null>(null);
  useEffect(() => { void ticketMetricsRequest().then(setMetrics).catch((caught: unknown) => setError(getApiErrorMessage(caught))); }, []);
  const exportReport = async (format: 'csv' | 'pdf') => {
    setBusy(format); setError(null);
    try { await exportTicketsRequest(format); } catch (caught) { setError(getApiErrorMessage(caught)); } finally { setBusy(null); }
  };
  return <main className="workspace-page">
    <div className="workspace-page__heading"><div><p>Operations intelligence</p><h1>Reports and SLA</h1></div><div className="report-export-actions"><button className="button button--secondary" type="button" disabled={busy !== null} onClick={() => void exportReport('csv')}>{busy === 'csv' ? 'Preparing CSV…' : 'Export CSV'}</button><button className="button button--primary" type="button" disabled={busy !== null} onClick={() => void exportReport('pdf')}>{busy === 'pdf' ? 'Preparing PDF…' : 'Export PDF'}</button></div></div>
    {error !== null && <p className="page-message is-error">{error}</p>}
    <section className="overview-grid report-summary"><article><span>Resolved</span><strong>{metrics?.summary.resolved ?? '—'}</strong><p>Resolved or requester-closed tickets.</p></article><article><span>Average resolution</span><strong>{metrics?.summary.averageResolutionHours === null || metrics === null ? '—' : `${metrics.summary.averageResolutionHours}h`}</strong><p>Submission to technical resolution.</p></article><article><span>Overdue</span><strong>{metrics?.summary.overdue ?? '—'}</strong><p>Open cases beyond their complaint-type and priority target.</p></article></section>
    <div className="report-grid"><section className="panel report-card"><div className="panel__heading"><div><span>Distribution</span><h2>By priority</h2></div></div>{metrics?.byPriority.map((item) => <div className="report-row" key={item.label}><span>{item.label}</span><strong>{item.count}</strong></div>)}</section>
      <section className="panel report-card"><div className="panel__heading"><div><span>Capacity</span><h2>Technician workload</h2></div></div>{metrics?.workload.length === 0 ? <p className="empty-state">No active assignments.</p> : metrics?.workload.map((item) => <div className="report-row" key={item.assigneeId}><span>{item.assigneeName}</span><strong>{item.count}</strong></div>)}</section></div>
  </main>;
}
