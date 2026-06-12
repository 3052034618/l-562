import { Router, type Request, type Response } from 'express';
import { getDb, saveDbToDisk } from '../db.js';
import { rowToObj, calcWaitHours } from '../services.js';
import * as XLSX from 'xlsx';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const { employeeId, department, startDate, endDate, type, status, page = 1, pageSize = 20 } = req.query as any;
    const conds: string[] = [];
    const params: any[] = [];
    if (employeeId) { conds.push('a.employee_id = ?'); params.push(employeeId); }
    if (department) { conds.push('a.department = ?'); params.push(department); }
    if (startDate) { conds.push('a.submit_time >= ?'); params.push(startDate + ' 00:00:00'); }
    if (endDate) { conds.push('a.submit_time <= ?'); params.push(endDate + ' 23:59:59'); }
    if (type) { conds.push('a.type = ?'); params.push(type); }
    if (status) { conds.push('a.status = ?'); params.push(status); }
    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const rows = db.exec(`SELECT a.* FROM applications a ${where} ORDER BY a.submit_time DESC LIMIT ? OFFSET ?`, [...params, Number(pageSize), (Number(page) - 1) * Number(pageSize)])[0];
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
    const list = apps.map(a => {
      const checks = cMap[a.id] || [];
      const approvals = aMap[a.id] || [];
      const missing = checks.filter(c => !c.passed).map(c => c.label);
      const currentPending = approvals.find(ap => ap.status === 'pending');
      return {
        ...a,
        missingItems: missing,
        checkResults: checks,
        approvalRecords: approvals,
        escalated: approvals.some(ap => ap.escalated),
        currentApprover: currentPending ? {
          id: currentPending.approverId,
          name: currentPending.approverName,
          role: currentPending.approverRole,
          waitHours: calcWaitHours(currentPending.createdAt),
        } : undefined,
      };
    });
    const total = Number(db.exec(`SELECT COUNT(*) FROM applications a ${where}`, params)[0].values[0][0]);
    res.json({ success: true, data: { list, total } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/export', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const { employeeId, department, startDate, endDate, type, status, ids } = req.query as any;
    let list: any[] = [];
    if (ids && typeof ids === 'string') {
      const idArr = ids.split(',');
      const q = idArr.map(() => '?').join(',');
      const rows = db.exec(`SELECT a.* FROM applications a WHERE a.id IN (${q})`, idArr)[0];
      if (rows) list = rows.values.map(v => rowToObj(rows.columns, v));
    } else {
      const conds: string[] = [];
      const params: any[] = [];
      if (employeeId) { conds.push('a.employee_id = ?'); params.push(employeeId); }
      if (department) { conds.push('a.department = ?'); params.push(department); }
      if (startDate) { conds.push('a.submit_time >= ?'); params.push(startDate + ' 00:00:00'); }
      if (endDate) { conds.push('a.submit_time <= ?'); params.push(endDate + ' 23:59:59'); }
      if (type) { conds.push('a.type = ?'); params.push(type); }
      if (status) { conds.push('a.status = ?'); params.push(status); }
      const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
      const rows = db.exec(`SELECT a.* FROM applications a ${where} ORDER BY a.submit_time DESC`, params)[0];
      if (rows) list = rows.values.map(v => rowToObj(rows.columns, v));
    }
    const statusMap: Record<string, string> = { pending_check: '校验中', check_failed: '校验不通过', pending_approval: '审批中', escalated: '已升级', approved: '通过', rejected: '退回' };
    const data = list.map(a => ({
      申请编号: a.id,
      类型: a.type === 'regular' ? '转正' : '调岗',
      员工编号: a.employeeId,
      员工姓名: a.employeeName,
      原部门: a.department,
      原岗位: a.position,
      目标部门: a.targetDepartment || '',
      目标岗位: a.targetPosition || '',
      状态: statusMap[a.status] || a.status,
      提交时间: a.submitTime,
      申请原因: a.reason || '',
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, '申请明细');
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=applications_${Date.now()}.xlsx`);
    res.send(Buffer.from(buffer));
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
