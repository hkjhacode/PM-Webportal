
export type UserRole =
  | 'PMO'
  | 'CEO NITI'
  | 'State Advisor'
  | 'State YP'
  | 'State Division HOD'
  | 'Division YP'
  | 'Super Admin';

export interface UserRoleAssignment {
    role: UserRole;
    state?: string; // Optional state for state-specific roles
    division?: string; // Optional division for division-specific roles
}

export type User = {
  id: string;
  name: string;
  roles: UserRoleAssignment[];
  email: string;
  password?: string;
  avatarUrl: string;
};

export type RequestStatus =
  | 'Draft'
  | 'Pending Division YP'
  | 'Pending Division HOD'
  | 'Pending State YP'
  | 'Pending State Advisor'
  | 'Pending CEO Review'
  | 'Completed'
  | 'Rejected';

export type AuditLog = {
  id: string;
  timestamp: string; // ISO string
  userId: string;
  action: string; // e.g., "Created Request", "Submitted Data", "Approved"
  notes?: string;
};

export type Request = {
  id: string;
  title: string;
  description: string;
  createdBy: string; // userId
  createdAt: string; // ISO string
  dueDate: string; // ISO string
  status: RequestStatus;
  currentAssigneeId: string; // userId
  state: string;
  division: string;
  submittedData?: {
    text: string;
    files: string[];
  };
  auditTrail: AuditLog[];
  flowDirection: 'up' | 'down'; // 'up' for approval, 'down' for allocation
  assignedBy: string; // userId of who assigned it
};
