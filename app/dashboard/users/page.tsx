'use client';

import { DynamicForm } from '@/components/shared/dynamic-form';
import { FormInput } from '@/components/ui/form-input';
import { useAuth } from '@/context/AuthContext';
import * as React from 'react';
import z from 'zod';
import toast from 'react-hot-toast';
import { deleteuser, setUserTargetProduct, updateUserTargetProductQty, updateuser } from '@/server/user'; // تأكد من وجود updateuser
import { Button } from '@/components/ui/button';
import { AppModal } from '@/components/ui/app-modal';
import { Mail, Plus } from 'lucide-react';
import { DataTable } from '@/components/shared/DataTable';
import { hasPermission } from '@/lib/utils';
import { getProduct } from '@/server/product';

const userSchema = z.object({
  username: z.string().min(3, "اسم المستخدم مطلوب"),
  email: z.string().email("بريد غير صالح"),
  phone: z.string().optional().nullable(),
  password: z.string().min(6, "كلمة المرور ضعيفة").optional().or(z.literal('')), // اختيارية عند التعديل
  jobTitle: z.string().min(2, "المسمى الوظيفي مطلوب"),
  accountType: z.enum(["ADMIN", "MANAGER", "STAFF"]),
  permissions: z.string().min(1, "يرجى اختيار صلاحية"),
});

