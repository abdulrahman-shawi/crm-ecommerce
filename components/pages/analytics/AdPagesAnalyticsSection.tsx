'use client';

import * as React from 'react';
import { getAdPagesDashboardAnalytics } from '@/server/product';

type AdAnalyticsDashboardData = {
  summary: {
    configuredAdsCount: number;
    trackedAdsCount: number;
    totalViews: number;
    totalOrders: number;
    uniqueVisitors: number;
    viewsToday: number;
    viewsLast7Days: number;
  };
  warrantySummary: {
    replacementCount: number;
    replacementQuantity: number;
    maintenanceCount: number;
    maintenanceQuantity: number;
    damagedCount: number;
    damagedQuantity: number;
  };
  products: Array<{
    productId: number;
    productName: string;
    adUrl: string;
    totalViews: number;
    ordersCount: number;
    conversionRate: number;
    uniqueVisitors: number;
    viewsToday: number;
    viewsLast7Days: number;
    lastVisitedAt?: string | Date | null;
    replacementCount: number;
    replacementQuantity: number;
    maintenanceCount: number;
    maintenanceQuantity: number;
    damagedCount: number;
    damagedQuantity: number;
  }>;
};

function formatDateTime(value?: string | Date | null) {
  if (!value) return 'لا توجد زيارات بعد';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'لا توجد زيارات بعد';
  return parsed.toLocaleString('ar-EG');
}

