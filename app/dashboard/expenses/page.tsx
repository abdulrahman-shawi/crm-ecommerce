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
  amount: z.coerce.number().min(0, "المبلغ يجب أن يكون أكبر أو يساوي 0"),
  description: z.string().optional(),
});

export default function ExpensesPage() {
  const { user } = useAuth();
  const [expenses, setExpenses] = React.useState<any[]>([]);
  const [isOpen, setIsOpen] = React.useState(false);
  const [editId, setEditId] = React.useState<number | null>(null);
  const [formData, setFormData] = React.useState<any>(null);
  const [page, setPage] = React.useState(1);
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

  React.useEffect(() => {
    fetchExpenses();
  }, [canView]);

  const handleClose = () => {
    setIsOpen(false);
    setEditId(null);
    setFormData(null);
  };

  const onSubmit = async (data: z.infer<typeof expenseSchema>) => {
    const loadingToast = toast.loading(editId ? "جاري تعديل المصروف..." : "جاري إضافة المصروف...");
    try {
      const payload = {
        amount: Number(data.amount || 0),
        description: String(data.description || "").trim() || null,
      };

      if (editId) {
        const res = await updateExpense(editId, payload);
        if (!res.success) throw new Error("تعذر تعديل المصروف");
        toast.success("تم تعديل المصروف بنجاح");
      } else {
        const res = await createExpense(payload);
        if (!res.success) throw new Error("تعذر إضافة المصروف");
        toast.success("تمت إضافة المصروف بنجاح");
      }

      handleClose();
      fetchExpenses();
    } catch {
      toast.error("حدث خطأ أثناء حفظ المصروف");
    } finally {
      toast.dismiss(loadingToast);
    }
  };

  const handleEdit = (item: any) => {
    setEditId(Number(item.id));
    setFormData({
      amount: Number(item.amount || 0),
      description: item.description || "",
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

  if (!canView) {
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">المصاريف الثابتة</h1>
        <p className="mt-4 text-sm text-slate-500">لا تملك صلاحية عرض هذه الصفحة.</p>
      </div>
    );
  }

  return (
    <div className="p-4" dir="rtl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">المصاريف الثابتة</h1>
        {canAdd && (
          <Button onClick={() => { setEditId(null); setFormData(null); setIsOpen(true); }} className="bg-blue-600 hover:bg-blue-700 text-white px-6">
            <Plus size={16} className="ml-2" />
            إضافة مصروف
          </Button>
        )}
      </div>

      <DataTable
        data={expenses}
        totalCount={expenses.length}
        pageSize={PAGE_SIZE}
        currentPage={page}
        onPageChange={(newPage) => setPage(newPage)}
        actions={actions.length ? actions : undefined}
        columns={[
          { header: "المبلغ", accessor: (row: any) => <span className="font-black text-blue-600">{Number(row.amount || 0).toLocaleString()}</span> },
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

      <AppModal title={editId ? "تعديل مصروف" : "إضافة مصروف"} isOpen={isOpen} onClose={handleClose}>
        <div className="p-2 max-h-[80vh]">
          <DynamicForm
            schema={expenseSchema}
            onSubmit={onSubmit}
            defaultValues={formData || { amount: 0, description: "" }}
            key={editId || "create"}
            submitLabel={editId ? "تحديث" : "إضافة"}
          >
            {({ register, formState: { errors } }) => (
              <div className="grid gap-4">
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
                  label="الوصف"
                  {...register("description")}
                  error={errors.description?.message as string}
                />
              </div>
            )}
          </DynamicForm>
        </div>
      </AppModal>
    </div>
  );
}
