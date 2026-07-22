import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';
import { getApiErrorMessage } from '../lib/auth-api';
import { catalogRequest } from '../lib/master-data-api';
import { ticketsRequest } from '../lib/tickets-api';
import type { MasterCatalog } from '../types/master-data';
import type { TicketSummary } from '../types/tickets';
import type { PaginationMeta } from '../types/users';

const emptyMeta: PaginationMeta = { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 };

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-PK', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export function TicketsPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialStatus = searchParams.get('status') ?? '';
  const requestedView = searchParams.get('view');
  const dashboardView = requestedView === 'open' || requestedView === 'overdue' ? requestedView : '';
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [catalog, setCatalog] = useState<MasterCatalog | null>(null);
  const [meta, setMeta] = useState(emptyMeta);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(initialStatus);
  const [priority, setPriority] = useState('');
  const [domain, setDomain] = useState(''); const [categoryId, setCategoryId] = useState('');
  const [dateFrom, setDateFrom] = useState(''); const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState('createdAt'); const [sortOrder, setSortOrder] = useState('desc');
  const [filters, setFilters] = useState({ search: '', status: initialStatus, priority: '', domain: '', categoryId: '', dateFrom: '', dateTo: '', sortBy: 'createdAt', sortOrder: 'desc' });
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (page = 1) => {
    setError(null);
    try {
      const result = await ticketsRequest({ params: { page, pageSize: 20,
        ...(filters.search === '' ? {} : { search: filters.search }),
        ...(filters.status === '' ? {} : { status: filters.status }),
        ...(dashboardView === '' ? {} : { view: dashboardView }),
        ...(filters.priority === '' ? {} : { priority: filters.priority }),
        ...(filters.domain === '' ? {} : { domain: filters.domain }),
        ...(filters.categoryId === '' ? {} : { categoryId: filters.categoryId }),
        ...(filters.dateFrom === '' ? {} : { dateFrom: filters.dateFrom }),
        ...(filters.dateTo === '' ? {} : { dateTo: filters.dateTo }),
        sortBy: filters.sortBy, sortOrder: filters.sortOrder,
      } });
      setTickets(result.items); setMeta(result.meta);
    } catch (caught) { setError(getApiErrorMessage(caught)); }
  }, [dashboardView, filters]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void catalogRequest().then(setCatalog).catch((caught: unknown) => setError(getApiErrorMessage(caught))); }, []);
  const canSubmit = user?.role === 'consumer' || user?.role === 'employee';
  const categoryDomain = canSubmit ? user.role : domain;
  const dashboardViewLabel = dashboardView === 'open'
    ? 'Showing tickets that are still open'
    : dashboardView === 'overdue' ? 'Showing open tickets that are past SLA' : null;

  const clearDashboardView = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('view');
    setSearchParams(next, { replace: true });
  };

  return (
    <main className="workspace-page">
      <div className="workspace-page__heading"><div><p>Tickets / {user?.role}</p><h1>{canSubmit ? 'My tickets' : 'Ticket queue'}</h1></div>{canSubmit && <Link className="button button--primary" to="/app/tickets/new">Submit ticket</Link>}</div>
      {error !== null && <p className="page-message is-error">{error}</p>}
      <section className="panel ticket-directory">
        {dashboardViewLabel !== null && (
          <div className="ticket-view-filter" role="status">
            <span>{dashboardViewLabel}</span>
            <button type="button" onClick={clearDashboardView}>Show all tickets</button>
          </div>
        )}
        <form className={`directory-filters ticket-filters${canSubmit ? ' ticket-filters--without-domain' : ''}`} onSubmit={(event) => { event.preventDefault(); setFilters({ search, status, priority, domain: canSubmit ? '' : domain, categoryId, dateFrom, dateTo, sortBy, sortOrder }); }}>
          <label><span>Search</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ticket number, subject, or description" /></label>
          <label><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option>{catalog?.statuses.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}</select></label>
          <label><span>Priority</span><select value={priority} onChange={(event) => setPriority(event.target.value)}><option value="">All priorities</option>{catalog?.priorities.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}</select></label>
          {!canSubmit && <label><span>Domain</span><select value={domain} onChange={(event) => { setDomain(event.target.value); setCategoryId(''); }}><option value="">All domains</option><option value="consumer">Consumer</option><option value="employee">Employee</option></select></label>}
          <label><span>Category</span><select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">All categories</option>{catalog?.categories.filter((item) => categoryDomain === '' || item.domain === categoryDomain).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label><span>Created from</span><input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label>
          <label><span>Created to</span><input type="date" value={dateTo} min={dateFrom} onChange={(event) => setDateTo(event.target.value)} /></label>
          <label><span>Sort by</span><select value={sortBy} onChange={(event) => setSortBy(event.target.value)}><option value="createdAt">Created date</option><option value="updatedAt">Last updated</option><option value="ticketNumber">Ticket number</option><option value="priority">Priority</option><option value="status">Status</option></select></label>
          <label><span>Direction</span><select value={sortOrder} onChange={(event) => setSortOrder(event.target.value)}><option value="desc">Descending</option><option value="asc">Ascending</option></select></label>
          <button className="button button--secondary" type="submit">Apply</button>
        </form>
        <div className="directory-summary"><strong>{meta.totalItems}</strong><span>tickets in this view</span></div>
        <div className="ticket-list">{tickets.length === 0 ? <p className="empty-state">No tickets match this view.</p> : tickets.map((ticket) => (
          <Link className="ticket-row" to={`/app/tickets/${ticket.id}`} key={ticket.id}>
            <div><code>{ticket.ticketNumber}</code><strong>{ticket.subject}</strong><span>{ticket.categoryName} / {ticket.complaintTypeName}</span></div>
            <div className="ticket-row__meta"><span className={`priority-mark priority-mark--${ticket.prioritySlug}`}>{ticket.priorityName}</span><span className={`ticket-status ticket-status--${ticket.statusSlug}`}>{ticket.statusName}</span><time>{formatDate(ticket.createdAt)}</time></div>
          </Link>
        ))}</div>
        <div className="pagination"><button type="button" disabled={meta.page <= 1} onClick={() => void load(meta.page - 1)}>Previous</button><span>Page {meta.page} of {Math.max(1, meta.totalPages)}</span><button type="button" disabled={meta.page >= meta.totalPages} onClick={() => void load(meta.page + 1)}>Next</button></div>
      </section>
    </main>
  );
}
