import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import type * as FramerMotion from 'framer-motion';

vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof FramerMotion>();
  return {
    ...actual,
    useReducedMotion: () => true,
  };
});

vi.mock('./lib/api', () => ({
  getPlatformStatus: vi.fn().mockResolvedValue({
    service: 'mepco-help-desk-api',
    status: 'ready',
    database: 'connected',
    timestamp: '2026-07-14T00:00:00.000Z',
  }),
}));

import App from './App';

describe('foundation page', () => {
  it('presents the MEPCO service proposition and real readiness slice', async () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: /report\. track\. resolve\./i })).toBeVisible();
    expect(screen.getByAltText('MEPCO')).toBeVisible();
    expect(await screen.findByText('API and database are ready')).toBeVisible();
    expect(screen.getByRole('link', { name: /open api docs/i })).toHaveAttribute(
      'href',
      'http://localhost:5000/api-docs',
    );
  });
});
