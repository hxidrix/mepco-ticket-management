import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { getApiErrorMessage } from '../lib/auth-api';
import {
  markAllNotificationsReadRequest, markNotificationReadRequest, notificationsRequest,
} from '../lib/notifications-api';
import type { NotificationItem } from '../lib/notifications-api';

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-PK', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const load = async () => {
    try { const result = await notificationsRequest(); setItems(result.items); setUnreadCount(result.unreadCount); setError(null); }
    catch (caught) { setError(getApiErrorMessage(caught)); }
  };
  useEffect(() => { void load(); }, []);
  const markOne = async (item: NotificationItem) => {
    if (item.readAt === null) await markNotificationReadRequest(item.id);
    await load();
  };
  const markAll = async () => { await markAllNotificationsReadRequest(); await load(); };
  return (
    <main className="workspace-page">
      <div className="workspace-page__heading"><div><p>Inbox</p><h1>Notifications</h1></div>
        <button className="button button--secondary" type="button" disabled={unreadCount === 0} onClick={() => void markAll()}>Mark all read</button></div>
      {error !== null && <p className="page-message is-error">{error}</p>}
      <section className="panel notification-panel">
        <div className="panel__heading"><div><span>Activity</span><h2>{unreadCount} unread</h2></div></div>
        {items.length === 0 ? <p className="empty-state">No notifications yet.</p> : <div className="notification-list">
          {items.map((item) => <article className={item.readAt === null ? 'is-unread' : undefined} key={item.id}>
            <button type="button" onClick={() => void markOne(item)} aria-label={`Mark ${item.title} as read`} />
            <div><strong>{item.title}</strong><p>{item.message}</p><time>{formatDate(item.createdAt)}</time></div>
            {item.targetType === 'ticket' && item.targetId !== null && <Link to={`/app/tickets/${item.targetId}`} onClick={() => void markOne(item)}>Open ticket</Link>}
          </article>)}
        </div>}
      </section>
    </main>
  );
}
