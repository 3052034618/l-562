import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore, CURRENT_USER_ID } from '@/store/app';
import { UserCheck, CheckCircle2, XCircle, AlertTriangle, RotateCcw, BadgeCheck, Send } from 'lucide-react';
import { STATUS_MAP, TYPE_MAP, LEVEL_MAP, formatDate } from '@/lib/api';

export default function ApplyRegular() {
  const nav = useNavigate();
  const { employees, createApplication, applications, resubmit } = useAppStore();
  const [employeeId, setEmployeeId] = useState(CURRENT_USER_ID);
  const [employeeName, setEmployeeName] = useState(employees.find(e => e.id === CURRENT_USER_ID)?.name || '');
  const [reason, setReason] = useState('');
  const [forceFail, setForceFail] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);

  const emp = employees.find(e => e.id === employeeId);
  const previous = applications.find(a => a.type === 'regular' && a.employeeId === employeeId && a.status === 'check_failed');

  const CHECK_ITEMS: { key: string; label: string }[] = [
    { key: 'performance', label: '绩效达标（近3月≥B）' },
    { key: 'training', label: '培训完成（全部必修课程）' },
    { key: 'evaluation', label: '主管评价（推荐转正）' },
    { key: 'skill_match', label: '技能匹配度（≥80%）' },
    { key: 'headcount', label: '部门编制（有空缺）' },
  ];

  const toggleFail = (k: string) => {
    setForceFail(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k]);
  };

  const onSubmit = async () => {
    if (!employeeId || !employeeName) return;
    setSubmitting(true);
    const app = await createApplication({ employeeId, type: 'regular', reason, forceFail });
    if (app) setResult(app);
    setSubmitting(false);
  };

  const onResubmit = async (id: string) => {
    setSubmitting(true);
    const app = await resubmit(id, forceFail);
    if (app) setResult(app);
    setSubmitting(false);
  };

  const currentEmp = emp ? {
    id: emp.id,
    name: emp.name,
    department: emp.department,
    position: emp.position,
    level: emp.level,
    salaryGrade: emp.salaryGrade,
    supervisor: emp.supervisorName,
    hireDate: emp.hireDate,
    status: emp.status,
  } : null;

  const display = result || previous;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center">
              <BadgeCheck size={22} />
            </div>
            转正申请
          </div>
          <div className="text-sm text-slate-500 mt-1">试用期员工提交转正审批，系统将自动校验5项资格条件
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="label">选择员工 <span className="text-red-500">*</span></label>
            <select className="select" value={employeeId} onChange={e => {
              setEmployeeId(e.target.value);
              const e2 = employees.find(x => x.id === e.target.value);
              setEmployeeName(e2?.name || '');
              setResult(null);
            }}>
              <option value="">请选择员工</option>
              {employees.filter(e => e.status === 'probation' || e.level === 'staff').map(e => (
                <option key={e.id} value={e.id}>{e.id} · {e.name} · {e.department}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">员工姓名</label>
            <input className="input" value={employeeName} readOnly placeholder="自动填充" />
          </div>
          {currentEmp && (
            <>
              <div>
                <label className="label">所属部门</label>
                <input className="input bg-slate-50" value={currentEmp.department} readOnly />
              </div>
              <div>
                <label className="label">当前岗位</label>
                <input className="input bg-slate-50" value={`${currentEmp.position}`} readOnly />
              </div>
              <div>
                <label className="label">职级 / 薪资级别</label>
                <input className="input bg-slate-50" value={`${LEVEL_MAP[currentEmp.level as keyof typeof LEVEL_MAP]} / ${currentEmp.salaryGrade}`} readOnly />
              </div>
              <div>
                <label className="label">直属主管</label>
                <input className="input bg-slate-50" value={currentEmp.supervisor || '-'} readOnly />
              </div>
              <div>
                <label className="label">入职日期 / 当前状态</label>
                <input className="input bg-slate-50" value={`${currentEmp.hireDate} / ${currentEmp.status === 'probation' ? '试用期' : currentEmp.status === 'regular' ? '正式' : '已调岗'}`} readOnly />
              </div>
              <div>
                <label className="label">自我评价 / 申请理由</label>
                <textarea className="input min-h-[88px]" value={reason} onChange={e => setReason(e.target.value)} placeholder="请描述试用期工作成果或补充说明..." />
              </div>
            </>
          )}
        </div>

        <div className="rounded-xl bg-amber-50 border border-amber-100 p-4 mb-6">
          <div className="text-xs font-semibold text-amber-800 mb-2 flex items-center gap-1.5">
            <AlertTriangle size={14} /> 模拟测试：以下选项用于模拟校验失败场景（可勾选模拟缺失项）
          </div>
          <div className="flex flex-wrap gap-2">
            {CHECK_ITEMS.map(c => (
              <label key={c.key} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer select-none transition-all ${forceFail.includes(c.key) ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'}`}>
                <input type="checkbox" className="accent-red-500" checked={forceFail.includes(c.key)} onChange={() => toggleFail(c.key)} />
                模拟「{c.label}」缺失
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={onSubmit} disabled={submitting || !employeeId} className="btn-primary">
            <Send size={16} /> {submitting ? '提交中...' : previous ? '重新提交申请' : '提交转正申请'}
          </button>
          {previous && !result && (
            <button onClick={() => onResubmit(previous.id)} disabled={submitting} className="btn-secondary">
              <RotateCcw size={16} /> 重新校验上一条记录
            </button>
          )}
        </div>
        </div>
      </div>

      {display && (
        <div className="card animate-fade-in">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-lg font-bold text-slate-800 flex items-center gap-2">
              {display.status === 'approved' || display.status === 'pending_approval' ? <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center"><CheckCircle2 size={18} /></div> : <div className="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center"><XCircle size={18} /></div>}
              资格校验结果
            </div>
            <div className="flex items-center gap-2">
              <span className="chip bg-slate-100 text-slate-600">{display.id}</span>
              <span className={`chip ${STATUS_MAP[display.status].cls}`}>{STATUS_MAP[display.status].label}</span>
              <span className={`chip ${TYPE_MAP.regular.cls}`}>{TYPE_MAP.regular.label}</span>
            </div>
          </div>

          {display.status === 'check_failed' && (
            <div className="mb-5 p-4 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">
              ⚠️ 校验未通过，请补充以下缺失项后重新提交：
              <div className="mt-2 flex flex-wrap gap-2">
                {display.missingItems.map((m: string) => <span key={m} className="chip bg-white text-red-700">{m}</span>)}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
            {display.checkResults.map((c: any) => (
              <div key={c.item} className={`p-4 rounded-xl border ${c.passed ? 'bg-emerald-50/50 border-emerald-100' : 'bg-red-50/60 border-red-100'}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${c.passed ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                      {c.passed ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-800">{c.label}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{c.passed ? '已通过' : '不通过/缺失'}</div>
                    </div>
                  </div>
                  <span className={`chip ${c.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{c.passed ? '✓' : '✗'}</span>
                </div>
                <div className="mt-3 text-xs text-slate-600 pl-11">{c.detail}</div>
              </div>
            ))}
          </div>

          {display.approvalRecords.length > 0 && (
            <>
              <div className="mb-3 text-sm font-semibold text-slate-800">审批流程分配（按职级规则）</div>
              <div className="mb-6 rounded-xl border border-slate-100 overflow-hidden">
                {display.approvalRecords.map((a: any, idx: number) => (
                  <div key={a.id} className={`flex items-center gap-4 p-4 border-b last:border-0 ${idx === display.approvalRecords.findIndex((x: any) => x.status === 'pending') ? 'bg-amber-50/40' : ''}`}>
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center ${a.status === 'approved' ? 'bg-emerald-100 text-emerald-600' : a.status === 'rejected' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600 animate-pulse-soft'}`}>
                      {a.status === 'approved' ? <CheckCircle2 size={18} /> : a.status === 'rejected' ? <XCircle size={18} /> : <UserCheck size={18} />}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                        第{a.step}/{a.totalSteps}步 · {a.approverRole}
                        {a.escalated && <span className="chip bg-fuchsia-100 text-fuchsia-700">已升级</span>}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        审批人：{a.approverName}
                        {a.processedAt && <> · 处理时间：{formatDate(a.processedAt)}</>}
                      </div>
                      {a.comment && <div className="text-xs text-slate-600 mt-2 pl-3 py-2 bg-slate-50 rounded-lg px-3 border-l-2 border-slate-200">💬 {a.comment}</div>}
                    </div>
                    <span className={`chip ${a.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : a.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                      {a.status === 'approved' ? '已通过' : a.status === 'rejected' ? '已退回' : '待处理'}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="flex items-center gap-3">
            <button onClick={() => nav('/')} className="btn-secondary">返回工作台</button>
            {display.status === 'pending_approval' && <button onClick={() => nav('/approval')} className="btn-primary">前往审批中心</button>}
          </div>
        </div>
      )}
    </div>
  );
}
