import { Router, type Request, type Response } from 'express';
import { getDb, saveDbToDisk } from '../db.js';
import { rowToObj, calcWaitHours } from '../services.js';
import PdfPrinter from 'pdfmake';
import * as XLSX from 'xlsx';

const router = Router();

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function addMonths(d: Date, n: number) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
}

router.get('/overview', async (_req: Request, res: Response) => {
  try {
    const db = await getDb();

    const pendingApprovals = db.exec(`SELECT COUNT(*) FROM approval_records WHERE status = 'pending'`)[0].values[0][0] as number;
    const thisMonth = monthKey(new Date());
    const startOfMonth = `${thisMonth}-01 00:00:00`;
    const nextMonthStart = `${monthKey(addMonths(new Date(), 1))}-01 00:00:00`;
    const regularCount = db.exec(`SELECT COUNT(*) FROM applications WHERE type = 'regular' AND submit_time >= ? AND submit_time < ?`, [startOfMonth, nextMonthStart])[0].values[0][0] as number;
    const transferCount = db.exec(`SELECT COUNT(*) FROM applications WHERE type = 'transfer' AND submit_time >= ? AND submit_time < ?`, [startOfMonth, nextMonthStart])[0].values[0][0] as number;

    const escalatedCount = db.exec(`SELECT COUNT(DISTINCT application_id) FROM approval_records WHERE escalated = 1 AND status = 'pending'`)[0].values[0][0] as number;
    const checkFailedCount = db.exec(`SELECT COUNT(*) FROM applications WHERE status = 'check_failed'`)[0].values[0][0] as number;
    const overtimeRows = db.exec(`SELECT * FROM approval_records WHERE status = 'pending'`)[0];
    let overtime = 0;
    if (overtimeRows) {
      overtimeRows.values.forEach(v => {
        const o = rowToObj(overtimeRows.columns, v);
        if (calcWaitHours(o.createdAt) > 48) overtime++;
      });
    }

    const lastMonth = monthKey(addMonths(new Date(), -1));
    const lmStart = `${lastMonth}-01 00:00:00`;
    const lmEnd = `${thisMonth}-01 00:00:00`;
    const lmRegular = Number(db.exec(`SELECT COUNT(*) FROM applications WHERE type='regular' AND status='approved' AND submit_time >= ? AND submit_time < ?`, [lmStart, lmEnd])[0].values[0][0]) || 0;
    const lmRegularTotal = Number(db.exec(`SELECT COUNT(*) FROM applications WHERE type='regular' AND submit_time >= ? AND submit_time < ?`, [lmStart, lmEnd])[0].values[0][0]) || 1;
    const lmTransfer = Number(db.exec(`SELECT COUNT(*) FROM applications WHERE type='transfer' AND status='approved' AND submit_time >= ? AND submit_time < ?`, [lmStart, lmEnd])[0].values[0][0]) || 0;
    const lmTransferTotal = Number(db.exec(`SELECT COUNT(*) FROM applications WHERE type='transfer' AND submit_time >= ? AND submit_time < ?`, [lmStart, lmEnd])[0].values[0][0]) || 1;

    const thisRegular = Number(db.exec(`SELECT COUNT(*) FROM applications WHERE type='regular' AND status='approved' AND submit_time >= ? AND submit_time < ?`, [startOfMonth, nextMonthStart])[0].values[0][0]) || 0;
    const thisRegularTotal = Number(db.exec(`SELECT COUNT(*) FROM applications WHERE type='regular' AND submit_time >= ? AND submit_time < ?`, [startOfMonth, nextMonthStart])[0].values[0][0]) || 1;
    const thisTransfer = Number(db.exec(`SELECT COUNT(*) FROM applications WHERE type='transfer' AND status='approved' AND submit_time >= ? AND submit_time < ?`, [startOfMonth, nextMonthStart])[0].values[0][0]) || 0;
    const thisTransferTotal = Number(db.exec(`SELECT COUNT(*) FROM applications WHERE type='transfer' AND submit_time >= ? AND submit_time < ?`, [startOfMonth, nextMonthStart])[0].values[0][0]) || 1;

    const durationRows = db.exec(`SELECT a.submit_time, ar.processed_at FROM applications a JOIN approval_records ar ON a.id = ar.application_id WHERE a.status='approved' AND ar.status='approved' AND ar.processed_at IS NOT NULL`)[0];
    let totalHours = 0;
    let cnt = 0;
    if (durationRows) {
      durationRows.values.forEach(v => {
        const sub = new Date(String(v[0]).replace(' ', 'T')).getTime();
        const pro = new Date(String(v[1]).replace(' ', 'T')).getTime();
        totalHours += (pro - sub) / 3600000;
        cnt++;
      });
    }
    const avgDuration = cnt ? Math.round(totalHours / cnt * 10) / 10 : 0;

    res.json({
      success: true,
      data: {
        pendingApprovals,
        regularCount,
        transferCount,
        escalatedCount,
        checkFailedCount,
        overtimeCount: overtime,
        metrics: {
          current: {
            regularPassRate: Math.round(thisRegular / thisRegularTotal * 1000) / 10,
            transferSuccessRate: Math.round(thisTransfer / thisTransferTotal * 1000) / 10,
            avgDuration,
          },
          previous: {
            regularPassRate: Math.round(lmRegular / lmRegularTotal * 1000) / 10,
            transferSuccessRate: Math.round(lmTransfer / lmTransferTotal * 1000) / 10,
            avgDuration: avgDuration,
          },
        },
      },
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/trend', async (_req: Request, res: Response) => {
  try {
    const db = await getDb();
    const now = new Date();
    const trend: any[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = addMonths(now, -i);
      const key = monthKey(d);
      const nextD = addMonths(d, 1);
      const nextKey = monthKey(nextD);
      const start = `${key}-01 00:00:00`;
      const end = `${nextKey}-01 00:00:00`;
      const regTotal = Number(db.exec(`SELECT COUNT(*) FROM applications WHERE type='regular' AND submit_time >= ? AND submit_time < ?`, [start, end])[0].values[0][0]) || 0;
      const regPass = Number(db.exec(`SELECT COUNT(*) FROM applications WHERE type='regular' AND status='approved' AND submit_time >= ? AND submit_time < ?`, [start, end])[0].values[0][0]) || 0;
      const transTotal = Number(db.exec(`SELECT COUNT(*) FROM applications WHERE type='transfer' AND submit_time >= ? AND submit_time < ?`, [start, end])[0].values[0][0]) || 0;
      const transPass = Number(db.exec(`SELECT COUNT(*) FROM applications WHERE type='transfer' AND status='approved' AND submit_time >= ? AND submit_time < ?`, [start, end])[0].values[0][0]) || 0;

      const durRows = db.exec(`SELECT a.submit_time, MAX(ar.processed_at) as lat FROM applications a JOIN approval_records ar ON a.id = ar.application_id WHERE a.status='approved' AND ar.processed_at IS NOT NULL AND a.submit_time >= ? AND a.submit_time < ? GROUP BY a.id`, [start, end])[0];
      let totalH = 0;
      let c = 0;
      if (durRows) {
        durRows.values.forEach(v => {
          const sub = new Date(String(v[0]).replace(' ', 'T')).getTime();
          const lat = new Date(String(v[1]).replace(' ', 'T')).getTime();
          totalH += (lat - sub) / 3600000;
          c++;
        });
      }

      trend.push({
        month: key,
        regularCount: regTotal,
        regularPassCount: regPass,
        regularPassRate: regTotal ? Math.round(regPass / regTotal * 1000) / 10 : 0,
        transferCount: transTotal,
        transferPassCount: transPass,
        transferSuccessRate: transTotal ? Math.round(transPass / transTotal * 1000) / 10 : 0,
        avgDuration: c ? Math.round(totalH / c * 10) / 10 : 0,
      });
    }
    res.json({ success: true, data: trend });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/monthly', async (_req: Request, res: Response) => {
  try {
    const db = await getDb();
    const rows = db.exec(`SELECT * FROM monthly_reports ORDER BY month DESC LIMIT 12`)[0];
    const list = rows ? rows.values.map(v => rowToObj(rows.columns, v)) : [];
    res.json({ success: true, data: list });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/generate/monthly', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const { month } = req.body;
    const d = month ? new Date(month + '-01') : new Date();
    const key = monthKey(d);
    const nextKey = monthKey(addMonths(d, 1));
    const start = `${key}-01 00:00:00`;
    const end = `${nextKey}-01 00:00:00`;
    const regTotal = Number(db.exec(`SELECT COUNT(*) FROM applications WHERE type='regular' AND submit_time >= ? AND submit_time < ?`, [start, end])[0].values[0][0]) || 0;
    const regPass = Number(db.exec(`SELECT COUNT(*) FROM applications WHERE type='regular' AND status='approved' AND submit_time >= ? AND submit_time < ?`, [start, end])[0].values[0][0]) || 0;
    const transTotal = Number(db.exec(`SELECT COUNT(*) FROM applications WHERE type='transfer' AND submit_time >= ? AND submit_time < ?`, [start, end])[0].values[0][0]) || 0;
    const transPass = Number(db.exec(`SELECT COUNT(*) FROM applications WHERE type='transfer' AND status='approved' AND submit_time >= ? AND submit_time < ?`, [start, end])[0].values[0][0]) || 0;

    const durRows = db.exec(`SELECT a.submit_time, MAX(ar.processed_at) as lat FROM applications a JOIN approval_records ar ON a.id = ar.application_id WHERE a.status='approved' AND ar.processed_at IS NOT NULL AND a.submit_time >= ? AND a.submit_time < ? GROUP BY a.id`, [start, end])[0];
    let totalH = 0;
    let c = 0;
    if (durRows) {
      durRows.values.forEach(v => {
        totalH += (new Date(String(v[1]).replace(' ', 'T')).getTime() - new Date(String(v[0]).replace(' ', 'T')).getTime()) / 3600000;
        c++;
      });
    }
    const avg = c ? Math.round(totalH / c * 10) / 10 : 0;
    const regRate = regTotal ? Math.round(regPass / regTotal * 1000) / 10 : 0;
    const transRate = transTotal ? Math.round(transPass / transTotal * 1000) / 10 : 0;

    const existing = db.exec(`SELECT id FROM monthly_reports WHERE month = ?`, [key])[0];
    if (existing) {
      db.run(`UPDATE monthly_reports SET regular_pass_rate = ?, transfer_success_rate = ?, avg_process_duration = ?, regular_count = ?, transfer_count = ? WHERE month = ?`, [regRate, transRate, avg, regTotal, transTotal, key]);
    } else {
      db.run(`INSERT INTO monthly_reports (id, month, regular_pass_rate, transfer_success_rate, avg_process_duration, regular_count, transfer_count) VALUES (?, ?, ?, ?, ?, ?, ?)`, [crypto.randomUUID(), key, regRate, transRate, avg, regTotal, transTotal]);
    }
    await saveDbToDisk();
    res.json({ success: true, data: { month: key, regularPassRate: regRate, transferSuccessRate: transRate, avgProcessDuration: avg, regularCount: regTotal, transferCount: transTotal } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/export/excel', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const { startDate, endDate, month } = req.query as any;
    let start = '', end = '';
    if (month) {
      const d = new Date(month + '-01');
      start = `${monthKey(d)}-01 00:00:00`;
      end = `${monthKey(addMonths(d, 1))}-01 00:00:00`;
    } else if (startDate && endDate) {
      start = startDate + ' 00:00:00';
      end = endDate + ' 23:59:59';
    } else {
      const now = new Date();
      start = `${monthKey(now)}-01 00:00:00`;
      end = `${monthKey(addMonths(now, 1))}-01 00:00:00`;
    }
    const rows = db.exec(`SELECT a.id, a.type, a.employee_id, a.employee_name, a.department, a.position, a.target_department, a.target_position, a.status, a.submit_time, (SELECT MAX(processed_at) FROM approval_records WHERE application_id = a.id) as finish_time FROM applications a WHERE a.submit_time >= ? AND a.submit_time < ? ORDER BY a.submit_time`, [start, end])[0];
    const data = rows ? rows.values.map(v => ({
      申请编号: v[0],
      类型: v[1] === 'regular' ? '转正' : '调岗',
      员工编号: v[2],
      员工姓名: v[3],
      原部门: v[4],
      原岗位: v[5],
      目标部门: v[6] || '',
      目标岗位: v[7] || '',
      状态: mapStatus(String(v[8])),
      提交时间: v[9],
      完成时间: v[10] || '',
    })) : [];

    const trendRows = db.exec(`SELECT * FROM monthly_reports ORDER BY month DESC LIMIT 12`)[0];
    const trend = trendRows ? trendRows.values.map(v => ({
      '月份': v[1],
      '转正通过率': `${v[2]}%`,
      '调岗成功率': `${v[3]}%`,
      '平均处理时长(小时)': v[4],
      '转正申请数': v[5],
      '调岗申请数': v[6],
    })) : [];

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(data);
    const ws2 = XLSX.utils.json_to_sheet(trend);
    XLSX.utils.book_append_sheet(wb, ws1, '申请明细');
    XLSX.utils.book_append_sheet(wb, ws2, '月度统计');
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=report_${start.slice(0, 7)}.xlsx`);
    res.send(Buffer.from(buffer));
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/export/pdf', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const { startDate, endDate, month } = req.query as any;
    let start = '', end = '', titleMonth = '';
    if (month) {
      const d = new Date(month + '-01');
      start = `${monthKey(d)}-01 00:00:00`;
      end = `${monthKey(addMonths(d, 1))}-01 00:00:00`;
      titleMonth = month;
    } else if (startDate && endDate) {
      start = startDate + ' 00:00:00';
      end = endDate + ' 23:59:59';
      titleMonth = `${startDate} ~ ${endDate}`;
    } else {
      const now = new Date();
      start = `${monthKey(now)}-01 00:00:00`;
      end = `${monthKey(addMonths(now, 1))}-01 00:00:00`;
      titleMonth = monthKey(now);
    }

    const overviewQ = db.exec(`SELECT * FROM monthly_reports WHERE month = ?`, [titleMonth])[0];
    let overview = { regularPassRate: 0, transferSuccessRate: 0, avgProcessDuration: 0, regularCount: 0, transferCount: 0 };
    if (overviewQ && overviewQ.values.length) {
      const o = rowToObj(overviewQ.columns, overviewQ.values[0]);
      overview = { regularPassRate: o.regularPassRate, transferSuccessRate: o.transferSuccessRate, avgProcessDuration: o.avgProcessDuration, regularCount: o.regularCount, transferCount: o.transferCount };
    }

    const printer = new PdfPrinter({
      Roboto: {
        normal: Buffer.from('AAEAAAA', 'base64'),
        bold: Buffer.from('AAEAAAA', 'base64'),
        italics: Buffer.from('AAEAAAA', 'base64'),
        bolditalics: Buffer.from('AAEAAAA', 'base64'),
      },
    });
    const docDefinition = {
      content: [
        { text: `员工转正调岗审批月度报告 - ${titleMonth}`, fontSize: 18, bold: true, alignment: 'center', margin: [0, 0, 0, 20] },
        { text: '核心指标', fontSize: 14, bold: true, margin: [0, 10, 0, 10] },
        {
          table: {
            widths: ['*', '*', '*', '*', '*'],
            body: [
              ['转正通过率', '调岗成功率', '平均处理时长(小时)', '转正申请数', '调岗申请数'],
              [`${overview.regularPassRate}%`, `${overview.transferSuccessRate}%`, String(overview.avgProcessDuration), String(overview.regularCount), String(overview.transferCount)],
            ],
          },
          margin: [0, 0, 0, 20],
        },
        { text: '环比趋势（近12个月）', fontSize: 14, bold: true, margin: [0, 10, 0, 10] },
        (() => {
          const trendRows = db.exec(`SELECT * FROM monthly_reports ORDER BY month DESC LIMIT 12`)[0];
          const trend = trendRows ? trendRows.values.map(v => rowToObj(trendRows.columns, v)).reverse() : [];
          const header = ['月份', '转正通过率', '调岗成功率', '平均时长(小时)'];
          const body = [header, ...trend.map(t => [t.month, `${t.regularPassRate}%`, `${t.transferSuccessRate}%`, String(t.avgProcessDuration)])];
          return { table: { widths: ['*', '*', '*', '*'], body }, margin: [0, 0, 0, 20] };
        })(),
        { text: '申请明细', fontSize: 14, bold: true, margin: [0, 10, 0, 10] },
        (() => {
          const rows = db.exec(`SELECT a.id, a.type, a.employee_id, a.employee_name, a.department, a.status, a.submit_time FROM applications a WHERE a.submit_time >= ? AND a.submit_time < ? ORDER BY a.submit_time DESC LIMIT 50`, [start, end])[0];
          const header = ['申请编号', '类型', '工号', '姓名', '部门', '状态', '提交时间'];
          const body = [header, ...(rows ? rows.values.map(v => [v[0], v[1] === 'regular' ? '转正' : '调岗', v[2], v[3], v[4], mapStatus(String(v[5])), v[6]]) : [])];
          return { table: { widths: ['auto', 'auto', 'auto', 'auto', '*', 'auto', 'auto'], body }, fontSize: 9 };
        })(),
      ],
      defaultStyle: { fontSize: 10 },
    };
    const pdfDoc = printer.createPdfKitDocument(docDefinition as any);
    const chunks: any[] = [];
    pdfDoc.on('data', chunk => chunks.push(chunk));
    pdfDoc.on('end', () => {
      const result = Buffer.concat(chunks);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=report_${titleMonth}.pdf`);
      res.send(result);
    });
    pdfDoc.end();
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

function mapStatus(s: string) {
  const map: Record<string, string> = {
    pending_check: '校验中',
    check_failed: '校验未通过',
    pending_approval: '审批中',
    escalated: '已升级',
    approved: '已通过',
    rejected: '已退回',
  };
  return map[s] || s;
}

export default router;