export default function AdPagesAnalyticsSection({ isVisible }: { isVisible: boolean }) {
  const [adAnalytics, setAdAnalytics] = React.useState<AdAnalyticsDashboardData | null>(null);
  const [adAnalyticsLoading, setAdAnalyticsLoading] = React.useState(false);

  React.useEffect(() => {
    const loadAdAnalytics = async () => {
      if (!isVisible) {
        setAdAnalytics(null);
        return;
      }

      setAdAnalyticsLoading(true);
      const result = await getAdPagesDashboardAnalytics();
      if (result?.success) {
        setAdAnalytics(result.data as AdAnalyticsDashboardData);
      } else {
        setAdAnalytics(null);
      }
      setAdAnalyticsLoading(false);
    };

    loadAdAnalytics();
  }, [isVisible]);

  if (!isVisible) {
    return null;
  }

  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-white">تحليلات صفحات الإعلان</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">مشاهدات صفحات ad، الزوار الفريدون، الطلبات المرتبطة، وحالات التبديل والصيانة والتالف لكل منتج.</p>
        </div>
        {adAnalyticsLoading ? (
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">جاري التحميل...</div>
        ) : null}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="text-xs font-semibold text-slate-500">إجمالي المشاهدات</div>
          <div className="mt-1 text-2xl font-black text-blue-600">{Number(adAnalytics?.summary.totalViews || 0).toLocaleString()}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="text-xs font-semibold text-slate-500">طلبات صفحات الإعلان</div>
          <div className="mt-1 text-2xl font-black text-rose-600">{Number(adAnalytics?.summary.totalOrders || 0).toLocaleString()}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="text-xs font-semibold text-slate-500">الزوار الفريدون</div>
          <div className="mt-1 text-2xl font-black text-emerald-600">{Number(adAnalytics?.summary.uniqueVisitors || 0).toLocaleString()}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="text-xs font-semibold text-slate-500">مشاهدات اليوم</div>
          <div className="mt-1 text-2xl font-black text-amber-600">{Number(adAnalytics?.summary.viewsToday || 0).toLocaleString()}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="text-xs font-semibold text-slate-500">إعلانات مفعلة / متتبعة</div>
          <div className="mt-1 text-2xl font-black text-violet-600">
            {Number(adAnalytics?.summary.trackedAdsCount || 0).toLocaleString()} / {Number(adAnalytics?.summary.configuredAdsCount || 0).toLocaleString()}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="text-xs font-semibold text-slate-500">التبديل</div>
          <div className="mt-1 text-2xl font-black text-amber-600">{Number(adAnalytics?.warrantySummary.replacementCount || 0).toLocaleString()}</div>
          <div className="mt-1 text-xs text-slate-500">الكمية: {Number(adAnalytics?.warrantySummary.replacementQuantity || 0).toLocaleString()}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="text-xs font-semibold text-slate-500">الصيانة</div>
          <div className="mt-1 text-2xl font-black text-sky-600">{Number(adAnalytics?.warrantySummary.maintenanceCount || 0).toLocaleString()}</div>
          <div className="mt-1 text-xs text-slate-500">الكمية: {Number(adAnalytics?.warrantySummary.maintenanceQuantity || 0).toLocaleString()}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="text-xs font-semibold text-slate-500">التالف</div>
          <div className="mt-1 text-2xl font-black text-rose-600">{Number(adAnalytics?.warrantySummary.damagedCount || 0).toLocaleString()}</div>
          <div className="mt-1 text-xs text-slate-500">الكمية: {Number(adAnalytics?.warrantySummary.damagedQuantity || 0).toLocaleString()}</div>
        </div>
      </div>

      {!adAnalytics || adAnalytics.products.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm font-semibold text-slate-500 dark:border-slate-700 dark:text-slate-400">
          لا توجد بيانات زيارات لصفحات الإعلان حتى الآن. بعد تنفيذ الهجرة الخاصة بالجدول وبدء الزيارات ستظهر الإحصاءات هنا.
        </div>
      ) : (
        <>
          <div className="mt-4 overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <table className="w-full min-w-[1320px] text-right text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                <tr>
                  <th className="px-3 py-3">المنتج</th>
                  <th className="px-3 py-3">الرابط</th>
                  <th className="px-3 py-3">المشاهدات</th>
                  <th className="px-3 py-3">الطلبات المرتبطة</th>
                  <th className="px-3 py-3">نسبة التحويل</th>
                  <th className="px-3 py-3">الزوار</th>
                  <th className="px-3 py-3">اليوم</th>
                  <th className="px-3 py-3">آخر 7 أيام</th>
                  <th className="px-3 py-3">تبديل</th>
                  <th className="px-3 py-3">صيانة</th>
                  <th className="px-3 py-3">تالف</th>
                  <th className="px-3 py-3">آخر زيارة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {adAnalytics.products.map((product) => (
                  <tr key={product.productId} className="odd:bg-white even:bg-slate-50/40 dark:odd:bg-slate-950 dark:even:bg-slate-900/30">
                    <td className="px-3 py-3 font-semibold text-slate-700 dark:text-slate-200">{product.productName}</td>
                    <td className="px-3 py-3">
                      <a
                        href={product.adUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="block max-w-[280px] break-all text-blue-600 hover:underline"
                      >
                        {product.adUrl}
                      </a>
                    </td>
                    <td className="px-3 py-3 font-bold text-blue-600">{Number(product.totalViews || 0).toLocaleString()}</td>
                    <td className="px-3 py-3 font-bold text-rose-600">{Number(product.ordersCount || 0).toLocaleString()}</td>
                    <td className="px-3 py-3 font-bold text-violet-600">{Number(product.conversionRate || 0).toFixed(2)}%</td>
                    <td className="px-3 py-3 font-bold text-emerald-600">{Number(product.uniqueVisitors || 0).toLocaleString()}</td>
                    <td className="px-3 py-3">{Number(product.viewsToday || 0).toLocaleString()}</td>
                    <td className="px-3 py-3">{Number(product.viewsLast7Days || 0).toLocaleString()}</td>
                    <td className="px-3 py-3 text-amber-600 font-bold">{Number(product.replacementCount || 0).toLocaleString()} / {Number(product.replacementQuantity || 0).toLocaleString()}</td>
                    <td className="px-3 py-3 text-sky-600 font-bold">{Number(product.maintenanceCount || 0).toLocaleString()} / {Number(product.maintenanceQuantity || 0).toLocaleString()}</td>
                    <td className="px-3 py-3 text-rose-600 font-bold">{Number(product.damagedCount || 0).toLocaleString()} / {Number(product.damagedQuantity || 0).toLocaleString()}</td>
                    <td className="px-3 py-3 text-xs text-slate-500">{formatDateTime(product.lastVisitedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}