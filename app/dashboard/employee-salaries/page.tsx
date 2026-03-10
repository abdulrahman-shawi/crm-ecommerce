"use client";

import * as React from "react";
import { DataTable } from "@/components/shared/DataTable";
import { useAuth } from "@/context/AuthContext";
import { hasAnyPermission, isAdmin } from "@/lib/utils";
import { GetUserTargetProgress } from "@/server/analytics";
import { getEmployeeSalaryAdjustments, upsertEmployeeSalaryAdjustment } from "@/server/employee-salaries";
import { getalluser } from "@/server/user";
import toast from "react-hot-toast";

export default function EmployeeSalariesPage() {
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

  const [editableSalaryByUser, setEditableSalaryByUser] = React.useState<Record<string, string>>({});

  const canView = Boolean(user && hasAnyPermission(user, ["viewEmployees", "viewAnalytics"])) || isAdmin(user);

  const fetchData = React.useCallback(async () => {
    if (!canView) return;
    setIsLoading(true);
    try {
      const [users, adjustmentsRes] = await Promise.all([
        getalluser(),
        getEmployeeSalaryAdjustments(selectedMonth),
      ]);

      const adjustmentMap: Record<string, string> = {};
      if (adjustmentsRes?.success) {
        for (const item of adjustmentsRes.data || []) {
          adjustmentMap[String(item.userId)] = String(Number(item.editedSalary || 0));
        }
      }
      setEditableSalaryByUser(adjustmentMap);

      const employeeRows = (Array.isArray(users) ? users : []).filter((row: any) => row?.accountType !== "ADMIN");

      const withProfit = await Promise.all(
        employeeRows.map(async (employee: any) => {
          const summaryRes = await GetUserTargetProgress(String(employee.id), selectedMonth);
          const summary: any = summaryRes?.summary || {};
          const fixedSalary = Number(employee?.wage || 0);
          const commissionPercent = Number(employee?.salesCommissionPercent || 0);
          const salesProfit = Number(summary?.totalCommissionAmount || 0);
          const totalDefaultSalary = fixedSalary + salesProfit;

          return {
            id: String(employee.id),
            name: employee.username || "-",
            email: employee.email || "-",
            fixedSalary,
            commissionPercent,
            salesProfit,
            totalDefaultSalary,
            totalOrdersCount: Number(summary?.totalOrdersCount || 0),
            deliveredOrdersCount: Number(summary?.deliveredOrdersCount || 0),
            totalSalesAmount: Number(summary?.totalSalesAmount || 0),
          };
        })
      );

      setRows(withProfit.sort((a, b) => b.totalDefaultSalary - a.totalDefaultSalary));
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
      String(row.name || "").toLowerCase().includes(q) ||
      String(row.email || "").toLowerCase().includes(q)
    );
  }, [rows, search]);

  const totals = React.useMemo(() => {
    return filteredRows.reduce(
      (acc, row) => {
        const edited = Number(editableSalaryByUser[row.id]);
        const payable = Number.isFinite(edited) ? edited : row.totalDefaultSalary;
        acc.fixed += row.fixedSalary;
        acc.profit += row.salesProfit;
        acc.payable += Math.max(0, payable || 0);
        return acc;
      },
      { fixed: 0, profit: 0, payable: 0 }
    );
  }, [filteredRows, editableSalaryByUser]);

  if (!canView) {
    return (
      <div className="p-4" dir="rtl">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">رواتب الموظفين</h1>
        <p className="mt-4 text-sm text-slate-500">لا تملك صلاحية عرض هذه الصفحة.</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4" dir="rtl">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">رواتب الموظفين</h1>
          <p className="text-xs text-slate-500">تعديل الراتب هنا لا يغيّر الراتب الثابت للموظف.</p>
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
              placeholder="اسم الموظف أو الإيميل"
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500">إجمالي الرواتب الثابتة</div>
          <div className="mt-1 text-xl font-black text-blue-600">{totals.fixed.toLocaleString()}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500">إجمالي الأرباح</div>
          <div className="mt-1 text-xl font-black text-emerald-600">{totals.profit.toLocaleString()}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500">إجمالي المستحق بعد التعديل</div>
          <div className="mt-1 text-xl font-black text-violet-600">{totals.payable.toLocaleString()}</div>
        </div>
      </div>

      <DataTable
        data={filteredRows}
        totalCount={filteredRows.length}
        pageSize={PAGE_SIZE}
        currentPage={page}
        onPageChange={(nextPage) => setPage(nextPage)}
        isLoading={isLoading}
        columns={[
          { header: "الموظف", accessor: (row: any) => <span className="font-bold">{row.name}</span> },
          { header: "الإيميل", accessor: (row: any) => <span>{row.email}</span> },
          { header: "الراتب الثابت", accessor: (row: any) => <span className="font-bold text-slate-600">{Number(row.fixedSalary || 0).toLocaleString()}</span> },
          { header: "نسبة الربح %", accessor: (row: any) => <span>{Number(row.commissionPercent || 0).toLocaleString()}</span> },
          { header: "الربح", accessor: (row: any) => <span className="font-black text-emerald-600">{Number(row.salesProfit || 0).toLocaleString()}</span> },
          { header: "الطلبات", accessor: (row: any) => <span>{Number(row.totalOrdersCount || 0).toLocaleString()}</span> },
          { header: "الطلبات المسلّمة", accessor: (row: any) => <span>{Number(row.deliveredOrdersCount || 0).toLocaleString()}</span> },
          { header: "إجمالي المبيعات", accessor: (row: any) => <span>{Number(row.totalSalesAmount || 0).toLocaleString()}</span> },
          { header: "المستحق الافتراضي", accessor: (row: any) => <span className="font-black text-blue-600">{Number(row.totalDefaultSalary || 0).toLocaleString()}</span> },
          {
            header: "الراتب المعدّل",
            accessor: (row: any) => (
              <input
                type="number"
                min={0}
                step="0.01"
                value={editableSalaryByUser[row.id] ?? ""}
                placeholder={String(Number(row.totalDefaultSalary || 0).toFixed(2))}
                onChange={(e) => {
                  const next = { ...editableSalaryByUser, [row.id]: e.target.value };
                  setEditableSalaryByUser(next);
                }}
                onBlur={async (e) => {
                  const value = Number(e.target.value || 0);
                  if (!Number.isFinite(value) || value < 0) {
                    toast.error("قيمة الراتب المعدّل غير صالحة");
                    return;
                  }

                  const res = await upsertEmployeeSalaryAdjustment(row.id, selectedMonth, value);
                  if (!res?.success) {
                    toast.error(res?.error || "تعذر حفظ الراتب المعدّل");
                  }
                }}
                className="w-28 rounded-md border border-slate-300 bg-white p-1 text-center text-sm dark:border-slate-700 dark:bg-slate-900"
              />
            )
          },
        ]}
      />
    </div>
  );
}
