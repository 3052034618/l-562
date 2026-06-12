import { useState, useMemo } from 'react';
import { useAppStore, CURRENT_USER_ID } from '@/store/app';
import { STATUS_MAP, TYPE_MAP, LEVEL_MAP, formatDate } from '@/lib/api';
import {
  ClipboardCheck, CheckCircle2, XCircle, Clock, AlertTriangle, Filter, Search, Check, X, ArrowUp, ArrowUpCircle, ChevronDown, ChevronUp, UserCheck, FileText, ArrowRightLeft, RotateCcw, RotateCcwIcon, BadgeCheck, ShieldCheck, AlertOctagon, ChevronRight, Loader2,
} from 'lucide-react';
import type { Application } from '../../shared/types';

export default function ApprovalCenter() {
  const { pendingApprovals, approve, reject, escalate, applications, refresh } = useAppStore();
  const [filter, setFilter] = useState<'all' | 'pending' | 'history'>('all');
  const [keyword, setKeyword] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [acting, setActing] = useState<string | null>(null);
  const [modal, setModal] = useState<{ id: string; action: 'approve' | 'reject' | null }>(null);
  const [showHistory, setShowHistory] = useState(false);

  const approverId = CURRENT_USER_ID;

  const data = useMemo(() => {
    const all = showHistory ? applications.filter(a => a.status !== 'pending_check') : pendingApprovals;
    return all.filter(a => !keyword
      || a.employeeName.includes(keyword)
      || a.id.toLowerCase().includes(keyword.toLowerCase())
      || a.department.includes(keyword));
  }, [pendingApprovals, applications, keyword, showHistory]);

  const runAction = async (id: string, action: 'approve' | 'reject') => {
    setActing(id);
    if (action === 'approve') await approve(id, approverId, comment);
    else await reject(id, approverId, comment);
    setModal(null);
    setComment('');
    setActing(null);
    refresh();
  };

  const runEscalate = async (id: string) => {
    setActing(id);
    await escalate(id, approverId);
    setActing(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex bg-white rounded-xl p-1 border border-slate-100 shadow-card">
            <button
              onClick={() => setShowHistory(false)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${!showHistory ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <span className="flex items-center gap-2">
                <ClipboardCheck size={16} />
                待我审批 <span className="chip ml-1 bg-white/20 text-white">{pendingApprovals.length}</span>
              </span>
            </button>
            <button
              onClick={() => setShowHistory(true)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${showHistory ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <span className="flex items-center gap-2"><FileText size={16} />全部申请</span>
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-9 w-72" placeholder="搜索工号/姓名/部门..."
              value={keyword} onChange={e => setKeyword(e.target.value)}
            />
          </div>
        </div>
      </div>

      {showHistory ? null : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card !p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/30"><Clock size={24} /></div>
            <div>
              <div className="text-xs text-slate-500">普通待办</div>
              <div className="text-2xl font-bold text-slate-800 font-mono">
                {pendingApprovals.filter(a => !a.escalated && (a.currentApprover?.waitHours || 0) <= 48).length}
              </div>
            </div>
          </div>
          <div className="card !p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-400 to-red-500 text-white flex items-center justify-center shadow-lg shadow-orange-500/30"><AlertTriangle size={24} /></div>
            <div>
              <div className="text-xs text-slate-500">临近超时（{'>'}24h）</div>
              <div className="text-2xl font-bold text-slate-800 font-mono">
                {pendingApprovals.filter(a => !a.escalated && (a.currentApprover?.waitHours || 0) > 24 && (a.currentApprover?.waitHours || 0) <= 48).length}
              </div>
            </div>
          </div>
          <div className="card !p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-fuchsia-500 to-fuchsia-600 text-white flex items-center justify-center shadow-lg shadow-fuchsia-500/30"><ArrowUpCircle size={24} /></div>
            <div>
              <div className="text-xs text-slate-500">已升级</div>
              <div className="text-2xl font-bold text-slate-800 font-mono">
                {pendingApprovals.filter(a => a.escalated).length}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card !p-0 overflow-hidden">
        {data.length === 0 && (
        <div className="py-20 text-center text-slate-400 text-sm">
          {showHistory ? '暂无历史申请记录' : '暂无待办审批 🎉'}
        </div>
      )}
        {data.map(app => (
          <div key={app.id} className="border-b last:border-0">
            <div className={`flex items-center gap-4 p-5 hover:bg-slate-50/60 cursor-pointer transition-colors ${app.escalated ? 'border-l-4 border-fuchsia-500' : ''}`}
              onClick={() => setExpanded(expanded === app.id ? null : app.id)}>
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${app.type === 'regular' ? 'bg-blue-100 text-blue-600' : 'bg-violet-100 text-violet-600'}`}>
                {app.type === 'regular' ? <BadgeCheck size={22} /> : <ArrowRightLeft size={22} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-slate-800">{app.employeeName}</span>
                  <span className={`chip ${TYPE_MAP[app.type].cls}`}>{TYPE_MAP[app.type].label}</span>
                  <span className="chip bg-slate-100 text-slate-600">{LEVEL_MAP[app.level]}</span>
                  <span className={`chip ${STATUS_MAP[app.status].cls}`}>{STATUS_MAP[app.status].label}</span>
                  {app.escalated && <span className="chip bg-fuchsia-100 text-fuchsia-700 animate-pulse-soft"><ArrowUp size={11} /> 已升级</span>}
                  {!app.escalated && app.currentApprover?.waitHours! > 24 && app.status === 'pending_approval' && <span className="chip bg-orange-100 text-orange-700"><Clock size={11} /> 等待{app.currentApprover?.waitHours}h</span>}
                </div>
                <div className="mt-1 text-xs text-slate-500 flex items-center gap-2">
                  <span>{app.department} · {app.position}</span>
                  {app.targetDepartment && <><span className="text-violet-600 font-medium">→</span> <span className="font-medium text-violet-700">{app.targetDepartment} · {app.targetPosition}</span></>}
                  <span>·</span>
                  <span>申请编号 <span className="font-mono text-slate-600">{app.id}</span></span>
                  <span>·</span>
                  <span>{formatDate(app.submitTime)}</span>
                </div>
                {app.missingItems.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {app.missingItems.map(m => (
                      <span key={m} className="chip bg-red-50 text-red-600"><XCircle size={10} /> {m}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="shrink-0">
                <div className="text-right">
                  {app.currentApprover && app.status === 'pending_approval' || app.status === 'escalated' ? (
                    <div>
                      <div className="text-xs text-slate-400">当前审批人</div>
                      <div className="text-sm font-semibold text-slate-700">{app.currentApprover.name}</div>
                      <div className="text-[11px] text-slate-400">{app.currentApprover.role} · 等{app.currentApprover.waitHours}h</div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400">已归档</div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!showHistory && (app.status === 'pending_approval' || app.status === 'escalated') && (
                  <>
                    <button onClick={e => { e.stopPropagation(); setModal({ id: app.id, action: 'approve' }); }} className="btn-success text-xs" disabled={acting === app.id}><Check size={14} /> 通过</button>
                    <button onClick={e => { e.stopPropagation(); setModal({ id: app.id, action: 'reject' }); }} className="btn-danger text-xs" disabled={acting === app.id}><X size={14} /> 退回</button>
                    {!app.escalated && app.currentApprover?.waitHours! > 24 && (
                      <button onClick={e => { e.stopPropagation(); runEscalate(app.id); }} className="btn-ghost text-xs border border-slate-200" disabled={acting === app.id} title="手动升级"><ArrowUp size={14} /> 升级</button>
                    )}
                  </>
                )}
                {expanded === app.id ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
              </div>
            </div>

            {expanded === app.id && (
              <div className="bg-slate-50/70 p-5 pl-[92px] animate-fade-in border-t border-slate-100">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <div className="text-xs font-semibold text-slate-700 mb-2">五项资格校验</div>
                    <div className="grid grid-cols-1 gap-2">
                      {app.checkResults.map(c => (
                        <div key={c.item} className={`p-3 rounded-lg bg-white border ${c.passed ? 'border-emerald-100' : 'border-red-100'}`}>
                          <div className="flex items-center gap-2">
                            {c.passed ? <CheckCircle2 size={15} className="text-emerald-600" /> : <XCircle size={15} className="text-red-600" />}
                            <span className="text-sm font-medium text-slate-700">{c.label}</span>
                          </div>
                          <div className="text-xs text-slate-500 mt-1 pl-6">{c.detail}</div>
                        </div>
                      ))}
                    </div>
                    {app.reason && (
                      <div className="mt-3 p-3 rounded-lg bg-white border border-slate-100">
                        <div className="text-xs font-semibold text-slate-700 mb-1">申请说明</div>
                        <div className="text-xs text-slate-600">{app.reason}</div>
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-700 mb-2">审批流程 & 记录</div>
                    <div className="space-y-2">
                      {app.approvalRecords.map((a, idx) => (
                        <div key={a.id} className={`p-3 rounded-lg bg-white border ${a.status === 'pending' ? 'border-amber-200 bg-amber-50/40' : a.status === 'approved' ? 'border-emerald-100' : 'border-red-100'}`}>
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${a.status === 'approved' ? 'bg-emerald-100 text-emerald-600' : a.status === 'rejected' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                                {a.status === 'approved' ? <Check size={14} /> : a.status === 'rejected' ? <X size={14} /> : <Clock size={14} />}
                              </div>
                              <div>
                                <div className="text-sm font-semibold text-slate-800">第{a.step}/{a.totalSteps} · {a.approverRole}</div>
                                <div className="text-[11px] text-slate-500">{a.approverName}
                                  {a.processedAt && <span> · {formatDate(a.processedAt)}</span>}
                                  {a.escalated && <span> · <span className="text-fuchsia-600">已升级</span></span>}
                                </div>
                              </div>
                            </div>
                            <span className={`chip ${a.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : a.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                              {a.status === 'approved' ? '通过' : a.status === 'rejected' ? '退回' : '待处理'}
                            </span>
                          </div>
                          {a.comment && <div className="mt-2 ml-11 text-xs text-slate-600 pl-3 py-2 bg-slate-50 rounded-lg px-3 border-l-2 border-slate-200">💬 {a.comment}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in" onClick={() => setModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-lg font-bold text-slate-800">
                  {modal.action === 'approve' ? '审批通过' : '审批退回'}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">申请编号：{modal.id}</div>
              </div>
              {modal.action === 'approve'
                ? <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white flex items-center justify-center"><ShieldCheck size={24} /></div>
                : <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-400 to-red-600 text-white flex items-center justify-center"><AlertOctagon size={24} /></div>}
            </div>
            <div className="mb-4">
              <label className="label">审批意见（可选）</label>
              <textarea className="input min-h-[100px]" value={comment} onChange={e => setComment(e.target.value)} placeholder={modal.action === 'approve' ? '请输入审批通过意见...' : '请输入退回原因...'} />
            </div>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setModal(null)} className="btn-ghost">取消</button>
              <button onClick={() => runAction(modal.id, modal.action)} disabled={acting === modal.id} className={modal.action === 'approve' ? 'btn-success' : 'btn-danger'}>
                {acting === modal.id && <Loader2 size={14} className="animate-spin" />}
                确认{modal.action === 'approve' ? '通过' : '退回'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
