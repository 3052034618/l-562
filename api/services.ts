import { getDb, saveDbToDisk } from './db.js';
import type { AppType, Level } from '../shared/types.js';

export interface CheckItem {
  item: 'performance' | 'training' | 'evaluation' | 'skill_match' | 'headcount';
  label: string;
  passed: boolean;
  detail: string;
}

export async function validateQualification(
  employeeId: string,
  type: AppType,
  opts?: { targetDepartment?: string; targetPosition?: string; forceFail?: string[] }
): Promise<CheckItem[]> {
  const db = await getDb();
  const empRow = db.exec('SELECT * FROM employees WHERE id = ?', [employeeId])[0];
  if (!empRow) throw new Error('员工不存在');
  const emp = rowToObj(empRow.columns, empRow.values[0]) as any;

  const forceFail = opts?.forceFail || [];
  const checks: CheckItem[] = [];

  const sg: string = emp.salaryGrade || 'P1';
  const level: string = emp.level || 'staff';
  const dept: string = emp.department || '';

  const perfPass = !forceFail.includes('performance') && _perfPass(level, sg, emp.id);
  checks.push({
    item: 'performance',
    label: '绩效达标',
    passed: perfPass,
    detail: perfPass
      ? `近3个月绩效评级均为B及以上（${sg}职级基准），符合要求`
      : '近3个月存在绩效低于B的记录，需提升绩效后再次申请',
  });

  const trainPass = !forceFail.includes('training') && _trainPass(level, sg, dept);
  checks.push({
    item: 'training',
    label: '培训完成',
    passed: trainPass,
    detail: trainPass
      ? '已完成所有必修培训课程（入职培训 + 岗位进阶）'
      : _trainDetail(level, sg, dept),
  });

  const evalPass = !forceFail.includes('evaluation') && _evalPass(dept, level);
  checks.push({
    item: 'evaluation',
    label: '主管评价',
    passed: evalPass,
    detail: evalPass
      ? `主管评价：工作态度端正，协作良好，推荐${type === 'regular' ? '转正' : '调岗'}`
      : '主管评价中存在待改进项，请与主管沟通后再次申请',
  });

  const skillScore = _skillScore(sg, level);
  const skillPass = !forceFail.includes('skill_match') && skillScore >= 80;
  checks.push({
    item: 'skill_match',
    label: '技能匹配度',
    passed: skillPass,
    detail: `核心技能匹配度${skillScore}%，${skillPass ? '符合岗位要求（≥80%）' : '低于岗位要求（≥80%），建议补充相关认证或培训'}`,
  });

  let hcDetail = '';
  let hcPass = true;
  if (type === 'transfer' && opts?.targetDepartment) {
    hcPass = !forceFail.includes('headcount') && _headcountPass(dept, opts.targetDepartment);
    const tgtDept = opts.targetDepartment;
    hcDetail = hcPass
      ? `${tgtDept}${opts.targetPosition ? '（' + opts.targetPosition + '）' : ''}编制充足，有空缺名额`
      : `${tgtDept}${opts.targetPosition ? '（' + opts.targetPosition + '）' : ''}当前编制已满，需等待空缺后再申请`;
  } else {
    hcPass = !forceFail.includes('headcount') && true;
    hcDetail = hcPass
      ? `${dept}编制充足，符合转正条件`
      : `${dept}当前冻结编制，转正暂缓`;
  }
  checks.push({
    item: 'headcount',
    label: '部门编制',
    passed: hcPass,
    detail: hcDetail,
  });

  return checks;
}

function _perfPass(level: string, sg: string, empId: string): boolean {
  if (level === 'director' || level === 'manager' || level === 'supervisor') return true;
  if (sg === 'P1') return true;
  if (empId === 'E003') return false;
  return true;
}

function _trainPass(level: string, sg: string, dept: string): boolean {
  if (level === 'director' || level === 'manager') return true;
  if (level === 'supervisor') return true;
  if (sg === 'P1') return false;
  if (sg === 'P2' && dept !== '技术部') return false;
  return true;
}

