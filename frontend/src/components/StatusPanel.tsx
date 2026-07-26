import { useEffect, useState } from 'react';

import { getPlatformStatus } from '../lib/api';

type Status = 'checking' | 'ready' | 'unavailable';

const statusCopy: Record<Status, { eyebrow: string; title: string; description: string }> = {
  checking: {
    eyebrow: 'System check',
    title: 'Connecting to the platform',
    description: 'Checking the Express API and MySQL readiness endpoint.',
  },
  ready: {
    eyebrow: 'Foundation online',
    title: 'API and database are ready',
    description: 'The first end-to-end platform slice is responding normally.',
  },
  unavailable: {
    eyebrow: 'Setup required',
    title: 'Start the API and database',
    description: 'Follow the Docker or XAMPP setup in the README, then refresh this page.',
  },
};

export function StatusPanel() {
  const [status, setStatus] = useState<Status>('checking');
  const copy = statusCopy[status];

  useEffect(() => {
    const controller = new AbortController();

    getPlatformStatus(controller.signal)
      .then(() => setStatus('ready'))
      .catch(() => {
        if (!controller.signal.aborted) {
          setStatus('unavailable');
        }
      });

    return () => controller.abort();
  }, []);

  return (
    <section className="status-panel" aria-live="polite">
      <div className={`status-panel__signal status-panel__signal--${status}`} aria-hidden="true">
        <span />
      </div>
      <div>
        <p className="status-panel__eyebrow">{copy.eyebrow}</p>
        <h2>{copy.title}</h2>
        <p>{copy.description}</p>
      </div>
    </section>
  );
}
