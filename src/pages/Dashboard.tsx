import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/app';
import {
  ClipboardList,
  UserCheck,
  ArrowRightLeft,
  AlertTriangle,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  TrendingUp,
  TrendingDown,
  FilePlus2,
  Plus,
} from 'lucide-react';
import { STATUS_MAP, TYPE_MAP, formatDate, LEVEL_MAP } from '@/lib/api';

export default function Dashboard() {
  const { overview, pendingApprovals, exceptions, applications, loadAll } = useAppStore();
  const nav = useNavigate();

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const m = overview.metrics?.current || {};
  const pm = overview.metrics?.previous || {};

  const metricCards = [
    {
      label: '待审批', value: overview.pendingApprovals || 0, icon: ClipboardList,
      bg: 'from-blue-500 to-blue-600', desc: '需及时处理的申请',
    },
    {
      label: '本月转正', value: overview.regularCount || 0, icon: UserCheck,
      bg: 'from-emerald-500 to-emerald-600', desc: '转正通过率', value2: m.regularPassRate, prev: pm.regularPassRate, suffix: '%',
    },
    {
      label: '本月调岗', value: overview.transferCount || 0, icon: ArrowRightLeft,
      bg: 'from-violet-500 to-violet-600', desc: '调岗成功率', value2: m.transferSuccessRate, prev: pm.transferSuccessRate, suffix: '%',
    },
    {
      label: '超时预警', value: (overview.escalatedCount || 0) + (overview.overtimeCount || 0), icon: AlertTriangle,
      bg: 'from-orange-500 to-red-600', desc: '48小时未处理自动升级',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {metricCards.map((c, i) => (
          <div key={i} className="card !p-0 overflow-hidden group hover:shadow-cardHover transition-shadow relative">
            <div className={`h-2 bg-gradient-to-r ${c.bg}`} />
            <div className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm text-slate-500">{c.label}</div>
                  <div className="text-3xl font-bold text-slate-800 mt-2 font-mono tracking-tight">{c.value}</div>
                  <div className="mt-2 text-xs text-slate-500 flex items-center gap-1">
                    <Clock size={12} />
                    {c.desc}
                  </div>
                </div>
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${c.bg} text-white flex items-center justify-center shadow-lg shadow-${c.bg.includes('blue') ? 'blue' : c.bg.includes('emerald') ? 'emerald' : c.bg.includes('violet') ? 'violet' : 'orange'}-500/30 group-hover:scale-105 transition-transform`}>
                  <c.icon size={22} />
                </div>
              </div>
              {c.value2 !== undefined && (
                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-slate-400">{c.desc}</div>
                    <div className="text-xl font-bold text-slate-700 mt-0.5 font-mono">
                      {c.value2}{c.suffix}
                    </div>
                  </div>
                  {c.prev !== undefined && c.prev !== c.value2 && (
                    <div className={`chip ${c.value2 >= c.prev ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {c.value2 >= c.prev ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                      环比 {((c.value2 || 0) - (c.prev || 0)).toFixed(1)}{c.suffix}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 待处理申请 */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <ClipboardList size={20} className="text-brand-600" />
                待处理申请
              </div>
              <div className="text-xs text-slate-400 mt-0.5">共 {pendingApprovals.length} 条待办</div>
            </div>
            <button onClick={() => nav('/approval')} className="btn-secondary text-xs">
              全部审批 <ChevronRight size={14} />
            </button>
          </div>
          <div className="space-y-3">
            {pendingApprovals.length === 0 && <div className="py-12 text-center text-slate-400 text-sm">暂无待办审批 🎉</div>}
            {pendingApprovals.map(app => (
              <div key={app.id} className={`p-4 rounded-xl border-l-4 ${app.escalated ? 'border-fuchsia-500 bg-fuchsia-50/30' : app.currentApprover?.waitHours! > 24 ? 'border-orange-400 bg-orange-50/30' : 'border-brand-500 bg-brand-50/30'} hover:shadow-sm transition-shadow`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`chip ${TYPE_MAP[app.type].cls}`}>{TYPE_MAP[app.type].label}</span>
                      <span className="chip bg-slate-100 text-slate-600">{LEVEL_MAP[app.level]}</span>
                      <span className={`chip ${STATUS_MAP[app.status].cls}`}>{STATUS_MAP[app.status].label}</span>
                      {app.escalated && <span className="chip bg-fuchsia-100 text-fuchsia-700"><AlertTriangle size={10} /> 已升级</span>}
                      {!app.escalated && app.currentApprover?.waitHours! > 24 && <span className="chip bg-orange-100 text-orange-700 animate-pulse-soft"><Clock size={10} /> 等待{app.currentApprover?.waitHours}h</span>}
                    </div>
                    <div className="mt-2 flex items-center gap-3 text-sm">
                      <span className="font-semibold text-slate-800">{app.employeeName}</span>
                      <span className="text-slate-400">{app.department} · {app.position}</span>
                    </div>
                    {app.targetDepartment && (
                      <div className="mt-1 text-xs text-slate-500 flex items-center gap-1.5">
                        <span>调往</span>
                        <span className="font-medium text-violet-700">{app.targetDepartment} · {app.targetPosition}</span>
                      </div>
                    )}
                    {app.missingItems.length > 0 && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {app.missingItems.map(item => (
                          <span key={item} className="chip bg-red-100 text-red-700"><XCircle size={10} /> 缺失：{item}</span>
                        ))}
                      </div>
                    )}
                    <div className="mt-2 text-xs text-slate-400 flex items-center gap-2">
                      <CheckCircle2 size={12} className="text-slate-400" />
                      当前审批：<span className="font-medium text-slate-600">{app.currentApprover?.name}</span>
                      <span className="text-slate-300">·</span>
                      {app.currentApprover?.role}
                      <span className="text-slate-300">·</span>
                      提交 {formatDate(app.submitTime)}
                    </div>
                  </div>
                  <button onClick={() => nav('/approval')} className="btn-primary text-xs shrink-0">处理</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 右侧：快捷入口 + 异常 + 近期申请 */}
        <div className="space-y-6">
          <div className="card">
            <div className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <FilePlus2 size={16} className="text-brand-600" /> 快捷操作
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => nav('/apply/regular')} className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100/60 hover:from-blue-100 hover:to-blue-200/70 text-left transition-colors group">
                <div className="w-10 h-10 rounded-lg bg-white/80 flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                  <UserCheck size={20} />
                </div>
                <div className="mt-3 text-sm font-semibold text-blue-900">提交转正</div>
                <div className="text-[11px] text-blue-700/70 mt-0.5">试用期已满可申请</div>
              </button>
              <button onClick={() => nav('/apply/transfer')} className="p-4 rounded-xl bg-gradient-to-br from-violet-50 to-violet-100/60 hover:from-violet-100 hover:to-violet-200/70 text-left transition-colors group">
                <div className="w-10 h-10 rounded-lg bg-white/80 flex items-center justify-center text-violet-600 group-hover:scale-110 transition-transform">
                  <ArrowRightLeft size={20} />
                </div>
                <div className="mt-3 text-sm font-semibold text-violet-900">提交调岗</div>
                <div className="text-[11px] text-violet-700/70 mt-0.5">跨/内部岗位调动</div>
              </button>
            </div>
            <button onClick={() => nav('/approval')} className="mt-3 w-full p-3 rounded-xl bg-slate-50 hover:bg-slate-100 flex items-center justify-between group">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-white text-slate-700 flex items-center justify-center">
                  <ClipboardList size={18} />
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-800">前往审批中心</div>
                  <div className="text-[11px] text-slate-400">查看并处理所有待办</div>
                </div>
              </div>
              <ChevronRight size={18} className="text-slate-400 group-hover:text-brand-600 group-hover:translate-x-0.5 transition-all" />
            </button>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <AlertTriangle size={16} className="text-orange-600" />
                异常提醒
              </div>
              <button onClick={() => nav('/logs')} className="text-xs text-brand-600 hover:underline">查看全部</button>
            </div>
            <div className="space-y-2.5">
              {exceptions.overtime.slice(0, 4).map((o: any) => (
                <div key={o.id} className="p-3 rounded-lg bg-red-50/60 border-l-2 border-red-400">
                  <div className="flex items-start justify-between">
                    <div className="text-xs text-slate-700">
                      <span className="font-semibold text-red-700">{o.employeeName}</span>
                      <span className="text-slate-500"> {o.type === 'regular' ? '转正' : '调岗'}审批超时</span>
                    </div>
                    <span className="chip bg-red-100 text-red-700 text-[10px]">{o.waitHours}h</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">审批人：{o.approverName} · {o.approverRole}</div>
                </div>
              ))}
              {exceptions.failed.slice(0, 2).map((f: any) => (
                <div key={f.id} className="p-3 rounded-lg bg-amber-50/60 border-l-2 border-amber-400">
                  <div className="text-xs text-slate-700">
                    <span className="font-semibold text-amber-700">{f.employeeName}</span>
                    <span className="text-slate-500"> 资格校验未通过</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">缺失：{f.missingItems.join('、')}</div>
                </div>
              ))}
              {exceptions.overtime.length === 0 && exceptions.failed.length === 0 && (
                <div className="py-8 text-center text-slate-400 text-xs">暂无异常 ✅</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 最近申请 */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Plus size={20} className="text-brand-600" />
            最近申请
          </div>
          <button onClick={() => nav('/query')} className="btn-secondary text-xs">历史查询 <ChevronRight size={14} /></button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr>
                <th className="table-th">申请编号</th>
                <th className="table-th">类型</th>
                <th className="table-th">员工</th>
                <th className="table-th">部门/岗位</th>
                <th className="table-th">资格校验</th>
                <th className="table-th">当前审批人</th>
                <th className="table-th">状态</th>
                <th className="table-th">提交时间</th>
                <th className="table-th text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {applications.slice(0, 10).map(a => (
                <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                  <td className="table-td font-mono text-xs text-slate-500">{a.id}</td>
                  <td className="table-td"><span className={`chip ${TYPE_MAP[a.type].cls}`}>{TYPE_MAP[a.type].label}</span></td>
                  <td className="table-td font-medium text-slate-800">{a.employeeName}</td>
                  <td className="table-td text-slate-600">
                    <div>{a.department} · {a.position}</div>
                    {a.targetDepartment && <div className="text-xs text-violet-600 mt-0.5">→ {a.targetDepartment} · {a.targetPosition}</div>}
                  </td>
                  <td className="table-td">
                    <div className="flex gap-1">
                      {a.checkResults.map(c => (
                        c.passed
                          ? <span key={c.item} title={c.label} className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-[10px]"><CheckCircle2 size={12} /></span>
                          : <span key={c.item} title={`${c.label}: ${c.detail}`} className="w-5 h-5 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-[10px]"><XCircle size={12} /></span>
                      ))}
                      {a.checkResults.length === 0 && <span className="text-xs text-slate-400">-</span>}
                    </div>
                  </td>
                  <td className="table-td">
                    {a.currentApprover ? (
                      <div>
                        <div className="text-sm font-medium text-slate-700">{a.currentApprover.name}</div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1">
                          <Clock size={10} /> {a.currentApprover.waitHours}h · {a.currentApprover.role}
                        </div>
                      </div>
                    ) : <span className="text-xs text-slate-400">-</span>}
                  </td>
                  <td className="table-td"><span className={`chip ${STATUS_MAP[a.status].cls}`}>{STATUS_MAP[a.status].label}</span></td>
                  <td className="table-td text-xs text-slate-500">{formatDate(a.submitTime)}</td>
                  <td className="table-td text-right">
                    {a.status === 'pending_approval' || a.status === 'escalated'
                      ? <button onClick={() => nav('/approval')} className="text-xs text-brand-600 hover:underline font-medium">去审批</button>
                      : a.status === 'check_failed'
                        ? <button onClick={() => nav(a.type === 'regular' ? '/apply/regular' : '/apply/transfer')} className="text-xs text-orange-600 hover:underline font-medium">重新提交</button>
                        : <span className="text-xs text-slate-400">—</span>}
                  </td>
                </tr>
              ))}
              {applications.length === 0 && (
                <tr><td colSpan={9} className="table-td text-center text-slate-400 py-10">暂无申请记录</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