function _trainDetail(level: string, sg: string, dept: string): string {
  if (sg === 'P1') return '尚缺少2门必修课程（合规101、岗位进阶），请完成后再次申请';
  if (sg === 'P2') return `尚缺少${dept}定制化进阶课程，建议完成后再次申请`;
  return '培训记录不完整，请与HR确认后再次申请';
}

function _evalPass(dept: string, level: string): boolean {
  return true;
}

function _skillScore(sg: string, level: string): number {
  const map: Record<string, number> = {
    P1: 72,
    P2: 85,
    P3: 91,
    P4: 94,
    M1: 88,
    M2: 93,
    M3: 96,
  };
  return map[sg] || (level === 'director' ? 95 : 82);
}

function _headcountPass(fromDept: string, toDept: string): boolean {
  if (fromDept === toDept) return true;
  if (toDept === '财务部') return false;
  if (toDept === '市场部' && fromDept === '技术部') return false;
  return true;
}

export interface ApprovalStep {
  approverId: string;
  approverName: string;
  approverRole: string;
  step: number;
  total: number;
}

export async function decideApprovalFlow(
  employeeId: string,
  type: AppType,
  targetDepartment?: string
): Promise<ApprovalStep[]> {
  const db = await getDb();
  const empRow = db.exec('SELECT * FROM employees WHERE id = ?', [employeeId])[0];
  if (!empRow) throw new Error('员工不存在');
  const emp = rowToObj(empRow.columns, empRow.values[0]) as any;
  const level: Level = emp.level;

  const steps: ApprovalStep[] = [];

  const isManagerAndAbove = level === 'manager' || level === 'director';
  const isTransfer = type === 'transfer';

  function findValidApprover(candidate: any, excludeId: string): any {
    if (!candidate) return null;
    if (candidate.id !== excludeId) return candidate;
    if (!candidate.supervisorId) return null;
    const supRows = db.exec('SELECT * FROM employees WHERE id = ?', [candidate.supervisorId])[0];
    if (!supRows || !supRows.values.length) return null;
    return rowToObj(supRows.columns, supRows.values[0]);
  }

  if (!isManagerAndAbove) {
    const supRows = emp.supervisorId
      ? db.exec('SELECT * FROM employees WHERE id = ?', [emp.supervisorId])[0]
      : null;
    let approver = supRows && supRows.values.length ? rowToObj(supRows.columns, supRows.values[0]) : null;
    approver = findValidApprover(approver, emp.id);
    if (approver) {
      steps.push({
        approverId: approver.id,
        approverName: approver.name,
        approverRole: '直属主管审批',
        step: 1,
        total: 1,
      });
    }
  } else {
    let hrMgr = findOneByLevel(db, 'manager', '人力资源部');
    hrMgr = findValidApprover(hrMgr, emp.id);
    if (hrMgr) {
      steps.push({
        approverId: hrMgr.id,
        approverName: hrMgr.name,
        approverRole: 'HR审批（合规/编制）',
        step: 1,
        total: 2,
      });
    }

    const finalDept = isTransfer && targetDepartment ? targetDepartment : emp.department;
    let director = findOneByLevel(db, 'director', finalDept)
      || findOneByLevel(db, 'manager', finalDept)
      || findOneByLevel(db, 'director');
    director = findValidApprover(director, emp.id);
    if (!director) {
      director = findOneByLevelExcluding(db, ['director', 'manager'], emp.id);
    }
    if (!director && emp.supervisorId) {
      const supRows = db.exec('SELECT * FROM employees WHERE id = ?', [emp.supervisorId])[0];
      if (supRows && supRows.values.length) {
        director = findValidApprover(rowToObj(supRows.columns, supRows.values[0]), emp.id);
      }
    }
    if (director) {
      steps.push({
        approverId: director.id,
        approverName: director.name,
        approverRole: isTransfer ? '目标部门总监审批' : '部门总监审批',
        step: steps.length + 1,
        total: 2,
      });
    }

    const total = steps.length;
    steps.forEach(s => (s.total = total));
    steps.forEach((s, i) => (s.step = i + 1));
  }

  return steps;
}

