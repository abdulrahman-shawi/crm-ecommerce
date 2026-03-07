"use client";

import { DataTable, TableAction } from "@/components/shared/DataTable";
import { DynamicForm } from "@/components/shared/dynamic-form";
import { AppModal } from "@/components/ui/app-modal";
import { Button } from "@/components/ui/button";
import { FormInput } from "@/components/ui/form-input";
import { useAuth } from "@/context/AuthContext";
import { hasPermission } from "@/lib/utils";
import { createExpense, deleteExpense, getData, getExpenseEmployees, updateExpense } from "@/server/expenses";
import { Edit, Plus, Trash2 } from "lucide-react";
import React from "react";
import toast from "react-hot-toast";
import z from "zod";

const expenseSchema = z.object({
  type: z.enum(["DAILY", "STAFF_SALARY", "RENT"]),
  amount: z.coerce.number().min(0, "المبلغ يجب أن يكون أكبر أو يساوي 0"),
  description: z.string().optional(),
  currency: z.enum(["SYP", "TRY", "USD"]).optional(),
  paidFromOffice: z.enum(["TURKEY", "SYRIA"]).optional(),
  employeeId: z.string().optional(),
  scheduledDate: z.string().optional(),
  salaryBaseWage: z.coerce.number().optional(),
});

