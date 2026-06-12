import { useEffect, useState, useMemo } from 'react';
import { api, STATUS_MAP, TYPE_MAP } from '@/lib/api';
import { useAppStore } from '@/store/app';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ComposedChart, Area, Line,
} from 'recharts';
import { BarChart2, Calendar, FileDown, TrendingUp, FileSpreadsheet, FileText, CheckCircle2, ArrowRightLeft, Clock, RefreshCw, DownloadCloud, LineChart as LineChartIcon, Filter, X } from 'lucide-react';

const DEPT_OPTIONS = ['技术部', '人力资源部', '财务部', '市场部', '董事会'];
const LEVEL_OPTIONS = ['staff', 'supervisor', 'manager', 'director'];
const TYPE_OPTIONS = ['regular', 'transfer'];
const LEVEL_LABEL: Record<string, string> = { staff: '员工级', supervisor: '主管级', manager: '经理级', director: '总监级' };

export default function Reports() {
  const [trend, setTrend] = useState<any[]>([]);
  const [month, setMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [filterDept, setFilterDept] = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [filterType, setFilterType] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const { overview, refresh, departments } = useAppStore();

  const filterParams = useMemo(() => ({
    department: filterDept || undefined,
    level: filterLevel || undefined,
    type: filterType || undefined,
  }), [filterDept, filterLevel, filterType]);

  const hasFilter = filterDept || filterLevel || filterType;

  useEffect(() => {
    (async () => {
      const r = await api.get<any[]>('/api/reports/trend', filterParams);
      if (r.success) setTrend(r.data);
    })();
  }, [filterDept, filterLevel, filterType]);

  const genReport = async () => {
    setLoading(true);
    const r = await api.post<any>('/api/reports/generate/monthly', { month });
    if (r.success) setReport(r.data);
    setLoading(false);
    refresh();
  };

  const exportExcel = () => api.download('/api/reports/export/excel', { month, ...filterParams });
  const exportPdf = () => api.download('/api/reports/export/pdf', { month, ...filterParams });

  const m = overview.metrics?.current || {};
  const pm = overview.metrics?.previous || {};

  const chartData = useMemo(() => {
    return trend.map(t => ({
      month: t.month.slice(5) + '月',
      转正通过率: t.regularPassRate,
      调岗成功率: t.transferSuccessRate,
      平均处理时长: t.avgDuration,
      转正数: t.regularCount,
      调岗数: t.transferCount,
    }));
  }, [trend]);

  const months = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  const clearFilter = () => {
    setFilterDept('');
    setFilterLevel('');
    setFilterType('');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-brand-500/30">
            <BarChart2 size={22} />
          </div>
          <div>
            <div className="text-xl font-bold text-slate-800">统计报表</div>
            <div className="text-sm text-slate-500">转正/调岗通过率 · 平均处理时长 · 趋势图</div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowFilter(!showFilter)}
            className={`btn-ghost text-xs border ${hasFilter ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-slate-200'}`}
          >
            <Filter size={14} /> 筛选{hasFilter ? '（已启用）' : ''}
          </button>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200">
            <Calendar size={14} className="text-slate-400" />
            <select className="bg-transparent outline-none text-sm font-medium text-slate-700" value={month} onChange={e => setMonth(e.target.value)}>
              {months.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <button onClick={genReport} disabled={loading} className="btn-secondary text-xs">
            {loading ? <RefreshCw size={14} className="animate-spin" /> : <TrendingUp size={14} />}
            {loading ? '统计中' : '生成月度报表'}
          </button>
          <button onClick={exportExcel} className="btn-success text-xs"><FileSpreadsheet size={14} /> 导出Excel</button>
          <button onClick={exportPdf} className="btn-primary text-xs"><FileText size={14} /> 导出PDF</button>
        </div>
      </div>

      {showFilter && (
        <div className="card !p-4 animate-fade-in border-brand-100 bg-brand-50/30">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold text-slate-700">数据筛选</div>
            {hasFilter && (
              <button onClick={clearFilter} className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1">
                <X size={12} /> 清除筛选
              </button>
            )}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">部门：</span>
              <select className="input !py-1.5 !px-2 text-xs w-32" value={filterDept} onChange={e => setFilterDept(e.target.value)}>
                <option value="">全部</option>
                {(departments.length ? departments : DEPT_OPTIONS).map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">职级：</span>
              <select className="input !py-1.5 !px-2 text-xs w-28" value={filterLevel} onChange={e => setFilterLevel(e.target.value)}>
                <option value="">全部</option>
                {LEVEL_OPTIONS.map(l => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">类型：</span>
              <select className="input !py-1.5 !px-2 text-xs w-24" value={filterType} onChange={e => setFilterType(e.target.value)}>
                <option value="">全部</option>
                {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t === 'regular' ? '转正' : '调岗'}</option>)}
              </select>
            </div>
            {hasFilter && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {filterDept && <span className="chip bg-brand-100 text-brand-700">{filterDept}</span>}
                {filterLevel && <span className="chip bg-brand-100 text-brand-700">{LEVEL_LABEL[filterLevel]}</span>}
                {filterType && <span className="chip bg-brand-100 text-brand-700">{filterType === 'regular' ? '转正' : '调岗'}</span>}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {[
          { label: '转正通过率', value: m.regularPassRate || 0, prev: pm.regularPassRate || 0, icon: CheckCircle2, color: 'from-emerald-400 to-emerald-600', unit: '%', hint: '审批通过的转正申请 / 转正总申请' },
          { label: '调岗成功率', value: m.transferSuccessRate || 0, prev: pm.transferSuccessRate || 0, icon: ArrowRightLeft, color: 'from-violet-400 to-indigo-600', unit: '%', hint: '审批通过的调岗申请 / 调岗总申请' },
          { label: '平均处理时长', value: m.avgDuration || 0, prev: pm.avgDuration || 0, icon: Clock, color: 'from-blue-400 to-brand-600', unit: '小时', hint: '从提交到最后审批完成的耗时' },
        ].map((m, i) => (
          <div key={i} className="card relative overflow-hidden group hover:shadow-cardHover transition-shadow">
            <div className={`absolute -right-8 -top-8 w-32 h-32 rounded-full bg-gradient-to-br ${m.color} opacity-10 group-hover:opacity-20 transition-opacity`} />
            <div className="flex items-start justify-between relative">
              <div>
                <div className="text-sm text-slate-500">{m.label}</div>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-3xl font-bold font-mono tracking-tight text-slate-800">{m.value}</span>
                  <span className="text-sm text-slate-500">{m.unit}</span>
                </div>
                {m.prev !== undefined && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs">
                    <span className="text-slate-400">环比：</span>
                    {((m.value || 0) - (m.prev || 0)) >= 0
                      ? <span className="chip bg-emerald-100 text-emerald-700">↑ {((m.value || 0) - (m.prev || 0)).toFixed(1)}{m.unit}</span>
                      : <span className="chip bg-red-100 text-red-700">↓ {Math.abs((m.value || 0) - (m.prev || 0)).toFixed(1)}{m.unit}</span>}
                  </div>
                )}
              </div>
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${m.color} text-white flex items-center justify-center shadow-lg`}>
                <m.icon size={22} />
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 text-[11px] text-slate-400">💡 {m.hint}</div>
          </div>
        ))}
      </div>

      {report && (
        <div className="card bg-gradient-to-br from-brand-50/50 via-white to-indigo-50/30 border border-brand-100 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-600" />
                {report.month} 月度报表已生成
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                转正申请 {report.regularCount} 件 · 调岗申请 {report.transferCount} 件
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={exportExcel} className="btn-success text-xs"><FileSpreadsheet size={14} /> 下载Excel</button>
              <button onClick={exportPdf} className="btn-primary text-xs"><FileText size={14} /> 下载PDF</button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-bold text-slate-800 flex items-center gap-2"><BarChart2 size={16} className="text-brand-600" /> 通过率趋势（近12个月）</div>
            <div className="text-xs text-slate-400">单位：%</div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorReg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10B981" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorTrans" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94A3B8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} domain={[0, 100]} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', boxShadow: '0 8px 24px rgba(15,23,42,0.08)' }}
                labelStyle={{ fontWeight: 600, color: '#1E293B' }}
              />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="转正通过率" stroke="#10B981" fill="url(#colorReg)" strokeWidth={2} />
              <Area type="monotone" dataKey="调岗成功率" stroke="#8B5CF6" fill="url(#colorTrans)" strokeWidth={2} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-bold text-slate-800 flex items-center gap-2"><LineChartIcon size={16} className="text-brand-600" /> 申请数量趋势（近12个月）</div>
            <div className="text-xs text-slate-400">单位：件</div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94A3B8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', boxShadow: '0 8px 24px rgba(15,23,42,0.08)' }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="转正数" fill="#3B82F6" radius={[6, 6, 0, 0]} />
              <Bar dataKey="调岗数" fill="#F59E0B" radius={[6, 6, 0, 0]} />
              <Line type="monotone" dataKey="平均处理时长" stroke="#EF4444" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-bold text-slate-800">月度统计明细（近12个月）</div>
          <div className="flex items-center gap-2">
            {hasFilter && <span className="text-xs text-brand-600">当前筛选：{[filterDept, filterLevel && LEVEL_LABEL[filterLevel], filterType && (filterType === 'regular' ? '转正' : '调岗')].filter(Boolean).join(' / ')}</span>}
            <button onClick={exportExcel} className="btn-secondary text-xs"><DownloadCloud size={14} /> 一键导出所有数据</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr>
                <th className="table-th">月份</th>
                <th className="table-th">转正申请</th>
                <th className="table-th">转正通过</th>
                <th className="table-th">转正通过率</th>
                <th className="table-th">调岗申请</th>
                <th className="table-th">调岗通过</th>
                <th className="table-th">调岗成功率</th>
                <th className="table-th">平均处理时长</th>
              </tr>
            </thead>
            <tbody>
              {trend.slice().reverse().map(t => (
                <tr key={t.month} className="hover:bg-slate-50 transition-colors">
                  <td className="table-td font-semibold text-slate-700">{t.month}</td>
                  <td className="table-td font-mono">{t.regularCount}</td>
                  <td className="table-td font-mono">{t.regularPassCount}</td>
                  <td className="table-td"><span className={`chip ${t.regularPassRate >= 80 ? 'bg-emerald-100 text-emerald-700' : t.regularPassRate >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{t.regularPassRate}%</span></td>
                  <td className="table-td font-mono">{t.transferCount}</td>
                  <td className="table-td font-mono">{t.transferPassCount}</td>
                  <td className="table-td"><span className={`chip ${t.transferSuccessRate >= 80 ? 'bg-violet-100 text-violet-700' : t.transferSuccessRate >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{t.transferSuccessRate}%</span></td>
                  <td className="table-td font-mono text-slate-700">{t.avgDuration} h</td>
                </tr>
              ))}
              {trend.length === 0 && <tr><td colSpan={8} className="table-td text-center text-slate-400 py-10">暂无数据，请先生成报表</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
