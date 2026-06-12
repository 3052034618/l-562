import { useEffect, useState } from 'react';
import { api, formatDate } from '@/lib/api';
import {
  FileText, Search, AlertTriangle, ShieldCheck, ClipboardCheck, UserCheck, ArrowUpCircle, XCircle, CheckCircle2, Clock, AlertOctagon, RefreshCw, DownloadCloud,
} from 'lucide-react';

export default function LogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [exceptions, setExceptions] = useState<{ exceptions: any[]; overtime: any[]; failed: any[] }>({ exceptions: [], overtime: [], failed: [] });
  const [tab, setTab] = useState<'operations' | 'exceptions'>('operations');
  const [kw, setKw] = useState('');
  const [type, setType] = useState('');

  useEffect(() => {
    (async () => {
      const [l, e] = await Promise.all([api.get<any>('/api/logs'), api.get<any>('/api/logs/exceptions')]);
      if (l.success) setLogs(l.data.list || []);
      if (e.success) setExceptions(e.data);
    })();
  }, []);

  const ACTION_ICONS: Record<string, any> = {
    '申请提交': ClipboardCheck, '重新提交申请': RefreshCw, '自动校验': ShieldCheck,
    '分配审批流程': UserCheck, '审批通过': CheckCircle2, '审批通过（完成）': CheckCircle2,
    '审批退回': XCircle, '审批超时升级': ArrowUpCircle, '审批超时升级（定时任务）': ArrowUpCircle,
  };

  const TYPE_CHIP: Record<string, { label: string; cls: string }> = {
    operation: { label: '操作', cls: 'bg-blue-100 text-blue-700' },
    exception: { label: '异常', cls: 'bg-red-100 text-red-700' },
  };

  const filtered = logs.filter(l =>
    (!kw || (l.detail || '').includes(kw) || (l.target || '').includes(kw) || (l.operatorName || '').includes(kw))
    && (!type || l.type === type)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-500 to-slate-700 text-white flex items-center justify-center shadow-lg shadow-slate-500/30"><FileText size={22} /></div>
          <div>
            <div className="text-xl font-bold text-slate-800">系统日志</div>
            <div className="text-sm text-slate-500">操作审计 · 异常记录 · 审批超时 · 校验失败</div>
          </div>
        </div>
        <div className="flex bg-white rounded-xl p-1 border border-slate-100 shadow-card">
          <button onClick={() => setTab('operations')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'operations' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}>
            <span className="flex items-center gap-2"><ShieldCheck size={15} /> 操作日志 <span className="chip bg-white/20 text-white text-[10px]">{logs.length}</span></span>
          </button>
          <button onClick={() => setTab('exceptions')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'exceptions' ? 'bg-red-500 text-white shadow-sm shadow-red-500/20' : 'text-slate-600 hover:bg-slate-50'}`}>
            <span className="flex items-center gap-2"><AlertTriangle size={15} /> 异常中心 <span className="chip bg-white/20 text-white text-[10px]">{exceptions.overtime.length + exceptions.failed.length + exceptions.exceptions.length}</span></span>
          </button>
        </div>
      </div>

      {tab === 'operations' ? (
        <>
          <div className="card">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input className="input pl-9 w-80" placeholder="操作人/详情/目标..." value={kw} onChange={e => setKw(e.target.value)} />
              </div>
              <select className="select w-36" value={type} onChange={e => setType(e.target.value)}>
                <option value="">所有类型</option>
                <option value="operation">操作</option>
                <option value="exception">异常</option>
              </select>
              <button onClick={() => { api.download('/api/query/export'); }} className="btn-secondary text-xs ml-auto"><DownloadCloud size={14} /> 导出日志</button>
            </div>
          </div>
          <div className="card !p-0 overflow-hidden">
            <div className="max-h-[70vh] overflow-y-auto">
              {filtered.length === 0 && <div className="py-20 text-center text-slate-400 text-sm">暂无日志</div>}
              <div className="divide-y divide-slate-50">
                {filtered.map(l => {
                  const Icon = ACTION_ICONS[l.action] || FileText;
                  const isExc = l.type === 'exception';
                  return (
                    <div key={l.id} className={`flex items-start gap-4 px-5 py-3.5 hover:bg-slate-50/60 transition-colors ${isExc ? 'bg-red-50/20' : ''}`}>
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${isExc ? 'bg-red-100 text-red-600' : 'bg-brand-100 text-brand-600'}`}>
                        <Icon size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-slate-800">{l.action}</span>
                          <span className={`chip ${TYPE_CHIP[l.type]?.cls || 'bg-slate-100 text-slate-600'}`}>{TYPE_CHIP[l.type]?.label || l.type}</span>
                          {l.target && <span className="chip bg-slate-50 text-slate-600 border border-slate-200">#{l.target}</span>}
                        </div>
                        {l.detail && <div className="text-xs text-slate-600 mt-1">{l.detail}</div>}
                        <div className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-2">
                          {l.operatorName && <><UserCheck size={10} /> {l.operatorName}<span>·</span></>}
                          <Clock size={10} /> {formatDate(l.timestamp)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-bold text-slate-800 flex items-center gap-2"><Clock size={16} className="text-orange-500" /> 审批超时</div>
              <span className="chip bg-orange-100 text-orange-700">{exceptions.overtime.length}</span>
            </div>
            <div className="space-y-2.5">
              {exceptions.overtime.length === 0 && <div className="py-10 text-center text-slate-400 text-xs rounded-xl bg-slate-50 border border-dashed">暂无超时 ✅</div>}
              {exceptions.overtime.map((o: any) => (
                <div key={o.id} className="p-3 rounded-xl bg-gradient-to-br from-orange-50 to-red-50 border-l-4 border-red-400">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold text-slate-800">{o.employeeName} · {o.type === 'regular' ? '转正' : '调岗'}</div>
                    <span className="chip bg-red-100 text-red-700">{o.waitHours}h</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">审批人：{o.approverName} · {o.approverRole}</div>
                  <div className="text-[11px] text-red-600 mt-1 font-medium">{o.escalated ? '✓ 已升级处理' : '⚠️ 超48小时，建议升级或加急'}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-bold text-slate-800 flex items-center gap-2"><AlertOctagon size={16} className="text-amber-500" /> 校验失败</div>
              <span className="chip bg-amber-100 text-amber-700">{exceptions.failed.length}</span>
            </div>
            <div className="space-y-2.5">
              {exceptions.failed.length === 0 && <div className="py-10 text-center text-slate-400 text-xs rounded-xl bg-slate-50 border border-dashed">暂无校验失败 ✅</div>}
              {exceptions.failed.map((f: any) => (
                <div key={f.id} className="p-3 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border-l-4 border-amber-400">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold text-slate-800">{f.employeeName}</div>
                    <span className={`chip ${f.type === 'regular' ? 'bg-blue-100 text-blue-700' : 'bg-violet-100 text-violet-700'}`}>{f.type === 'regular' ? '转正' : '调岗'}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">原部门：{f.department} · {f.position}</div>
                  {f.targetDepartment && <div className="text-[11px] text-violet-700">目标：{f.targetDepartment} · {f.targetPosition}</div>}
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {f.missingItems.map((m: string) => <span key={m} className="chip bg-white text-red-700 border border-red-200 text-[10px]">缺：{m}</span>)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-bold text-slate-800 flex items-center gap-2"><AlertTriangle size={16} className="text-fuchsia-500" /> 系统异常记录</div>
              <span className="chip bg-fuchsia-100 text-fuchsia-700">{exceptions.exceptions.length}</span>
            </div>
            <div className="space-y-2.5 max-h-[500px] overflow-y-auto">
              {exceptions.exceptions.length === 0 && <div className="py-10 text-center text-slate-400 text-xs rounded-xl bg-slate-50 border border-dashed">暂无异常记录 ✅</div>}
              {exceptions.exceptions.map((e: any) => (
                <div key={e.id} className="p-3 rounded-xl bg-gradient-to-br from-fuchsia-50 to-pink-50 border border-fuchsia-100">
                  <div className="flex items-start justify-between">
                    <div className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                      <span className="chip bg-fuchsia-100 text-fuchsia-700">{e.action}</span>
                    </div>
                  </div>
                  {e.detail && <div className="text-[11px] text-slate-600 mt-1.5">{e.detail}</div>}
                  <div className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1.5">
                    <Clock size={9} /> {formatDate(e.timestamp)}
                    {e.target && <><span>·</span> 目标：{e.target}</>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
