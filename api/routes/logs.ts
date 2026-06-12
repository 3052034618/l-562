import { Router, type Request, type Response } from 'express';
import { getDb, saveDbToDisk } from '../db.js';
import { rowToObj, calcWaitHours } from '../services.js';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const { page = 1, pageSize = 50 } = req.query;
    const rows = db.exec(`SELECT * FROM operation_logs ORDER BY timestamp DESC LIMIT ? OFFSET ?`, [Number(pageSize), (Number(page) - 1) * Number(pageSize)])[0];
    const list = rows ? rows.values.map(v => rowToObj(rows.columns, v)) : [];
    const total = Number(db.exec(`SELECT COUNT(*) FROM operation_logs`)[0].values[0][0]);
    res.json({ success: true, data: { list, total } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/exceptions', async (req: Request, res: Response) => {
  try {
    const db = await getDb();

    const typeRows = db.exec(`SELECT * FROM operation_logs WHERE type = 'exception' ORDER BY timestamp DESC LIMIT 200`)[0];
    const exceptions = typeRows ? typeRows.values.map(v => rowToObj(typeRows.columns, v)) : [];

    const overtimeRows = db.exec(`SELECT ar.*, a.employee_name, a.type, a.id as app_id FROM approval_records ar JOIN applications a ON a.id = ar.application_id WHERE ar.status = 'pending'`)[0];
    const overtime: any[] = [];
    if (overtimeRows) {
      overtimeRows.values.forEach(v => {
        const o = rowToObj(overtimeRows.columns, v);
        const hours = calcWaitHours(o.createdAt);
        if (hours > 48 || o.escalated) {
          overtime.push({
            ...o,
            waitHours: hours,
          });
        }
      });
    }
    overtime.sort((a, b) => b.waitHours - a.waitHours);

    const failedRows = db.exec(`SELECT a.* FROM applications a WHERE status = 'check_failed' ORDER BY submit_time DESC`)[0];
    const failed: any[] = [];
    if (failedRows) {
      failedRows.values.forEach(v => {
        const o = rowToObj(failedRows.columns, v);
        const cr = db.exec(`SELECT * FROM check_results WHERE application_id = ? AND passed = 0`, [o.id])[0];
        const missing = cr ? cr.values.map((x: any) => rowToObj(cr.columns, x).label) : [];
        failed.push({ ...o, missingItems: missing });
      });
    }

    res.json({ success: true, data: { exceptions, overtime, failed } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