const UserManagement: React.FunctionComponent = () => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [editId, setEditId] = React.useState<string | null>(null);
  const [roles, setRoles] = React.useState<any[]>([]);
  const [users, setUsers] = React.useState<any[]>([]);
  const [formData, setFormData] = React.useState<any>(null);
  const [products, setProducts] = React.useState<any[]>([]);
  const [isTargetOpen, setIsTargetOpen] = React.useState(false);
  const [targetMode, setTargetMode] = React.useState<"assign" | "edit">("assign");
  const [targetUser, setTargetUser] = React.useState<any>(null);
  const [targetProductId, setTargetProductId] = React.useState<string>("");
  const [targetQty, setTargetQty] = React.useState<number>(1);
  const {user} = useAuth()
  const getAlluser = async () => {
    try {
      const res = await fetch("/api/users")
      const data = await res.json()
      setUsers(data.data);
      console.log("Users:", res);
    } catch (error) {

    }
  }
  const getRoul = async () => {
     try {
            const res = await fetch('/api/permissions');
            const response = await res.json();
            if (response.success && Array.isArray(response.data)) {
                setRoles(response.data);
            }
        } catch (err) {
            toast.error("خطأ في جلب البيانات");
        }
  }

  React.useEffect(() => { getRoul(); getAlluser(); }, []);
  React.useEffect(() => {
    getProduct().then(setProducts).catch(console.error);
  }, []);

  const [page, setPage] = React.useState(1);
  const PAGE_SIZE = 10;

  const handleClose = () => {
    setIsOpen(false);
    setEditId(null);
    setFormData(null);
  };

  const openTargetModal = (mode: "assign" | "edit", data: any) => {
    setTargetMode(mode);
    setTargetUser(data);
    if (mode === "edit" && data?.targetProducts?.length > 0) {
      const firstTarget = data.targetProducts[0];
      setTargetProductId(String(firstTarget.productId));
      setTargetQty(firstTarget.requiredQty || 1);
    } else {
      setTargetProductId("");
      setTargetQty(1);
    }
    setIsTargetOpen(true);
  };

  const handleSaveTarget = async () => {
    if (!targetUser?.id) return;
    if (!targetProductId) {
      toast.error("يرجى اختيار المنتج");
      return;
    }
    if (!targetQty || targetQty <= 0) {
      toast.error("يرجى إدخال كمية صحيحة");
      return;
    }

    const loadingToast = toast.loading("جاري حفظ التاركت...");
    try {
      const productId = Number(targetProductId);
      const res = targetMode === "assign"
        ? await setUserTargetProduct(targetUser.id, productId, targetQty)
        : await updateUserTargetProductQty(targetUser.id, productId, targetQty);

      if (res.success) {
        toast.success("تم حفظ التاركت بنجاح");
        setIsTargetOpen(false);
        getAlluser();
      } else {
        toast.error(res.error || "فشل حفظ التاركت");
      }
    } catch (error) {
      toast.error("فشل حفظ التاركت");
    } finally {
      toast.dismiss(loadingToast);
    }
  };

  const onSubmit = async (data: z.infer<typeof userSchema>) => {
  const loadingToast = toast.loading(editId ? 'جاري تحديث البيانات...' : 'جاري إنشاء الحساب...');
  try {
    let response;
    if (editId) {
      // تحديث مستخدم موجود
      const res = await updateuser(editId, data);
      if (res?.success) {
        toast.success('تم التحديث بنجاح');
        getAlluser();
      } else {
        toast.error(res?.error || 'فشل التحديث');
      }
    } else {
      // إنشاء مستخدم جديد عبر API
      const res = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json", // ضروري جداً ليتمكن السيرفر من قراءة البيانات
        },
        body: JSON.stringify(data), // تحويل الكائن إلى نص JSON
      });
      
      const result = await res.json();

      if (result.success) {
        toast.success('تم إنشاء المستخدم بنجاح');
        getAlluser();
      } else {
        toast.error(result.error || 'فشل في إنشاء المستخدم');
      }
    }
    handleClose();
  } catch (error) {
    console.error(error);
    toast.error('حدث خطأ غير متوقع');
  } finally {
    toast.dismiss(loadingToast);
  }
};
  const selectClasses = `w-full p-3 rounded-md border transition-all outline-none bg-white border-gray-300 text-gray-900 dark:bg-[#0f172a] dark:border-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500/50`;

  // هذا الجزء يستخدم عادة داخل مكون الجدول (DataTable)
  const tableActions: any[] = [
    (user && hasPermission(user, "editEmployees")) &&
    {
      label: "تعديل",
      icon: <Mail size={14} />,
      onClick: (data: any) => {
        setEditId(data.id);
        setFormData({
          username: data.username,
          email: data.email,
          phone: data.phone,
          jobTitle: data.jobTitle,
          accountType: data.accountType,
          permissions: data.permission.id || "", // الربط مع ID الصلاحية
        });
        console.log("data", data);
        setIsOpen(true);
      }
    },
    (user && hasPermission(user, "deleteEmployees")) &&
    {
      label: "حذف",
      icon: <Plus className="rotate-45" size={14} />,
      variant: "danger",
      onClick: async (data: any) => {
        const confirm = window.confirm("هل أنت متأكد من حذف هذا المستخدم؟");
        if (confirm) {
          const loadingToast = toast.loading('جاري الحذف...');
          try {
            // استدعاء دالة الحذف من السيرفر هنا
            const res = await deleteuser(data.id);
            if (res.success) {
              toast.success('تم حذف المستخدم بنجاح');
              getAlluser(); // تحديث قائمة المستخدمين بعد الحذف
            } else {
              toast.error(res.error || 'فشل في حذف المستخدم');
            }
          } catch (error) {
            toast.error('فشل في حذف المستخدم');
          } finally {
            toast.dismiss(loadingToast);
          }
        }
      }
    },
  ];

  return (
    <div className="p-4" dir="rtl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">إدارة المستخدمين</h1>
        {user && hasPermission(user, "addEmployees") && (
          <Button onClick={() => { setEditId(null); setFormData(null); setIsOpen(true); }} className="bg-blue-600 hover:bg-blue-700 text-white px-6">
          إضافة مستخدم جديد
        </Button>
        )}
      </div>
      <DataTable data={users} 
       totalCount={users.length} // لنفترض وجود 150 عميل في الداتا بيز
                pageSize={PAGE_SIZE}
                currentPage={page}
                onPageChange={(newPage) => setPage(newPage)}
      actions={tableActions} columns={
        [
          { header: "الاسم", accessor: "username" },
          { header: "البريد الإلكتروني", accessor: "email" },
          { header: "رقم الهاتف", accessor: "phone" },
          { header: "المسمى الوظيفي", accessor: "jobTitle" },
          { header: "نوع الحساب", accessor: "accountType" },
          { header: "مجموعة الصلاحيات", accessor: (row: any) => row.permission?.roleName || "غير محدد" },
          { 
            header: "التاركت", 
            accessor: (row: any) => (
              <div className="flex items-center gap-2">
                <button
                  className="px-2 py-1 text-xs font-bold bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200"
                  onClick={() => openTargetModal("assign", row)}
                >
                  تعيين المنتج
                </button>
                <button
                  className="px-2 py-1 text-xs font-bold bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200"
                  onClick={() => openTargetModal("edit", row)}
                >
                  تعديل التاركت
                </button>
              </div>
            )
          },
        ]
      } />

      <AppModal
        title={editId ? "تعديل بيانات المستخدم" : "إضافة مستخدم جديد"}
        isOpen={isOpen}
        onClose={handleClose}
      >
        <div className="p-2 max-h-[80vh]">
          <DynamicForm
            schema={userSchema}
            onSubmit={onSubmit}
            defaultValues={formData} // تمرير البيانات الافتراضية عند التعديل
            key={editId || 'create'} // لإعادة بناء الفورم عند التبديل بين تعديل وإضافة
            submitLabel={editId ? 'تحديث البيانات' : 'إرسال البيانات'}
          >
            {({ register, formState: { errors } }) => (
              <div className="grid gap-4">
                <FormInput className='text-gray-800 dark:text-white' label="اسم المستخدم" {...register("username")} error={errors.username?.message as string} />
                <FormInput className='text-gray-800 dark:text-white' label="البريد الإلكتروني" {...register("email")} error={errors.email?.message as string} />
                <FormInput className='text-gray-800 dark:text-white' label="رقم الهاتف" {...register("phone")} error={errors.phone?.message as string} />
                <FormInput className='text-gray-800 dark:text-white' label="كلمة المرور" type="password" {...register("password")} placeholder={editId ? "اتركها فارغة لعدم التغيير" : ""} error={errors.password?.message as string} />
                <FormInput className='text-gray-800 dark:text-white' label="المسمى الوظيفي" {...register("jobTitle")} error={errors.jobTitle?.message as string} />

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold dark:text-slate-300">نوع الحساب</label>
                  <select className={selectClasses} {...register("accountType")}>
                    <option value="ADMIN">مشرف نظام</option>
                    <option value="MANAGER">مدير</option>
                    <option value="STAFF">موظف</option>
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold dark:text-slate-300">مجموعة الصلاحيات</label>
                  <select className={selectClasses} {...register("permissions")}>
                    <option value="">اختر الصلاحية...</option>
                    {roles.map((role: any) => (
                      <option key={role.id} value={role.id}>{role.roleName}</option>
                    ))}
                  </select>
                  {errors.permissions && <p className="text-red-500 text-xs">{errors.permissions.message as string}</p>}
                </div>
              </div>
            )}
          </DynamicForm>
        </div>
      </AppModal>

      <AppModal
        title={targetMode === "assign" ? "تعيين منتج للتاركت" : "تعديل التاركت"}
        isOpen={isTargetOpen}
        onClose={() => setIsTargetOpen(false)}
      >
        <div className="p-4">
          {targetMode === "edit" && (!targetUser?.targetProducts || targetUser.targetProducts.length === 0) ? (
            <div className="text-sm text-slate-500">لا يوجد منتجات مرتبطة بتاركت لهذا المستخدم.</div>
          ) : (
            <div className="grid gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold dark:text-slate-300">المنتج</label>
                <select
                  className={selectClasses}
                  value={targetProductId}
                  onChange={(e) => {
                    const value = e.target.value;
                    setTargetProductId(value);
                    if (targetMode === "edit") {
                      const selected = targetUser?.targetProducts?.find((t: any) => String(t.productId) === value);
                      if (selected) setTargetQty(selected.requiredQty || 1);
                    }
                  }}
                >
                  <option value="">اختر المنتج...</option>
                  {(targetMode === "assign" ? products : (targetUser?.targetProducts || []))
                    .map((item: any) => {
                      const product = targetMode === "assign" ? item : item.product;
                      return (
                        <option key={product.id} value={product.id}>{product.name}</option>
                      );
                    })}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold dark:text-slate-300">الكمية المطلوبة</label>
                <input
                  type="number"
                  min={1}
                  className={selectClasses}
                  value={targetQty}
                  onChange={(e) => setTargetQty(Number(e.target.value))}
                />
              </div>

              <div className="flex items-center gap-2 justify-end">
                <Button onClick={handleSaveTarget} className="bg-blue-600 hover:bg-blue-700 text-white">
                  حفظ
                </Button>
              </div>
            </div>
          )}
        </div>
      </AppModal>
    </div>
  );
};

export default UserManagement;