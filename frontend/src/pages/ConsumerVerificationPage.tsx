import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { PublicFlowLayout } from '../components/PublicFlowLayout';
import { usePublicComplaint } from '../hooks/usePublicComplaint';
import { getApiErrorMessage } from '../lib/auth-api';
import { verifyConsumerRequest } from '../lib/public-complaints-api';
import type { VerifiedConsumer } from '../lib/public-complaints-api';

function fieldValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

export function ConsumerVerificationPage() {
  const navigate = useNavigate();
  const { setVerification } = usePublicComplaint();
  const [rawIdentity, setRawIdentity] = useState<{ referenceNumber: string; consumerId: string } | null>(null);
  const [consumer, setConsumer] = useState<VerifiedConsumer | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const data = new FormData(event.currentTarget);
    const referenceNumber = fieldValue(data, 'referenceNumber');
    const consumerId = fieldValue(data, 'consumerId');
    try {
      const verified = await verifyConsumerRequest(referenceNumber, consumerId);
      setRawIdentity({ referenceNumber, consumerId });
      setConsumer(verified);
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const continueToComplaint = () => {
    if (consumer === null || rawIdentity === null) return;
    setVerification({ ...rawIdentity, consumer });
    void navigate('/complaints/new');
  };

  return (
    <PublicFlowLayout
      eyebrow="Consumer verification"
      title="Confirm your billing details"
      description="Enter the two identifiers printed on your electricity bill. We only use them to verify the service connection for this complaint."
    >
      <div className="public-flow-card__heading">
        <span>Step 1 of 2</span>
        <h2>{consumer === null ? 'Find your connection' : 'Review the matched record'}</h2>
        <p>{consumer === null
          ? 'Use the Reference Number and Consumer ID exactly as they appear on the bill.'
          : 'Only masked information is shown. Confirm it before continuing.'}</p>
      </div>
        {consumer === null ? (
          <form className="public-flow-form" onSubmit={(event) => void verify(event)}>
            <label><span>Reference Number</span><input name="referenceNumber" required inputMode="numeric" pattern="[0-9]{14}" minLength={14} maxLength={14} placeholder="Enter 14 digits" autoComplete="off" /></label>
            <label><span>Consumer ID</span><input name="consumerId" required inputMode="numeric" pattern="[0-9]{10}" minLength={10} maxLength={10} placeholder="Enter 10 digits" autoComplete="off" /></label>
            {error !== null && <p className="auth-message auth-message--error">{error}</p>}
            <button className="button button--primary public-flow-form__submit" type="submit" disabled={busy}>{busy ? 'Verifying...' : 'Verify details'}</button>
          </form>
        ) : (
          <div className="verification-preview">
            <dl>
              <div><dt>Reference Number</dt><dd>{consumer.referenceNumber}</dd></div>
              <div><dt>Consumer ID</dt><dd>{consumer.consumerId}</dd></div>
              <div><dt>Name</dt><dd>{consumer.name}</dd></div>
              <div><dt>Sub-division</dt><dd>{consumer.subdivision}</dd></div>
              <div><dt>Tariff</dt><dd>{consumer.tariff}</dd></div>
            </dl>
            <div className="verification-preview__actions">
              <button type="button" className="button" onClick={() => { setConsumer(null); setRawIdentity(null); }}>Back</button>
              <button type="button" className="button button--primary" onClick={continueToComplaint}>Continue</button>
            </div>
          </div>
        )}
    </PublicFlowLayout>
  );
}
