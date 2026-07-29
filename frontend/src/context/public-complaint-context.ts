import { createContext } from 'react';

import type { VerifiedConsumer } from '../lib/public-complaints-api';

export interface PublicConsumerVerification {
  referenceNumber: string;
  consumerId: string;
  consumer: VerifiedConsumer;
}

export interface PublicComplaintContextValue {
  verification: PublicConsumerVerification | null;
  setVerification: (value: PublicConsumerVerification | null) => void;
}

export const PublicComplaintContext = createContext<PublicComplaintContextValue | null>(null);
