import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';
import { getApiErrorMessage } from '../lib/auth-api';
import {
  createMessageThreadRequest,
  messageRecipientsRequest,
  messageThreadRequest,
  messageThreadsRequest,
  replyToMessageThreadRequest,
} from '../lib/internal-messages-api';
import type {
  MessageRecipient,
  MessageThread,
  MessageThreadDetail,
} from '../lib/internal-messages-api';

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-PK', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function roleLabel(role: 'technician' | 'supervisor' | 'administrator'): string {
  if (role === 'administrator') return 'Administrator';
  return role === 'supervisor' ? 'Supervisor' : 'Technician';
}

function formValue(data: FormData, name: string): string {
  const value = data.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

export function InternalMessagesPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [recipients, setRecipients] = useState<MessageRecipient[]>([]);
  const [selected, setSelected] = useState<MessageThreadDetail | null>(null);
  const [composing, setComposing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const isTechnician = user?.role === 'technician';

  const loadThreads = useCallback(async () => {
    try {
      setThreads(await messageThreadsRequest());
      setError(null);
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  const openThread = useCallback(async (threadId: number) => {
    try {
      setSelected(await messageThreadRequest(threadId));
      setThreads((current) => current.map((thread) => (
        thread.id === threadId ? { ...thread, unreadCount: 0 } : thread
      )));
      setError(null);
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    }
  }, []);

  const selectThread = (threadId: number) => {
    setSearchParams({ thread: String(threadId) }, { replace: true });
    void openThread(threadId);
  };

  useEffect(() => {
    void loadThreads();
    void messageRecipientsRequest()
      .then(setRecipients)
      .catch((caught: unknown) => setError(getApiErrorMessage(caught)));
  }, [loadThreads]);

  useEffect(() => {
    const requestedThreadId = Number(searchParams.get('thread'));
    if (Number.isInteger(requestedThreadId) && requestedThreadId > 0) {
      void openThread(requestedThreadId);
    }
  }, [openThread, searchParams]);

  const createThread = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const threadId = await createMessageThreadRequest({
        recipientId: Number(data.get('recipientId')),
        subject: formValue(data, 'subject'),
        message: formValue(data, 'message'),
      });
      form.reset();
      setComposing(false);
      setMessage('Your message was sent.');
      await loadThreads();
      setSearchParams({ thread: String(threadId) }, { replace: true });
      await openThread(threadId);
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const reply = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selected === null) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const replyMessage = formValue(data, 'message');
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await replyToMessageThreadRequest(selected.thread.id, replyMessage);
      form.reset();
      setMessage('Reply sent.');
      await openThread(selected.thread.id);
      await loadThreads();
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const counterpart = (thread: MessageThread) => (
    user?.id === thread.technicianId
      ? `${thread.managerName} · ${roleLabel(thread.managerRole)}`
      : `${thread.technicianName} · Technician`
  );

  return (
    <main className="workspace-page internal-messages-page">
      <div className="workspace-page__heading">
        <div>
          <p>Secure staff communication</p>
          <h1>Messages</h1>
        </div>
        <button
          className="button button--primary"
          type="button"
          onClick={() => setComposing((value) => !value)}
        >
          {composing ? 'Cancel message' : 'New message'}
        </button>
      </div>

      {(error !== null || message !== null) && (
        <p className={error === null ? 'page-message is-success' : 'page-message is-error'}>
          {error ?? message}
        </p>
      )}

      {composing && (
        <form className="panel internal-message-compose" onSubmit={(event) => void createThread(event)}>
          <div className="panel__heading">
            <div>
              <span>New conversation</span>
              <h2>{isTechnician ? 'Message a manager' : 'Message a technician'}</h2>
            </div>
          </div>
          <div className="internal-message-compose__fields">
            <label>
              <span>Send to</span>
              <select name="recipientId" required defaultValue="">
                <option value="" disabled>
                  {isTechnician ? 'Select a supervisor or administrator' : 'Select a technician'}
                </option>
                {recipients.map((recipient) => (
                  <option key={recipient.id} value={recipient.id}>
                    {recipient.displayName} — {roleLabel(recipient.role)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Subject</span>
              <input name="subject" minLength={3} maxLength={160} required placeholder="What do you need help with?" />
            </label>
            <label className="internal-message-compose__body">
              <span>Message</span>
              <textarea
                name="message"
                minLength={1}
                maxLength={4000}
                required
                placeholder={isTechnician ? 'Write the details your manager needs.' : 'Write the details the technician needs.'}
              />
            </label>
          </div>
          <div className="internal-message-compose__actions">
            <small>Only you and the selected recipient can view this conversation.</small>
            <button className="button button--primary" type="submit" disabled={busy || recipients.length === 0}>
              {busy ? 'Sending…' : 'Send message'}
            </button>
          </div>
        </form>
      )}

      <section className="panel internal-message-shell" aria-label="Internal message inbox">
        <div className="internal-message-list">
          <header>
            <div><span>Inbox</span><strong>{threads.length} conversations</strong></div>
          </header>
          {loading ? (
            <p className="empty-state">Loading messages…</p>
          ) : threads.length === 0 ? (
            <p className="empty-state">
              {isTechnician
                ? 'No messages yet. Start a conversation with a manager.'
                : 'No messages yet. Start a conversation with a technician.'}
            </p>
          ) : (
            <div className="internal-message-list__items">
              {threads.map((thread) => (
                <button
                  className={selected?.thread.id === thread.id ? 'is-active' : undefined}
                  type="button"
                  key={thread.id}
                  onClick={() => selectThread(thread.id)}
                >
                  <span>
                    <strong>{thread.subject}</strong>
                    {thread.unreadCount > 0 && <b>{thread.unreadCount}</b>}
                  </span>
                  <small>{counterpart(thread)}</small>
                  <p>{thread.lastMessagePreview}</p>
                  <time>{formatDate(thread.lastMessageAt)}</time>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="internal-message-conversation">
          {selected === null ? (
            <div className="internal-message-conversation__empty">
              <h2>Select a conversation</h2>
              <p>Open a thread to read its messages and send a secure reply.</p>
            </div>
          ) : (
            <>
              <header>
                <div>
                  <span>Private thread</span>
                  <h2>{selected.thread.subject}</h2>
                  <p>
                    {user?.id === selected.thread.technicianId
                      ? `${selected.thread.managerName} · ${roleLabel(selected.thread.managerRole)}`
                      : `${selected.thread.technicianName} · Technician`}
                  </p>
                </div>
              </header>
              <div className="internal-message-conversation__messages" aria-live="polite">
                {selected.messages.map((item) => (
                  <article className={item.senderId === user?.id ? 'is-mine' : undefined} key={item.id}>
                    <div>
                      <strong>{item.senderName}</strong>
                      <time>{formatDate(item.createdAt)}</time>
                    </div>
                    <p>{item.body}</p>
                  </article>
                ))}
              </div>
              <form className="internal-message-reply" onSubmit={(event) => void reply(event)}>
                <label>
                  <span>Reply</span>
                  <textarea name="message" minLength={1} maxLength={4000} required placeholder="Write a reply…" />
                </label>
                <button className="button button--primary" type="submit" disabled={busy}>
                  {busy ? 'Sending…' : 'Send reply'}
                </button>
              </form>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
