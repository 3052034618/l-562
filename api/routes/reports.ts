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

function buildFilterClause(query: any): { sql: string; params: any[] } {
  const conds: string[] = [];
  const params: any[] = [];
  if (query.department) { conds.push(`e.department = ?`); params.push(query.department); }
  if (query.level) { conds.push(`e.level = ?`); params.push(query.level); }
  if (query.type) { conds.push(`a.type = ?`); params.push(query.type); }
  const sql = conds.length ? ' AND ' + conds.join(' AND ') : '';
  return { sql, params };
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

router.get('/trend', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const f = buildFilterClause(req.query);
    const empJoin = f.sql ? ' JOIN employees e ON a.employee_id = e.id' : '';
    const now = new Date();
    const trend: any[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = addMonths(now, -i);
      const key = monthKey(d);
      const nextD = addMonths(d, 1);
      const nextKey = monthKey(nextD);
      const start = `${key}-01 00:00:00`;
      const end = `${nextKey}-01 00:00:00`;
      const regTotal = Number(db.exec(`SELECT COUNT(*) FROM applications a${empJoin} WHERE a.type='regular' AND a.submit_time >= ? AND a.submit_time < ?${f.sql}`, [start, end, ...f.params])[0].values[0][0]) || 0;
      const regPass = Number(db.exec(`SELECT COUNT(*) FROM applications a${empJoin} WHERE a.type='regular' AND a.status='approved' AND a.submit_time >= ? AND a.submit_time < ?${f.sql}`, [start, end, ...f.params])[0].values[0][0]) || 0;
      const transTotal = Number(db.exec(`SELECT COUNT(*) FROM applications a${empJoin} WHERE a.type='transfer' AND a.submit_time >= ? AND a.submit_time < ?${f.sql}`, [start, end, ...f.params])[0].values[0][0]) || 0;
      const transPass = Number(db.exec(`SELECT COUNT(*) FROM applications a${empJoin} WHERE a.type='transfer' AND a.status='approved' AND a.submit_time >= ? AND a.submit_time < ?${f.sql}`, [start, end, ...f.params])[0].values[0][0]) || 0;

      const durRows = db.exec(`SELECT a.submit_time, MAX(ar.processed_at) as lat FROM applications a${empJoin} JOIN approval_records ar ON a.id = ar.application_id WHERE a.status='approved' AND ar.processed_at IS NOT NULL AND a.submit_time >= ? AND a.submit_time < ?${f.sql} GROUP BY a.id`, [start, end, ...f.params])[0];
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

export async function generateMonthlyReport(month?: string) {
  const db = await getDb();
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
  if (existing && existing.values.length) {
    db.run(`UPDATE monthly_reports SET regular_pass_rate = ?, transfer_success_rate = ?, avg_process_duration = ?, regular_count = ?, transfer_count = ? WHERE month = ?`, [regRate, transRate, avg, regTotal, transTotal, key]);
  } else {
    db.run(`INSERT INTO monthly_reports (id, month, regular_pass_rate, transfer_success_rate, avg_process_duration, regular_count, transfer_count) VALUES (?, ?, ?, ?, ?, ?, ?)`, [crypto.randomUUID(), key, regRate, transRate, avg, regTotal, transTotal]);
  }
  await saveDbToDisk();
  return { month: key, regularPassRate: regRate, transferSuccessRate: transRate, avgProcessDuration: avg, regularCount: regTotal, transferCount: transTotal };
}

router.post('/generate/monthly', async (req: Request, res: Response) => {
  try {
    const { month } = req.body;
    const result = await generateMonthlyReport(month);
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/export/excel', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const { startDate, endDate, month, department, level, type } = req.query as any;
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
    const f = buildFilterClause({ department, level, type });
    const rows = db.exec(`SELECT a.id, a.type, a.employee_id, a.employee_name, a.department, a.position, a.target_department, a.target_position, a.status, a.submit_time, (SELECT MAX(processed_at) FROM approval_records WHERE application_id = a.id) as finish_time FROM applications a JOIN employees e ON a.employee_id = e.id WHERE a.submit_time >= ? AND a.submit_time < ?${f.sql} ORDER BY a.submit_time`, [start, end, ...f.params])[0];
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
    })).reverse() : [];

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
      overview = {
        regularPassRate: o.regularPassRate,
        transferSuccessRate: o.transferSuccessRate,
        avgProcessDuration: o.avgProcessDuration,
        regularCount: o.regularCount,
        transferCount: o.transferCount,
      };
    }

    const trendRows = db.exec(`SELECT * FROM monthly_reports ORDER BY month DESC LIMIT 12`)[0];
    const trendData = trendRows ? trendRows.values.map(v => rowToObj(trendRows.columns, v)).reverse() : [];
    const trendHeader = ['月份', '转正通过率', '调岗成功率', '平均时长(小时)', '转正申请数', '调岗申请数'];
    const trendBody: any[] = [trendHeader.map(h => ({ text: h, bold: true, fillColor: '#EEF2FF' }))];
    trendData.forEach(t => {
      trendBody.push([
        t.month,
        `${t.regularPassRate}%`,
        `${t.transferSuccessRate}%`,
        String(t.avgProcessDuration),
        String(t.regularCount),
        String(t.transferCount),
      ]);
    });

    const appRows = db.exec(
      `SELECT a.id, a.type, a.employee_id, a.employee_name, a.department, a.position, a.status, a.submit_time FROM applications a WHERE a.submit_time >= ? AND a.submit_time < ? ORDER BY a.submit_time DESC`,
      [start, end]
    )[0];
    const appHeader = ['申请编号', '类型', '工号', '姓名', '部门', '岗位', '状态', '提交时间'];
    const appBody: any[] = [appHeader.map(h => ({ text: h, bold: true, fillColor: '#EEF2FF', fontSize: 9 }))];
    if (appRows) {
      appRows.values.forEach(v => {
        appBody.push([
          v[0],
          v[1] === 'regular' ? '转正' : '调岗',
          v[2],
          v[3],
          v[4],
          v[5] || '',
          mapStatus(String(v[6])),
          v[7],
        ].map(c => ({ text: c, fontSize: 9 })));
      });
    }

    const fontPath = 'C:\\Windows\\Fonts\\simhei.ttf';
    const printer = new PdfPrinter({
      SimHei: {
        normal: fontPath,
        bold: fontPath,
        italics: fontPath,
        bolditalics: fontPath,
      },
    });

    const docDefinition: any = {
      defaultStyle: { font: 'SimHei', fontSize: 10 },
      pageSize: 'A4',
      pageMargins: [30, 30, 30, 30],
      content: [
        { text: `员工转正调岗审批月度报告 - ${titleMonth}`, fontSize: 20, bold: true, alignment: 'center', margin: [0, 0, 0, 20], color: '#1E3A5F' },
        { text: `生成时间：${new Date().toLocaleString('zh-CN')}`, fontSize: 9, color: '#666', alignment: 'right', margin: [0, 0, 0, 10] },
        { text: '一、核心指标', fontSize: 14, bold: true, margin: [0, 10, 0, 10], color: '#1E3A5F' },
        {
          table: {
            headerRows: 1,
            widths: ['*', '*', '*', '*', '*'],
            body: [
              [
                { text: '转正通过率', bold: true, fillColor: '#EEF2FF' },
                { text: '调岗成功率', bold: true, fillColor: '#EEF2FF' },
                { text: '平均处理时长(小时)', bold: true, fillColor: '#EEF2FF' },
                { text: '转正申请数', bold: true, fillColor: '#EEF2FF' },
                { text: '调岗申请数', bold: true, fillColor: '#EEF2FF' },
              ],
              [
                `${overview.regularPassRate}%`,
                `${overview.transferSuccessRate}%`,
                String(overview.avgProcessDuration),
                String(overview.regularCount),
                String(overview.transferCount),
              ],
            ],
          },
          margin: [0, 0, 0, 20],
          layout: 'lightHorizontalLines',
        },
        { text: '二、环比趋势（近12个月）', fontSize: 14, bold: true, margin: [0, 10, 0, 10], color: '#1E3A5F' },
        {
          table: {
            headerRows: 1,
            widths: ['*', '*', '*', '*', '*', '*'],
            body: trendBody,
          },
          layout: 'lightHorizontalLines',
          margin: [0, 0, 0, 20],
        },
        { text: '三、申请明细', fontSize: 14, bold: true, margin: [0, 10, 0, 10], color: '#1E3A5F' },
        {
          table: {
            headerRows: 1,
            widths: ['auto', 'auto', 'auto', 'auto', '*', 'auto', 'auto', 'auto'],
            body: appBody,
          },
          layout: 'lightHorizontalLines',
        },
      ],
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const chunks: any[] = [];
    pdfDoc.on('data', (chunk: any) => chunks.push(chunk));
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
