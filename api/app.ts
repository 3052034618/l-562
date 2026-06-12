/**
 * Employee HR Approval System API
 */

import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { initDb } from './db.js'
import cron from 'node-cron'
import { calcWaitHours, pushNotification, logOperation, rowToObj, fixApprovalFlowForPendingApplications } from './services.js'
import { getDb, saveDbToDisk } from './db.js'

import authRoutes from './routes/auth.js'
import applicationRoutes from './routes/applications.js'
import approvalRoutes from './routes/approvals.js'
import employeeRoutes from './routes/employees.js'
import reportRoutes, { generateMonthlyReport } from './routes/reports.js'
import logRoutes from './routes/logs.js'
import queryRoutes from './routes/query.js'
import notificationRoutes from './routes/notifications.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config()

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

;(async () => {
  await initDb()
  console.log('Database initialized')
  try {
    const n = await fixApprovalFlowForPendingApplications()
    if (n > 0) console.log(`[${new Date().toISOString()}] Fixed approval flow for ${n} pending application(s)`)
  } catch (e) {
    console.error('Fix approval flow error:', e)
  }
})()

/**
 * API Routes
 */
app.use('/api/auth', authRoutes)
app.use('/api/applications', applicationRoutes)
app.use('/api/approvals', approvalRoutes)
app.use('/api/employees', employeeRoutes)
app.use('/api/reports', reportRoutes)
app.use('/api/logs', logRoutes)
app.use('/api/query', queryRoutes)
app.use('/api/notifications', notificationRoutes)

/**
 * health
 */
app.use(
  '/api/health',
  (req: Request, res: Response, next: NextFunction): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
      time: new Date().toISOString(),
    })
  },
)

/**
 * error handler middleware
 */
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(error)
  res.status(500).json({
    success: false,
    error: 'Server internal error: ' + error.message,
  })
})

/**
 * 404 handler
 */
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

cron.schedule('0 * * * *', async () => {
  try {
    const db = await getDb()
    const rows = db.exec(`SELECT ar.*, a.employee_name, a.type, a.id as app_id FROM approval_records ar JOIN applications a ON a.id = ar.application_id WHERE ar.status = 'pending' AND ar.escalated = 0`)[0]
    if (!rows) return
    const updates: any[] = []
    rows.values.forEach(v => {
      const o = rowToObj(rows.columns, v)
      const wh = calcWaitHours(o.createdAt)
      if (wh >= 48) updates.push(o)
    })
    for (const step of updates) {
      const appRows = db.exec('SELECT * FROM employees WHERE id = ?', [step.approverId])[0]
      if (!appRows) continue
      const approver = rowToObj(appRows.columns, appRows.values[0])
      if (!approver.supervisorId) continue
      const upRows = db.exec('SELECT * FROM employees WHERE id = ?', [approver.supervisorId])[0]
      if (!upRows) continue
      const upper = rowToObj(upRows.columns, upRows.values[0])

      db.run(`UPDATE approval_records SET status = 'delegated', escalated = 1, processed_at = datetime('now') WHERE id = ?`, [step.id])
      db.run(`UPDATE applications SET status = 'escalated', updated_at = datetime('now') WHERE id = ?`, [step.appId])
      db.run(`INSERT INTO approval_records (id, application_id, approver_id, approver_name, approver_role, step, total_steps, status, created_at, escalated) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'), 1)`,
        [crypto.randomUUID(), step.appId, upper.id, upper.name, '升级审批（超时自动）', step.step, step.totalSteps])

      await logOperation(null, 'system', '审批超时升级（定时任务）', step.appId, `从${approver.name}升级至${upper.name}，已等待${calcWaitHours(step.createdAt)}小时`, 'exception')
      await pushNotification(upper.id, '审批超时自动升级', `${step.employeeName}的${step.type === 'regular' ? '转正' : '调岗'}申请超时未处理，已升级至您审批，请尽快处理`, 'escalation')
      await pushNotification(step.approverId, '审批超时警告', `您的待办审批（${step.appId}）已超时48小时，系统已自动升级至您的上级主管`, 'exception')
    }
    if (updates.length) {
      await saveDbToDisk()
      console.log(`[${new Date().toISOString()}] Escalated ${updates.length} approval(s)`)
    }
  } catch (e) {
    console.error('Cron escalation error:', e)
  }
})

cron.schedule('0 2 1 * *', async () => {
  try {
    const result = await generateMonthlyReport()
    console.log(`[${new Date().toISOString()}] Monthly report auto-generated: ${result.month}`)
  } catch (e) {
    console.error('Cron monthly report error:', e)
  }
})

process.on('beforeExit', async () => {
  await saveDbToDisk()
})

export default app
