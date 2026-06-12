import { useState, useMemo } from 'react';
import { useAppStore } from '@/store/app';
import { Users, Search, UserCircle2, Building2, Award, Briefcase, ChevronRight, FileUser, BadgeCheck, Crown, Hash, Clock, Star, ArrowRightLeft, BadgeDollarSign, X, Save, RefreshCw } from 'lucide-react';
import { EMP_STAT_MAP, LEVEL_MAP, formatDate, STATUS_MAP, TYPE_MAP } from '@/lib/api';

export default function EmployeePage() {
  const { employees, applications, refresh } = useAppStore();
  const [kw, setKw] = useState('');
  const [dept, setDept] = useState('');
  const [lv, setLv] = useState('');
  const [detail, setDetail] = useState<any>(null);
  const [edit, setEdit] = useState(false);
  const [editData, setEditData] = useState<any>({});
  const [saving, setSaving] = useState(false);

  const depts = useMemo(() => Array.from(new Set(employees.map(e => e.department))), [employees]);

  const list = useMemo(() => employees.filter(e =>
    (!kw || e.name.includes(kw) || e.id.includes(kw) || e.position.includes(kw))
    && (!dept || e.department === dept)
    && (!lv || e.level === lv)
  ), [employees, kw, dept, lv]);

  const openDetail = (e: any) => {
    setDetail(e);
    setEditData({ department: e.department, position: e.position, salaryGrade: e.salaryGrade, supervisorId: e.supervisorId, supervisorName: e.supervisorName, status: e.status, level: e.level });
    setEdit(false);
  };

  const saveEdit = async () => {
    setSaving(true);
    const res = await fetch(`/api/employees/${detail.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editData),
    }).then(r => r.json());
    setSaving(false);
    if (res.success) {
      setEdit(false);
      refresh();
    }
  };

  const history = applications.filter(a => detail && a.employeeId === detail.id);

  const statCount = {
    total: employees.length,
    probation: employees.filter(e => e.status === 'probation').length,
    regular: employees.filter(e => e.status === 'regular').length,
    transferred: employees.filter(e => e.status === 'transferred').length,
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: '员工总数', value: statCount.total, icon: Users, cls: 'from-blue-500 to-blue-600' },
          { label: '试用期', value: statCount.probation, icon: Clock, cls: 'from-amber-400 to-orange-500' },
          { label: '正式员工', value: statCount.regular, icon: BadgeCheck, cls: 'from-emerald-500 to-emerald-600' },
          { label: '已调岗', value: statCount.transferred, icon: ArrowRightLeft, cls: 'from-violet-500 to-violet-600' },
        ].map((m, i) => (
          <div key={i} className="card !p-0 overflow-hidden">
            <div className={`h-2 bg-gradient-to-r ${m.cls}`} />
            <div className="p-5 flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${m.cls} text-white flex items-center justify-center shadow-lg`}>
                <m.icon size={22} />
              </div>
              <div>
                <div className="text-xs text-slate-500">{m.label}</div>
                <div className="text-2xl font-bold text-slate-800 font-mono mt-1">{m.value}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div className="text-lg font-bold text-slate-800 flex items-center gap-2"><FileUser size={20} className="text-brand-600" /> 员工档案</div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="input pl-8 w-64" placeholder="姓名/工号/岗位" value={kw} onChange={e => setKw(e.target.value)} />
            </div>
            <select className="select w-40" value={dept} onChange={e => setDept(e.target.value)}>
              <option value="">所有部门</option>
              {depts.map(d => <option key={d}>{d}</option>)}
            </select>
            <select className="select w-36" value={lv} onChange={e => setLv(e.target.value)}>
              <option value="">所有职级</option>
              {Object.entries(LEVEL_MAP).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr>
                <th className="table-th">员工</th>
                <th className="table-th">部门/岗位</th>
                <th className="table-th">职级</th>
                <th className="table-th">薪资级别</th>
                <th className="table-th">直属主管</th>
                <th className="table-th">入职日期</th>
                <th className="table-th">状态</th>
                <th className="table-th text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {list.map(e => (
                <tr key={e.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => openDetail(e)}>
                  <td className="table-td">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-white flex items-center justify-center text-sm font-semibold">{e.name.slice(0, 1)}</div>
                      <div>
                        <div className="font-semibold text-slate-800">{e.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{e.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="table-td">{e.department} · {e.position}</td>
                  <td className="table-td"><span className="chip bg-slate-100 text-slate-700">{LEVEL_MAP[e.level as keyof typeof LEVEL_MAP]}</span></td>
                  <td className="table-td font-mono text-sm text-slate-700">{e.salaryGrade}</td>
                  <td className="table-td">{e.supervisorName || '-'}</td>
                  <td className="table-td text-xs text-slate-500">{e.hireDate}</td>
                  <td className="table-td"><span className={`chip ${EMP_STAT_MAP[e.status as keyof typeof EMP_STAT_MAP].cls}`}>{EMP_STAT_MAP[e.status as keyof typeof EMP_STAT_MAP].label}</span></td>
                  <td className="table-td text-right">
                    <button className="text-xs text-brand-600 hover:underline font-medium" onClick={ev => { ev.stopPropagation(); openDetail(e); }}>查看档案</button>
                  </td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={8} className="table-td text-center text-slate-400 py-10">暂无匹配的员工</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {detail && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-6 animate-fade-in" onClick={() => setDetail(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-white flex items-center justify-center text-lg font-bold">{detail.name.slice(0, 1)}</div>
                <div>
                  <div className="text-xl font-bold text-slate-800">{detail.name} <span className="text-sm font-normal text-slate-400 ml-1">({detail.id})</span></div>
                  <div className="text-xs text-slate-500">{detail.department} · {detail.position}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!edit ? (
                  <button className="btn-secondary text-xs" onClick={() => setEdit(true)}><RefreshCw size={14} /> 编辑档案</button>
                ) : (
                  <>
                    <button className="btn-ghost text-xs" onClick={() => { setEdit(false); openDetail(detail); }}>取消</button>
                    <button className="btn-primary text-xs" onClick={saveEdit} disabled={saving}><Save size={14} /> {saving ? '保存中' : '保存修改'}</button>
                  </>
                )}
                <button onClick={() => setDetail(null)} className="w-9 h-9 rounded-lg hover:bg-slate-100 flex items-center justify-center"><X size={18} /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div>
                <div className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2"><UserCircle2 size={16} /> 基本信息</div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {[
                    { label: '姓名', key: 'name', readonly: true, icon: UserCircle2 },
                    { label: '工号', key: 'id', readonly: true, icon: Hash },
                    { label: '部门', key: 'department', select: depts, icon: Building2 },
                    { label: '岗位', key: 'position', icon: Briefcase },
                    { label: '职级', key: 'level', select: Object.entries(LEVEL_MAP).map(([k, v]) => ({ v, k })), icon: Award },
                    { label: '薪资级别', key: 'salaryGrade', icon: BadgeDollarSign },
                    { label: '直属主管', key: 'supervisorName', icon: Crown },
                    { label: '入职日期', key: 'hireDate', readonly: true, icon: Clock },
                    { label: '员工状态', key: 'status', select: Object.entries(EMP_STAT_MAP).map(([k, v]) => ({ v: v.label, k })), icon: Star },
                  ].map((f: any) => (
                    <div key={f.key}>
                      <label className="label flex items-center gap-1"><f.icon size={13} className="text-slate-400" /> {f.label}</label>
                      {!edit || f.readonly
                        ? <div className={`input bg-slate-50 ${f.key === 'level' || f.key === 'status' ? 'text-transparent relative' : ''}`}>
                            {f.key === 'level' && <span className="text-slate-700">{LEVEL_MAP[detail[f.key] as keyof typeof LEVEL_MAP]}</span>}
                            {f.key === 'status' && <span className="text-slate-700">{EMP_STAT_MAP[detail[f.key] as keyof typeof EMP_STAT_MAP].label}</span>}
                            {f.key !== 'level' && f.key !== 'status' && <span>{detail[f.key] || '-'}</span>}
                          </div>
                        : f.select
                          ? <select className="select" value={editData[f.key]} onChange={e => setEditData({ ...editData, [f.key]: e.target.value })}>
                              {f.select.map((o: any) => <option key={o.k} value={o.k}>{o.v}</option>)}
                            </select>
                          : <input className="input" value={editData[f.key]} onChange={e => setEditData({ ...editData, [f.key]: e.target.value })} />}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2"><BadgeCheck size={16} /> 系统权限</div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex flex-wrap gap-2">
                    {(detail.permissions || []).length === 0 && <span className="text-xs text-slate-400">暂无分配权限</span>}
                    {(detail.permissions || ['*']).map((p: string, i: number) => (
                      <span key={i} className="chip bg-brand-50 text-brand-700 border border-brand-100">{p}</span>
                    ))}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-2">注：审批通过后系统权限会根据职级自动更新</div>
                </div>
              </div>
              <div>
                <div className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2"><FileUser size={16} /> 历史申请 / 变更记录</div>
                <div className="space-y-2">
                  {history.length === 0 && <div className="py-8 text-center text-slate-400 text-xs rounded-xl bg-slate-50 border border-dashed">暂无申请记录</div>}
                  {history.map((h: any) => (
                    <div key={h.id} className="p-3 rounded-xl bg-white border border-slate-100 hover:border-brand-200 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`chip ${TYPE_MAP[h.type].cls}`}>{TYPE_MAP[h.type].label}</span>
                          <span className={`chip ${STATUS_MAP[h.status].cls}`}>{STATUS_MAP[h.status].label}</span>
                          <span className="text-xs text-slate-500 font-mono">{h.id}</span>
                        </div>
                        <span className="text-[11px] text-slate-400">{formatDate(h.submitTime)}</span>
                      </div>
                      {h.targetDepartment && <div className="mt-1.5 text-xs text-violet-700">→ {h.targetDepartment} · {h.targetPosition}</div>}
                      {h.reason && <div className="mt-1 text-xs text-slate-500">说明：{h.reason}</div>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
