import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FilePlus2,
  ClipboardCheck,
  Users,
  BarChart3,
  Search,
  FileText,
  Bell,
  ChevronDown,
  UserCircle2,
  BadgeCheck,
  UserMinus,
} from 'lucide-react';
import { useAppStore, CURRENT_USER_NAME } from '@/store/app';
import { useEffect, useState } from 'react';

const MENU = [
  { to: '/', label: '工作台', icon: LayoutDashboard, end: true },
  { to: '/apply/regular', label: '转正申请', icon: BadgeCheck },
  { to: '/apply/transfer', label: '调岗申请', icon: UserMinus },
  { to: '/approval', label: '审批中心', icon: ClipboardCheck },
  { to: '/employee', label: '员工档案', icon: Users },
  { to: '/reports', label: '统计报表', icon: BarChart3 },
  { to: '/query', label: '查询导出', icon: Search },
  { to: '/logs', label: '系统日志', icon: FileText },
];

export default function Layout() {
  const { currentUser, unreadCount, readAll } = useAppStore();
  const location = useLocation();
  const [showNotif, setShowNotif] = useState(false);
  const { notifications } = useAppStore();

  useEffect(() => {
    setShowNotif(false);
  }, [location.pathname]);

  const pageTitle = (MENU.find(m => location.pathname.startsWith(m.to) && !(m.end && location.pathname !== m.to)) || MENU[0]).label;

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 bg-gradient-to-b from-brand-700 via-brand-800 to-brand-900 text-white flex flex-col">
        <div className="h-16 px-6 flex items-center gap-3 border-b border-white/10">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center shadow-lg shadow-brand-500/30">
            <FilePlus2 size={18} />
          </div>
          <div>
            <div className="text-sm font-bold tracking-wide">人事审批中心</div>
            <div className="text-[10px] text-slate-400">HR Approval System</div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {MENU.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => isActive ? 'sidebar-item-active' : 'sidebar-item'}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-white/10 text-[11px] text-slate-400 text-center">
          v1.0.0 · 审批自动升级
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-100 px-6 flex items-center justify-between shrink-0">
          <div>
            <div className="text-xs text-slate-400">首页 / {pageTitle}</div>
            <div className="text-lg font-bold text-slate-800 mt-0.5">{pageTitle}</div>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <button
                onClick={() => setShowNotif(v => !v)}
                className="relative w-10 h-10 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors"
              >
                <Bell size={20} className="text-slate-600" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-accent-danger text-white text-[10px] font-bold flex items-center justify-center animate-pulse-soft">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
              {showNotif && (
                <div className="absolute right-0 top-12 w-96 max-h-[480px] overflow-y-auto bg-white rounded-xl shadow-cardHover border border-slate-100 z-50 animate-fade-in">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 sticky top-0 bg-white">
                    <div className="font-semibold text-slate-800">通知中心</div>
                    <button onClick={() => readAll()} className="text-xs text-brand-600 hover:underline">全部已读</button>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {notifications.length === 0 && (
                      <div className="py-12 text-center text-slate-400 text-sm">暂无通知</div>
                    )}
                    {notifications.map(n => (
                      <div key={n.id} className={`px-4 py-3 hover:bg-slate-50 cursor-pointer ${!n.read ? 'bg-brand-50/50' : ''}`}>
                        <div className="flex items-start gap-3">
                          <div className="w-2 h-2 mt-2 rounded-full bg-brand-500 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-slate-800 flex items-center justify-between">
                              <span className="truncate">{n.title}</span>
                              {!n.read && <span className="chip bg-brand-100 text-brand-700">未读</span>}
                            </div>
                            <div className="text-xs text-slate-500 mt-1 line-clamp-2">{n.content}</div>
                            <div className="text-[11px] text-slate-400 mt-1">{new Date(n.createdAt.replace(' ', 'T')).toLocaleString('zh-CN', { hour12: false })}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 pl-4 border-l border-slate-100">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white font-semibold">
                {(currentUser?.name || CURRENT_USER_NAME).slice(0, 1)}
              </div>
              <div className="hidden md:block">
                <div className="text-sm font-medium text-slate-800">{currentUser?.name || CURRENT_USER_NAME}</div>
                <div className="text-xs text-slate-400">{currentUser?.position || '技术总监'}</div>
              </div>
              <ChevronDown size={16} className="text-slate-400" />
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
