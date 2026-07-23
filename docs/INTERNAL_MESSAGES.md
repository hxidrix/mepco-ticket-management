# Internal Messages

## Who can use it

- A technician can start a private conversation with any active supervisor or administrator.
- A supervisor or administrator can start a private conversation with any active technician.
- The selected supervisor or administrator can read and reply to that conversation.
- Only those two participants can open the thread. Other managers cannot see it.
- Consumers and employees cannot access this panel.

## How to use it

1. Sign in as a technician, supervisor, or administrator.
2. Open **Messages** from the sidebar.
3. Select **New message**.
4. Technicians choose a supervisor or administrator. Supervisors and administrators choose a technician.
5. Enter a subject and message, then select **Send message**.
6. The manager receives a notification. Selecting **Open message** takes them directly to the private thread.
7. Either participant can send further replies from the bottom of the conversation.

Unread message counts appear beside the relevant conversation. Opening a thread marks its current messages as read.

## Security and records

- Every API operation verifies that the signed-in user is a participant in the requested thread.
- Accounts must still be active.
- Messages cannot be edited or deleted through the application.
- Creating a thread and sending a reply writes an audit event, but the private message body is not stored in audit metadata.
- All database queries are parameterized and message creation uses a transaction.

## API routes

- `GET /api/v1/internal-messages/recipients`
- `GET /api/v1/internal-messages/threads`
- `POST /api/v1/internal-messages/threads`
- `GET /api/v1/internal-messages/threads/{id}`
- `POST /api/v1/internal-messages/threads/{id}/messages`

The same endpoints are documented in Swagger at `http://localhost:5000/api-docs`.
