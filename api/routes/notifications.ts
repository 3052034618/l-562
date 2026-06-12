import { Router, type Request, type Response } from 'express';
import { getDb, saveDbToDisk } from '../db.js';
import { rowToObj } from '../services.js';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const { userId, unreadOnly } = req.query;
    const conds: string[] = [];
    const params: any[] = [];
    if (userId) { conds.push('user_id = ?'); params.push(userId); }
    if (unreadOnly === 'true') { conds.push('read = 0'); params.push(); }
    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const rows = db.exec(`SELECT * FROM notifications ${where} ORDER BY created_at DESC LIMIT 200`, params)[0];
    const list = rows ? rows.values.map(v => rowToObj(rows.columns, v)) : [];
    const unreadCount = userId
      ? Number(db.exec(`SELECT COUNT(*) FROM notifications WHERE user_id = ? AND read = 0`, [userId])[0].values[0][0])
      : Number(db.exec(`SELECT COUNT(*) FROM notifications WHERE read = 0`)[0].values[0][0]);
    res.json({ success: true, data: { list, unreadCount } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.put('/:id/read', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    db.run(`UPDATE notifications SET read = 1 WHERE id = ?`, [req.params.id]);
    await saveDbToDisk();
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.put('/read/all', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const { userId } = req.body;
    const params: any[] = [];
    const where = userId ? (params.push(userId), 'WHERE user_id = ?') : '';
    db.run(`UPDATE notifications SET read = 1 ${where}`, params);
    await saveDbToDisk();
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
