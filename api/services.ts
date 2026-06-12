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
  const emp = rowToObj(empRow.columns, empRow.values[0]);

  const forceFail = opts?.forceFail || [];

  const checks: CheckItem[] = [];

  const perfPass = !forceFail.includes('performance') && Math.random() > 0.15;
  checks.push({
    item: 'performance',
    label: '绩效达标',
    passed: perfPass,
    detail: perfPass
      ? '近3个月绩效评级均为B及以上，符合要求'
      : '近3个月存在绩效低于B的记录，请提升后再次申请',
  });

  const trainPass = !forceFail.includes('training') && Math.random() > 0.2;
  checks.push({
    item: 'training',
    label: '培训完成',
    passed: trainPass,
    detail: trainPass
      ? '已完成所有必修培训课程'
      : '尚缺少2门必修课程（合规101、岗位进阶），请完成后再次申请',
  });

  const evalPass = !forceFail.includes('evaluation') && Math.random() > 0.1;
  checks.push({
    item: 'evaluation',
    label: '主管评价',
    passed: evalPass,
    detail: evalPass
      ? `主管评价：工作态度端正，协作良好，推荐${type === 'regular' ? '转正' : '调岗'}`
      : '主管评价中存在待改进项，请与主管沟通后再次申请',
  });

  const skillScore = forceFail.includes('skill_match') ? 50 + Math.floor(Math.random() * 20) : 80 + Math.floor(Math.random() * 20);
  const skillPass = skillScore >= 80;
  checks.push({
    item: 'skill_match',
    label: '技能匹配度',
    passed: skillPass,
    detail: `核心技能匹配度${skillScore}%，${skillPass ? '符合岗位要求（≥80%）' : '低于岗位要求（≥80%），建议补充相关认证或培训'}`,
  });

  let hcDetail = '';
  let hcPass = true;
  if (type === 'transfer' && opts?.targetDepartment) {
    hcPass = !forceFail.includes('headcount') && Math.random() > 0.2;
    const dept = opts.targetDepartment;
    hcDetail = hcPass
      ? `${dept}${opts.targetPosition ? '（' + opts.targetPosition + '）' : ''}编制充足，有空缺名额`
      : `${dept}${opts.targetPosition ? '（' + opts.targetPosition + '）' : ''}当前编制已满，需等待空缺后再申请`;
  } else {
    hcPass = !forceFail.includes('headcount') && Math.random() > 0.05;
    hcDetail = hcPass
      ? `${emp.department}编制充足，符合转正条件`
      : `${emp.department}当前冻结编制，转正暂缓`;
  }
  checks.push({
    item: 'headcount',
    label: '部门编制',
    passed: hcPass,
    detail: hcDetail,
  });

  return checks;
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
  const emp = rowToObj(empRow.columns, empRow.values[0]);
  const level: Level = emp.level;

  const steps: ApprovalStep[] = [];

  const isTransfer = type === 'transfer';
  const isCrossDept = isTransfer && targetDepartment && targetDepartment !== emp.department;
  const needMultiLevel = level === 'manager' || level === 'director' || isCrossDept;

  if (!needMultiLevel) {
    steps.push({
      approverId: emp.supervisorId,
      approverName: emp.supervisorName,
      approverRole: '直属主管审批',
      step: 1,
      total: 1,
    });
  } else {
    let stepNo = 1;
    steps.push({
      approverId: emp.supervisorId,
      approverName: emp.supervisorName,
      approverRole: '直属主管/原部门审批',
      step: stepNo++,
      total: 3,
    });
    const hrMgr = findOneByLevel(db, 'manager', '人力资源部');
    if (hrMgr) {
      steps.push({
        approverId: hrMgr.id,
        approverName: hrMgr.name,
        approverRole: 'HR审批（合规/编制）',
        step: stepNo++,
        total: 3,
      });
    }
    const directorDept = isTransfer ? targetDepartment! : emp.department;
    const director = findOneByLevel(db, 'manager', directorDept) || findOneByLevel(db, 'director');
    if (director) {
      steps[steps.length - 1].total = stepNo + 0;
      steps.push({
        approverId: director.id,
        approverName: director.name,
        approverRole: '总监审批',
        step: stepNo,
        total: stepNo,
      });
    }
    const total = steps.length;
    steps.forEach(s => (s.total = total));
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
  return Math.max(0, Math.round((now - then) / 3600000));
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
