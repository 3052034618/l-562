import { useEffect, useState } from 'react';
import { api, STATUS_MAP, TYPE_MAP, LEVEL_MAP, formatDate } from '@/lib/api';
import {
  Search, Calendar, Filter, Download, CheckCircle2, XCircle, Clock, AlertTriangle, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, RotateCcw, Building2, Hash, BadgeCheck, ArrowRightLeft, FileSpreadsheet, X,
} from 'lucide-react';
import type { Application } from '../../shared/types';

export default function QueryPage() {
  const [filters, setFilters] = useState<any>({ page: 1, pageSize: 20 });
  const [data, setData] = useState<Application[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showFilter, setShowFilter] = useState(true);
  const [detail, setDetail] = useState<Application | null>(null);
  const [departments, setDepartments] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const r = await api.get<any>('/api/employees/options/list');
      if (r.success) setDepartments(r.data.departments);
    })();
    doQuery();
  }, []);

  const doQuery = async () => {
    setLoading(true);
    const r = await api.get<{ list: Application[]; total: number }>('/api/query', filters);
    if (r.success) {
      setData(r.data.list);
      setTotal(r.data.total);
    }
    setLoading(false);
  };

  const onExport = () => {
    const ids = Array.from(selected);
    api.download('/api/query/export', { ids: ids.length ? ids.join(',') : undefined, ...filters, page: undefined, pageSize: undefined });
  };

  const toggle = (id: string) => {
    setSelected(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };

  const toggleAll = () => {
    if (selected.size === data.length) setSelected(new Set());
    else setSelected(new Set(data.map(d => d.id)));
  };

  const totalPages = Math.ceil(total / (filters.pageSize || 20));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-red-500 text-white flex items-center justify-center shadow-lg shadow-orange-500/30"><Search size={22} /></div>
          <div>
            <div className="text-xl font-bold text-slate-800">历史查询 · 批量导出</div>
            <div className="text-sm text-slate-500">按员工编号 / 部门 / 时间段 / 类型 / 状态 组合筛选</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary text-xs" onClick={() => setShowFilter(v => !v)}>
            <Filter size={14} /> {showFilter ? '收起筛选' : '展开筛选'}
          </button>
          <button className="btn-ghost text-xs" onClick={() => { setFilters({ page: 1, pageSize: 20 }); doQuery(); }}><RotateCcw size={14} /> 重置</button>
          <button className={`btn-primary text-xs ${selected.size ? '' : 'opacity-60'}`} onClick={onExport}>
            <FileSpreadsheet size={14} /> {selected.size ? `导出选中 (${selected.size})` : '导出全部'}
          </button>
        </div>
      </div>

      {showFilter && (
        <div className="card bg-gradient-to-br from-slate-50/80 to-brand-50/30 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <div>
              <label className="label flex items-center gap-1"><Hash size={12} className="text-slate-400" /> 员工编号</label>
              <input className="input" placeholder="如：E001" value={filters.employeeId || ''} onChange={e => setFilters({ ...filters, employeeId: e.target.value })} />
            </div>
            <div>
              <label className="label flex items-center gap-1"><Building2 size={12} className="text-slate-400" /> 部门</label>
              <select className="select" value={filters.department || ''} onChange={e => setFilters({ ...filters, department: e.target.value })}>
                <option value="">全部部门</option>
                {departments.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="label flex items-center gap-1"><BadgeCheck size={12} className="text-slate-400" /> 申请类型</label>
              <select className="select" value={filters.type || ''} onChange={e => setFilters({ ...filters, type: e.target.value })}>
                <option value="">全部类型</option>
                <option value="regular">转正</option>
                <option value="transfer">调岗</option>
              </select>
            </div>
            <div>
              <label className="label flex items-center gap-1"><Clock size={12} className="text-slate-400" /> 审批状态</label>
              <select className="select" value={filters.status || ''} onChange={e => setFilters({ ...filters, status: e.target.value })}>
                <option value="">全部状态</option>
                {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label flex items-center gap-1"><Calendar size={12} className="text-slate-400" /> 开始日期</label>
              <input type="date" className="input" value={filters.startDate || ''} onChange={e => setFilters({ ...filters, startDate: e.target.value })} />
            </div>
            <div>
              <label className="label flex items-center gap-1"><Calendar size={12} className="text-slate-400" /> 结束日期</label>
              <input type="date" className="input" value={filters.endDate || ''} onChange={e => setFilters({ ...filters, endDate: e.target.value })} />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-end">
            <button className="btn-primary text-sm" onClick={doQuery} disabled={loading}>
              {loading && <RotateCcw size={14} className="animate-spin" />}
              <Search size={14} /> {loading ? '查询中...' : '执行查询'}
            </button>
          </div>
        </div>
      )}

      <div className="card !p-0 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <div className="text-sm text-slate-500">
            共找到 <b className="text-slate-800 font-mono">{total}</b> 条记录
            {selected.size > 0 && <> · 已选择 <b className="text-brand-700 font-mono">{selected.size}</b> 条</>}
          </div>
          {data.length > 0 && (
            <label className="inline-flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
              <input type="checkbox" checked={selected.size === data.length} onChange={toggleAll} className="accent-brand-600" />
              全选本页
            </label>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px]">
            <thead>
              <tr>
                <th className="table-th w-12"><span className="sr-only">选择</span></th>
                <th className="table-th">编号</th>
                <th className="table-th">类型</th>
                <th className="table-th">员工</th>
                <th className="table-th">部门/岗位</th>
                <th className="table-th">资格</th>
                <th className="table-th">当前审批人</th>
                <th className="table-th">等待时长</th>
                <th className="table-th">状态</th>
                <th className="table-th">提交时间</th>
                <th className="table-th text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading && data.length === 0 && <tr><td colSpan={11} className="table-td text-center py-16 text-slate-400">加载中...</td></tr>}
              {!loading && data.length === 0 && <tr><td colSpan={11} className="table-td text-center py-16 text-slate-400">暂无匹配记录</td></tr>}
              {data.map(a => (
                <tr key={a.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="table-td">
                    <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggle(a.id)} className="accent-brand-600" />
                  </td>
                  <td className="table-td font-mono text-xs text-slate-500">{a.id}</td>
                  <td className="table-td"><span className={`chip ${TYPE_MAP[a.type].cls}`}>{TYPE_MAP[a.type].label}</span></td>
                  <td className="table-td">
                    <div className="font-semibold text-slate-800">{a.employeeName}</div>
                    <div className="text-[11px] text-slate-400 font-mono">{a.employeeId}</div>
                  </td>
                  <td className="table-td text-slate-600 text-sm">
                    <div>{a.department} · {a.position}</div>
                    {a.targetDepartment && <div className="text-violet-700 mt-0.5 text-xs">→ {a.targetDepartment} · {a.targetPosition}</div>}
                  </td>
                  <td className="table-td">
                    <div className="flex gap-1">
                      {a.checkResults.slice(0, 5).map(c => c.passed
                        ? <span key={c.item} className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-[10px]" title={`${c.label}: ${c.detail}`}><CheckCircle2 size={12} /></span>
                        : <span key={c.item} className="w-5 h-5 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-[10px]" title={`${c.label}: ${c.detail}`}><XCircle size={12} /></span>)}
                    </div>
                    {a.missingItems.length > 0 && <div className="mt-1 text-[10px] text-red-600">缺: {a.missingItems.join(' ')}</div>}
                  </td>
                  <td className="table-td">
                    {a.currentApprover
                      ? <div>
                          <div className="text-sm font-medium text-slate-700">{a.currentApprover.name}</div>
                          <div className="text-[10px] text-slate-400">{a.currentApprover.role}</div>
                        </div>
                      : <span className="text-xs text-slate-400">-</span>}
                  </td>
                  <td className="table-td">
                    {a.currentApprover
                      ? <div className={`inline-flex items-center gap-1 chip ${a.currentApprover.waitHours > 48 ? 'bg-red-100 text-red-700' : a.currentApprover.waitHours > 24 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600'}`}>
                          <Clock size={10} /> {a.currentApprover.waitHours}h
                          {a.escalated && <span className="text-fuchsia-700"><AlertTriangle size={10} /></span>}
                        </div>
                      : <span className="text-xs text-slate-400">-</span>}
                  </td>
                  <td className="table-td"><span className={`chip ${STATUS_MAP[a.status].cls}`}>{STATUS_MAP[a.status].label}</span></td>
                  <td className="table-td text-xs text-slate-500">{formatDate(a.submitTime)}</td>
                  <td className="table-td text-right">
                    <button onClick={() => setDetail(a)} className="text-xs text-brand-600 hover:underline font-medium">查看详情</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
            <div className="text-xs text-slate-500">第 {filters.page} / {totalPages} 页</div>
            <div className="flex items-center gap-1">
              <button onClick={() => { setFilters({ ...filters, page: filters.page - 1 }); doQuery(); }} disabled={filters.page === 1} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center disabled:opacity-40"><ChevronLeft size={16} /></button>
              {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                const p = Math.max(1, Math.min(totalPages - 4, filters.page - 2)) + i;
                return (
                  <button key={i} onClick={() => { setFilters({ ...filters, page: p }); doQuery(); }} className={`w-8 h-8 rounded-lg text-xs font-medium ${p === filters.page ? 'bg-brand-600 text-white' : 'hover:bg-slate-100 text-slate-600'}`}>{p}</button>
                );
              })}
              <button onClick={() => { setFilters({ ...filters, page: filters.page + 1 }); doQuery(); }} disabled={filters.page === totalPages} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center disabled:opacity-40"><ChevronRight size={16} /></button>
            </div>
          </div>
        )}
      </div>

      {detail && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-6 animate-fade-in" onClick={() => setDetail(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${detail.type === 'regular' ? 'bg-blue-100 text-blue-600' : 'bg-violet-100 text-violet-600'}`}>
                  {detail.type === 'regular' ? <BadgeCheck size={22} /> : <ArrowRightLeft size={22} />}
                </div>
                <div>
                  <div className="text-lg font-bold text-slate-800">申请详情 <span className="font-mono text-sm text-slate-400">({detail.id})</span></div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    <span className={`chip ${TYPE_MAP[detail.type].cls} mr-1.5`}>{TYPE_MAP[detail.type].label}</span>
                    <span className={`chip ${STATUS_MAP[detail.status].cls}`}>{STATUS_MAP[detail.status].label}</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setDetail(null)} className="w-9 h-9 rounded-lg hover:bg-slate-100 flex items-center justify-center"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div><div className="text-[11px] text-slate-400">申请人</div><div className="font-semibold text-slate-800">{detail.employeeName} ({detail.employeeId})</div></div>
                <div><div className="text-[11px] text-slate-400">职级</div><div className="font-semibold text-slate-800">{LEVEL_MAP[detail.level as keyof typeof LEVEL_MAP]}</div></div>
                <div><div className="text-[11px] text-slate-400">原部门/岗位</div><div className="font-semibold text-slate-800">{detail.department} · {detail.position}</div></div>
                {detail.targetDepartment && <div><div className="text-[11px] text-slate-400">目标部门/岗位</div><div className="font-semibold text-violet-700">{detail.targetDepartment} · {detail.targetPosition}</div></div>}
                <div><div className="text-[11px] text-slate-400">提交时间</div><div className="font-semibold text-slate-800">{formatDate(detail.submitTime)}</div></div>
                <div><div className="text-[11px] text-slate-400">申请原因</div><div className="text-sm text-slate-700">{detail.reason || '-'}</div></div>
              </div>
              <div>
                <div className="text-xs font-bold text-slate-700 mb-2">资格校验明细</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {detail.checkResults.map(c => (
                    <div key={c.item} className={`p-3 rounded-xl border ${c.passed ? 'border-emerald-100 bg-emerald-50/40' : 'border-red-100 bg-red-50/60'}`}>
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                        {c.passed ? <CheckCircle2 size={16} className="text-emerald-600" /> : <XCircle size={16} className="text-red-600" />}
                        {c.label} <span className={`ml-auto chip ${c.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{c.passed ? '✓' : '✗'}</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1 pl-7">{c.detail}</div>
                    </div>
                  ))}
                </div>
              </div>
              {detail.approvalRecords.length > 0 && (
                <div>
                  <div className="text-xs font-bold text-slate-700 mb-2">审批流程</div>
                  <div className="space-y-2">
                    {detail.approvalRecords.map(a => (
                      <div key={a.id} className={`p-3 rounded-xl border ${a.status === 'pending' ? 'border-amber-200 bg-amber-50/40' : a.status === 'approved' ? 'border-emerald-100 bg-white' : 'border-red-100 bg-white'}`}>
                        <div className="flex items-center justify-between">
                          <div className="text-sm">
                            <span className="font-semibold text-slate-800">第{a.step}/{a.totalSteps}步 · {a.approverRole}</span>
                            <span className="text-slate-400 mx-1.5">|</span>
                            <span className="text-slate-600">{a.approverName}</span>
                            {a.escalated && <span className="ml-2 chip bg-fuchsia-100 text-fuchsia-700">已升级</span>}
                          </div>
                          <span className={`chip ${a.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : a.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                            {a.status === 'approved' ? '通过' : a.status === 'rejected' ? '退回' : '待处理'}
                          </span>
                        </div>
                        {a.comment && <div className="mt-2 ml-2 pl-3 text-xs text-slate-600 py-2 bg-slate-50 rounded-lg border-l-2 border-slate-200">💬 {a.comment}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
