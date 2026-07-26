import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';

import { getApiErrorMessage } from '../lib/auth-api';
import { catalogRequest } from '../lib/master-data-api';
import { exportTicketsRequest, ticketMetricsRequest } from '../lib/tickets-api';
import type { TicketMetrics } from '../lib/tickets-api';
import type { MasterCatalog } from '../types/master-data';
import type { TicketSummary } from '../types/tickets';

interface ReportFilters {
  domain: string;
  status: string;
  priority: string;
  circleId: string;
  divisionId: string;
  subdivisionId: string;
  dateFrom: string;
  dateTo: string;
}

const emptyFilters: ReportFilters = {
  domain: '', status: '', priority: '', circleId: '', divisionId: '', subdivisionId: '', dateFrom: '', dateTo: '',
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-PK', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function formatHours(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'Not configured';
  if (value < 24) return `${value} ${value === 1 ? 'hour' : 'hours'}`;
  if (value % 24 === 0) {
    const days = value / 24;
    return `${days} ${days === 1 ? 'day' : 'days'}`;
  }
  return `${value} hours`;
}

function percentage(value: number, total: number): number {
  return total === 0 ? 0 : Math.round((value / total) * 100);
}

function ticketSlaState(ticket: TicketSummary): { label: string; tone: string } {
  if (['resolved', 'closed', 'cancelled'].includes(ticket.statusSlug)) return { label: 'Complete', tone: 'complete' };
  if (ticket.statusSlug === 'pending-user') return { label: 'Paused for user', tone: 'paused' };
  if (ticket.isOverdue === 1) return { label: 'Past target', tone: 'breached' };
  return { label: `Due ${formatDate(ticket.slaDueAt)}`, tone: 'healthy' };
}

