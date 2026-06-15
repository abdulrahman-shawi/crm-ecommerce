"use client";

import { DataTable } from "@/components/shared/DataTable";
import { DynamicForm } from "@/components/shared/dynamic-form";
import { AppModal } from "@/components/ui/app-modal";
import { Button } from "@/components/ui/button";
import { FormInput } from "@/components/ui/form-input";
import { FormSelect } from "@/components/ui/select-form";
import { useAuth } from "@/context/AuthContext";
import { hasAnyPermission } from "@/lib/utils";
import { createWarrantyAction, deleteWarrantyAction, getWarrantyData } from "@/server/warranty";
import { Plus, Trash2 } from "lucide-react";
import React from "react";
import toast from "react-hot-toast";
import z from "zod";

const warrantySchema = z.object({
  type: z.enum(["REPLACEMENT", "MAINTENANCE", "DAMAGED"]),
  customerId: z.string().min(1, "العميل مطلوب"),
  productId: z.coerce.number().min(1, "المنتج مطلوب"),
  warehouseId: z.coerce.number().min(1, "المستودع مطلوب"),
  quantity: z.coerce.number().min(1, "الكمية يجب أن تكون 1 على الأقل").default(1),
  maintenanceLaborCost: z.coerce.number().optional(),
  shippingCost: z.coerce.number().optional(),
  notes: z.string().optional(),
});

const typeLabel: Record<string, string> = {
  REPLACEMENT: "تبديل",
  MAINTENANCE: "صيانة",
  DAMAGED: "تالف",
};