function findOneByLevel(db: any, level: string, department?: string) {
  const rows = department
    ? db.exec('SELECT * FROM employees WHERE level = ? AND department = ? LIMIT 1', [level, department])[0]
    : db.exec('SELECT * FROM employees WHERE level = ? LIMIT 1', [level])[0];
  if (!rows || !rows.values.length) return null;
  return rowToObj(rows.columns, rows.values[0]);
}

function findOneByLevelExcluding(db: any, levels: string[], excludeId: string) {
  const ph = levels.map(() => '?').join(',');
  const rows = db.exec(`SELECT * FROM employees WHERE level IN (${ph}) AND id != ? LIMIT 1`, [...levels, excludeId])[0];
  if (!rows || !rows.values.length) return null;
  return rowToObj(rows.columns, rows.values[0]);
}

export function rowToObj(columns: string[], values: any[]): any {
  const obj: any = {};
  columns.forEach((c, i) => {
    const key = c.replace(/_([a-z])/g, (_, g) => g.toUpperCase());
    obj[key] = values[i];
  });
  return obj;
}

export function calcWaitHours(createdAt: string): number {
  const then = new Date(createdAt.replace(' ', 'T')).getTime();
  const now = Date.now();
  return Math.max(0, (now - then) / 3600000);
}

export function isWaitOver48h(createdAt: string): boolean {
  const then = new Date(createdAt.replace(' ', 'T')).getTime();
  return (Date.now() - then) >= 48 * 3600000;
}

export async function logOperation(
  operatorId: string | null,
  operatorName: string | null,
  action: string,
  target: string | null,
  detail: string | null,
  type: 'operation' | 'exception' = 'operation'
) {
  const db = await getDb();
  db.run(
    'INSERT INTO operation_logs (id, operator_id, operator_name, action, target, detail, timestamp, type) VALUES (?, ?, ?, ?, ?, ?, datetime(\'now\'), ?)',
    [crypto.randomUUID(), operatorId, operatorName, action, target, detail, type]
  );
  await saveDbToDisk();
}

export async function pushNotification(
  userId: string,
  title: string,
  content: string,
  type: 'approval' | 'escalation' | 'system' | 'exception' | 'info' = 'system'
) {
  const db = await getDb();
  db.run(
    'INSERT INTO notifications (id, user_id, title, content, type, created_at) VALUES (?, ?, ?, ?, ?, datetime(\'now\'))',
    [crypto.randomUUID(), userId, title, content, type]
  );
  await saveDbToDisk();
}

export async function fixApprovalFlowForPendingApplications(): Promise<number> {
  const db = await getDb();
  const rows = db.exec(`SELECT * FROM applications WHERE status IN ('pending_approval', 'escalated')`)[0];
  if (!rows || !rows.values.length) return 0;

  let fixed = 0;
  for (const v of rows.values) {
    const app = rowToObj(rows.columns, v);
    const processedRows = db.exec(`SELECT COUNT(*) FROM approval_records WHERE application_id = ? AND status NOT IN ('pending')`, [app.id])[0];
    const hasProcessed = processedRows && processedRows.values[0][0] as number > 0;
    if (hasProcessed) continue;

    const newSteps = await decideApprovalFlow(app.employeeId, app.type as AppType, app.targetDepartment);
    if (!newSteps.length) continue;

    db.run(`DELETE FROM approval_records WHERE application_id = ?`, [app.id]);
    for (const s of newSteps) {
      db.run(
        `INSERT INTO approval_records (id, application_id, approver_id, approver_name, approver_role, step, total_steps, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'))`,
        [crypto.randomUUID(), app.id, s.approverId, s.approverName, s.approverRole, s.step, s.total]
      );
    }

    db.run(`UPDATE applications SET status = 'pending_approval', updated_at = datetime('now') WHERE id = ?`, [app.id]);
    await logOperation(null, 'system', '审批流程修复（新规则）', app.id, `按新规则重建审批流程：${newSteps.length}步，首审：${newSteps[0].approverName}`, 'system');
    fixed++;
  }
  if (fixed > 0) await saveDbToDisk();
  return fixed;
}
