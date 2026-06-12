export const api = {
  async get<T = any>(url: string, params?: Record<string, any>): Promise<{ success: boolean; data: T; error?: string }> {
    const q = params ? '?' + new URLSearchParams(
      Object.fromEntries(
        Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
      )
    ).toString() : '';
    const res = await fetch(url + q, { credentials: 'same-origin' });
    return res.json();
  },
  async post<T = any>(url: string, body?: any): Promise<{ success: boolean; data: T; error?: string }> {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    });
    return res.json();
  },
  async put<T = any>(url: string, body?: any): Promise<{ success: boolean; data: T; error?: string }> {
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    });
    return res.json();
  },
  download(url: string, params?: Record<string, any>) {
    const q = params ? '?' + new URLSearchParams(
      Object.fromEntries(
        Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
      )
    ).toString() : '';
    window.open(url + q, '_blank');
  },
};

export function formatDate(s?: string) {
  if (!s) return '-';
  try {
    const d = new Date(s.replace(' ', 'T'));
    return d.toLocaleString('zh-CN', { hour12: false });
  } catch {
    return s;
  }
}

export function formatDateShort(s?: string) {
  if (!s) return '-';
  try {
    const d = new Date(s.replace(' ', 'T'));
    return d.toLocaleDateString('zh-CN');
  } catch {
    return s;
  }
}

export const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  pending_check: { label: '校验中', cls: 'bg-slate-100 text-slate-600' },
  check_failed: { label: '校验未通过', cls: 'bg-red-100 text-red-600' },
  pending_approval: { label: '审批中', cls: 'bg-amber-100 text-amber-700' },
  escalated: { label: '已升级', cls: 'bg-fuchsia-100 text-fuchsia-700' },
  approved: { label: '已通过', cls: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: '已退回', cls: 'bg-rose-100 text-rose-700' },
};

export const LEVEL_MAP: Record<string, string> = {
  staff: '员工级',
  supervisor: '主管级',
  manager: '经理级',
  director: '总监级',
};

export const TYPE_MAP: Record<string, { label: string; cls: string }> = {
  regular: { label: '转正', cls: 'bg-blue-100 text-blue-700' },
  transfer: { label: '调岗', cls: 'bg-indigo-100 text-indigo-700' },
};

export const EMP_STAT_MAP: Record<string, { label: string; cls: string }> = {
  probation: { label: '试用期', cls: 'bg-orange-100 text-orange-700' },
  regular: { label: '正式', cls: 'bg-emerald-100 text-emerald-700' },
  transferred: { label: '已调岗', cls: 'bg-cyan-100 text-cyan-700' },
};

export const NOTIF_TYPE_MAP: Record<string, { label: string; icon: string; cls: string }> = {
  approval: { label: '审批', icon: 'ClipboardList', cls: 'bg-blue-100 text-blue-600' },
  escalation: { label: '升级', icon: 'AlertTriangle', cls: 'bg-fuchsia-100 text-fuchsia-600' },
  system: { label: '系统', icon: 'Settings', cls: 'bg-slate-100 text-slate-600' },
  exception: { label: '异常', icon: 'AlertCircle', cls: 'bg-red-100 text-red-600' },
  info: { label: '消息', icon: 'Bell', cls: 'bg-emerald-100 text-emerald-600' },
};
