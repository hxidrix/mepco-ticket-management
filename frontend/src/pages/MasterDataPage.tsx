import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';

import { getApiErrorMessage } from '../lib/auth-api';
import {
  catalogRequest, createMasterItemRequest, masterItemsRequest, updateMasterItemRequest,
} from '../lib/master-data-api';
import type { MasterCatalog, MasterItem, MasterResource } from '../types/master-data';

const resources: Array<{ id: MasterResource; label: string }> = [
  { id: 'departments', label: 'Departments' }, { id: 'circles', label: 'Circles' },
  { id: 'cities', label: 'Cities' }, { id: 'categories', label: 'Categories' },
  { id: 'complaint-types', label: 'Complaint types' }, { id: 'priorities', label: 'Priorities' },
  { id: 'statuses', label: 'Statuses' },
];

function value(data: FormData, name: string): string {
  const entry = data.get(name);
  return typeof entry === 'string' ? entry.trim() : '';
}

function checked(data: FormData, name: string): boolean { return data.get(name) === 'on'; }
function active(item: MasterItem): boolean { return item.isActive === true || item.isActive === 1; }

function itemPayload(item: MasterItem, isActive: boolean): Record<string, unknown> {
  return {
    name: item.name, slug: item.slug, description: item.description ?? '', isActive,
    sortOrder: item.sortOrder, parentId: item.parentId ?? undefined,
    domain: item.domain, departmentId: item.departmentId ?? undefined,
    isConfidential: item.isConfidential === true || item.isConfidential === 1,
    colorToken: item.colorToken, slaTargetHours: item.slaTargetHours ?? undefined,
    isTerminal: item.isTerminal === true || item.isTerminal === 1,
  };
}

