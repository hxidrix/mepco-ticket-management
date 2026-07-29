import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { PublicComplaintContext } from './public-complaint-context';
import type { PublicConsumerVerification } from './public-complaint-context';

export function PublicComplaintProvider({ children }: { children: ReactNode }) {
  const [verification, setVerification] = useState<PublicConsumerVerification | null>(null);
  const value = useMemo(() => ({ verification, setVerification }), [verification]);
  return <PublicComplaintContext.Provider value={value}>{children}</PublicComplaintContext.Provider>;
}
