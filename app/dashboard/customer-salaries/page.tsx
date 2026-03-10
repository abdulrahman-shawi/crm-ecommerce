"use client";

import * as React from "react";
import { DataTable } from "@/components/shared/DataTable";
import { useAuth } from "@/context/AuthContext";
import { hasAnyPermission, isAdmin } from "@/lib/utils";
import { getCustomer } from "@/server/customer";

const CANCELED_STATUSES = ["تم الغاء الطلب", "فشل التسليم مرتجع"];

const getMonthBounds = (monthValue: string) => {
  const [yearRaw, monthRaw] = String(monthValue || "").split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);

  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    const now = new Date();
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0),
      end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
    };
  }

  return {
    start: new Date(year, month - 1, 1, 0, 0, 0, 0),
    end: new Date(year, month, 0, 23, 59, 59, 999),
  };
};

const normalizeMoney = (value: unknown) => {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? numeric : 0;
};

export default function CustomerSalariesPage() {
  const { user } = useAuth();
  const [rows, setRows] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const PAGE_SIZE = 12;

  const [selectedMonth, setSelectedMonth] = React.useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const [manualProfitByCustomer, setManualProfitByCustomer] = React.useState<Record<string, string>>({});

  const canView = Boolean(user && hasAnyPermission(user, ["viewCustomers", "viewAnalytics"])) || isAdmin(user);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const key = `customer-profits:${selectedMonth}`;
    const raw = localStorage.getItem(key);
    if (!raw) {
      setManualProfitByCustomer({});
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      setManualProfitByCustomer(parsed && typeof parsed === "object" ? parsed : {});
    } catch {
      setManualProfitByCustomer({});
    }
  }, [selectedMonth]);

  const saveManualProfit = React.useCallback((nextData: Record<string, string>) => {
    if (typeof window === "undefined") return;
    const key = `customer-profits:${selectedMonth}`;
    localStorage.setItem(key, JSON.stringify(nextData));
  }, [selectedMonth]);

  const fetchData = React.useCallback(async () => {
    if (!canView) return;
    setIsLoading(true);
    try {
      const res = await getCustomer();
      const list = Array.isArray(res?.data) ? res.data : [];
      const { start, end } = getMonthBounds(selectedMonth);

      const computed = list
        .map((customer: any) => {
          const customerOrders = Array.isArray(customer?.orders) ? customer.orders : [];
          const periodOrders = customerOrders.filter((order: any) => {
            const createdAt = new Date(order?.createdAt || order?.manualCreatedAt || 0);
            if (Number.isNaN(createdAt.getTime())) return false;
            if (CANCELED_STATUSES.includes(String(order?.status || "").trim())) return false;
            return createdAt >= start && createdAt <= end;
          });

          const totalSales = periodOrders.reduce((sum: number, order: any) => sum + normalizeMoney(order?.finalAmount), 0);
          const ordersCount = periodOrders.length;

          const assignedUsers = Array.isArray(customer?.users) ? customer.users : [];
          const commissionPercents = assignedUsers
            .map((u: any) => Number(u?.salesCommissionPercent || 0))
            .filter((v: number) => Number.isFinite(v));
          const fixedPercent = commissionPercents.length > 0 ? Math.max(...commissionPercents) : 0;
          const fixedProfit = (totalSales * fixedPercent) / 100;

          const lastOrderDate = periodOrders
            .map((order: any) => new Date(order?.createdAt || order?.manualCreatedAt || 0))
            .filter((d: Date) => !Number.isNaN(d.getTime()))
            .sort((a: Date, b: Date) => b.getTime() - a.getTime())[0] || null;

          const phone = Array.isArray(customer?.phone) ? customer.phone.filter(Boolean).join(" - ") : "";

          return {
            id: String(customer?.id || ""),
            customerName: customer?.name || "-",
            phone,
            country: customer?.country || "-",
            city: customer?.city || "-",
            assignedUsers: assignedUsers.map((u: any) => u?.username).filter(Boolean).join("، ") || "-",
            ordersCount,
            totalSales,
            fixedPercent,
            fixedProfit,
            lastOrderDate,
          };
        })
        .filter((row: any) => row.id)
        .sort((a: any, b: any) => b.totalSales - a.totalSales);

      setRows(computed);
      setPage(1);
    } finally {
      setIsLoading(false);
    }
  }, [canView, selectedMonth]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredRows = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      String(row.customerName || "").toLowerCase().includes(q) ||
      String(row.phone || "").toLowerCase().includes(q) ||
      String(row.assignedUsers || "").toLowerCase().includes(q)
    );
  }, [rows, search]);

  const totals = React.useMemo(() => {
    return filteredRows.reduce(
      (acc, row) => {
        const manual = Number(manualProfitByCustomer[row.id]);
        const payableProfit = Number.isFinite(manual) ? manual : row.fixedProfit;
        acc.sales += row.totalSales;
        acc.fixed += row.fixedProfit;
        acc.payable += Math.max(0, payableProfit || 0);
        return acc;
      },
      { sales: 0, fixed: 0, payable: 0 }
    );
  }, [filteredRows, manualProfitByCustomer]);

  if (!canView) {
    return (
      <div className="p-4" dir="rtl">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">رواتب العملاء</h1>
        <p className="mt-4 text-sm text-slate-500">لا تملك صلاحية عرض هذه الصفحة.</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4" dir="rtl">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">رواتب العملاء</h1>
          <p className="text-xs text-slate-500">تعديل قيمة الربح هنا لا يغير نسبة العمولة الثابتة للموظف.</p>
        </div>

        <div className="flex flex-col gap-2 md:flex-row md:items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">الشهر</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">بحث</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="اسم العميل أو الهاتف أو الموظف"
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500">إجمالي المبيعات</div>
          <div className="mt-1 text-xl font-black text-blue-600">{totals.sales.toLocaleString()}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500">إجمالي الربح الثابت</div>
          <div className="mt-1 text-xl font-black text-emerald-600">{totals.fixed.toLocaleString()}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500">إجمالي الربح بعد التعديل</div>
          <div className="mt-1 text-xl font-black text-violet-600">{totals.payable.toLocaleString()}</div>
        </div>
      </div>

      <DataTable
        data={filteredRows}
        totalCount={filteredRows.length}
        pageSize={PAGE_SIZE}
        currentPage={page}
        onPageChange={(newPage) => setPage(newPage)}
        isLoading={isLoading}
        columns={[
          { header: "العميل", accessor: (row: any) => <span className="font-bold">{row.customerName}</span> },
          { header: "الهاتف", accessor: (row: any) => <span>{row.phone || "-"}</span> },
          { header: "المدينة", accessor: (row: any) => <span>{row.city}</span> },
          { header: "الموظف المرتبط", accessor: (row: any) => <span>{row.assignedUsers}</span> },
          { header: "عدد الطلبات", accessor: (row: any) => <span>{Number(row.ordersCount || 0).toLocaleString()}</span> },
          { header: "إجمالي المبيعات", accessor: (row: any) => <span className="font-black text-blue-600">{Number(row.totalSales || 0).toLocaleString()}</span> },
          { header: "النسبة الثابتة %", accessor: (row: any) => <span>{Number(row.fixedPercent || 0).toLocaleString()}</span> },
          { header: "الربح الثابت", accessor: (row: any) => <span className="font-bold text-emerald-600">{Number(row.fixedProfit || 0).toLocaleString()}</span> },
          {
            header: "الربح المعدل",
            accessor: (row: any) => {
              const value = manualProfitByCustomer[row.id] ?? "";
              return (
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={value}
                  placeholder={String(Number(row.fixedProfit || 0).toFixed(2))}
                  onChange={(e) => {
                    const next = { ...manualProfitByCustomer, [row.id]: e.target.value };
                    setManualProfitByCustomer(next);
                  }}
                  onBlur={() => saveManualProfit(manualProfitByCustomer)}
                  className="w-28 rounded-md border border-slate-300 bg-white p-1 text-center text-sm dark:border-slate-700 dark:bg-slate-900"
                />
              );
            }
          },
          {
            header: "آخر طلب",
            accessor: (row: any) => (
              <span>
                {row.lastOrderDate
                  ? new Date(row.lastOrderDate).toLocaleDateString("ar-EG", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                    })
                  : "-"}
              </span>
            )
          },
        ]}
      />
    </div>
  );
}
