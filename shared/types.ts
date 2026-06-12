export type Level = 'staff' | 'supervisor' | 'manager' | 'director';
export type AppType = 'regular' | 'transfer';
export type AppStatus = 'pending_check' | 'check_failed' | 'pending_approval' | 'approved' | 'rejected' | 'escalated';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'delegated';
export type NotifType = 'approval' | 'escalation' | 'system' | 'exception' | 'info';

export interface Employee {
  id: string;
  name: string;
  department: string;
  position: string;
  level: Level;
  salaryGrade: string;
  supervisorId?: string;
  supervisorName?: string;
  hireDate: string;
  status: 'probation' | 'regular' | 'transferred';
  permissions: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CheckResult {
  id: string;
  applicationId: string;
  item: 'performance' | 'training' | 'evaluation' | 'skill_match' | 'headcount';
  label: string;
  passed: boolean;
  detail: string;
  createdAt: string;
}

export interface ApprovalRecord {
  id: string;
  applicationId: string;
  approverId: string;
  approverName: string;
  approverRole: string;
  step: number;
  totalSteps: number;
  status: ApprovalStatus;
  comment?: string;
  createdAt: string;
  processedAt?: string;
  escalated: boolean;
}

export interface Application {
  id: string;
  type: AppType;
  employeeId: string;
  employeeName: string;
  department: string;
  position: string;
  level: Level;
  targetDepartment?: string;
  targetPosition?: string;
  status: AppStatus;
  submitTime: string;
  reason?: string;
  checkResults: CheckResult[];
  approvalRecords: ApprovalRecord[];
  currentApprover?: { id: string; name: string; role: string; waitHours: number };
  missingItems: string[];
  escalated: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  content: string;
  type: NotifType;
  read: boolean;
  createdAt: string;
}

export interface LogItem {
  id: string;
  operatorId?: string;
  operatorName?: string;
  action: string;
  target?: string;
  detail?: string;
  timestamp: string;
  type: 'operation' | 'exception';
}
