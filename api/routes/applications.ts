import { Router, type Request, type Response } from 'express';
import { getDb, saveDbToDisk } from '../db.js';
import { rowToObj, validateQualification, decideApprovalFlow, logOperation, pushNotification, calcWaitHours } from '../services.js';

const router = Router();

function toApplication(app: any, checks: any[], approvals: any[]) {
  const missing = checks.filter(c => !c.passed).map(c => c.label);
  const escalated = approvals.some(a => a.escalated);
  const currentPending = approvals.find(a => a.status === 'pending');
  let currentApprover = undefined;
  if (currentPending) {
    currentApprover = {
      id: currentPending.approverId,
      name: currentPending.approverName,
      role: currentPending.approverRole,
      waitHours: calcWaitHours(currentPending.createdAt),
    };
  }
  return {
    ...app,
    checkResults: checks,
    approvalRecords: approvals,
    missingItems: missing,
    escalated,
    currentApprover,
  };
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const { status, type, department, level, employeeId, page = 1, pageSize = 20 } = req.query;
    const conditions: string[] = [];
    const params: any[] = [];
    if (status) { conditions.push('status = ?'); params.push(status); }
    if (type) { conditions.push('type = ?'); params.push(type); }
    if (department) { conditions.push('department = ?'); params.push(department); }
    if (level) { conditions.push('level = ?'); params.push(level); }
    if (employeeId) { conditions.push('employee_id = ?'); params.push(employeeId); }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const appRows = db.exec(`SELECT * FROM applications ${where} ORDER BY submit_time DESC LIMIT ? OFFSET ?`, [...params, Number(pageSize), (Number(page) - 1) * Number(pageSize)])[0];
    const apps = appRows ? appRows.values.map(v => rowToObj(appRows.columns, v)) : [];

    const ids = apps.map(a => a.id);
    const checksMap: Record<string, any[]> = {};
    const approvalsMap: Record<string, any[]> = {};
    if (ids.length) {
      const qmarks = ids.map(() => '?').join(',');
      const cRows = db.exec(`SELECT * FROM check_results WHERE application_id IN (${qmarks})`, ids)[0];
      if (cRows) cRows.values.forEach(v => {
        const o = rowToObj(cRows.columns, v);
        (checksMap[o.applicationId] ||= []).push(o);
      });
      const aRows = db.exec(`SELECT * FROM approval_records WHERE application_id IN (${qmarks}) ORDER BY step`, ids)[0];
      if (aRows) aRows.values.forEach(v => {
        const o = rowToObj(aRows.columns, v);
        (approvalsMap[o.applicationId] ||= []).push(o);
      });
    }
    const total = db.exec(`SELECT COUNT(*) as cnt FROM applications ${where}`, params)[0].values[0][0];
    const list = apps.map(a => toApplication(a, checksMap[a.id] || [], approvalsMap[a.id] || []));
    res.json({ success: true, data: { list, total: Number(total) } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const { id } = req.params;
    const aRows = db.exec('SELECT * FROM applications WHERE id = ?', [id])[0];
    if (!aRows) return res.status(404).json({ success: false, error: '申请不存在' });
    const app = rowToObj(aRows.columns, aRows.values[0]);
    const cRows = db.exec('SELECT * FROM check_results WHERE application_id = ?', [id])[0];
    const checks = cRows ? cRows.values.map(v => rowToObj(cRows.columns, v)) : [];
    const apRows = db.exec('SELECT * FROM approval_records WHERE application_id = ? ORDER BY step', [id])[0];
    const approvals = apRows ? apRows.values.map(v => rowToObj(apRows.columns, v)) : [];
    res.json({ success: true, data: toApplication(app, checks, approvals) });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const { employeeId, type, targetDepartment, targetPosition, reason, forceFail } = req.body;
    if (!employeeId || !type) return res.status(400).json({ success: false, error: '缺少必填参数' });

    const empRows = db.exec('SELECT * FROM employees WHERE id = ?', [employeeId])[0];
    if (!empRows) return res.status(404).json({ success: false, error: '员工不存在' });
    const emp = rowToObj(empRows.columns, empRows.values[0]);

    const appId = 'APP' + Date.now().toString(36).toUpperCase();
    const checks = await validateQualification(employeeId, type as any, { targetDepartment, targetPosition, forceFail });
    const allPass = checks.every(c => c.passed);

    let status = allPass ? 'pending_approval' : 'check_failed';
    db.run(
      'INSERT INTO applications (id, type, employee_id, employee_name, department, position, level, target_department, target_position, status, submit_time, reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime(\'now\'), ?)',
      [appId, type, employeeId, emp.name, emp.department, emp.position, emp.level, targetDepartment || null, targetPosition || null, status, reason || null]
    );
    for (const c of checks) {
      db.run(
        'INSERT INTO check_results (id, application_id, item, label, passed, detail) VALUES (?, ?, ?, ?, ?, ?)',
        [crypto.randomUUID(), appId, c.item, c.label, c.passed ? 1 : 0, c.detail]
      );
    }

    let flow: any[] = [];
    if (allPass) {
      flow = await decideApprovalFlow(employeeId, type as any, targetDepartment);
      for (const s of flow) {
        db.run(
          'INSERT INTO approval_records (id, application_id, approver_id, approver_name, approver_role, step, total_steps, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, \'pending\', datetime(\'now\'))',
          [crypto.randomUUID(), appId, s.approverId, s.approverName, s.approverRole, s.step, s.total]
        );
        await pushNotification(s.approverId, `新的${type === 'regular' ? '转正' : '调岗'}申请待审批`, `${emp.name}的${type === 'regular' ? '转正' : '调岗'}申请已提交，请及时审批`, 'approval');
      }
    }

    await logOperation(employeeId, emp.name, '申请提交', appId, `提交${type === 'regular' ? '转正' : '调岗'}申请${allPass ? '' : '：校验未通过（' + checks.filter(c => !c.passed).map(c => c.label).join('、') + '）'}`, allPass ? 'operation' : 'exception');

    if (!allPass) {
      const missing = checks.filter(c => !c.passed).map(c => c.label).join('、');
      await pushNotification(employeeId, '资格校验不通过', `您的${type === 'regular' ? '转正' : '调岗'}申请校验未通过：${missing}，请补充材料后重新提交`, 'exception');
    }

    await saveDbToDisk();

    const finalAppRows = db.exec('SELECT * FROM applications WHERE id = ?', [appId])[0];
    const finalApp = rowToObj(finalAppRows.columns, finalAppRows.values[0]);
    const finalChecksRows = db.exec('SELECT * FROM check_results WHERE application_id = ?', [appId])[0];
    const finalChecksArr = finalChecksRows ? finalChecksRows.values.map(v => rowToObj(finalChecksRows.columns, v)) : [];
    const finalApprovalsQ = db.exec('SELECT * FROM approval_records WHERE application_id = ? ORDER BY step', [appId])[0];
    const finalApprovals = finalApprovalsQ ? finalApprovalsQ.values.map(v => rowToObj(finalApprovalsQ.columns, v)) : [];

    res.json({ success: true, data: toApplication(finalApp, finalChecksArr, finalApprovals) });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/resubmit/:id', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const { id } = req.params;
    const { forceFail } = req.body;
    const aRows = db.exec('SELECT * FROM applications WHERE id = ?', [id])[0];
    if (!aRows) return res.status(404).json({ success: false, error: '申请不存在' });
    const app = rowToObj(aRows.columns, aRows.values[0]);

    db.run('DELETE FROM check_results WHERE application_id = ?', [id]);
    db.run('DELETE FROM approval_records WHERE application_id = ?', [id]);

    const checks = await validateQualification(app.employeeId, app.type as any, { targetDepartment: app.targetDepartment, targetPosition: app.targetPosition, forceFail });
    const allPass = checks.every(c => c.passed);
    const newStatus = allPass ? 'pending_approval' : 'check_failed';

    for (const c of checks) {
      db.run('INSERT INTO check_results (id, application_id, item, label, passed, detail) VALUES (?, ?, ?, ?, ?, ?)', [crypto.randomUUID(), id, c.item, c.label, c.passed ? 1 : 0, c.detail]);
    }

    if (allPass) {
      const flow = await decideApprovalFlow(app.employeeId, app.type as any, app.targetDepartment);
      for (const s of flow) {
        db.run('INSERT INTO approval_records (id, application_id, approver_id, approver_name, approver_role, step, total_steps, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, \'pending\', datetime(\'now\'))', [crypto.randomUUID(), id, s.approverId, s.approverName, s.approverRole, s.step, s.total]);
        await pushNotification(s.approverId, `新的${app.type === 'regular' ? '转正' : '调岗'}申请待审批`, `${app.employeeName}的申请已重新提交，请及时审批`, 'approval');
      }
    }

    db.run('UPDATE applications SET status = ?, updated_at = datetime(\'now\') WHERE id = ?', [newStatus, id]);
    await logOperation(app.employeeId, app.employeeName, '重新提交申请', id, allPass ? '校验通过，等待审批' : '校验未通过', allPass ? 'operation' : 'exception');
    await saveDbToDisk();

    const finalApp = rowToObj(db.exec('SELECT * FROM applications WHERE id = ?', [id])[0].columns, db.exec('SELECT * FROM applications WHERE id = ?', [id])[0].values[0]);
    const fc = db.exec('SELECT * FROM check_results WHERE application_id = ?', [id])[0];
    const fa = db.exec('SELECT * FROM approval_records WHERE application_id = ? ORDER BY step', [id])[0];
    res.json({ success: true, data: toApplication(finalApp, fc ? fc.values.map(v => rowToObj(fc.columns, v)) : [], fa ? fa.values.map(v => rowToObj(fa.columns, v)) : []) });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
