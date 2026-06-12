import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db: Database | null = null;
let SQL: SqlJsStatic | null = null;
const DB_PATH = path.join(__dirname, '..', 'data.db');

function createTables(dbInstance: Database) {
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      department TEXT NOT NULL,
      position TEXT NOT NULL,
      level TEXT NOT NULL CHECK(level IN ('staff', 'supervisor', 'manager', 'director')),
      salary_grade TEXT NOT NULL,
      supervisor_id TEXT,
      supervisor_name TEXT,
      hire_date TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('probation', 'regular', 'transferred')),
      permissions TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS applications (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK(type IN ('regular', 'transfer')),
      employee_id TEXT NOT NULL REFERENCES employees(id),
      employee_name TEXT NOT NULL,
      department TEXT NOT NULL,
      position TEXT NOT NULL,
      level TEXT NOT NULL,
      target_department TEXT,
      target_position TEXT,
      status TEXT NOT NULL DEFAULT 'pending_check',
      submit_time TEXT DEFAULT (datetime('now')),
      reason TEXT,
      attachments TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS check_results (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
      item TEXT NOT NULL,
      label TEXT NOT NULL,
      passed INTEGER NOT NULL DEFAULT 0,
      detail TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS approval_records (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL REFERENCES applications(id),
      approver_id TEXT NOT NULL REFERENCES employees(id),
      approver_name TEXT NOT NULL,
      approver_role TEXT NOT NULL,
      step INTEGER NOT NULL DEFAULT 1,
      total_steps INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'pending',
      comment TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      processed_at TEXT,
      escalated INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS operation_logs (
      id TEXT PRIMARY KEY,
      operator_id TEXT,
      operator_name TEXT,
      action TEXT NOT NULL,
      target TEXT,
      detail TEXT,
      timestamp TEXT DEFAULT (datetime('now')),
      type TEXT NOT NULL DEFAULT 'operation'
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES employees(id),
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('approval', 'escalation', 'system', 'exception', 'info')),
      read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS monthly_reports (
      id TEXT PRIMARY KEY,
      month TEXT NOT NULL UNIQUE,
      regular_pass_rate REAL NOT NULL DEFAULT 0,
      transfer_success_rate REAL NOT NULL DEFAULT 0,
      avg_process_duration REAL NOT NULL DEFAULT 0,
      regular_count INTEGER NOT NULL DEFAULT 0,
      transfer_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_applications_employee ON applications(employee_id);
    CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
    CREATE INDEX IF NOT EXISTS idx_applications_type ON applications(type);
    CREATE INDEX IF NOT EXISTS idx_approval_records_application ON approval_records(application_id);
    CREATE INDEX IF NOT EXISTS idx_approval_records_approver ON approval_records(approver_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
    CREATE INDEX IF NOT EXISTS idx_operation_logs_type ON operation_logs(type);
    CREATE INDEX IF NOT EXISTS idx_operation_logs_timestamp ON operation_logs(timestamp);
  `);
}

function seedData(dbInstance: Database) {
  const count = dbInstance.exec('SELECT COUNT(*) as cnt FROM employees')[0].values[0][0] as number;
  if (count > 0) return;

  const employees = [
    ['E001', '张伟', '技术部', '高级开发工程师', 'staff', 'P3', 'E005', '李明', '2025-12-01', 'probation'],
    ['E002', '王芳', '市场部', '市场专员', 'staff', 'P2', 'E006', '赵倩', '2025-10-15', 'probation'],
    ['E003', '刘洋', '技术部', '前端开发工程师', 'staff', 'P2', 'E005', '李明', '2025-11-20', 'probation'],
    ['E004', '陈静', '人力资源部', 'HR专员', 'staff', 'P3', 'E008', '周涛', '2025-09-01', 'regular'],
    ['E005', '李明', '技术部', '技术主管', 'supervisor', 'M1', 'E007', '王强', '2023-06-15', 'regular'],
    ['E006', '赵倩', '市场部', '市场主管', 'supervisor', 'M1', 'E009', '孙丽', '2023-08-20', 'regular'],
    ['E007', '王强', '技术部', '技术总监', 'manager', 'M2', 'E010', '王董', '2022-03-01', 'regular'],
    ['E008', '周涛', '人力资源部', 'HR经理', 'manager', 'M2', 'E010', '王董', '2022-05-10', 'regular'],
    ['E009', '孙丽', '市场部', '市场总监', 'manager', 'M2', 'E010', '王董', '2022-07-15', 'regular'],
    ['E010', '王董', '董事会', '董事长', 'director', 'M3', null, null, '2020-01-01', 'regular'],
    ['E011', '黄丽', '市场部', '市场助理', 'staff', 'P1', 'E006', '赵倩', '2025-10-01', 'probation'],
    ['E012', '周凯', '技术部', '测试工程师', 'staff', 'P2', 'E005', '李明', '2025-09-01', 'regular'],
  ];

  for (const emp of employees) {
    const perms = emp[4] === 'staff'
      ? JSON.stringify(['apply:view', 'apply:create'])
      : emp[4] === 'supervisor'
        ? JSON.stringify(['apply:view', 'apply:create', 'approval:staff', 'employee:view'])
        : emp[4] === 'manager'
          ? JSON.stringify(['apply:view', 'apply:create', 'approval:staff', 'approval:manager', 'employee:view', 'employee:edit', 'report:view'])
          : JSON.stringify(['*']);
    dbInstance.run(
      'INSERT INTO employees (id, name, department, position, level, salary_grade, supervisor_id, supervisor_name, hire_date, status, permissions) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [...emp, perms]
    );
  }

  const seedApps = [
    {
      id: 'APP001',
      type: 'regular',
      employeeId: 'E001',
      employeeName: '张伟',
      department: '技术部',
      position: '高级开发工程师',
      level: 'staff',
      reason: '试用期表现优秀，申请转正',
      submitTime: '2026-06-10 09:30:00',
      status: 'pending_approval',
      checks: [
        ['performance', '绩效达标', 1, '近3个月绩效评级均为B及以上'],
        ['training', '培训完成', 1, '已完成新员工入职培训、岗位技能培训'],
        ['evaluation', '主管评价', 1, '主管评价：工作认真负责，技术能力突出'],
        ['skill_match', '技能匹配度', 1, '核心技能匹配度90%，符合岗位要求'],
        ['headcount', '部门编制', 1, '技术部编制充足，当前空缺1人'],
      ],
      approvals: [
        { approverId: 'E005', approverName: '李明', approverRole: '直属主管', step: 1, total: 1, status: 'pending', createdAt: '2026-06-10 09:30:00' },
      ],
    },
    {
      id: 'APP002',
      type: 'regular',
      employeeId: 'E002',
      employeeName: '王芳',
      department: '市场部',
      position: '市场专员',
      level: 'staff',
      reason: '试用期已满，申请转正',
      submitTime: '2026-06-08 14:20:00',
      status: 'escalated',
      checks: [
        ['performance', '绩效达标', 1, '近3个月绩效评级均为B及以上'],
        ['training', '培训完成', 1, '已完成所有必修培训课程'],
        ['evaluation', '主管评价', 1, '主管评价：沟通能力强，积极主动'],
        ['skill_match', '技能匹配度', 1, '技能匹配度85%'],
        ['headcount', '部门编制', 1, '市场部编制充足'],
      ],
      approvals: [
        { approverId: 'E006', approverName: '赵倩', approverRole: '直属主管', step: 1, total: 1, status: 'pending', createdAt: '2026-06-08 14:20:00', escalated: 1 },
      ],
    },
    {
      id: 'APP003',
      type: 'transfer',
      employeeId: 'E012',
      employeeName: '周凯',
      department: '技术部',
      position: '测试工程师',
      level: 'staff',
      targetDepartment: '技术部',
      targetPosition: '高级开发工程师',
      reason: '希望转岗从事开发工作，已自学相关技能',
      submitTime: '2026-06-09 11:00:00',
      status: 'check_failed',
      checks: [
        ['performance', '绩效达标', 1, '近3个月绩效评级B+'],
        ['training', '培训完成', 1, '已完成开发技能认证培训'],
        ['evaluation', '主管评价', 1, '主管评价：学习能力强，有开发潜力'],
        ['skill_match', '技能匹配度', 0, '核心开发技能匹配度60%，低于要求的80%'],
        ['headcount', '部门编制', 1, '目标岗位有空缺'],
      ],
      approvals: [],
    },
    {
      id: 'APP004',
      type: 'transfer',
      employeeId: 'E004',
      employeeName: '陈静',
      department: '人力资源部',
      position: 'HR专员',
      level: 'staff',
      targetDepartment: '市场部',
      targetPosition: '市场主管',
      reason: '个人职业发展规划，申请调岗到市场部',
      submitTime: '2026-06-01 10:00:00',
      status: 'pending_approval',
      checks: [
        ['performance', '绩效达标', 1, '近3个月绩效A-'],
        ['training', '培训完成', 1, '已完成市场管理相关培训'],
        ['evaluation', '主管评价', 1, '主管评价：综合能力优秀，具备管理潜力'],
        ['skill_match', '技能匹配度', 1, '管理及市场技能匹配度88%'],
        ['headcount', '部门编制', 1, '市场主管岗位有空缺'],
      ],
      approvals: [
        { approverId: 'E008', approverName: '周涛', approverRole: '原部门经理', step: 1, total: 2, status: 'approved', createdAt: '2026-06-01 10:00:00', processedAt: '2026-06-02 09:00:00', comment: '同意调出' },
        { approverId: 'E009', approverName: '孙丽', approverRole: 'HR总监+市场总监', step: 2, total: 2, status: 'pending', createdAt: '2026-06-02 09:00:00' },
      ],
    },
  ];

  for (const app of seedApps) {
    dbInstance.run(
      `INSERT INTO applications (id, type, employee_id, employee_name, department, position, level, target_department, target_position, status, submit_time, reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [app.id, app.type, app.employeeId, app.employeeName, app.department, app.position, app.level, app.targetDepartment || null, app.targetPosition || null, app.status, app.submitTime, app.reason]
    );
    for (const c of app.checks) {
      dbInstance.run(
        'INSERT INTO check_results (id, application_id, item, label, passed, detail) VALUES (?, ?, ?, ?, ?, ?)',
        [crypto.randomUUID(), app.id, c[0], c[1], c[2], c[3]]
      );
    }
    for (const a of app.approvals) {
      const anyA = a as any;
      dbInstance.run(
        'INSERT INTO approval_records (id, application_id, approver_id, approver_name, approver_role, step, total_steps, status, comment, created_at, processed_at, escalated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [crypto.randomUUID(), app.id, anyA.approverId, anyA.approverName, anyA.approverRole, anyA.step, anyA.total, anyA.status, anyA.comment || null, anyA.createdAt, anyA.processedAt || null, anyA.escalated ? 1 : 0]
      );
    }
  }

  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const notifications = [
    ['E005', '新的转正申请待审批', '张伟的转正申请已提交，请及时审批', 'approval'],
    ['E009', '跨部门调岗申请待审批', '陈静的调岗申请待审批（HR经理已通过）', 'approval'],
    ['E006', '审批超时升级提醒', '王芳的转正申请已超过48小时未处理，已升级至上级', 'escalation'],
    ['E007', '审批升级通知', '您有一项升级审批待处理：王芳的转正申请', 'escalation'],
    ['E003', '资格校验不通过', '您的调岗申请因技能匹配度不足被退回，请补充相关认证', 'exception'],
  ];
  for (const n of notifications) {
    dbInstance.run(
      'INSERT INTO notifications (id, user_id, title, content, type, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [crypto.randomUUID(), ...n, now]
    );
  }

  const logs = [
    [null, 'system', '申请提交', 'APP001', '张伟提交转正申请', '2026-06-10 09:30:00', 'operation'],
    [null, 'system', '自动校验', 'APP001', '五项校验全部通过', '2026-06-10 09:30:01', 'operation'],
    [null, 'system', '分配审批流程', 'APP001', '主管级以下：单级审批（李明）', '2026-06-10 09:30:02', 'operation'],
    [null, 'system', '申请提交', 'APP003', '周凯提交调岗申请', '2026-06-09 11:00:00', 'operation'],
    [null, 'system', '资格校验不通过', 'APP003', '技能匹配度60%低于80%要求', '2026-06-09 11:00:01', 'exception'],
    [null, 'system', '审批超时升级', 'APP002', '超过48小时未处理，已升级至王强', '2026-06-11 00:00:00', 'exception'],
  ];
  for (const l of logs) {
    dbInstance.run(
      'INSERT INTO operation_logs (id, operator_id, operator_name, action, target, detail, timestamp, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [crypto.randomUUID(), ...l]
    );
  }
}

async function saveDbToDisk() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, buffer);
}

async function locateWasm(): Promise<string | undefined> {
  const candidates = [
    path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
    path.join(__dirname, '..', '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
    path.resolve(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

export async function initDb() {
  if (db) return db;
  const wasmPath = await locateWasm();
  SQL = await (wasmPath
    ? initSqlJs({ locateFile: () => wasmPath })
    : initSqlJs());
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }
  createTables(db);
  seedData(db);
  await saveDbToDisk();
  return db;
}

export async function getDb() {
  if (!db) await initDb();
  return db!;
}

export { saveDbToDisk };

setInterval(() => {
  saveDbToDisk().catch(() => {});
}, 5000);
