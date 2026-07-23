import type { RowDataPacket } from 'mysql2/promise';

import type { UserRole } from '../auth/auth.types.js';

export interface MessageRecipientRow extends RowDataPacket {
  id: number;
  displayName: string;
  role: 'technician' | 'supervisor' | 'administrator';
}

export interface MessageThreadRow extends RowDataPacket {
  id: number;
  subject: string;
  technicianId: number;
  technicianName: string;
  managerId: number;
  managerName: string;
  managerRole: 'supervisor' | 'administrator';
  lastMessagePreview: string;
  lastMessageAt: Date;
  createdAt: Date;
  unreadCount: number;
}

export interface MessageRow extends RowDataPacket {
  id: number;
  senderId: number;
  senderName: string;
  senderRole: UserRole;
  body: string;
  createdAt: Date;
}

export interface ThreadParticipantRow extends RowDataPacket {
  id: number;
  subject: string;
  technicianId: number;
  technicianName: string;
  managerId: number;
  managerName: string;
  managerRole: 'supervisor' | 'administrator';
  lastMessageId: number | null;
  lastMessageAt: Date;
  createdAt: Date;
}