export default function WarrantyPage() {
  const { user } = useAuth();
  const canView = user && hasAnyPermission(user, ["viewOrders", "addOrders", "editOrders", "deleteOrders"]);
  const canAdd = user && hasAnyPermission(user, ["addOrders", "editOrders"]);
  const canDelete = user && hasAnyPermission(user, ["deleteOrders"]);

  const [isOpen, setIsOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [warrantyType, setWarrantyType] = React.useState<"REPLACEMENT" | "MAINTENANCE" | "DAMAGED">("REPLACEMENT");
  const [records, setRecords] = React.useState<any[]>([]);
  const [products, setProducts] = React.useState<any[]>([]);
  const [customers, setCustomers] = React.useState<any[]>([]);
  const [warehouses, setWarehouses] = React.useState<any[]>([]);

  const [replacementPage, setReplacementPage] = React.useState(1);
  const [maintenancePage, setMaintenancePage] = React.useState(1);
  const [damagedPage, setDamagedPage] = React.useState(1);
  const PAGE_SIZE = 10;

  const loadData = async () => {
    if (!canView) return;
    const res = await getWarrantyData();
    if (!res.success) {
      toast.error(String(res.error || "فشل في جلب بيانات الكفالة"));
      return;
    }

    const payload = res.data;
    setRecords(payload?.records || []);
    setProducts(payload?.products || []);
    setCustomers(payload?.customers || []);
    setWarehouses(payload?.warehouses || []);
  };

  React.useEffect(() => {
    loadData();
  }, [canView]);

  const handleClose = () => {
    setIsOpen(false);
    setWarrantyType("REPLACEMENT");
  };

  const onSubmit = async (data: z.infer<typeof warrantySchema>) => {
    setLoading(true);
    const loadingToast = toast.loading("جاري حفظ حركة الكفالة...");
    try {
      const payload = {
        type: data.type,
        customerId: data.customerId,
        productId: Number(data.productId),
        warehouseId: data.warehouseId ? Number(data.warehouseId) : null,
        quantity: Number(data.quantity || 1),
        maintenanceLaborCost:
          data.type === "MAINTENANCE" && data.maintenanceLaborCost != null
            ? Number(data.maintenanceLaborCost)
            : null,
        shippingCost: data.shippingCost != null ? Number(data.shippingCost) : null,
        notes: data.notes || null,
      };

      const res = await createWarrantyAction(payload as any);
      if (!res.success) {
        throw new Error(String(res.error || "فشل حفظ الكفالة"));
      }

      toast.success("تمت إضافة حركة الكفالة بنجاح");
      handleClose();
      loadData();
    } catch (error: any) {
      toast.error(error?.message || "حدث خطأ أثناء حفظ حركة الكفالة");
    } finally {
      setLoading(false);
      toast.dismiss(loadingToast);
    }
  };

  const onDelete = async (item: any) => {
    const confirmDelete = window.confirm("هل تريد حذف سجل الكفالة؟");
    if (!confirmDelete) return;

    const loadingToast = toast.loading("جاري حذف السجل...");
    try {
      const res = await deleteWarrantyAction(item.id);
      if (!res.success) {
        throw new Error(String(res.error || "تعذر الحذف"));
      }
      toast.success("تم حذف سجل الكفالة");
      loadData();
    } catch (error: any) {
      toast.error(error?.message || "حدث خطأ أثناء الحذف");
    } finally {
      toast.dismiss(loadingToast);
    }
  };

  const replacementRows = React.useMemo(
    () => records.filter((row) => String(row.type) === "REPLACEMENT"),
    [records]
  );

  const maintenanceRows = React.useMemo(
    () => records.filter((row) => String(row.type) === "MAINTENANCE"),
    [records]
  );

  const damagedRows = React.useMemo(
    () => records.filter((row) => String(row.type) === "DAMAGED"),
    [records]
  );

  if (!canView) {
    return (
      <div className="p-4" dir="rtl">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">إدارة الكفالة</h1>
        <p className="mt-4 text-sm text-slate-500">لا تملك صلاحية عرض هذه الصفحة.</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-8" dir="rtl">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">إدارة الكفالة</h1>
        {canAdd && (
          <Button
            className="bg-blue-600 hover:bg-blue-700 text-white px-6"
            onClick={() => {
              setWarrantyType("REPLACEMENT");
              setIsOpen(true);
            }}
          >
            <Plus size={16} className="ml-2" />
            إضافة حركة كفالة
          </Button>
        )}
      </div>

      <div>
        <h2 className="text-lg font-black text-slate-800 dark:text-white mb-3">تبديل</h2>
        <DataTable
          data={replacementRows}
          totalCount={replacementRows.length}
          pageSize={PAGE_SIZE}
          currentPage={replacementPage}
          onPageChange={(page) => setReplacementPage(page)}
          actions={
            canDelete
              ? [
                  {
                    label: "حذف",
                    icon: <Trash2 size={14} />,
                    variant: "danger",
                    onClick: onDelete,
                  },
                ]
              : undefined
          }
          columns={[
            { header: "العميل", accessor: (row: any) => row.customer?.name || "-" },
            { header: "المنتج المرتجع", accessor: (row: any) => row.product?.name || "-" },
            { header: "المستودع", accessor: (row: any) => row.warehouse?.name || "-" },
            { header: "الكمية", accessor: (row: any) => <span className="font-black text-red-600">-{row.quantity}</span> },
            { header: "رقم الطلب", accessor: (row: any) => row.order?.orderNumber || "-" },
            {
              header: "التاريخ",
              accessor: (row: any) =>
                new Date(row.createdAt).toLocaleDateString("ar-EG", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                }),
            },
            { header: "ملاحظات", accessor: (row: any) => row.notes || "-" },
          ]}
        />
      </div>

      <div>
        <h2 className="text-lg font-black text-slate-800 dark:text-white mb-3">صيانة</h2>
        <DataTable
          data={maintenanceRows}
          totalCount={maintenanceRows.length}
          pageSize={PAGE_SIZE}
          currentPage={maintenancePage}
          onPageChange={(page) => setMaintenancePage(page)}
          actions={
            canDelete
              ? [
                  {
                    label: "حذف",
                    icon: <Trash2 size={14} />,
                    variant: "danger",
                    onClick: onDelete,
                  },
                ]
              : undefined
          }
          columns={[
            { header: "العميل", accessor: (row: any) => row.customer?.name || "-" },
            { header: "المنتج", accessor: (row: any) => row.product?.name || "-" },
            { header: "المستودع", accessor: (row: any) => row.warehouse?.name || "-" },
            { header: "الكمية", accessor: (row: any) => <span className="font-black text-red-600">-{row.quantity}</span> },
            { header: "أجور الصيانة", accessor: (row: any) => (row.maintenanceLaborCost != null ? Number(row.maintenanceLaborCost).toLocaleString() : "-") },
            { header: "أجور الشحن", accessor: (row: any) => (row.shippingCost != null ? Number(row.shippingCost).toLocaleString() : "-") },
            {
              header: "التاريخ",
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
        <h2 className="text-lg font-black text-slate-800 dark:text-white mb-3">تالف</h2>
        <DataTable
          data={damagedRows}
          totalCount={damagedRows.length}
          pageSize={PAGE_SIZE}
          currentPage={damagedPage}
          onPageChange={(page) => setDamagedPage(page)}
          actions={
            canDelete
              ? [
                  {
                    label: "حذف",
                    icon: <Trash2 size={14} />,
                    variant: "danger",
                    onClick: onDelete,
                  },
                ]
              : undefined
          }
          columns={[
            { header: "العميل", accessor: (row: any) => row.customer?.name || "-" },
            { header: "المنتج", accessor: (row: any) => row.product?.name || "-" },
            { header: "المستودع", accessor: (row: any) => row.warehouse?.name || "-" },
            { header: "الكمية", accessor: (row: any) => <span className="font-black text-red-600">-{row.quantity}</span> },
            {
              header: "التاريخ",
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

      <AppModal title="إضافة حركة كفالة" isOpen={isOpen} onClose={handleClose}>
        <div className="p-2">
          <DynamicForm
            schema={warrantySchema}
            onSubmit={onSubmit}
            submitLabel={loading ? "جاري الحفظ..." : "حفظ"}
            defaultValues={{
              type: warrantyType,
              customerId: "",
              productId: undefined,
              warehouseId: undefined,
              quantity: 1,
              maintenanceLaborCost: undefined,
              shippingCost: undefined,
              notes: "",
            }}
          >
            {({ register, watch, setValue, formState: { errors } }) => {
              const currentType = watch("type") || warrantyType;
              const productOptions = products.map((product) => ({
                value: String(product.id),
                label: product.name,
              }));
              const customerOptions = customers.map((customer) => ({
                value: customer.id,
                label: customer.name,
              }));
              const warehouseOptions = warehouses.map((warehouse) => ({
                value: String(warehouse.id),
                label: `${warehouse.name} (${warehouse.location})`,
              }));

              return (
                <div className="grid gap-4">
                  <FormSelect
                    className="text-gray-800 dark:text-white"
                    label="نوع الكفالة"
                    options={[
                      { value: "REPLACEMENT", label: typeLabel.REPLACEMENT },
                      { value: "MAINTENANCE", label: typeLabel.MAINTENANCE },
                      { value: "DAMAGED", label: typeLabel.DAMAGED },
                    ]}
                    {...register("type", {
                      onChange: (e) => {
                        const nextType = e.target.value as "REPLACEMENT" | "MAINTENANCE" | "DAMAGED";
                        setWarrantyType(nextType);
                        if (nextType !== "MAINTENANCE") {
                          setValue("maintenanceLaborCost", undefined as any);
                        }
                      },
                    })}
                    error={errors.type?.message as string}
                  />

                  <FormSelect
                    className="text-gray-800 dark:text-white"
                    label="العميل"
                    options={customerOptions}
                    {...register("customerId")}
                    error={errors.customerId?.message as string}
                  />

                  <FormSelect
                    className="text-gray-800 dark:text-white"
                    label={currentType === "REPLACEMENT" ? "المنتج المرتجع" : "المنتج"}
                    options={productOptions}
                    {...register("productId")}
                    error={errors.productId?.message as string}
                  />

                  <FormSelect
                    className="text-gray-800 dark:text-white"
                    label="المستودع"
                    options={warehouseOptions}
                    {...register("warehouseId")}
                    error={errors.warehouseId?.message as string}
                  />

                  <FormInput
                    className="text-gray-800 dark:text-white"
                    type="number"
                    min={1}
                    label="الكمية"
                    {...register("quantity")}
                    error={errors.quantity?.message as string}
                  />

                  {currentType === "MAINTENANCE" && (
                    <>
                      <FormInput
                        className="text-gray-800 dark:text-white"
                        type="number"
                        min={0}
                        step="any"
                        label="أجور الصيانة (اختياري)"
                        {...register("maintenanceLaborCost")}
                        error={errors.maintenanceLaborCost?.message as string}
                      />
                      <FormInput
                        className="text-gray-800 dark:text-white"
                        type="number"
                        min={0}
                        step="any"
                        label="أجور الشحن (اختياري)"
                        {...register("shippingCost")}
                        error={errors.shippingCost?.message as string}
                      />
                    </>
                  )}

                  {currentType !== "MAINTENANCE" && (
                    <FormInput
                      className="text-gray-800 dark:text-white"
                      type="number"
                      min={0}
                      step="any"
                      label="أجور الشحن (اختياري)"
                      {...register("shippingCost")}
                      error={errors.shippingCost?.message as string}
                    />
                  )}

                  <FormInput
                    className="text-gray-800 dark:text-white"
                    label="ملاحظات (اختياري)"
                    {...register("notes")}
                    error={errors.notes?.message as string}
                  />
                </div>
              );
            }}
          </DynamicForm>
        </div>
      </AppModal>
    </div>
  );
}