export function MasterDataPage() {
  const [resource, setResource] = useState<MasterResource>('departments');
  const [items, setItems] = useState<MasterItem[]>([]);
  const [catalog, setCatalog] = useState<MasterCatalog | null>(null);
  const [editing, setEditing] = useState<MasterItem | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [nextItems, nextCatalog] = await Promise.all([masterItemsRequest(resource), catalogRequest()]);
      setItems(nextItems); setCatalog(nextCatalog);
    } catch (caught) { setError(getApiErrorMessage(caught)); }
  }, [resource]);

  useEffect(() => { void load(); }, [load]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError(null); setMessage(null);
    const data = new FormData(event.currentTarget);
    const input: Record<string, unknown> = {
      name: value(data, 'name'), slug: value(data, 'slug'), description: value(data, 'description'),
      sortOrder: Number(value(data, 'sortOrder')) || 0, isActive: checked(data, 'isActive'),
    };
    if (resource === 'cities' || resource === 'complaint-types') input.parentId = Number(value(data, 'parentId'));
    if (resource === 'categories') {
      input.domain = value(data, 'domain'); input.departmentId = Number(value(data, 'departmentId')) || undefined;
    }
    if (resource === 'complaint-types') {
      input.isConfidential = checked(data, 'isConfidential');
      input.slaTargetHours = Number(value(data, 'slaTargetHours')) || 120;
    }
    if (resource === 'priorities') {
      input.colorToken = value(data, 'colorToken'); input.slaTargetHours = Number(value(data, 'slaTargetHours')) || undefined;
    }
    if (resource === 'statuses') input.isTerminal = checked(data, 'isTerminal');
    try {
      if (editing === null) await createMasterItemRequest(resource, input);
      else await updateMasterItemRequest(resource, editing.id, input);
      setMessage(editing === null ? 'Item created.' : 'Item updated.');
      setEditing(null); setFormVisible(false); await load();
    } catch (caught) { setError(getApiErrorMessage(caught)); }
    finally { setBusy(false); }
  };

  const toggle = async (item: MasterItem) => {
    setBusy(true); setError(null); setMessage(null);
    try {
      await updateMasterItemRequest(resource, item.id, itemPayload(item, !active(item)));
      setMessage(`${item.name} ${active(item) ? 'deactivated' : 'activated'}.`); await load();
    } catch (caught) { setError(getApiErrorMessage(caught)); }
    finally { setBusy(false); }
  };

  const beginEdit = (item: MasterItem | null) => { setEditing(item); setFormVisible(true); setError(null); setMessage(null); };

  return (
    <main className="workspace-page">
      <div className="workspace-page__heading"><div><p>Administration / configuration</p><h1>Master data</h1></div><button className="button button--primary" type="button" onClick={() => beginEdit(null)}>Add item</button></div>
      <div className="master-tabs" aria-label="Master-data resource">{resources.map((entry) => <button key={entry.id} type="button" className={resource === entry.id ? 'is-active' : ''} onClick={() => { setResource(entry.id); setFormVisible(false); setEditing(null); }}>{entry.label}</button>)}</div>
      {(message !== null || error !== null) && <p className={error === null ? 'page-message is-success' : 'page-message is-error'}>{error ?? message}</p>}
      {formVisible && (
        <form key={`${resource}-${editing?.id ?? 'new'}`} className="panel form-grid master-form" onSubmit={(event) => void submit(event)}>
          <div className="panel__heading form-grid__wide"><div><span>{editing === null ? 'New record' : 'Edit record'}</span><h2>{resources.find((entry) => entry.id === resource)?.label}</h2></div><button type="button" onClick={() => setFormVisible(false)}>Close</button></div>
          <label><span>Name</span><input name="name" defaultValue={editing?.name} required /></label>
          <label><span>Slug <small>auto-generated if blank</small></span><input name="slug" defaultValue={editing?.slug} /></label>
          <label className="form-grid__wide"><span>Description</span><input name="description" defaultValue={editing?.description ?? ''} /></label>
          <label><span>Sort order</span><input name="sortOrder" type="number" min="0" defaultValue={editing?.sortOrder ?? items.length + 1} /></label>
          <label className="check-label"><input name="isActive" type="checkbox" defaultChecked={editing === null || active(editing)} /><span>Active</span></label>
          {resource === 'cities' && <label className="form-grid__wide"><span>Circle</span><select name="parentId" defaultValue={editing?.parentId ?? ''} required><option value="">Select circle</option>{catalog?.circles.map((circle) => <option key={circle.id} value={circle.id}>{circle.name}</option>)}</select></label>}
          {resource === 'categories' && <><label><span>Domain</span><select name="domain" defaultValue={editing?.domain ?? 'consumer'}><option value="consumer">Consumer</option><option value="employee">Employee</option></select></label><label><span>Department</span><select name="departmentId" defaultValue={editing?.departmentId ?? ''}><option value="">No department</option>{catalog?.departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label></>}
          {resource === 'complaint-types' && <><label className="form-grid__wide"><span>Category</span><select name="parentId" defaultValue={editing?.parentId ?? ''} required><option value="">Select category</option>{catalog?.categories.map((category) => <option key={category.id} value={category.id}>{category.domain} / {category.name}</option>)}</select></label><label><span>Normal SLA target (hours)</span><input name="slaTargetHours" type="number" min="1" max="10000" defaultValue={editing?.slaTargetHours ?? 120} required /></label><label className="check-label"><input name="isConfidential" type="checkbox" defaultChecked={editing?.isConfidential === 1 || editing?.isConfidential === true} /><span>Confidential type</span></label></>}
          {resource === 'priorities' && <><label><span>Color token</span><input name="colorToken" defaultValue={editing?.colorToken ?? 'blue'} required /></label><label><span>SLA target (hours)</span><input name="slaTargetHours" type="number" min="1" defaultValue={editing?.slaTargetHours ?? ''} /></label></>}
          {resource === 'statuses' && <label className="check-label"><input name="isTerminal" type="checkbox" defaultChecked={editing?.isTerminal === 1 || editing?.isTerminal === true} /><span>Terminal status</span></label>}
          <button className="button button--primary form-grid__wide" type="submit" disabled={busy}>{busy ? 'Saving...' : 'Save item'}</button>
        </form>
      )}
      <section className="panel master-list">
        <div className="master-list__summary"><strong>{items.length}</strong><span>configured records</span><small>Deactivation preserves historical references.</small></div>
        <div className="table-scroll"><table><thead><tr><th>Name</th><th>Context</th><th>Order</th><th>Status</th><th>Actions</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><strong>{item.name}</strong><code>{item.slug}</code></td><td>{item.parentName ?? item.domain ?? item.description ?? '—'}</td><td>{item.sortOrder}</td><td><span className={`status-pill status-pill--${active(item) ? 'active' : 'inactive'}`}>{active(item) ? 'active' : 'inactive'}</span></td><td><div className="row-actions"><button type="button" onClick={() => beginEdit(item)}>Edit</button><button type="button" disabled={busy} onClick={() => void toggle(item)}>{active(item) ? 'Deactivate' : 'Activate'}</button></div></td></tr>)}</tbody></table></div>
      </section>
    </main>
  );
}
