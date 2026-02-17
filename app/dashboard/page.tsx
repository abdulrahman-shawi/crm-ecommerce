"use client";

import * as React from 'react';
import { useAuth } from '@/context/AuthContext';
import { GetUserTargetProgress } from '@/server/analytics';

const DashboardPage: React.FunctionComponent = () => {
  const { user } = useAuth();
  const [loading, setLoading] = React.useState(false);
  const [targetProgress, setTargetProgress] = React.useState<{
    success: boolean;
    data: Array<{
      userId?: string;
      userName?: string;
      targetCreatedAt?: string | Date;
      productId: number;
      productName: string;
      requiredQty: number;
      rewardValue?: number;
      soldQty: number;
      remaining: number;
      reached: boolean;
    }>;
    error?: string;
  }>({ success: true, data: [] });

  const [selectedMonth, setSelectedMonth] = React.useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const monthKey = (value?: string | Date) => {
    if (!value) return "unknown";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "unknown";
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  };

  const monthLabel = (value?: string | Date) => {
    if (!value) return "غير محدد";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "غير محدد";
    return new Intl.DateTimeFormat('ar-EG', { month: 'long', year: 'numeric' }).format(date);
  };

  const getDaysLeftInMonth = (key: string) => {
    if (key === "all" || key === "unknown") return null;
    const [yearStr, monthStr] = key.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr);
    if (!year || !month) return null;
    const lastDay = new Date(year, month, 0);
    const today = new Date();
    const endOfDay = new Date(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate(), 23, 59, 59, 999);
    const diffMs = endOfDay.getTime() - today.getTime();
    return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  };

  const monthOptions = React.useMemo(() => {
    const now = new Date();
    const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;
    const allowed = new Set([currentKey, previousKey]);

    const keys = new Map<string, string>();
    targetProgress.data.forEach((item) => {
      const key = monthKey(item.targetCreatedAt);
      if (allowed.has(key) && !keys.has(key)) {
        keys.set(key, monthLabel(item.targetCreatedAt));
      }
    });

    const entries = Array.from(keys.entries());
    entries.sort(([a], [b]) => a.localeCompare(b));
    return entries;
  }, [targetProgress.data]);

  const filteredTargets = React.useMemo(() => {
    return targetProgress.data.filter((item) => monthKey(item.targetCreatedAt) === selectedMonth);
  }, [selectedMonth, targetProgress.data]);

  React.useEffect(() => {
    const fetchTargetProgress = async () => {
      if (!user?.id) return;
      setLoading(true);
      try {
        const res = await GetUserTargetProgress(user.id);
        setTargetProgress(res as any);
      } catch (error) {
        console.error("Error fetching target progress:", error);
        setTargetProgress({ success: false, data: [], error: "Internal Error" });
      } finally {
        setLoading(false);
      }
    };

    fetchTargetProgress();
  }, [user?.id]);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">لوحة التحكم</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">متابعة التاركت حسب المنتج</p>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white">تقدم التاركت</h2>
          {loading && <span className="text-xs text-slate-500">جاري التحميل...</span>}
        </div>

        {!loading && (!targetProgress.success || filteredTargets.length === 0) && (
          <div className="text-sm text-slate-500">لا يوجد تاركت مضاف لهذا المستخدم.</div>
        )}

        {targetProgress.success && targetProgress.data.length > 0 && (
          <div className="overflow-x-auto">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {monthOptions.map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setSelectedMonth(key)}
                  className={`rounded-full px-3 py-1 text-xs font-bold ${selectedMonth === key
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}
                >
                  {label}
                </button>
              ))}
              <span className="text-xs text-slate-500">
                باقي {getDaysLeftInMonth(selectedMonth)} يوم لنهاية الشهر
              </span>
            </div>
            <table className="w-full text-right text-sm">
              <thead className="text-xs uppercase text-slate-500 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  {user?.accountType === "ADMIN" && <th className="py-3 px-2">الموظف</th>}
                  <th className="py-3 px-2">المنتج</th>
                  <th className="py-3 px-2">المطلوب</th>
                  <th className="py-3 px-2">المكافأة</th>
                  <th className="py-3 px-2">المباع</th>
                  <th className="py-3 px-2">المتبقي</th>
                  <th className="py-3 px-2">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredTargets.map((item) => (
                  <tr key={`${item.userId || "me"}-${item.productId}`}>
                    {user?.accountType === "ADMIN" && (
                      <td className="py-3 px-2 font-semibold text-slate-700 dark:text-slate-200">
                        {item.userName || "-"}
                      </td>
                    )}
                    <td className="py-3 px-2 font-semibold text-slate-700 dark:text-slate-200">{item.productName}</td>
                    <td className="py-3 px-2">{item.requiredQty}</td>
                    <td className="py-3 px-2">{item.rewardValue ?? 0}</td>
                    <td className="py-3 px-2">{item.soldQty}</td>
                    <td className="py-3 px-2">{item.remaining}</td>
                    <td className="py-3 px-2">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-bold ${item.reached
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"}`}
                      >
                        {item.reached ? "تم الوصول" : "لم يكتمل"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;