export function ReportsPage() {
  const [metrics, setMetrics] = useState<TicketMetrics | null>(null);
  const [catalog, setCatalog] = useState<MasterCatalog | null>(null);
  const [filters, setFilters] = useState<ReportFilters>(emptyFilters);
  const [slaDomain, setSlaDomain] = useState('');
  const [slaSearch, setSlaSearch] = useState('');
  const [showAllTargets, setShowAllTargets] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'csv' | 'pdf' | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextMetrics, nextCatalog] = await Promise.all([ticketMetricsRequest(), catalogRequest()]);
      setMetrics(nextMetrics);
      setCatalog(nextCatalog);
      setLastUpdated(new Date());
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const divisions = catalog?.circles.find((circle) => String(circle.id) === filters.circleId)?.divisions ?? [];
  const subdivisions = divisions.find((division) => String(division.id) === filters.divisionId)?.subdivisions ?? [];
  const activeFilterCount = Object.values(filters).filter((value) => value !== '').length;

  const slaTargets = useMemo(() => {
    const query = slaSearch.trim().toLocaleLowerCase();
    return (catalog?.categories ?? []).flatMap((category) => category.complaintTypes.map((complaintType) => ({
      id: complaintType.id,
      name: complaintType.name,
      category: category.name,
      domain: category.domain ?? 'employee',
      hours: complaintType.slaTargetHours,
    }))).filter((target) => (
      (slaDomain === '' || target.domain === slaDomain)
      && (query === '' || `${target.name} ${target.category}`.toLocaleLowerCase().includes(query))
    ));
  }, [catalog, slaDomain, slaSearch]);

  const exportReport = async (format: 'csv' | 'pdf') => {
    if (filters.dateFrom !== '' && filters.dateTo !== '' && filters.dateFrom > filters.dateTo) {
      setError('The report end date must be on or after the start date.');
      return;
    }
    setBusy(format);
    setError(null);
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== ''));
      await exportTicketsRequest(format, params);
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setBusy(null);
    }
  };

  const summary = metrics?.summary;
  const total = summary?.total ?? 0;
  const open = summary?.open ?? 0;
  const overdue = summary?.overdue ?? 0;
  const resolved = summary?.resolved ?? 0;
  const resolutionRate = percentage(resolved, total);
  const slaHealth = open === 0 ? 100 : percentage(Math.max(0, open - overdue), open);
  const maxStatus = Math.max(1, ...(metrics?.byStatus.map((item) => item.count) ?? []));
  const maxPriority = Math.max(1, ...(metrics?.byPriority.map((item) => item.count) ?? []));
  const maxWorkload = Math.max(1, ...(metrics?.workload.map((item) => item.count) ?? []));
  const visibleTargets = showAllTargets ? slaTargets : slaTargets.slice(0, 10);

  return (
    <main className="workspace-page reports-page">
      <div className="workspace-page__heading reports-heading">
        <div><p>Operations intelligence</p><h1>Reports &amp; SLA</h1><span>Live service health, workload, targets, and export-ready evidence.</span></div>
        <button className="button button--secondary" type="button" disabled={loading} onClick={() => void load()}>
          {loading ? 'Refreshing' : 'Refresh data'}
        </button>
      </div>
      {error !== null && <p className="page-message is-error">{error}</p>}

      <section className="report-context" aria-label="Report context">
        <div><span className="report-live-dot" aria-hidden="true" /><strong>Authorized live scope</strong></div>
        <p>Metrics include every ticket your role is permitted to view.</p>
        <time>{lastUpdated === null ? 'Waiting for data' : `Updated ${formatDate(lastUpdated.toISOString())}`}</time>
      </section>

      <section className="report-kpi-grid" aria-label="Ticket performance summary">
        <article><span>Total visible</span><strong>{loading && metrics === null ? '—' : total}</strong><p>All tickets in your operational scope.</p><small>{total === 0 ? 'No ticket data yet' : 'Complete report population'}</small></article>
        <article><span>Open queue</span><strong>{loading && metrics === null ? '—' : open}</strong><p>Tickets still moving through the workflow.</p><small>{percentage(open, total)}% of visible tickets</small></article>
        <article className={overdue > 0 ? 'is-attention' : 'is-healthy'}><span>Past SLA</span><strong>{loading && metrics === null ? '—' : overdue}</strong><p>Active tickets beyond their effective target.</p><small>{overdue === 0 ? 'No active breaches' : `${percentage(overdue, open)}% of the open queue`}</small></article>
        <article><span>Resolution rate</span><strong>{loading && metrics === null ? '—' : `${resolutionRate}%`}</strong><p>{resolved} tickets are resolved or requester-closed.</p><small>{summary?.averageResolutionHours === null || summary === undefined ? 'No resolution-time sample' : `${summary.averageResolutionHours}h average resolution`}</small></article>
      </section>

      <section className="report-intelligence-grid">
        <article className="panel report-health-card">
          <div className="panel__heading"><div><span>SLA health</span><h2>Open queue within target</h2></div></div>
          <div className="report-health-card__body">
            <div className="sla-health-ring" style={{ '--sla-health': `${slaHealth * 3.6}deg` } as CSSProperties}>
              <div><strong>{slaHealth}%</strong><span>within target</span></div>
            </div>
            <div className="report-health-copy"><strong>{Math.max(0, open - overdue)} of {open} open tickets</strong><p>Pending-user tickets are paused and do not count as overdue while MEPCO waits for the requester.</p><Link to="/app/tickets?view=overdue">Review past-SLA tickets <span aria-hidden="true">→</span></Link></div>
          </div>
        </article>

        <article className="panel report-chart-card">
          <div className="panel__heading"><div><span>Workflow</span><h2>Status distribution</h2></div><strong>{total} total</strong></div>
          <div className="report-bars">
            {metrics?.byStatus.length === 0 && <p className="empty-state">No status data yet.</p>}
            {metrics?.byStatus.map((item) => <div className="report-bar" key={item.label}>
              <div><span>{item.label}</span><strong>{item.count}</strong></div>
              <div className="report-bar__track"><span style={{ width: `${percentage(item.count, maxStatus)}%` }} /></div>
            </div>)}
          </div>
        </article>

        <article className="panel report-chart-card">
          <div className="panel__heading"><div><span>Urgency</span><h2>Priority mix</h2></div></div>
          <div className="report-bars report-bars--priority">
            {metrics?.byPriority.length === 0 && <p className="empty-state">No priority data yet.</p>}
            {metrics?.byPriority.map((item) => <div className={`report-bar report-bar--${item.label.toLocaleLowerCase()}`} key={item.label}>
              <div><span>{item.label}</span><strong>{item.count}</strong></div>
              <div className="report-bar__track"><span style={{ width: `${percentage(item.count, maxPriority)}%` }} /></div>
            </div>)}
          </div>
        </article>
      </section>

      <section className="panel report-sla-watch">
        <div className="panel__heading"><div><span>Immediate view</span><h2>Recent ticket SLA watch</h2></div><Link to="/app/tickets">Open full ticket queue</Link></div>
        <div className="report-ticket-list">
          {metrics?.recent.length === 0 && <p className="empty-state">No recent tickets.</p>}
          {metrics?.recent.map((ticket) => {
            const slaState = ticketSlaState(ticket);
            return <Link className="report-ticket-row" to={`/app/tickets/${ticket.id}`} key={ticket.id}>
              <div><code>{ticket.ticketNumber}</code><strong>{ticket.subject}</strong><span>{ticket.complaintTypeName} · {ticket.priorityName}</span></div>
              <div><span className={`report-sla-state report-sla-state--${slaState.tone}`}>{slaState.label}</span><small>{ticket.assigneeName ?? 'Unassigned'}</small></div>
            </Link>;
          })}
        </div>
      </section>

      <section className="report-management-grid">
        <article className="panel report-workload-card">
          <div className="panel__heading"><div><span>Capacity</span><h2>Technician workload</h2></div><strong>{metrics?.workload.reduce((sum, item) => sum + item.count, 0) ?? 0} assignments</strong></div>
          <div className="report-workload-list">
            {metrics?.workload.length === 0 && <p className="empty-state">No active assignments.</p>}
            {metrics?.workload.map((item) => <div key={item.assigneeId}><div><span>{item.assigneeName}</span><strong>{item.count}</strong></div><div><span style={{ width: `${percentage(item.count, maxWorkload)}%` }} /></div></div>)}
          </div>
        </article>

        <article className="panel report-policy-card">
          <div className="panel__heading"><div><span>Policy logic</span><h2>How targets are applied</h2></div></div>
          <ol><li><span>01</span><div><strong>Complaint baseline</strong><p>Each complaint type provides its normal elapsed-hour target.</p></div></li><li><span>02</span><div><strong>Priority cap</strong><p>The shorter priority target is used when urgency requires it.</p></div></li><li><span>03</span><div><strong>Frozen on creation</strong><p>The effective target is saved with the ticket for consistent reporting.</p></div></li></ol>
          <div className="report-priority-caps">{catalog?.priorities.map((priority) => <div key={priority.id}><span>{priority.name}</span><strong>{priority.slaTargetHours === null ? 'Complaint target' : formatHours(priority.slaTargetHours)}</strong></div>)}</div>
        </article>
      </section>

      <section className="panel report-export-builder">
        <div className="panel__heading"><div><span>Report builder</span><h2>Export ticket evidence</h2><p>Filters apply to CSV and PDF exports; dashboard metrics remain your complete authorized scope.</p></div><span className="report-filter-count">{activeFilterCount === 0 ? 'All tickets' : `${activeFilterCount} active filters`}</span></div>
        <div className="report-filter-grid">
          <label><span>Ticket domain</span><select value={filters.domain} onChange={(event) => setFilters((current) => ({ ...current, domain: event.target.value }))}><option value="">All domains</option><option value="consumer">Consumer</option><option value="employee">Employee</option></select></label>
          <label><span>Status</span><select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}><option value="">All statuses</option>{catalog?.statuses.map((item) => <option value={item.slug} key={item.id}>{item.name}</option>)}</select></label>
          <label><span>Priority</span><select value={filters.priority} onChange={(event) => setFilters((current) => ({ ...current, priority: event.target.value }))}><option value="">All priorities</option>{catalog?.priorities.map((item) => <option value={item.slug} key={item.id}>{item.name}</option>)}</select></label>
          <label><span>Circle</span><select value={filters.circleId} onChange={(event) => setFilters((current) => ({ ...current, circleId: event.target.value, divisionId: '', subdivisionId: '' }))}><option value="">All circles</option>{catalog?.circles.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
          <label><span>Division</span><select value={filters.divisionId} disabled={filters.circleId === ''} onChange={(event) => setFilters((current) => ({ ...current, divisionId: event.target.value, subdivisionId: '' }))}><option value="">All divisions</option>{divisions.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
          <label><span>Sub-division</span><select value={filters.subdivisionId} disabled={filters.divisionId === ''} onChange={(event) => setFilters((current) => ({ ...current, subdivisionId: event.target.value }))}><option value="">All sub-divisions</option>{subdivisions.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
          <label><span>Created from</span><input type="date" value={filters.dateFrom} onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))} /></label>
          <label><span>Created to</span><input type="date" min={filters.dateFrom} value={filters.dateTo} onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))} /></label>
        </div>
        <div className="report-export-footer"><button type="button" className="report-clear-filters" disabled={activeFilterCount === 0 || busy !== null} onClick={() => setFilters(emptyFilters)}>Clear filters</button><div><button className="button button--secondary" type="button" disabled={busy !== null} onClick={() => void exportReport('csv')}>{busy === 'csv' ? 'Preparing CSV' : 'Export CSV'}</button><button className="button button--primary" type="button" disabled={busy !== null} onClick={() => void exportReport('pdf')}>{busy === 'pdf' ? 'Preparing PDF' : 'Export PDF'}</button></div></div>
      </section>

      <section className="panel report-sla-catalogue">
        <div className="panel__heading"><div><span>Reference catalogue</span><h2>Complaint SLA targets</h2><p>Configured operational targets from master data. Administrators can update them when policy changes.</p></div><strong>{slaTargets.length} targets</strong></div>
        <div className="report-sla-filters"><label><span>Search targets</span><input value={slaSearch} onChange={(event) => { setSlaSearch(event.target.value); setShowAllTargets(false); }} placeholder="Complaint type or category" /></label><label><span>Catalogue domain</span><select value={slaDomain} onChange={(event) => { setSlaDomain(event.target.value); setShowAllTargets(false); }}><option value="">All domains</option><option value="consumer">Consumer</option><option value="employee">Employee</option></select></label></div>
        <div className="report-sla-table" role="table" aria-label="Complaint SLA targets">
          <div className="report-sla-table__head" role="row"><span role="columnheader">Complaint type</span><span role="columnheader">Category</span><span role="columnheader">Domain</span><span role="columnheader">Normal target</span></div>
          {visibleTargets.map((target) => <div className="report-sla-table__row" role="row" key={target.id}><strong role="cell">{target.name}</strong><span role="cell">{target.category}</span><span role="cell" className="report-domain-badge">{target.domain}</span><strong role="cell">{formatHours(target.hours)}</strong></div>)}
          {visibleTargets.length === 0 && <p className="empty-state">No SLA targets match this search.</p>}
        </div>
        {slaTargets.length > 10 && <button className="report-show-targets" type="button" onClick={() => setShowAllTargets((current) => !current)}>{showAllTargets ? 'Show fewer targets' : `Show all ${slaTargets.length} targets`}</button>}
      </section>
    </main>
  );
}
