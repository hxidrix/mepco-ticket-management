import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';

import { getApiErrorMessage } from '../lib/auth-api';
import {
  announcementsRequest,
  createAnnouncementRequest,
  deactivateAnnouncementRequest,
} from '../lib/administration-api';
import type { Announcement } from '../lib/administration-api';
import type { UserRole } from '../types/auth';

const audienceRoles = ['employee', 'technician', 'supervisor', 'administrator'] as const satisfies readonly UserRole[];

function formValue(data: FormData, name: string): string {
  const entry = data.get(name);
  return typeof entry === 'string' ? entry.trim() : '';
}

function localDateTimeValue(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-PK', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function announcementStatus(item: Announcement): string {
  if (!item.isActive) return 'Inactive';
  const now = Date.now();
  if (new Date(item.startsAt).getTime() > now) return 'Scheduled';
  if (item.endsAt !== null && new Date(item.endsAt).getTime() < now) return 'Expired';
  return 'Active';
}

export function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [defaultStart] = useState(() => localDateTimeValue(new Date()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadAnnouncements = useCallback(async () => {
    try {
      setAnnouncements(await announcementsRequest());
      setError(null);
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    }
  }, []);

  useEffect(() => {
    void loadAnnouncements();
  }, [loadAnnouncements]);

  const publish = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const audiences = audienceRoles.filter((role) => data.getAll('audiences').includes(role));
    if (audiences.length === 0) {
      setMessage(null);
      setError('Select at least one audience role.');
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const endsAt = formValue(data, 'endsAt');
      await createAnnouncementRequest({
        title: formValue(data, 'title'),
        body: formValue(data, 'body'),
        startsAt: new Date(formValue(data, 'startsAt')).toISOString(),
        ...(endsAt === '' ? {} : { endsAt: new Date(endsAt).toISOString() }),
        isActive: true,
        audiences,
      });
      form.reset();
      setMessage('Announcement published successfully.');
      await loadAnnouncements();
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const deactivate = async (id: number) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await deactivateAnnouncementRequest(id);
      setMessage('Announcement deactivated.');
      await loadAnnouncements();
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="workspace-page announcements-page">
      <div className="workspace-page__heading">
        <div><p>Communications / announcements</p><h1>Announcement management</h1></div>
      </div>

      {(error !== null || message !== null) && (
        <p className={error === null ? 'page-message is-success' : 'page-message is-error'}>{error ?? message}</p>
      )}

      <div className="announcement-management-grid">
        <form className="panel admin-ops-card announcement-form" onSubmit={(event) => void publish(event)}>
          <div className="panel__heading"><div><span>Broadcast</span><h2>Publish announcement</h2></div></div>
          <label><span>Title</span><input name="title" minLength={3} maxLength={180} required /></label>
          <label><span>Message</span><textarea name="body" minLength={3} maxLength={10000} required /></label>
          <div className="form-grid">
            <label><span>Starts</span><input name="startsAt" type="datetime-local" defaultValue={defaultStart} required /></label>
            <label><span>Ends (optional)</span><input name="endsAt" type="datetime-local" /></label>
          </div>
          <fieldset>
            <legend>Audience roles</legend>
            {audienceRoles.map((role) => (
              <label key={role}><input name="audiences" type="checkbox" value={role} /><span>{role}</span></label>
            ))}
          </fieldset>
          <button className="button button--primary" disabled={busy} type="submit">
            {busy ? 'Publishing…' : 'Publish announcement'}
          </button>
        </form>

        <section className="panel admin-data-panel announcement-management-list" aria-labelledby="managed-announcements-title">
          <div className="panel__heading">
            <div><span>Broadcast history</span><h2 id="managed-announcements-title">Manage announcements</h2></div>
            <small>{announcements.length} total</small>
          </div>
          {announcements.length === 0 ? (
            <p className="empty-state">No announcements have been published yet.</p>
          ) : announcements.map((item) => {
            const status = announcementStatus(item);
            return (
              <article className="admin-list-row announcement-management-row" key={item.id}>
                <div>
                  <div className="announcement-management-row__title">
                    <strong>{item.title}</strong>
                    <span className={`announcement-state announcement-state--${status.toLowerCase()}`}>{status}</span>
                  </div>
                  <p>{item.body}</p>
                  <span>
                    {item.audiences.join(', ')} · Starts {formatDate(item.startsAt)}
                    {item.endsAt === null ? '' : ` · Ends ${formatDate(item.endsAt)}`}
                    {' · '}{item.authorName}
                  </span>
                </div>
                <button
                  className="button button--danger announcement-deactivate"
                  type="button"
                  disabled={busy || !item.isActive}
                  onClick={() => void deactivate(item.id)}
                >
                  {item.isActive ? 'Deactivate' : 'Inactive'}
                </button>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}