const expenseTypeLabels: Record<string, string> = {
  DAILY: "مصاريف يومية",
  STAFF_SALARY: "رواتب الموظفين",
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

const formatDateForInput = (dateLike?: string | Date | null) => {
  if (!dateLike) return "";
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

export default function ExpensesPage() {
  const { user } = useAuth();
  const [expenses, setExpenses] = React.useState<any[]>([]);
  const [employees, setEmployees] = React.useState<any[]>([]);
  const [isOpen, setIsOpen] = React.useState(false);
  const [editId, setEditId] = React.useState<number | null>(null);
  const [formData, setFormData] = React.useState<any>(null);
  const [activeType, setActiveType] = React.useState<"DAILY" | "STAFF_SALARY" | "RENT">("DAILY");
  const [dailyPage, setDailyPage] = React.useState(1);
  const [salaryPage, setSalaryPage] = React.useState(1);
  const [rentPage, setRentPage] = React.useState(1);
  const PAGE_SIZE = 10;

  const canView = user && hasPermission(user, "viewExpenses");
  const canAdd = user && hasPermission(user, "addExpenses");
  const canEdit = user && hasPermission(user, "editExpenses");
  const canDelete = user && hasPermission(user, "deleteExpenses");

  const fetchExpenses = async () => {
    if (!canView) return;
    const res = await getData();
    if (res.success) {
      setExpenses(res.data || []);
    } else {
      toast.error("فشل في جلب المصاريف");
    }
  };

  const fetchEmployees = async () => {
    if (!canView) return;
    const res = await getExpenseEmployees();
    if (res.success) {
      setEmployees(Array.isArray(res.data) ? res.data : []);
    }
  };

  React.useEffect(() => {
    fetchExpenses();
    fetchEmployees();
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
      const selectedEmployee = employees.find((employee) => employee.id === data.employeeId);
      const payload: any = {
        type: normalizedType,
        amount: Number(data.amount || 0),
          salaryBaseWage: Number(data.salaryBaseWage || 0),
        description: String(data.description || "").trim() || null,
        currency: data.currency || null,
        paidFromOffice: data.paidFromOffice || null,
        employeeId: data.employeeId || null,
        scheduledDate: data.scheduledDate || null,
      };

      if (normalizedType === "DAILY") {
        if (!payload.description) {
          throw new Error("يرجى إدخال وصف المصروف اليومي");
        }
        if (!payload.currency) {
          throw new Error("يرجى اختيار العملة");
        }
        if (!payload.paidFromOffice) {
          throw new Error("يرجى تحديد مكتب الدفع");
        }
      }

      if (normalizedType === "STAFF_SALARY") {
        if (!payload.employeeId) {
          throw new Error("يرجى اختيار الموظف");
        }
        payload.salaryBaseWage = Number(selectedEmployee?.wage || 0);
        if (Number(payload.amount) <= 0) {
          payload.amount = Number(selectedEmployee?.wage || 0);
        }
        payload.description = payload.description || (selectedEmployee ? `راتب الموظف: ${selectedEmployee.username}` : null);
      }

      if (normalizedType === "RENT") {
        if (!payload.description) {
          throw new Error("يرجى إدخال وصف الإيجار");
        }
        payload.scheduledDate = payload.scheduledDate || formatDateForInput(new Date());
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
    const expenseType = (item.type || "DAILY") as "DAILY" | "STAFF_SALARY" | "RENT";
    setEditId(Number(item.id));
    setActiveType(expenseType);
    setFormData({
      type: expenseType,
      amount: Number(item.amount || 0),
      salaryBaseWage: Number(item.salaryBaseWage || item.employee?.wage || 0),
      description: item.description || "",
      currency: item.currency || undefined,
      paidFromOffice: item.paidFromOffice || undefined,
      employeeId: item.employeeId || "",
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

  const dailyExpenses = React.useMemo(
    () => expenses.filter((expense) => String(expense?.type || "DAILY") === "DAILY"),
    [expenses]
  );

  const salaryExpenses = React.useMemo(
    () => expenses.filter((expense) => String(expense?.type || "") === "STAFF_SALARY"),
    [expenses]
  );

  const rentExpenses = React.useMemo(
    () => expenses.filter((expense) => String(expense?.type || "") === "RENT"),
    [expenses]
  );

  const defaultFormValues = React.useMemo(() => {
    if (formData) return formData;
    return {
      type: activeType,
      amount: 0,
      salaryBaseWage: 0,
      description: "",
      currency: "SYP",
      paidFromOffice: "SYRIA",
      employeeId: "",
      scheduledDate: formatDateForInput(new Date()),
    };
  }, [formData, activeType]);

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

      <div className="space-y-8">
        <div>
          <h2 className="text-lg font-black text-slate-800 dark:text-white mb-3">مصاريف يومية</h2>
          <DataTable
            data={dailyExpenses}
            totalCount={dailyExpenses.length}
            pageSize={PAGE_SIZE}
            currentPage={dailyPage}
            onPageChange={(newPage) => setDailyPage(newPage)}
            actions={actions.length ? actions : undefined}
            columns={[
              { header: "المبلغ", accessor: (row: any) => <span className="font-black text-blue-600">{Number(row.amount || 0).toLocaleString()}</span> },
              { header: "الوصف", accessor: (row: any) => <span>{row.description || "-"}</span> },
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

        <div>
          <h2 className="text-lg font-black text-slate-800 dark:text-white mb-3">رواتب الموظفين</h2>
          <DataTable
            data={salaryExpenses}
            totalCount={salaryExpenses.length}
            pageSize={PAGE_SIZE}
            currentPage={salaryPage}
            onPageChange={(newPage) => setSalaryPage(newPage)}
            actions={actions.length ? actions : undefined}
            columns={[
              { header: "الموظف", accessor: (row: any) => <span className="font-bold">{row.employee?.username || "-"}</span> },
              { header: "الراتب الثابت", accessor: (row: any) => <span className="font-bold text-slate-600">{Number(row.salaryBaseWage || row.employee?.wage || 0).toLocaleString()}</span> },
              { header: "الراتب", accessor: (row: any) => <span className="font-black text-blue-600">{Number(row.amount || 0).toLocaleString()}</span> },
              { header: "الوصف", accessor: (row: any) => <span>{row.description || "-"}</span> },
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

        <div>
          <h2 className="text-lg font-black text-slate-800 dark:text-white mb-3">مصاريف إيجارات</h2>
          <DataTable
            data={rentExpenses}
            totalCount={rentExpenses.length}
            pageSize={PAGE_SIZE}
            currentPage={rentPage}
            onPageChange={(newPage) => setRentPage(newPage)}
            actions={actions.length ? actions : undefined}
            columns={[
              { header: "الوصف", accessor: (row: any) => <span>{row.description || "-"}</span> },
              { header: "المبلغ", accessor: (row: any) => <span className="font-black text-blue-600">{Number(row.amount || 0).toLocaleString()}</span> },
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
            {({ register, watch, setValue, formState: { errors } }) => {
              const type = (watch("type") as "DAILY" | "STAFF_SALARY" | "RENT") || activeType;
              const employeeId = watch("employeeId") || "";
              const selectedEmployee = employees.find((employee) => employee.id === employeeId);

              React.useEffect(() => {
                setActiveType(type);
              }, [type]);

              React.useEffect(() => {
                if (type === "STAFF_SALARY") {
                  setValue("salaryBaseWage", Number(selectedEmployee?.wage || 0), { shouldValidate: true });
                  const currentAmount = Number(watch("amount") || 0);
                  if (currentAmount <= 0) {
                    setValue("amount", Number(selectedEmployee?.wage || 0), { shouldValidate: true });
                  }
                }
              }, [type, selectedEmployee, setValue]);

              return (
                <div className="grid gap-4">
                  <div className="flex flex-col gap-1.5 w-full text-right">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">نوع المصروف</label>
                    <select
                      className="flex h-10 w-full rounded-md border text-slate-700 dark:text-slate-300 text-right border-slate-200 bg-white px-3 py-2 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950"
                      {...register("type")}
                    >
                      <option value="DAILY">مصاريف يومية</option>
                      <option value="STAFF_SALARY">رواتب الموظفين</option>
                      <option value="RENT">مصاريف إيجارات</option>
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

                      <div className="flex flex-col gap-1.5 w-full text-right">
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">الدفع من مكتب</label>
                        <select
                          className="flex h-10 w-full rounded-md border text-slate-700 dark:text-slate-300 text-right border-slate-200 bg-white px-3 py-2 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950"
                          {...register("paidFromOffice")}
                        >
                          <option value="SYRIA">مكتب سوريا</option>
                          <option value="TURKEY">مكتب تركيا</option>
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

                  {type === "STAFF_SALARY" && (
                    <>
                      <div className="flex flex-col gap-1.5 w-full text-right">
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">الموظف</label>
                        <select
                          className="flex h-10 w-full rounded-md border text-slate-700 dark:text-slate-300 text-right border-slate-200 bg-white px-3 py-2 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950"
                          {...register("employeeId")}
                        >
                          <option value="">اختر موظف</option>
                          {employees.map((employee) => (
                            <option key={employee.id} value={employee.id}>
                              {employee.username} - {Number(employee.wage || 0).toLocaleString()}
                            </option>
                          ))}
                        </select>
                      </div>

                      <FormInput
                        className="text-gray-800 dark:text-white"
                        label="الراتب الثابت (من جدول الموظف)"
                        type="number"
                        step="0.01"
                        readOnly
                        value={Number(selectedEmployee?.wage || 0)}
                      />

                      <FormInput
                        className="text-gray-800 dark:text-white"
                        label="الراتب المصروف (قابل للتعديل)"
                        type="number"
                        step="0.01"
                        {...register("amount", { valueAsNumber: true })}
                        error={errors.amount?.message as string}
                      />

                      <FormInput
                        className="text-gray-800 dark:text-white"
                        label="الوصف (اختياري)"
                        {...register("description")}
                        error={errors.description?.message as string}
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
