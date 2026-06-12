import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/app';
import { CheckCircle2, XCircle, AlertTriangle, RotateCcw, UserMinus, Send } from 'lucide-react';
import { STATUS_MAP, TYPE_MAP, LEVEL_MAP, formatDate } from '@/lib/api';

export default function ApplyTransfer() {
  const nav = useNavigate();
  const { employees, departments, createApplication, applications, resubmit } = useAppStore();
  const [employeeId, setEmployeeId] = useState(employees[0]?.id || '');
  const [targetDepartment, setTargetDepartment] = useState(departments[1] || '');
  const [targetPosition, setTargetPosition] = useState('');
  const [reason, setReason] = useState('');
  const [forceFail, setForceFail] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);

  const emp = employees.find(e => e.id === employeeId);
  const previous = applications.find(a => a.type === 'transfer' && a.employeeId === employeeId && a.status === 'check_failed');

  const CHECK_ITEMS: { key: string; label: string }[] = [
    { key: 'performance', label: '绩效达标' },
    { key: 'training', label: '培训完成（目标岗位要求）' },
    { key: 'evaluation', label: '主管评价（推荐调岗）' },
    { key: 'skill_match', label: '技能匹配度（≥80%）' },
    { key: 'headcount', label: '目标部门编制' },
  ];

  const toggleFail = (k: string) => {
    setForceFail(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k]);
  };

  const onSubmit = async () => {
    if (!employeeId || !targetDepartment || !targetPosition) return;
    setSubmitting(true);
    const app = await createApplication({ employeeId, type: 'transfer', targetDepartment, targetPosition, reason, forceFail });
    if (app) setResult(app);
    setSubmitting(false);
  };

  const onResubmit = async (id: string) => {
    setSubmitting(true);
    const app = await resubmit(id, forceFail);
    if (app) setResult(app);
    setSubmitting(false);
  };

  const display = result || previous;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="card">
        <div className="mb-6">
          <div className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 text-white flex items-center justify-center">
              <UserMinus size={22} />
            </div>
            调岗申请
          </div>
          <div className="text-sm text-slate-500 mt-1">跨部门或内部岗位调动，系统将根据职级和跨部门与否自动分配审批流程
          </div>
        </div>

        <div className="rounded-xl bg-gradient-to-r from-slate-50 to-violet-50/50 p-4 mb-5 border border-slate-100">
          <div className="text-xs font-semibold text-slate-700 mb-3">审批流程规则提示</div>
          <ul className="text-xs text-slate-500 space-y-1.5">
            <li className="flex items-start gap-2"><CheckCircle2 size={14} className="text-violet-600 shrink-0 mt-0.5" /> <b>员工/主管级（非跨部门）</b>：单级审批（直属主管）</li>
            <li className="flex items-start gap-2"><CheckCircle2 size={14} className="text-violet-600 shrink-0 mt-0.5" /> <b>经理级/总监级 或 跨部门</b>：多级审批（原部门 → HR → 目标部门总监）</li>
            <li className="flex items-start gap-2"><AlertTriangle size={14} className="text-orange-500 shrink-0 mt-0.5" /> <b>超48小时未处理自动升级至上级主管，异常列表可见</b></li>
          </ul>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="label">选择员工 <span className="text-red-500">*</span></label>
            <select className="select" value={employeeId} onChange={e => { setEmployeeId(e.target.value); setResult(null); }}>
              <option value="">请选择员工</option>
              {employees.map(e => (
                <option key={e.id} value={e.id}>{e.id} · {e.name} · {e.department}/{e.position}</option>
              ))}
            </select>
          </div>
          {emp && (
            <>
              <div>
                <label className="label">原部门 / 岗位</label>
                <input className="input bg-slate-50" value={`${emp.department} · ${emp.position}`} readOnly />
              </div>
              <div>
                <label className="label">职级 / 薪资级别</label>
                <input className="input bg-slate-50" value={`${LEVEL_MAP[emp.level as keyof typeof LEVEL_MAP]} / ${emp.salaryGrade}`} readOnly />
              </div>
              <div>
                <label className="label">直属主管</label>
                <input className="input bg-slate-50" value={emp.supervisorName || '-'} readOnly />
              </div>
            </>
          )}
          <div>
            <label className="label">目标部门 <span className="text-red-500">*</span></label>
            <select className="select" value={targetDepartment} onChange={e => setTargetDepartment(e.target.value)}>
              {departments.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="label">目标岗位 <span className="text-red-500">*</span></label>
            <input className="input" value={targetPosition} onChange={e => setTargetPosition(e.target.value)} placeholder="如：高级市场经理" />
          </div>
          <div className="md:col-span-2">
            <label className="label">调岗原因 / 说明</label>
            <textarea className="input min-h-[88px]" value={reason} onChange={e => setReason(e.target.value)} placeholder="请说明调岗原因、个人职业发展方向..." />
          </div>
        </div>

        <div className="rounded-xl bg-amber-50 border border-amber-100 p-4 mb-6">
          <div className="text-xs font-semibold text-amber-800 mb-2 flex items-center gap-1.5">
            <AlertTriangle size={14} /> 模拟校验失败场景（勾选模拟对应缺失项）
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
          <button onClick={onSubmit} disabled={submitting || !employeeId || !targetPosition} className="btn-primary">
            <Send size={16} /> {submitting ? '提交中...' : previous ? '重新提交' : '提交调岗申请'}
          </button>
          {previous && !result && (
            <button onClick={() => onResubmit(previous.id)} disabled={submitting} className="btn-secondary">
              <RotateCcw size={16} /> 重新校验上一条记录
            </button>
          )}
        </div>
      </div>

      {display && (
        <div className="card animate-fade-in">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-lg font-bold text-slate-800 flex items-center gap-2">
              {display.status !== 'check_failed'
                ? <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center"><CheckCircle2 size={18} /></div>
                : <div className="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center"><XCircle size={18} /></div>}
              资格校验结果
            </div>
            <div className="flex items-center gap-2">
              <span className="chip bg-slate-100 text-slate-600">{display.id}</span>
              <span className={`chip ${STATUS_MAP[display.status].cls}`}>{STATUS_MAP[display.status].label}</span>
              <span className={`chip ${TYPE_MAP.transfer.cls}`}>{TYPE_MAP.transfer.label}</span>
            </div>
          </div>

          {display.status === 'check_failed' && (
            <div className="mb-5 p-4 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">
              ⚠️ 校验未通过，请补充：
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
              <div className="mb-3 text-sm font-semibold text-slate-800">审批流程</div>
              <div className="mb-6 rounded-xl border border-slate-100 overflow-hidden">
                {display.approvalRecords.map((a: any) => (
                  <div key={a.id} className={`flex items-center gap-4 p-4 border-b last:border-0 ${a.status === 'pending' ? 'bg-amber-50/40' : ''}`}>
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center ${a.status === 'approved' ? 'bg-emerald-100 text-emerald-600' : a.status === 'rejected' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600 animate-pulse-soft'}`}>
                      {a.status === 'approved' ? <CheckCircle2 size={18} /> : a.status === 'rejected' ? <XCircle size={18} /> : <span className="font-bold">{a.step}</span>}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                        第{a.step}/{a.totalSteps}步 · {a.approverRole}
                        {a.escalated && <span className="chip bg-fuchsia-100 text-fuchsia-700">已升级</span>}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {a.approverName}
                        {a.processedAt && <> · {formatDate(a.processedAt)}</>}
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
