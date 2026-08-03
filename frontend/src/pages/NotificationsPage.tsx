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
  const [markingId, setMarkingId] = useState<number | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = async () => {
    try { const result = await notificationsRequest(); setItems(result.items); setUnreadCount(result.unreadCount); setError(null); }
    catch (caught) { setError(getApiErrorMessage(caught)); }
  };
  useEffect(() => { void load(); }, []);
  const markOne = async (item: NotificationItem) => {
    if (item.readAt !== null || markingId === item.id) return;
    setMarkingId(item.id);
    try {
      await markNotificationReadRequest(item.id);
      setItems((current) => current.map((notification) => (
        notification.id === item.id ? { ...notification, readAt: new Date().toISOString() } : notification
      )));
      setUnreadCount((current) => Math.max(0, current - 1));
      setError(null);
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setMarkingId(null);
    }
  };
  const markAll = async () => {
    if (unreadCount === 0 || markingAll) return;
    setMarkingAll(true);
    try {
      await markAllNotificationsReadRequest();
      const readAt = new Date().toISOString();
      setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? readAt })));
      setUnreadCount(0);
      setError(null);
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setMarkingAll(false);
    }
  };
  return (
    <main className="workspace-page">
      <div className="workspace-page__heading"><div><p>Inbox</p><h1>Notifications</h1></div>
        <button className="button button--secondary" type="button" disabled={unreadCount === 0 || markingAll} onClick={() => void markAll()}>
          {markingAll ? 'Updating' : 'Mark all as read'}
        </button></div>
      {error !== null && <p className="page-message is-error">{error}</p>}
      <section className="panel notification-panel">
        <div className="panel__heading"><div><span>Activity</span><h2>{unreadCount} unread</h2></div></div>
        {items.length === 0 ? <p className="empty-state">No notifications yet.</p> : <div className="notification-list">
          {items.map((item) => <article className={item.readAt === null ? 'is-unread' : 'is-read'} key={item.id}>
            <span className="notification-list__indicator" aria-hidden="true" />
            <div className="notification-list__content"><strong>{item.title}</strong><p>{item.message}</p><time>{formatDate(item.createdAt)}</time></div>
            <div className="notification-list__actions">
              {item.readAt === null ? (
                <button
                  className="button button--secondary notification-read-button"
                  type="button"
                  disabled={markingId === item.id || markingAll}
                  onClick={() => void markOne(item)}
                >
                  {markingId === item.id ? 'Saving' : 'Mark as read'}
                </button>
              ) : <span className="notification-read-state"><span className="notification-read-state__icon" aria-hidden="true" /> Read</span>}
              {item.targetType === 'ticket' && item.targetId !== null ? <Link className="button button--primary notification-target-button" to={`/app/tickets/${item.targetId}`} onClick={() => void markOne(item)}>View ticket</Link> : null}
              {(item.targetType === 'suspension_case' || item.targetType === 'support_request') && item.targetId !== null ? <Link className="button button--primary notification-target-button" to="/app/account-governance" onClick={() => void markOne(item)}>View request</Link> : null}
              {item.targetType === 'internal_message_thread' && item.targetId !== null ? <Link className="button button--primary notification-target-button" to={`/app/messages?thread=${item.targetId}`} onClick={() => void markOne(item)}>View message</Link> : null}
              {item.targetType === 'announcement' ? <Link className="button button--primary notification-target-button" to="/app" onClick={() => void markOne(item)}>View announcement</Link> : null}
            </div>
          </article>)}
        </div>}
      </section>
    </main>
  );
}
