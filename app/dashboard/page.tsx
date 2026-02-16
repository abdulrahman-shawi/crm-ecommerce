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
      productId: number;
      productName: string;
      requiredQty: number;
      soldQty: number;
      remaining: number;
      reached: boolean;
    }>;
    error?: string;
  }>({ success: true, data: [] });

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

        {!loading && (!targetProgress.success || targetProgress.data.length === 0) && (
          <div className="text-sm text-slate-500">لا يوجد تاركت مضاف لهذا المستخدم.</div>
        )}

        {targetProgress.success && targetProgress.data.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="text-xs uppercase text-slate-500 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-2">المنتج</th>
                  <th className="py-3 px-2">المطلوب</th>
                  <th className="py-3 px-2">المباع</th>
                  <th className="py-3 px-2">المتبقي</th>
                  <th className="py-3 px-2">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {targetProgress.data.map((item) => (
                  <tr key={item.productId}>
                    <td className="py-3 px-2 font-semibold text-slate-700 dark:text-slate-200">{item.productName}</td>
                    <td className="py-3 px-2">{item.requiredQty}</td>
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
