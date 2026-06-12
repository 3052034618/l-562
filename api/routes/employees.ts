import { Router, type Request, type Response } from 'express';
import { getDb, saveDbToDisk } from '../db.js';
import { rowToObj } from '../services.js';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const { department, level, keyword } = req.query;
    const conds: string[] = [];
    const params: any[] = [];
    if (department) { conds.push('department = ?'); params.push(department); }
    if (level) { conds.push('level = ?'); params.push(level); }
    if (keyword) { conds.push('(name LIKE ? OR id LIKE ?)'); params.push(`%${keyword}%`, `%${keyword}%`); }
    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const rows = db.exec(`SELECT * FROM employees ${where} ORDER BY department, id`, params)[0];
    const list = rows ? rows.values.map(v => {
      const o = rowToObj(rows.columns, v);
      try { o.permissions = JSON.parse(o.permissions || '[]'); } catch { o.permissions = []; }
      return o;
    }) : [];
    res.json({ success: true, data: list });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const rows = db.exec('SELECT * FROM employees WHERE id = ?', [req.params.id])[0];
    if (!rows) return res.status(404).json({ success: false, error: '员工不存在' });
    const emp = rowToObj(rows.columns, rows.values[0]);
    try { emp.permissions = JSON.parse(emp.permissions || '[]'); } catch { emp.permissions = []; }
    const appRows = db.exec(`SELECT id, type, status, submit_time FROM applications WHERE employee_id = ? ORDER BY submit_time DESC`, [req.params.id])[0];
    const history = appRows ? appRows.values.map(v => rowToObj(appRows.columns, v)) : [];
    res.json({ success: true, data: { ...emp, history } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/options/list', async (_req: Request, res: Response) => {
  try {
    const db = await getDb();
    const rows = db.exec('SELECT id, name, department, position, level, supervisor_id, supervisor_name FROM employees ORDER BY id')[0];
    const list = rows ? rows.values.map(v => rowToObj(rows.columns, v)) : [];
    const departments = Array.from(new Set(list.map(e => e.department)));
    const supervisors = list.filter(e => ['supervisor', 'manager', 'director'].includes(e.level)).map(e => ({ id: e.id, name: e.name, department: e.department }));
    res.json({ success: true, data: { employees: list, departments, supervisors } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const { id } = req.params;
    const { department, position, salaryGrade, supervisorId, supervisorName, status, level } = req.body;
    const fields: string[] = [];
    const params: any[] = [];
    if (department !== undefined) { fields.push('department = ?'); params.push(department); }
    if (position !== undefined) { fields.push('position = ?'); params.push(position); }
    if (salaryGrade !== undefined) { fields.push('salary_grade = ?'); params.push(salaryGrade); }
    if (supervisorId !== undefined) { fields.push('supervisor_id = ?'); params.push(supervisorId); }
    if (supervisorName !== undefined) { fields.push('supervisor_name = ?'); params.push(supervisorName); }
    if (status !== undefined) { fields.push('status = ?'); params.push(status); }
    if (level !== undefined) { fields.push('level = ?'); params.push(level); }
    fields.push('updated_at = datetime(\'now\')');
    params.push(id);
    db.run(`UPDATE employees SET ${fields.join(', ')} WHERE id = ?`, params);
    await saveDbToDisk();
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
