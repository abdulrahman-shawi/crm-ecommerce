"use client";

import { DataTable, TableAction } from "@/components/shared/DataTable";
import { DynamicForm } from "@/components/shared/dynamic-form";
import { AppModal } from "@/components/ui/app-modal";
import { Button } from "@/components/ui/button";
import { FormInput } from "@/components/ui/form-input";
import { useAuth } from "@/context/AuthContext";
import { hasPermission } from "@/lib/utils";
import { createExpense, deleteExpense, getData, updateExpense } from "@/server/expenses";
import { Edit, Plus, Trash2 } from "lucide-react";
import React from "react";
import toast from "react-hot-toast";
import z from "zod";

const expenseSchema = z.object({
  type: z.enum(["DAILY", "RENT"]),
  amount: z.coerce.number().min(0, "المبلغ يجب أن يكون أكبر أو يساوي 0"),
  description: z.string().optional(),
  notes: z.string().optional(),
  currency: z.enum(["SYP", "TRY", "USD"]).optional(),
  paidFromOffice: z.enum(["TURKEY", "SYRIA"]).optional(),
  scheduledDate: z.string().optional(),
});

const expenseTypeLabels: Record<string, string> = {
  DAILY: "مصاريف يومية",
  RENT: "مصاريف إيجارات",
};

const currencyLabels: Record<string, string> = {
  SYP: "ليرة سورية",
  TRY: "ليرة تركية",
  USD: "دولار",
};

const paidFromOfficeLabels: Record<string, string> = {
  TURKEY: "مكتب تركيا",
  SYRIA: "مكتب سوريا",
};

const getDailyOfficeCurrencySymbol = (office: unknown) => {
  const normalizedOffice = String(office || "").toUpperCase();
  if (normalizedOffice === "SYRIA") return "$";
  if (normalizedOffice === "TURKEY") return "₺";
  return "";
};

const formatDateForInput = (dateLike?: string | Date | null) => {
  if (!dateLike) return "";
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const getExpenseEffectiveDate = (expense: any) => {
  return new Date(expense?.scheduledDate || expense?.createdAt || Date.now());
};

const getMonthKey = (date: Date) => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

const getMonthLabel = (monthKey: string) => {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, (month || 1) - 1, 1);
  return date.toLocaleDateString("ar-EG", { month: "long", year: "numeric" });
};

