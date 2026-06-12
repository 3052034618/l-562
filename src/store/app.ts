import { create } from 'zustand';
import { api } from '@/lib/api';
import type { Application, Notification, Employee, LogItem } from '../../shared/types';

export const CURRENT_USER_ID = 'E007';
export const CURRENT_USER_NAME = '王强';

interface AppState {
  currentUser: Employee | null;
  employees: Employee[];
  departments: string[];
  supervisors: { id: string; name: string; department: string }[];
  applications: Application[];
  applicationsTotal: number;
  pendingApprovals: Application[];
  notifications: Notification[];
  unreadCount: number;
  exceptions: {
    exceptions: LogItem[];
    overtime: any[];
    failed: any[];
  };
  overview: any;
  loadAll: () => Promise<void>;
  refresh: () => Promise<void>;
  fetchApplications: (params?: any) => Promise<void>;
  createApplication: (body: any) => Promise<Application | null>;
  resubmit: (id: string, forceFail?: string[]) => Promise<Application | null>;
  approve: (id: string, approverId: string, comment?: string) => Promise<Application | null>;
  reject: (id: string, approverId: string, comment?: string) => Promise<Application | null>;
  escalate: (id: string, operatorId: string) => Promise<boolean>;
  readNotif: (id: string) => Promise<void>;
  readAll: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  currentUser: null,
  employees: [],
  departments: [],
  supervisors: [],
  applications: [],
  applicationsTotal: 0,
  pendingApprovals: [],
  notifications: [],
  unreadCount: 0,
  exceptions: { exceptions: [], overtime: [], failed: [] },
  overview: { pendingApprovals: 0, regularCount: 0, transferCount: 0, escalatedCount: 0, checkFailedCount: 0, overtimeCount: 0, metrics: { current: {}, previous: {} } },

  async loadAll() {
    const [empR, optsR, overviewR, notifR, excR, pendingR] = await Promise.all([
      api.get<any[]>('/api/employees'),
      api.get<{ employees: Employee[]; departments: string[]; supervisors: any[] }>('/api/employees/options/list'),
      api.get<any>('/api/reports/overview'),
      api.get<{ list: Notification[]; unreadCount: number }>('/api/notifications'),
      api.get<any>('/api/logs/exceptions'),
      api.get<Application[]>('/api/approvals/pending', { approverId: CURRENT_USER_ID }),
    ]);
    const opts = optsR.success ? optsR.data : { employees: [], departments: [], supervisors: [] };
    const currentUser = opts.employees.find(e => e.id === CURRENT_USER_ID) || null;
    set({
      currentUser,
      employees: opts.employees,
      departments: opts.departments,
      supervisors: opts.supervisors,
      overview: overviewR.success ? overviewR.data : get().overview,
      notifications: notifR.success ? notifR.data.list : [],
      unreadCount: notifR.success ? notifR.data.unreadCount : 0,
      exceptions: excR.success ? excR.data : get().exceptions,
      pendingApprovals: pendingR.success ? pendingR.data : [],
    });
    const appsR = await api.get<{ list: Application[]; total: number }>('/api/applications', { pageSize: 50 });
    if (appsR.success) {
      set({ applications: appsR.data.list, applicationsTotal: appsR.data.total });
    }
  },

  async refresh() {
    await get().loadAll();
  },

  async fetchApplications(params) {
    const r = await api.get<{ list: Application[]; total: number }>('/api/applications', params);
    if (r.success) set({ applications: r.data.list, applicationsTotal: r.data.total });
  },

  async createApplication(body) {
    const r = await api.post<Application>('/api/applications', body);
    if (r.success) {
      await get().refresh();
      return r.data;
    }
    return null;
  },

  async resubmit(id, forceFail) {
    const r = await api.post<Application>(`/api/applications/resubmit/${id}`, { forceFail });
    if (r.success) {
      await get().refresh();
      return r.data;
    }
    return null;
  },

  async approve(id, approverId, comment) {
    const r = await api.post<Application>(`/api/approvals/${id}/approve`, { approverId, comment });
    if (r.success) {
      await get().refresh();
      return r.data;
    }
    return null;
  },

  async reject(id, approverId, comment) {
    const r = await api.post<Application>(`/api/approvals/${id}/reject`, { approverId, comment });
    if (r.success) {
      await get().refresh();
      return r.data;
    }
    return null;
  },

  async escalate(id, operatorId) {
    const r = await api.post(`/api/approvals/${id}/escalate`, { operatorId });
    if (r.success) {
      await get().refresh();
      return true;
    }
    return false;
  },

  async readNotif(id) {
    await api.put(`/api/notifications/${id}/read`);
    set(s => ({
      notifications: s.notifications.map(n => n.id === id ? { ...n, read: true } : n),
      unreadCount: Math.max(0, s.unreadCount - 1),
    }));
  },

  async readAll() {
    await api.put('/api/notifications/read/all', { userId: CURRENT_USER_ID });
    set(s => ({
      notifications: s.notifications.map(n => ({ ...n, read: true })),
      unreadCount: 0,
    }));
  },
}));
