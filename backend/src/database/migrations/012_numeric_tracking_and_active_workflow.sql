UPDATE tickets
SET ticket_number = CONCAT(
  SUBSTRING(ticket_number, 7, 4),
  RIGHT(ticket_number, 6)
)
WHERE ticket_number REGEXP '^MEPCO-[0-9]{4}-[0-9]{6}$';

UPDATE tickets ticket
JOIN ticket_statuses current_status ON current_status.id = ticket.status_id
JOIN ticket_statuses active_status ON active_status.slug = 'in-progress'
SET ticket.status_id = active_status.id,
    ticket.updated_at = ticket.updated_at
WHERE current_status.slug = 'pending-user';

DELETE FROM ticket_statuses WHERE slug = 'pending-user';
