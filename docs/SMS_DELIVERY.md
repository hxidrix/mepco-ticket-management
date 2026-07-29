# SMS Delivery

The application uses a provider-neutral durable `sms_outbox`. Complaint creation commits the ticket and SMS record in the same database transaction, then attempts delivery without delaying the browser response.

## Can a local installation send real SMS?

Yes. The backend can run on a local computer and still send SMS when:

1. the computer has Internet access;
2. MEPCO has an approved SMS gateway/provider account;
3. the provider is reachable through an HTTPS webhook; and
4. its URL/token are configured only in `backend/.env` or a secret manager.

XAMPP or Docker does not itself provide SMS service. A SIM modem is not required when using an Internet SMS gateway.

## Safe local default

```dotenv
SMS_DRIVER=local-log
SMS_WEBHOOK_URL=
SMS_WEBHOOK_TOKEN=
SMS_SENDER_ID=MEPCO
```

`local-log` simulates delivery, marks the outbox item sent, logs only the phone-number suffix, and sends nothing to a mobile network. This is the recommended setting for local development and tests.

## Webhook driver

```dotenv
SMS_DRIVER=webhook
SMS_WEBHOOK_URL=https://approved-sms-gateway.example/send
SMS_WEBHOOK_TOKEN=store-this-secret-outside-git
SMS_SENDER_ID=MEPCO
```

The backend sends an HTTPS `POST` with a bearer token (when configured) and this JSON contract:

```json
{
  "to": "03001234567",
  "senderId": "MEPCO",
  "event": "complaint_submitted",
  "message": "MEPCO complaint MEPCO-2026-123456 has been submitted...",
  "idempotencyKey": "mepco-sms-123"
}
```

The provider adapter should return HTTP 2xx and may return `{ "messageId": "provider-id" }`. Failed attempts stay in the outbox with an error and a retry time; after five attempts they are marked failed. The event model already supports `assigned`, `updated`, `resolved`, and `closed` for later notification expansion.

## Operational safeguards

- Never commit gateway tokens or paste them into screenshots/logs.
- Use an approved sender ID and consent/retention policy.
- Keep messages concise and exclude CNIC, Consumer ID, full Reference Number, addresses, or complaint descriptions.
- Restrict provider credentials by IP/scope when supported and rotate them regularly.
- Monitor pending/failed outbox records before relying on SMS for operational notifications.
