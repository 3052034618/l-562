import { Router, type Request, type Response } from 'express';
import { getDb, saveDbToDisk } from '../db.js';
import { rowToObj, logOperation, pushNotification, calcWaitHours } from '../services.js';

const router = Router();

function toApplicationLite(app: any, checks: any[], approvals: any[]) {
  const missing = checks.filter(c => !c.passed).map(c => c.label);
  const escalated = approvals.some(a => a.escalated);
  const currentPending = approvals.find(a => a.status === 'pending');
  return {
    ...app,
    checkResults: checks,
    approvalRecords: approvals,
    missingItems: missing,
    escalated,
    currentApprover: currentPending ? {
      id: currentPending.approverId,
      name: currentPending.approverName,
      role: currentPending.approverRole,
      waitHours: calcWaitHours(currentPending.createdAt),
    } : undefined,
  };
}

router.get('/pending', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const { approverId } = req.query;
    let rows;
    const params: any[] = [];
    let where = 'WHERE ar.status = \'pending\'';
    if (approverId) {
      where += ' AND ar.approver_id = ?';
      params.push(approverId);
    }
    rows = db.exec(`SELECT DISTINCT a.*, ar.step as current_step FROM applications a JOIN approval_records ar ON a.id = ar.application_id ${where} AND (SELECT MIN(step) FROM approval_records WHERE application_id = a.id AND status = 'pending') = ar.step ORDER BY a.submit_time DESC`, params)[0];
    const apps = rows ? rows.values.map(v => rowToObj(rows.columns, v)) : [];

    const ids = apps.map(a => a.id);
    const cMap: Record<string, any[]> = {};
    const aMap: Record<string, any[]> = {};
    if (ids.length) {
      const q = ids.map(() => '?').join(',');
      const cr = db.exec(`SELECT * FROM check_results WHERE application_id IN (${q})`, ids)[0];
      if (cr) cr.values.forEach(v => { const o = rowToObj(cr.columns, v); (cMap[o.applicationId] ||= []).push(o); });
      const ar = db.exec(`SELECT * FROM approval_records WHERE application_id IN (${q}) ORDER BY step`, ids)[0];
      if (ar) ar.values.forEach(v => { const o = rowToObj(ar.columns, v); (aMap[o.applicationId] ||= []).push(o); });
    }
    const list = apps.map(a => toApplicationLite(a, cMap[a.id] || [], aMap[a.id] || []));
    res.json({ success: true, data: list });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/history', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const rows = db.exec(`SELECT a.*, (SELECT MAX(processed_at) FROM approval_records WHERE application_id = a.id) as last_processed FROM applications a WHERE a.status IN ('approved', 'rejected') ORDER BY COALESCE(last_processed, submit_time) DESC LIMIT 50`)[0];
    const apps = rows ? rows.values.map(v => rowToObj(rows.columns, v)) : [];
    res.json({ success: true, data: apps });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/:id/approve', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const { id } = req.params;
    const { approverId, comment } = req.body;
    if (!approverId) return res.status(400).json({ success: false, error: '缺少审批人' });

    const aRows = db.exec('SELECT * FROM applications WHERE id = ?', [id])[0];
    if (!aRows) return res.status(404).json({ success: false, error: '申请不存在' });
    const app = rowToObj(aRows.columns, aRows.values[0]);

    const stepRows = db.exec(`SELECT * FROM approval_records WHERE application_id = ? AND status = 'pending' ORDER BY step LIMIT 1`, [id])[0];
    if (!stepRows) return res.status(400).json({ success: false, error: '当前无待审批步骤' });
    const step = rowToObj(stepRows.columns, stepRows.values[0]);
    if (step.approverId !== approverId) {
      return res.status(403).json({ success: false, error: '非当前审批人，无权操作' });
    }

    db.run(`UPDATE approval_records SET status = 'approved', comment = ?, processed_at = datetime('now') WHERE id = ?`, [comment || null, step.id]);

    const nextStepRows = db.exec(`SELECT * FROM approval_records WHERE application_id = ? AND status = 'pending' ORDER BY step LIMIT 1`, [id])[0];

    if (!nextStepRows) {
      db.run(`UPDATE applications SET status = 'approved', updated_at = datetime('now') WHERE id = ?`, [id]);
      await updateEmployeeAfterApproval(app);
      await logOperation(approverId, step.approverName, '审批通过（完成）', id, comment || '通过审批', 'operation');
      await pushNotification(app.employeeId, `${app.type === 'regular' ? '转正' : '调岗'}审批通过`, `您的申请已审批通过，档案已同步更新`, 'info');
      const empRows = db.exec('SELECT * FROM employees WHERE id = ?', [app.employeeId])[0];
      if (empRows) {
        const emp = rowToObj(empRows.columns, empRows.values[0]);
        if (emp.supervisorId) await pushNotification(emp.supervisorId, `下属${app.type === 'regular' ? '转正' : '调岗'}完成`, `${emp.name}的${app.type === 'regular' ? '转正' : '调岗'}已审批完成`, 'info');
      }
    } else {
      const nextStep = rowToObj(nextStepRows.columns, nextStepRows.values[0]);
      await logOperation(approverId, step.approverName, '审批通过', id, `第${step.step}/${step.totalSteps}步通过，等待下一级：${nextStep.approverName}`, 'operation');
      await pushNotification(nextStep.approverId, `新的${app.type === 'regular' ? '转正' : '调岗'}申请待审批`, `${app.employeeName}的申请已通过上一级审批，请您审批`, 'approval');
      await pushNotification(app.employeeId, '审批进度更新', `您的申请已通过${step.approverName}审批，等待${nextStep.approverName}审批`, 'info');
    }
    await saveDbToDisk();

    const finalApp = rowToObj(db.exec('SELECT * FROM applications WHERE id = ?', [id])[0].columns, db.exec('SELECT * FROM applications WHERE id = ?', [id])[0].values[0]);
    const fc = db.exec('SELECT * FROM check_results WHERE application_id = ?', [id])[0];
    const fa = db.exec('SELECT * FROM approval_records WHERE application_id = ? ORDER BY step', [id])[0];
    res.json({ success: true, data: toApplicationLite(finalApp, fc ? fc.values.map(v => rowToObj(fc.columns, v)) : [], fa ? fa.values.map(v => rowToObj(fa.columns, v)) : []) });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/:id/reject', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const { id } = req.params;
    const { approverId, comment } = req.body;
    if (!approverId) return res.status(400).json({ success: false, error: '缺少审批人' });

    const aRows = db.exec('SELECT * FROM applications WHERE id = ?', [id])[0];
    if (!aRows) return res.status(404).json({ success: false, error: '申请不存在' });
    const app = rowToObj(aRows.columns, aRows.values[0]);

    const stepRows = db.exec(`SELECT * FROM approval_records WHERE application_id = ? AND status = 'pending' ORDER BY step LIMIT 1`, [id])[0];
    if (!stepRows) return res.status(400).json({ success: false, error: '当前无待审批步骤' });
    const step = rowToObj(stepRows.columns, stepRows.values[0]);
    if (step.approverId !== approverId) return res.status(403).json({ success: false, error: '非当前审批人，无权操作' });

    db.run(`UPDATE approval_records SET status = 'rejected', comment = ?, processed_at = datetime('now') WHERE id = ?`, [comment || null, step.id]);
    db.run(`UPDATE approval_records SET status = 'rejected' WHERE application_id = ? AND status = 'pending'`, [id]);
    db.run(`UPDATE applications SET status = 'rejected', updated_at = datetime('now') WHERE id = ?`, [id]);

    await logOperation(approverId, step.approverName, '审批退回', id, comment || '退回申请', 'exception');
    await pushNotification(app.employeeId, `${app.type === 'regular' ? '转正' : '调岗'}申请被退回`, `${step.approverName}退回了您的申请：${comment || '无说明'}`, 'exception');

    await saveDbToDisk();
    const finalApp = rowToObj(db.exec('SELECT * FROM applications WHERE id = ?', [id])[0].columns, db.exec('SELECT * FROM applications WHERE id = ?', [id])[0].values[0]);
    const fc = db.exec('SELECT * FROM check_results WHERE application_id = ?', [id])[0];
    const fa = db.exec('SELECT * FROM approval_records WHERE application_id = ? ORDER BY step', [id])[0];
    res.json({ success: true, data: toApplicationLite(finalApp, fc ? fc.values.map(v => rowToObj(fc.columns, v)) : [], fa ? fa.values.map(v => rowToObj(fa.columns, v)) : []) });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/:id/escalate', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const { id } = req.params;
    const { operatorId } = req.body;

    const aRows = db.exec('SELECT * FROM applications WHERE id = ?', [id])[0];
    if (!aRows) return res.status(404).json({ success: false, error: '申请不存在' });
    const app = rowToObj(aRows.columns, aRows.values[0]);

    const stepRows = db.exec(`SELECT * FROM approval_records WHERE application_id = ? AND status = 'pending' ORDER BY step LIMIT 1`, [id])[0];
    if (!stepRows) return res.status(400).json({ success: false, error: '无待审批步骤' });
    const step = rowToObj(stepRows.columns, stepRows.values[0]);

    const waitH = calcWaitHours(step.createdAt);
    if (waitH < 48) {
      return res.status(400).json({ success: false, error: `等待时间不足48小时（当前${waitH.toFixed(1)}小时），不能升级` });
    }

    if (step.escalated) {
      return res.status(400).json({ success: false, error: '已升级，请勿重复操作' });
    }

    const approverRows = db.exec('SELECT * FROM employees WHERE id = ?', [step.approverId])[0];
    if (!approverRows) return res.status(404).json({ success: false, error: '审批人不存在' });
    const approver = rowToObj(approverRows.columns, approverRows.values[0]);
    if (!approver.supervisorId) return res.status(400).json({ success: false, error: '当前审批人无上级，无法升级' });

    const upperRows = db.exec('SELECT * FROM employees WHERE id = ?', [approver.supervisorId])[0];
    if (!upperRows) return res.status(404).json({ success: false, error: '上级不存在' });
    const upper = rowToObj(upperRows.columns, upperRows.values[0]);

    db.run(`UPDATE approval_records SET status = 'delegated', escalated = 1, processed_at = datetime('now') WHERE id = ?`, [step.id]);
    db.run(`UPDATE applications SET status = 'escalated', updated_at = datetime('now') WHERE id = ?`, [id]);
    db.run(
      `INSERT INTO approval_records (id, application_id, approver_id, approver_name, approver_role, step, total_steps, status, created_at, escalated) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'), 1)`,
      [crypto.randomUUID(), id, upper.id, upper.name, `升级审批（手动）`, step.step, step.totalSteps]
    );

    await logOperation(operatorId || null, 'system', '审批手动升级', id, `从${approver.name}升级至${upper.name}，已等待${waitH.toFixed(1)}小时`, 'exception');
    await pushNotification(upper.id, '审批升级通知', `${app.employeeName}的${app.type === 'regular' ? '转正' : '调岗'}申请（${id}）已升级至您审批，请尽快处理`, 'escalation');
    await pushNotification(approver.id, '审批升级提醒', `${app.employeeName}的申请已升级至上级${upper.name}，您已不再是当前审批人`, 'exception');

    await saveDbToDisk();
    res.json({ success: true, message: '已升级至上级审批' });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

async function updateEmployeeAfterApproval(app: any) {
  const db = await getDb();
  const empRows = db.exec('SELECT * FROM employees WHERE id = ?', [app.employeeId])[0];
  if (!empRows) return;
  const emp = rowToObj(empRows.columns, empRows.values[0]);

  if (app.type === 'regular') {
    const gradeMap: Record<string, string> = { P1: 'P2', P2: 'P3', P3: 'P4', M1: 'M2', M2: 'M3' };
    const newGrade = gradeMap[emp.salaryGrade] || emp.salaryGrade;
    const permMap: Record<string, string> = {
      staff: JSON.stringify(['apply:view', 'apply:create', 'employee:view:self']),
      supervisor: JSON.stringify(['apply:view', 'apply:create', 'approval:staff', 'employee:view']),
      manager: JSON.stringify(['apply:view', 'apply:create', 'approval:staff', 'approval:manager', 'employee:view', 'employee:edit', 'report:view']),
      director: JSON.stringify(['*']),
    };
    db.run(`UPDATE employees SET status = 'regular', salary_grade = ?, permissions = ?, updated_at = datetime('now') WHERE id = ?`, [newGrade, permMap[emp.level] || emp.permissions, emp.id]);
  } else if (app.type === 'transfer') {
    let supervisorId = emp.supervisorId;
    let supervisorName = emp.supervisorName;
    if (app.targetDepartment) {
      const supRows = db.exec(`SELECT * FROM employees WHERE department = ? AND level IN ('supervisor', 'manager') LIMIT 1`, [app.targetDepartment])[0];
      if (supRows) {
        const sup = rowToObj(supRows.columns, supRows.values[0]);
        supervisorId = sup.id;
        supervisorName = sup.name;
      }
    }
    const permMap: Record<string, string> = {
      staff: JSON.stringify(['apply:view', 'apply:create', 'employee:view:self']),
      supervisor: JSON.stringify(['apply:view', 'apply:create', 'approval:staff', 'employee:view']),
      manager: JSON.stringify(['apply:view', 'apply:create', 'approval:staff', 'approval:manager', 'employee:view', 'employee:edit', 'report:view']),
      director: JSON.stringify(['*']),
    };
    db.run(`UPDATE employees SET department = ?, position = ?, supervisor_id = ?, supervisor_name = ?, status = 'transferred', permissions = ?, updated_at = datetime('now') WHERE id = ?`,
      [app.targetDepartment || emp.department, app.targetPosition || emp.position, supervisorId, supervisorName, permMap[emp.level] || emp.permissions, emp.id]);
  }
}

export default router;
