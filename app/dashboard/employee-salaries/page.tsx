"use client";

import * as React from "react";
import { DataTable, TableAction } from "@/components/shared/DataTable";
import { AppModal } from "@/components/ui/app-modal";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { hasAnyPermission, isAdmin } from "@/lib/utils";
import { GetUserTargetProgress } from "@/server/analytics";
import { getEmployeeSalaryAdjustments, upsertEmployeeSalaryAdjustment } from "@/server/employee-salaries";
import { createExpense, deleteExpense, getData as getExpensesData, updateExpense } from "@/server/expenses";
import { getalluser } from "@/server/user";
import { Edit, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

const formatMoney = (value: number | undefined | null) =>
  Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });

const buildMonthDefaultDate = (monthKey: string) => `${monthKey}-01`;

export default function EmployeeSalariesPage() {
  const { user } = useAuth();
  const [rows, setRows] = React.useState<any[]>([]);
  const [rentExpenses, setRentExpenses] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [rentPage, setRentPage] = React.useState(1);
  const PAGE_SIZE = 12;
  const RENT_PAGE_SIZE = 10;

  const [selectedMonth, setSelectedMonth] = React.useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const [editableSalaryByUser, setEditableSalaryByUser] = React.useState<Record<string, string>>({});
  const [isRentModalOpen, setIsRentModalOpen] = React.useState(false);
  const [editingRentId, setEditingRentId] = React.useState<number | null>(null);
  const [rentDescription, setRentDescription] = React.useState("");
  const [rentAmount, setRentAmount] = React.useState("");
  const [rentNotes, setRentNotes] = React.useState("");
  const [rentDate, setRentDate] = React.useState(() => buildMonthDefaultDate(selectedMonth));
  const [isRentSaving, setIsRentSaving] = React.useState(false);

  const canView = Boolean(user && hasAnyPermission(user, ["viewEmployees", "viewAnalytics"])) || isAdmin(user);
  const canAddRentExpense = Boolean(user && hasAnyPermission(user, ["addExpenses"])) || isAdmin(user);
  const canEditRentExpense = Boolean(user && hasAnyPermission(user, ["editExpenses"])) || isAdmin(user);
  const canDeleteRentExpense = Boolean(user && hasAnyPermission(user, ["deleteExpenses"])) || isAdmin(user);

  const resetRentForm = React.useCallback(() => {
    setEditingRentId(null);
    setRentDescription("");
    setRentAmount("");
    setRentNotes("");
    setRentDate(buildMonthDefaultDate(selectedMonth));
  }, [selectedMonth]);

  const openRentModal = React.useCallback(() => {
    resetRentForm();
    setIsRentModalOpen(true);
  }, [resetRentForm]);

  const handleEditRentExpense = React.useCallback((expense: any) => {
    setEditingRentId(Number(expense?.id));
    setRentDescription(String(expense?.description || ""));
    setRentAmount(String(Number(expense?.amount || 0)));
    setRentNotes(String(expense?.notes || ""));

    const effectiveDate = expense?.scheduledDate || expense?.createdAt;
    const parsedDate = effectiveDate ? new Date(effectiveDate) : null;
    setRentDate(
      parsedDate && !Number.isNaN(parsedDate.getTime())
        ? parsedDate.toISOString().slice(0, 10)
        : buildMonthDefaultDate(selectedMonth)
    );
    setIsRentModalOpen(true);
  }, [selectedMonth]);

  const isDateInSelectedMonth = React.useCallback(
    (dateLike: string | Date | null | undefined) => {
      if (!dateLike || !selectedMonth) return false;
      const date = new Date(dateLike);
      if (Number.isNaN(date.getTime())) return false;
      const [year, month] = selectedMonth.split("-").map(Number);
      if (!year || !month) return false;
      return date.getFullYear() === year && date.getMonth() + 1 === month;
    },
    [selectedMonth]
  );

  const fetchData = React.useCallback(async () => {
    if (!canView) return;
    setIsLoading(true);
    try {
      const [users, adjustmentsRes, expensesRes] = await Promise.all([
        getalluser(),
        getEmployeeSalaryAdjustments(selectedMonth),
        getExpensesData(),
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
          const salesTargetReward = Number(summary?.totalSalesRewardAmount || 0);
          const productTargetReward = Number(summary?.totalProductRewardAmount || 0);
          const totalDefaultSalary = fixedSalary + salesProfit + salesTargetReward + productTargetReward;

          return {
            id: String(employee.id),
            name: employee.username || "-",
            email: employee.email || "-",
            fixedSalary,
            commissionPercent,
            salesProfit,
            salesTargetReward,
            productTargetReward,
            totalDefaultSalary,
            totalOrdersCount: Number(summary?.totalOrdersCount || 0),
            deliveredOrdersCount: Number(summary?.deliveredOrdersCount || 0),
            totalSalesAmount: Number(summary?.totalSalesAmount || 0),
          };
        })
      );

      setRows(withProfit.sort((a, b) => b.totalDefaultSalary - a.totalDefaultSalary));
      setPage(1);

      if (expensesRes?.success) {
        const rentRows = (expensesRes.data || []).filter((expense: any) => {
          if (String(expense?.type || "") !== "RENT") return false;
          const effectiveDate = expense?.scheduledDate || expense?.createdAt;
          return isDateInSelectedMonth(effectiveDate);
        });
        setRentExpenses(rentRows);
      } else {
        setRentExpenses([]);
      }

      setRentPage(1);
    } finally {
      setIsLoading(false);
    }
  }, [canView, selectedMonth, isDateInSelectedMonth]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  React.useEffect(() => {
    if (!isRentModalOpen) return;
    setRentDate(buildMonthDefaultDate(selectedMonth));
  }, [selectedMonth, isRentModalOpen]);

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
        acc.commission += row.salesProfit;
        acc.salesTargetReward += Number(row.salesTargetReward || 0);
        acc.productTargetReward += Number(row.productTargetReward || 0);
        acc.payable += Math.max(0, payable || 0);
        return acc;
      },
      { fixed: 0, commission: 0, salesTargetReward: 0, productTargetReward: 0, payable: 0 }
    );
  }, [filteredRows, editableSalaryByUser]);

  const handleSaveRentExpense = async () => {
    const amount = Number(rentAmount || 0);
    if (!rentDescription.trim()) {
      toast.error("يرجى إدخال وصف الإيجار");
      return;
    }

    if (!Number.isFinite(amount) || amount < 0) {
      toast.error("المبلغ غير صالح");
      return;
    }

    setIsRentSaving(true);
    const isEditing = editingRentId !== null;
    const loadingToast = toast.loading(isEditing ? "جاري تعديل مصروف الإيجار..." : "جاري إضافة مصروف الإيجار...");
    try {
      const payload = {
        type: "RENT",
        description: rentDescription,
        amount,
        notes: rentNotes,
        scheduledDate: rentDate,
      };
      const res = isEditing
        ? await updateExpense(editingRentId, payload)
        : await createExpense(payload);

      if (!res?.success) {
        toast.error(typeof res?.error === "string" ? res.error : isEditing ? "فشل في تعديل مصروف الإيجار" : "فشل في إضافة مصروف الإيجار");
        return;
      }

      toast.success(isEditing ? "تم تعديل مصروف الإيجار بنجاح" : "تمت إضافة مصروف الإيجار بنجاح");
      setIsRentModalOpen(false);
      resetRentForm();
      await fetchData();
    } catch (error) {
      toast.error(isEditing ? "فشل في تعديل مصروف الإيجار" : "فشل في إضافة مصروف الإيجار");
    } finally {
      setIsRentSaving(false);
      toast.dismiss(loadingToast);
    }
  };

  const handleDeleteRentExpense = React.useCallback(async (expense: any) => {
    const confirmed = window.confirm("هل أنت متأكد من حذف مصروف الإيجار؟");
    if (!confirmed) return;

    const loadingToast = toast.loading("جاري حذف مصروف الإيجار...");
    try {
      const res = await deleteExpense(Number(expense?.id));
      if (!res?.success) {
        toast.error(typeof res?.error === "string" ? res.error : "فشل في حذف مصروف الإيجار");
        return;
      }

      toast.success("تم حذف مصروف الإيجار بنجاح");
      await fetchData();
    } catch (error) {
      toast.error("فشل في حذف مصروف الإيجار");
    } finally {
      toast.dismiss(loadingToast);
    }
  }, [fetchData]);

  const rentExpenseActions = React.useMemo(() => {
    return [
      canEditRentExpense
        ? {
            label: "تعديل",
            icon: <Edit size={14} />,
            onClick: handleEditRentExpense,
          }
        : null,
      canDeleteRentExpense
        ? {
            label: "حذف",
            icon: <Trash2 size={14} />,
            variant: "danger" as const,
            onClick: handleDeleteRentExpense,
          }
        : null,
    ].filter(Boolean) as TableAction<any>[];
  }, [canDeleteRentExpense, canEditRentExpense, handleDeleteRentExpense, handleEditRentExpense]);

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

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500">إجمالي الرواتب الثابتة</div>
          <div className="mt-1 text-xl font-black text-blue-600">{formatMoney(totals.fixed)}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500">إجمالي عمولة المبيعات</div>
          <div className="mt-1 text-xl font-black text-emerald-600">{formatMoney(totals.commission)}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500">إجمالي مكافأة المبيعات</div>
          <div className="mt-1 text-xl font-black text-amber-600">{formatMoney(totals.salesTargetReward)}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500">إجمالي مكافأة المنتجات</div>
          <div className="mt-1 text-xl font-black text-violet-600">{formatMoney(totals.productTargetReward)}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500">إجمالي المستحق بعد التعديل</div>
          <div className="mt-1 text-xl font-black text-violet-600">{formatMoney(totals.payable)}</div>
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
          { header: "الراتب الثابت", accessor: (row: any) => <span className="font-bold text-slate-600">{formatMoney(row.fixedSalary)}</span> },
          { header: "نسبة الربح %", accessor: (row: any) => <span>{Number(row.commissionPercent || 0).toLocaleString()}</span> },
          { header: "عمولة المبيعات", accessor: (row: any) => <span className="font-black text-emerald-600">{formatMoney(row.salesProfit)}</span> },
          { header: "مكافأة المبيعات", accessor: (row: any) => <span className="font-black text-amber-600">{formatMoney(row.salesTargetReward)}</span> },
          { header: "مكافأة المنتجات", accessor: (row: any) => <span className="font-black text-violet-600">{formatMoney(row.productTargetReward)}</span> },
          { header: "الطلبات", accessor: (row: any) => <span>{Number(row.totalOrdersCount || 0).toLocaleString()}</span> },
          { header: "الطلبات المسلّمة", accessor: (row: any) => <span>{Number(row.deliveredOrdersCount || 0).toLocaleString()}</span> },
          { header: "إجمالي المبيعات", accessor: (row: any) => <span>{formatMoney(row.totalSalesAmount)}</span> },
          { header: "المستحق الافتراضي", accessor: (row: any) => <span className="font-black text-blue-600">{formatMoney(row.totalDefaultSalary)}</span> },
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

      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-black text-slate-800 dark:text-white">مصاريف الإيجارات</h2>
          {canAddRentExpense && (
            <Button onClick={openRentModal} className="bg-blue-600 text-white hover:bg-blue-700">
              إضافة مصروف إيجار
            </Button>
          )}
        </div>
        <DataTable
          data={rentExpenses}
          totalCount={rentExpenses.length}
          pageSize={RENT_PAGE_SIZE}
          currentPage={rentPage}
          onPageChange={(nextPage) => setRentPage(nextPage)}
          isLoading={isLoading}
          actions={rentExpenseActions}
          columns={[
            { header: "الوصف", accessor: (row: any) => <span>{row.description || "-"}</span> },
            { header: "المبلغ", accessor: (row: any) => <span className="font-black text-blue-600">{formatMoney(row.amount)}</span> },
            {
              header: "تاريخ الإيجار",
              accessor: (row: any) => {
                const effectiveDate = row.scheduledDate || row.createdAt;
                return new Date(effectiveDate).toLocaleDateString("ar-EG", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                });
              },
            },
          ]}
        />
      </div>

      <AppModal
        title={editingRentId === null ? "إضافة مصروف إيجار" : "تعديل مصروف إيجار"}
        isOpen={isRentModalOpen}
        onClose={() => {
          setIsRentModalOpen(false);
          resetRentForm();
        }}
      >
        <div className="grid gap-4 p-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">الوصف</label>
            <input
              type="text"
              value={rentDescription}
              onChange={(e) => setRentDescription(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              placeholder="مثال: إيجار المكتب"
              disabled={isRentSaving}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">المبلغ</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={rentAmount}
                onChange={(e) => setRentAmount(e.target.value)}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                placeholder="0.00"
                disabled={isRentSaving}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">تاريخ الإيجار</label>
              <input
                type="date"
                value={rentDate}
                onChange={(e) => setRentDate(e.target.value)}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                disabled={isRentSaving}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">ملاحظات</label>
            <textarea
              value={rentNotes}
              onChange={(e) => setRentNotes(e.target.value)}
              className="min-h-24 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              placeholder="ملاحظات إضافية"
              disabled={isRentSaving}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsRentModalOpen(false);
                resetRentForm();
              }}
              disabled={isRentSaving}
            >
              إلغاء
            </Button>
            <Button onClick={handleSaveRentExpense} className="bg-blue-600 text-white hover:bg-blue-700" disabled={isRentSaving}>
              {isRentSaving ? "جار الحفظ..." : editingRentId === null ? "حفظ المصروف" : "حفظ التعديل"}
            </Button>
          </div>
        </div>
      </AppModal>
    </div>
  );
}