export default function ExpensesPage() {
  const { user } = useAuth();
  const [expenses, setExpenses] = React.useState<any[]>([]);
  const [isOpen, setIsOpen] = React.useState(false);
  const [editId, setEditId] = React.useState<number | null>(null);
  const [formData, setFormData] = React.useState<any>(null);
  const [activeType, setActiveType] = React.useState<"DAILY" | "RENT">("DAILY");
  const [dailyPage, setDailyPage] = React.useState(1);
  const [selectedMonth, setSelectedMonth] = React.useState<string>("ALL");
  const PAGE_SIZE = 10;

  const canView = user && hasPermission(user, "viewExpenses");
  const canAdd = user && hasPermission(user, "addExpenses");
  const canEdit = user && hasPermission(user, "editExpenses");
  const canDelete = user && hasPermission(user, "deleteExpenses");
  const isAdminUser = user?.accountType === "ADMIN";
  const canAccessSyria = user?.permission?.accessSyria === true;
  const canAccessTurkey = user?.permission?.accessTurkey === true;

  const allowedPaidOffices = React.useMemo(() => {
    if (isAdminUser) return ["SYRIA", "TURKEY"] as const;
    const offices: Array<"SYRIA" | "TURKEY"> = [];
    if (canAccessSyria) offices.push("SYRIA");
    if (canAccessTurkey) offices.push("TURKEY");
    return offices;
  }, [isAdminUser, canAccessSyria, canAccessTurkey]);

  const fetchExpenses = async () => {
    if (!canView) return;
    const res = await getData();
    if (res.success) {
      setExpenses(res.data || []);
    } else {
      toast.error("فشل في جلب المصاريف");
    }
  };

  React.useEffect(() => {
    fetchExpenses();
  }, [canView]);

  const handleClose = () => {
    setIsOpen(false);
    setEditId(null);
    setFormData(null);
    setActiveType("DAILY");
  };

  const onSubmit = async (data: z.infer<typeof expenseSchema>) => {
    const loadingToast = toast.loading(editId ? "جاري تعديل المصروف..." : "جاري إضافة المصروف...");
    try {
      const normalizedType = data.type || activeType;
      const payload: any = {
        type: normalizedType,
        amount: Number(data.amount || 0),
        description: String(data.description || "").trim() || null,
        notes: String(data.notes || "").trim() || null,
        currency: data.currency || null,
        paidFromOffice: data.paidFromOffice || null,
        scheduledDate: data.scheduledDate || null,
      };

      if (normalizedType === "DAILY") {
        if (!payload.description) throw new Error("يرجى إدخال وصف المصروف اليومي");
        if (!payload.currency) throw new Error("يرجى اختيار العملة");
        if (!payload.paidFromOffice) throw new Error("يرجى تحديد مكتب الدفع");
        if (!isAdminUser && !allowedPaidOffices.includes(payload.paidFromOffice)) {
          throw new Error("لا تملك صلاحية تسجيل مصروف لهذا المكتب");
        }
      }

      if (editId) {
        const res = await updateExpense(editId, payload);
        if (!res.success) throw new Error(String(res.error || "تعذر تعديل المصروف"));
        toast.success("تم تعديل المصروف بنجاح");
      } else {
        const res = await createExpense(payload);
        if (!res.success) throw new Error(String(res.error || "تعذر إضافة المصروف"));
        toast.success("تمت إضافة المصروف بنجاح");
      }

      handleClose();
      fetchExpenses();
    } catch (error: any) {
      toast.error(error?.message || "حدث خطأ أثناء حفظ المصروف");
    } finally {
      toast.dismiss(loadingToast);
    }
  };

  const handleEdit = (item: any) => {
    const expenseType = (item.type || "DAILY") as "DAILY" | "RENT";
    setEditId(Number(item.id));
    setActiveType(expenseType);
    setFormData({
      type: expenseType,
      amount: Number(item.amount || 0),
      description: item.description || "",
      notes: item.notes || "",
      currency: item.currency || undefined,
      paidFromOffice: item.paidFromOffice || undefined,
      scheduledDate: formatDateForInput(item.scheduledDate || item.createdAt),
    });
    setIsOpen(true);
  };

  const handleDelete = async (item: any) => {
    const confirmDelete = window.confirm("هل أنت متأكد من حذف هذا المصروف؟");
    if (!confirmDelete) return;

    const loadingToast = toast.loading("جاري حذف المصروف...");
    try {
      const res = await deleteExpense(Number(item.id));
      if (res.success) {
        toast.success("تم حذف المصروف بنجاح");
        fetchExpenses();
      } else {
        toast.error("تعذر حذف المصروف");
      }
    } catch {
      toast.error("حدث خطأ أثناء حذف المصروف");
    } finally {
      toast.dismiss(loadingToast);
    }
  };

  const actions: TableAction<any>[] = [
    canEdit
      ? {
          label: "تعديل",
          icon: <Edit size={14} />,
          onClick: handleEdit,
        }
      : null,
    canDelete
      ? {
          label: "حذف",
          icon: <Trash2 size={14} />,
          variant: "danger",
          onClick: handleDelete,
        }
      : null,
  ].filter(Boolean) as TableAction<any>[];

  const dailyExpenses = React.useMemo(() => {
    const dailyRows = expenses.filter((expense) => String(expense?.type || "DAILY") === "DAILY");
    if (isAdminUser) return dailyRows;

    return dailyRows.filter((expense) => {
      const office = String(expense?.paidFromOffice || "").toUpperCase();
      return allowedPaidOffices.includes(office as "SYRIA" | "TURKEY");
    });
  }, [expenses, isAdminUser, allowedPaidOffices]);

  const currentYear = React.useMemo(() => new Date().getFullYear(), []);

  const availableMonthKeys = React.useMemo(() => {
    const monthKeys = expenses
      .map((expense) => getExpenseEffectiveDate(expense))
      .filter((date) => !Number.isNaN(date.getTime()) && date.getFullYear() === currentYear)
      .map((date) => getMonthKey(date));

    return Array.from(new Set(monthKeys)).sort((a, b) => b.localeCompare(a));
  }, [expenses, currentYear]);

  React.useEffect(() => {
    if (selectedMonth === "ALL") return;
    if (!availableMonthKeys.includes(selectedMonth)) {
      setSelectedMonth("ALL");
    }
  }, [availableMonthKeys, selectedMonth]);

  const filteredDailyExpenses = React.useMemo(() => {
    const base = dailyExpenses.filter((expense) => {
      const date = getExpenseEffectiveDate(expense);
      return !Number.isNaN(date.getTime()) && date.getFullYear() === currentYear;
    });

    if (selectedMonth === "ALL") {
      return base;
    }

    return base.filter((expense) => getMonthKey(getExpenseEffectiveDate(expense)) === selectedMonth);
  }, [dailyExpenses, currentYear, selectedMonth]);

  const officeTotals = React.useMemo(() => {
    return filteredDailyExpenses.reduce(
      (acc, expense) => {
        const amount = Number(expense?.amount || 0);
        const office = String(expense?.paidFromOffice || "").toUpperCase();
        if (office === "SYRIA") acc.syria += amount;
        if (office === "TURKEY") acc.turkey += amount;
        return acc;
      },
      { syria: 0, turkey: 0 }
    );
  }, [filteredDailyExpenses]);

  const defaultFormValues = React.useMemo(() => {
    if (formData) return formData;
    return {
      type: activeType,
      amount: 0,
      description: "",
      notes: "",
      currency: "SYP",
      paidFromOffice: allowedPaidOffices[0] || "SYRIA",
      scheduledDate: formatDateForInput(new Date()),
    };
  }, [formData, activeType, allowedPaidOffices]);

  const paidFromOfficeOptions = React.useMemo(() => {
    return allowedPaidOffices.map((office) => ({
      value: office,
      label: paidFromOfficeLabels[office],
    }));
  }, [allowedPaidOffices]);

  if (!canView) {
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">إدارة المصاريف</h1>
        <p className="mt-4 text-sm text-slate-500">لا تملك صلاحية عرض هذه الصفحة.</p>
      </div>
    );
  }

  return (
    <div className="p-4" dir="rtl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">إدارة المصاريف</h1>
        {canAdd && (
          <Button
            onClick={() => {
              setEditId(null);
              setFormData(null);
              setActiveType("DAILY");
              setIsOpen(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6"
          >
            <Plus size={16} className="ml-2" />
            إضافة مصروف
          </Button>
        )}
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500">مجموع مصاريف مكتب سوريا</div>
          <div className="mt-1 text-2xl font-black text-emerald-600">{officeTotals.syria.toLocaleString()} $</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500">مجموع مصاريف مكتب تركيا</div>
          <div className="mt-1 text-2xl font-black text-blue-600">{officeTotals.turkey.toLocaleString()} ₺</div>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 text-sm font-bold text-slate-700 dark:text-slate-200">أشهر السنة الحالية المسجلة</div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setSelectedMonth("ALL");
              setDailyPage(1);
            }}
            className={`rounded-lg px-3 py-2 text-sm font-bold transition-colors ${
              selectedMonth === "ALL"
                ? "bg-blue-600 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
            }`}
          >
            كل أشهر {currentYear}
          </button>

          {availableMonthKeys.map((monthKey) => (
            <button
              key={monthKey}
              type="button"
              onClick={() => {
                setSelectedMonth(monthKey);
                setDailyPage(1);
              }}
              className={`rounded-lg px-3 py-2 text-sm font-bold transition-colors ${
                selectedMonth === monthKey
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
              }`}
            >
              {getMonthLabel(monthKey)}
            </button>
          ))}

          {availableMonthKeys.length === 0 && (
            <span className="text-sm text-slate-500">لا توجد أشهر مسجلة لهذه السنة بعد.</span>
          )}
        </div>
      </div>

      <div className="space-y-8">
        <div>
          <h2 className="text-lg font-black text-slate-800 dark:text-white mb-3">مصاريف يومية</h2>
          <DataTable
            data={filteredDailyExpenses}
            totalCount={filteredDailyExpenses.length}
            pageSize={PAGE_SIZE}
            currentPage={dailyPage}
            onPageChange={(newPage) => setDailyPage(newPage)}
            actions={actions.length ? actions : undefined}
            columns={[
              {
                header: "المبلغ",
                accessor: (row: any) => {
                  const symbol = getDailyOfficeCurrencySymbol(row.paidFromOffice);
                  return (
                    <span className="font-black text-blue-600">
                      {Number(row.amount || 0).toLocaleString()} {symbol}
                    </span>
                  );
                }
              },
              { header: "الوصف", accessor: (row: any) => <span>{row.description || "-"}</span> },
              { header: "الملاحظات", accessor: (row: any) => <span>{row.notes || "-"}</span> },
              { header: "المكتب", accessor: (row: any) => <span>{paidFromOfficeLabels[String(row.paidFromOffice || "")] || "-"}</span> },
              { header: "العملة", accessor: (row: any) => <span>{currencyLabels[String(row.currency || "")] || "-"}</span> },
              {
                header: "تاريخ الإنشاء",
                accessor: (row: any) =>
                  new Date(row.createdAt).toLocaleDateString("ar-EG", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  }),
              },
            ]}
          />
        </div>
      </div>

      <AppModal
        title={editId ? `تعديل ${expenseTypeLabels[activeType]}` : `إضافة ${expenseTypeLabels[activeType]}`}
        isOpen={isOpen}
        onClose={handleClose}
      >
        <div className="p-2 max-h-[80vh]">
          <DynamicForm
            schema={expenseSchema}
            onSubmit={onSubmit}
            defaultValues={defaultFormValues}
            key={`${editId || "create"}-${activeType}`}
            submitLabel={editId ? "تحديث" : "إضافة"}
          >
            {({ register, watch, formState: { errors } }) => {
              const type = (watch("type") as "DAILY" | "RENT") || activeType;

              React.useEffect(() => {
                setActiveType(type);
              }, [type]);

              return (
                <div className="grid gap-4">
                  <div className="flex flex-col gap-1.5 w-full text-right">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">نوع المصروف</label>
                    <select
                      className="flex h-10 w-full rounded-md border text-slate-700 dark:text-slate-300 text-right border-slate-200 bg-white px-3 py-2 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950"
                      {...register("type")}
                    >
                      <option value="DAILY">مصاريف يومية</option>
                    </select>
                  </div>

                  {type === "DAILY" && (
                    <>
                      <FormInput
                        className="text-gray-800 dark:text-white"
                        label="وصف المصروف"
                        {...register("description")}
                        error={errors.description?.message as string}
                      />

                      <FormInput
                        className="text-gray-800 dark:text-white"
                        label="ملاحظات"
                        {...register("notes")}
                        error={errors.notes?.message as string}
                      />

                      <div className="flex flex-col gap-1.5 w-full text-right">
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">الدفع من مكتب</label>
                        <select
                          className="flex h-10 w-full rounded-md border text-slate-700 dark:text-slate-300 text-right border-slate-200 bg-white px-3 py-2 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950"
                          disabled={paidFromOfficeOptions.length === 0}
                          {...register("paidFromOffice")}
                        >
                          {paidFromOfficeOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-col gap-1.5 w-full text-right">
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">العملة</label>
                        <select
                          className="flex h-10 w-full rounded-md border text-slate-700 dark:text-slate-300 text-right border-slate-200 bg-white px-3 py-2 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950"
                          {...register("currency")}
                        >
                          <option value="SYP">ليرة سورية</option>
                          <option value="TRY">ليرة تركية</option>
                          <option value="USD">دولار</option>
                        </select>
                      </div>

                      <FormInput
                        className="text-gray-800 dark:text-white"
                        label="المبلغ"
                        type="number"
                        step="0.01"
                        {...register("amount", { valueAsNumber: true })}
                        error={errors.amount?.message as string}
                      />
                    </>
                  )}

                  {type === "RENT" && (
                    <>
                      <FormInput
                        className="text-gray-800 dark:text-white"
                        label="وصف الإيجار"
                        {...register("description")}
                        error={errors.description?.message as string}
                      />

                      <FormInput
                        className="text-gray-800 dark:text-white"
                        label="ملاحظات"
                        {...register("notes")}
                        error={errors.notes?.message as string}
                      />

                      <FormInput
                        className="text-gray-800 dark:text-white"
                        label="المبلغ"
                        type="number"
                        step="0.01"
                        {...register("amount", { valueAsNumber: true })}
                        error={errors.amount?.message as string}
                      />

                      <FormInput
                        className="text-gray-800 dark:text-white"
                        label="تاريخ الإيجار (اختياري)"
                        type="date"
                        {...register("scheduledDate")}
                        error={errors.scheduledDate?.message as string}
                      />
                    </>
                  )}
                </div>
              );
            }}
          </DynamicForm>
        </div>
      </AppModal>
    </div>
  );
}
