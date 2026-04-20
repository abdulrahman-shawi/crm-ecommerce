"use client";

import * as React from "react";
import { Landmark, HandCoins, Wallet, RefreshCw, CheckCircle2, Undo2 } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/context/AuthContext";
import { hasAnyPermission } from "@/lib/utils";
import {
  clearCarrierCollectionReceived,
  getCollectionsDashboardData,
  markCarrierCollectionReceived,
} from "@/server/collections";

type CollectionsPayload = {
  supportsCarrierCollectionTracking: boolean;
  bankTransfers: any[];
  carrierCollectionsPending: any[];
  carrierCollectionsReceived: any[];
  summaries: {
    bankTransfersTotal: number;
    carrierPendingTotal: number;
    carrierReceivedTotal: number;
  };
};

const formatMoney = (amount: number, location?: string | null) => {
  const currency = String(location || "").trim() === "تركيا" ? "₺" : "$";
  return `${Number(amount || 0).toLocaleString()} ${currency}`;
};

const getDisplayDate = (row: any) => {
  const value = row?.manualCreatedAt || row?.createdAt || row?.carrierCollectionReceivedAt;
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

function SummaryCard({
  title,
  value,
  subtitle,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ElementType;
  tone: "blue" | "amber" | "emerald";
}) {
  const tones = {
    blue: "from-blue-600 to-cyan-500 text-blue-600",
    amber: "from-amber-500 to-orange-500 text-amber-600",
    emerald: "from-emerald-500 to-green-500 text-emerald-600",
  };

  return (
    <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-bold text-slate-500 dark:text-slate-400">{title}</div>
          <div className={`mt-3 text-3xl font-black ${tones[tone].split(" ")[2]}`}>{value}</div>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">{subtitle}</div>
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${tones[tone].split(" ").slice(0, 2).join(" ")} text-white shadow-lg`}>
          <Icon size={22} />
        </div>
      </div>
    </div>
  );
}

function SectionTable({
  title,
  description,
  rows,
  emptyMessage,
  amountLabel,
  getAmount,
  actionLabel,
  onAction,
  actionVariant = "primary",
}: {
  title: string;
  description: string;
  rows: any[];
  emptyMessage: string;
  amountLabel: string;
  getAmount: (row: any) => string;
  actionLabel?: string;
  onAction?: (row: any) => void;
  actionVariant?: "primary" | "danger";
}) {
  return (
    <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white">{title}</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
        </div>
        <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {rows.length} طلب
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm font-bold text-slate-500 dark:border-slate-700 dark:text-slate-400">
          {emptyMessage}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-right text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <th className="px-3 py-3 font-bold">رقم الطلب</th>
                <th className="px-3 py-3 font-bold">العميل</th>
                <th className="px-3 py-3 font-bold">طريقة الدفع</th>
                <th className="px-3 py-3 font-bold">الحالة</th>
                <th className="px-3 py-3 font-bold">شركة الشحن</th>
                <th className="px-3 py-3 font-bold">{amountLabel}</th>
                <th className="px-3 py-3 font-bold">التاريخ</th>
                {actionLabel && <th className="px-3 py-3 font-bold">الإجراء</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800/70">
                  <td className="px-3 py-3 font-black text-blue-600">#{row.orderNumber}</td>
                  <td className="px-3 py-3 font-bold text-slate-800 dark:text-slate-100">{row.customer?.name || row.receiverName || "-"}</td>
                  <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{row.paymentMethod || "-"}</td>
                  <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{row.status || "-"}</td>
                  <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{row.shipping?.name || "-"}</td>
                  <td className="px-3 py-3 font-black text-emerald-600">{getAmount(row)}</td>
                  <td className="px-3 py-3 text-slate-500 dark:text-slate-400">{getDisplayDate(row)}</td>
                  {actionLabel && onAction && (
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => onAction(row)}
                        className={`rounded-xl px-3 py-2 text-xs font-black transition-colors ${
                          actionVariant === "danger"
                            ? "bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-900/30 dark:text-rose-300"
                            : "bg-blue-600 text-white hover:bg-blue-700"
                        }`}
                      >
                        {actionLabel}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function CollectionsPage() {
  const { user } = useAuth();
  const [payload, setPayload] = React.useState<CollectionsPayload | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const canView = Boolean(user && hasAnyPermission(user, ["viewOrders", "addOrders", "editOrders", "deleteOrders"]));
  const canManage = Boolean(user && (user.accountType === "ADMIN" || user?.permission?.editOrders));

  const loadData = React.useCallback(async (silent = false) => {
    if (!canView) {
      setIsLoading(false);
      return;
    }

    if (silent) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const result = await getCollectionsDashboardData();
      if (!result.success) {
        toast.error(String(result.error || "تعذر جلب صفحة التحصيلات"));
        return;
      }

      setPayload(result.data as CollectionsPayload);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [canView]);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleMarkReceived = async (row: any) => {
    const loadingToast = toast.loading("جاري تسجيل التحصيل كمستلم...");
    try {
      const result = await markCarrierCollectionReceived(Number(row.id), Number(row.collectionNetReceived || 0), null);
      if (!result.success) {
        toast.error(String(result.error || "تعذر تحديث التحصيل"));
        return;
      }

      toast.success("تم نقل التحصيل إلى صندوق المستلمة");
      await loadData(true);
    } finally {
      toast.dismiss(loadingToast);
    }
  };

  const handleClearReceived = async (row: any) => {
    const loadingToast = toast.loading("جاري إلغاء تسجيل التحصيل...");
    try {
      const result = await clearCarrierCollectionReceived(Number(row.id));
      if (!result.success) {
        toast.error(String(result.error || "تعذر إلغاء التحصيل"));
        return;
      }

      toast.success("تمت إعادة التحصيل إلى قسم مع الناقل");
      await loadData(true);
    } finally {
      toast.dismiss(loadingToast);
    }
  };

  if (!canView) {
    return (
      <div className="p-4" dir="rtl">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">التحصيلات</h1>
        <p className="mt-4 text-sm text-slate-500">لا تملك صلاحية عرض هذه الصفحة.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">التحصيلات</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            عرض الحوالات البنكية، التحصيلات الموجودة مع الناقل، والتحصيلات التي تم استلامها.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadData(true)}
          disabled={isRefreshing}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
        >
          <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
          تحديث البيانات
        </button>
      </div>

      {payload && !payload.supportsCarrierCollectionTracking && (
        <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
          تمت إضافة حقول nullable في Prisma لتتبع التحصيلات المستلمة من الناقل، لكن يجب تنفيذ الترحيل أولًا حتى يتفعّل الصندوق الثالث وأزرار تسجيل الاستلام.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          title="الحوالات البنكية المستلمة"
          value={formatMoney(payload?.summaries.bankTransfersTotal || 0)}
          subtitle="طلبات الدفع البنكي أو الجزء البنكي من الدفع المختلط"
          icon={Landmark}
          tone="blue"
        />
        <SummaryCard
          title="التحصيلات الموجودة مع الناقل"
          value={formatMoney(payload?.summaries.carrierPendingTotal || 0)}
          subtitle="قيمة الطلب القابلة للتحصيل + قيمة الشحن"
          icon={HandCoins}
          tone="amber"
        />
        <SummaryCard
          title="تحصيلاتي المستلمة"
          value={formatMoney(payload?.summaries.carrierReceivedTotal || 0)}
          subtitle="التحصيلات التي تم استلامها بعد خصم الشحن"
          icon={Wallet}
          tone="emerald"
        />
      </div>

      {isLoading && !payload ? (
        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-10 text-center text-sm font-bold text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          جاري تحميل بيانات التحصيلات...
        </div>
      ) : (
        <div className="space-y-6">
          <SectionTable
            title="الحوالات البنكية المستلمة"
            description="تشمل الطلبات المدفوعة بتحويل بنكي كامل، أو الجزء البنكي من الطلبات المختلطة."
            rows={payload?.bankTransfers || []}
            emptyMessage="لا توجد حوالات بنكية مطابقة حاليًا."
            amountLabel="قيمة الحوالة"
            getAmount={(row) => formatMoney(Number(row.collectionAmount || 0), row?.warehouse?.location)}
          />

          <SectionTable
            title="التحصيلات المستلمة مع الناقل"
            description="القيمة القابلة للتحصيل لدى شركة الشحن وتُحسب كقيمة الطلب القابلة للتحصيل + قيمة الشحن."
            rows={payload?.carrierCollectionsPending || []}
            emptyMessage="لا توجد تحصيلات معلقة مع الناقل حاليًا."
            amountLabel="مع الناقل"
            getAmount={(row) => formatMoney(Number(row.collectionWithShipping || 0), row?.warehouse?.location)}
            actionLabel={canManage && payload?.supportsCarrierCollectionTracking ? "تسجيل كمستلم" : undefined}
            onAction={canManage && payload?.supportsCarrierCollectionTracking ? handleMarkReceived : undefined}
          />

          <SectionTable
            title="تحصيلاتي المستلمة"
            description="التحصيلات التي تم استلامها وتُعرض بصافي قيمة الطلب القابلة للتحصيل بعد خصم الشحن."
            rows={payload?.carrierCollectionsReceived || []}
            emptyMessage="لا توجد تحصيلات مستلمة مسجلة بعد."
            amountLabel="الصافي المستلم"
            getAmount={(row) => formatMoney(Number(row.carrierCollectionReceivedAmount ?? row.collectionNetReceived ?? 0), row?.warehouse?.location)}
            actionLabel={canManage && payload?.supportsCarrierCollectionTracking ? "إلغاء الاستلام" : undefined}
            onAction={canManage && payload?.supportsCarrierCollectionTracking ? handleClearReceived : undefined}
            actionVariant="danger"
          />
        </div>
      )}
    </div>
  );
}