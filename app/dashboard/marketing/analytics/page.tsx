"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useAuth } from "@/context/AuthContext";
import { hasAnyPermission } from "@/lib/utils";
import { getCampaigns, getMarketingAnalytics } from "@/server/marketing";
import { DataTable } from "@/components/shared/DataTable";
import { BarChart2, TrendingUp, Users, MousePointer, Mail, CheckCircle } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "#94a3b8",
  SCHEDULED: "#f59e0b",
  RUNNING: "#3b82f6",
  COMPLETED: "#10b981",
  CANCELLED: "#f43f5e",
};

const TYPE_COLORS: Record<string, string> = {
  EMAIL: "#3b82f6",
  SOCIAL: "#8b5cf6",
  SMS: "#f59e0b",
  CONTENT: "#10b981",
  WHATSAPP: "#25d366",
};

type MetricTotals = {
  total: number;
  sent: number;
  opened: number;
  clicked: number;
  converted: number;
};

type CampaignMetrics = {
  sent: number;
  opened: number;
  clicked: number;
  converted: number;
  total?: number;
};

type AnalyticsData = {
  totals: MetricTotals;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  topCampaigns: Array<{ id: number; title: string; type: string; status: string; metrics: CampaignMetrics }>;
};

export default function MarketingAnalyticsPage() {
  const { user } = useAuth();
  const [data, setData] = React.useState<AnalyticsData | null>(null);
  const [campaigns, setCampaigns] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const canView = React.useMemo(() => {
    if (!user) return false;
    return hasAnyPermission(user, ["viewMarketing", "addMarketing", "editMarketing", "deleteMarketing"]);
  }, [user]);

  React.useEffect(() => {
    if (!canView) {
      setIsLoading(false);
      return;
    }

    const load = async () => {
      setIsLoading(true);
      try {
        const [analyticsResponse, campaignsResponse] = await Promise.all([
          getMarketingAnalytics(),
          getCampaigns(),
        ]);

        if (!analyticsResponse.success) {
          toast.error(analyticsResponse.error || "تعذر تحميل التحليلات");
        } else {
          setData(analyticsResponse.data as AnalyticsData);
        }

        if (campaignsResponse.success) {
          setCampaigns(Array.isArray(campaignsResponse.data) ? campaignsResponse.data : []);
        }
      } catch (error) {
        console.error("Load marketing analytics error:", error);
        toast.error("حدث خطأ أثناء تحميل التحليلات");
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [canView]);

  if (!canView) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-lg font-black text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
        لا تملك صلاحية الوصول إلى تحليلات التسويق
      </div>
    );
  }

  const typeChartData = data
    ? Object.entries(data.byType).map(([name, value]) => ({ name: translateType(name), value, color: TYPE_COLORS[name] || "#64748b" }))
    : [];

  const statusChartData = data
    ? Object.entries(data.byStatus).map(([name, value]) => ({ name: translateStatus(name), value, color: STATUS_COLORS[name] || "#64748b" }))
    : [];

  const funnelData = data
    ? [
        { name: "إرسال", value: data.totals.sent },
        { name: "فتح", value: data.totals.opened },
        { name: "نقر", value: data.totals.clicked },
        { name: "تحويل", value: data.totals.converted },
      ]
    : [];

  const topCampaignsWithTitles = React.useMemo(() => {
    if (!data) return [];
    return data.topCampaigns.map((campaign) => {
      const full = campaigns.find((c) => c.id === campaign.id);
      return {
        ...campaign,
        title: full?.title || `حملة #${campaign.id}`,
      };
    });
  }, [data, campaigns]);

  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">تحليلات التسويق</h1>
        <p className="mt-2 text-sm font-bold text-slate-500 dark:text-slate-400">
          ملخص أداء الحملات التسويقية والقنوات.
        </p>
      </div>

      {isLoading ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center dark:border-slate-800 dark:bg-slate-950">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      ) : !data ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-lg font-black text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
          لا توجد بيانات متاحة
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <MetricCard icon={<Mail size={20} />} label="إجمالي الحملات" value={data.totals.total} color="bg-blue-100 text-blue-700" />
            <MetricCard icon={<Users size={20} />} label="إجمالي الإرسال" value={data.totals.sent} color="bg-slate-100 text-slate-700" />
            <MetricCard icon={<CheckCircle size={20} />} label="إجمالي الفتح" value={data.totals.opened} color="bg-emerald-100 text-emerald-700" />
            <MetricCard icon={<MousePointer size={20} />} label="إجمالي النقر" value={data.totals.clicked} color="bg-amber-100 text-amber-700" />
            <MetricCard icon={<TrendingUp size={20} />} label="إجمالي التحويل" value={data.totals.converted} color="bg-rose-100 text-rose-700" />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
              <h2 className="mb-4 text-lg font-black text-slate-900 dark:text-white">توزيع الحملات حسب القناة</h2>
              <div className="h-72">
                <ClientOnlyChart>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={typeChartData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label
                      >
                        {typeChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </ClientOnlyChart>
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
              <h2 className="mb-4 text-lg font-black text-slate-900 dark:text-white">توزيع الحملات حسب الحالة</h2>
              <div className="h-72">
                <ClientOnlyChart>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusChartData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label
                      >
                        {statusChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </ClientOnlyChart>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
            <h2 className="mb-4 text-lg font-black text-slate-900 dark:text-white">قمع التحويلات</h2>
            <div className="h-80">
              <ClientOnlyChart>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={funnelData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ClientOnlyChart>
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
            <h2 className="mb-4 text-lg font-black text-slate-900 dark:text-white">أفضل الحملات أداءً</h2>
            <DataTable
              data={topCampaignsWithTitles}
              columns={[
                { header: "الحملة", accessor: (item: any) => <span className="font-bold">{item.title}</span> },
                { header: "القناة", accessor: (item: any) => translateType(item.type) },
                { header: "الحالة", accessor: (item: any) => translateStatus(item.status) },
                { header: "إرسال", accessor: (item: any) => item.metrics.sent },
                { header: "فتح", accessor: (item: any) => item.metrics.opened },
                { header: "نقر", accessor: (item: any) => item.metrics.clicked },
                { header: "تحويل", accessor: (item: any) => <span className="font-black text-blue-600">{item.metrics.converted}</span> },
              ]}
              isLoading={isLoading}
              totalCount={topCampaignsWithTitles.length}
              pageSize={5}
              currentPage={1}
              onPageChange={() => undefined}
            />
          </div>
        </>
      )}
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
      <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${color}`}>{icon}</div>
      <div>
        <p className="text-xs font-bold text-slate-500 dark:text-slate-400">{label}</p>
        <p className="text-2xl font-black text-slate-900 dark:text-white">{Number(value || 0).toLocaleString()}</p>
      </div>
    </div>
  );
}

function translateType(type: string) {
  const map: Record<string, string> = {
    EMAIL: "بريد إلكتروني",
    SOCIAL: "تواصل اجتماعي",
    SMS: "رسائل نصية",
    CONTENT: "محتوى",
    WHATSAPP: "واتساب",
  };
  return map[type] || type;
}

function translateStatus(status: string) {
  const map: Record<string, string> = {
    DRAFT: "مسودة",
    SCHEDULED: "مجدولة",
    RUNNING: "قيد التنفيذ",
    COMPLETED: "مكتملة",
    CANCELLED: "ملغاة",
  };
  return map[status] || status;
}

function ClientOnlyChart({ children, heightClass }: { children: React.ReactNode; heightClass?: string }) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted) {
    return (
      <div className={`${heightClass || "h-full"} flex items-center justify-center rounded-2xl bg-slate-50 dark:bg-slate-900`}>
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
      </div>
    );
  }
  return <>{children}</>;
}
