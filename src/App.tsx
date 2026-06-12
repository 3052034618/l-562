import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import ApplyRegular from "@/pages/ApplyRegular";
import ApplyTransfer from "@/pages/ApplyTransfer";
import ApprovalCenter from "@/pages/ApprovalCenter";
import EmployeePage from "@/pages/EmployeePage";
import Reports from "@/pages/Reports";
import QueryPage from "@/pages/QueryPage";
import LogsPage from "@/pages/LogsPage";
import { useAppStore } from "@/store/app";

export default function App() {
  const loadAll = useAppStore(s => s.loadAll);
  useEffect(() => {
    loadAll();
  }, [loadAll]);

  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/apply/regular" element={<ApplyRegular />} />
          <Route path="/apply/transfer" element={<ApplyTransfer />} />
          <Route path="/approval" element={<ApprovalCenter />} />
          <Route path="/employee" element={<EmployeePage />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/query" element={<QueryPage />} />
          <Route path="/logs" element={<LogsPage />} />
        </Route>
        <Route path="*" element={
          <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <div className="text-center">
              <div className="text-6xl font-bold text-slate-300 mb-2">404</div>
              <div className="text-slate-500">页面不存在</div>
              <a href="/" className="mt-4 inline-block btn-primary">返回首页</a>
            </div>
          </div>
        } />
      </Routes>
    </Router>
  );
}
