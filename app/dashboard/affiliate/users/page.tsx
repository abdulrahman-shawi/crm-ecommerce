'use client';

import * as React from 'react';
import z from 'zod';
import toast from 'react-hot-toast';
import PhoneInput from 'react-phone-number-input';
import { Controller } from 'react-hook-form';
import { DynamicForm } from '@/components/shared/dynamic-form';
import { AppModal } from '@/components/ui/app-modal';
import { FormInput } from '@/components/ui/form-input';
import { getAffiliateUsersAdminList, setAffiliateUserApproval, transferAffiliateDeliveredCommissions } from '@/server/affiliate';
import { deleteuser, updateuser } from '@/server/user';

const userSchema = z.object({
  username: z.string().min(3, 'اسم المستخدم مطلوب'),
  email: z.string().email('بريد غير صالح'),
  phone: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  password: z.string().min(6, 'كلمة المرور ضعيفة').optional().or(z.literal('')),
  jobTitle: z.string().min(2, 'المسمى الوظيفي مطلوب'),
  accountType: z.enum(['ADMIN', 'MANAGER', 'STAFF', 'AFFILIATE']),
  isAffiliate: z.boolean().optional().default(false),
  permissions: z.string().min(1, 'يرجى اختيار صلاحية'),
  salesCommissionPercent: z.preprocess(
    (value) => (typeof value === 'string' ? value.replace(/[٫,]/g, '.') : value),
    z.coerce.number().min(0).optional()
  ),
  wage: z.coerce.number().int().min(0).optional(),
});

type AffiliateUserRow = {
  id: string;
  username: string;
  email: string;
  phone?: string | null;
  notes?: string | null;
  jobTitle?: string | null;
  accountType: 'ADMIN' | 'MANAGER' | 'STAFF' | 'AFFILIATE' | string;
  isAffiliate: boolean;
  salesCommissionPercent?: number | null;
  wage?: number | null;
  affiliateApproved: boolean;
  affiliateRequestedAt?: string | Date | null;
  affiliateApprovedAt?: string | Date | null;
  createdAt?: string | Date;
  permission?: {
    id: string;
    roleName?: string | null;
  } | null;
  affiliateLinks?: Array<{ id: string }>;
  deliveredOrdersCount?: number;
  deliveredCommissionTotal?: number;
  transferredTotal?: number;
  availableTransferAmount?: number;
  lastTransferAt?: string | Date | null;
  walletTransfersCount?: number;
};

type AffiliateUsersPayload = {
  summary: {
    total: number;
    pending: number;
    approved: number;
  };
  users: AffiliateUserRow[];
};

const defaultPayload: AffiliateUsersPayload = {
  summary: {
    total: 0,
    pending: 0,
    approved: 0,
  },
  users: [],
};

const formatDate = (value?: string | Date | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('ar');
};

const formatAmount = (value?: number | null) => Number(value || 0).toFixed(2);

export default function AffiliateUsersPage() {
  const [payload, setPayload] = React.useState<AffiliateUsersPayload>(defaultPayload);
  const [loading, setLoading] = React.useState(true);
  const [roles, setRoles] = React.useState<Array<{ id: string; roleName: string }>>([]);
  const [savingByUser, setSavingByUser] = React.useState<Record<string, boolean>>({});
  const [transferringByUser, setTransferringByUser] = React.useState<Record<string, boolean>>({});
  const [isEditOpen, setIsEditOpen] = React.useState(false);
  const [editId, setEditId] = React.useState<string | null>(null);
  const [formData, setFormData] = React.useState<z.infer<typeof userSchema> | null>(null);

  const selectClasses = 'w-full rounded-md border border-gray-300 bg-white p-3 text-gray-900 outline-none transition-all focus:ring-2 focus:ring-blue-500/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200';

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const result = await getAffiliateUsersAdminList();
      if (!result.success || !result.data) {
        toast.error(result.error || 'تعذر جلب مستخدمي الأفلييت');
        setPayload(defaultPayload);
        return;
      }
      setPayload(result.data as AffiliateUsersPayload);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  React.useEffect(() => {
    const loadRoles = async () => {
      try {
        const response = await fetch('/api/permissions');
        const result = await response.json();
        if (result?.success && Array.isArray(result.data)) {
          setRoles(result.data);
          return;
        }
        toast.error('تعذر جلب مجموعات الصلاحيات');
      } catch {
        toast.error('تعذر جلب مجموعات الصلاحيات');
      }
    };

    void loadRoles();
  }, []);

  const handleCloseEdit = () => {
    setIsEditOpen(false);
    setEditId(null);
    setFormData(null);
  };

  const handleApprovalChange = async (userId: string, approved: boolean) => {
    setSavingByUser((prev) => ({ ...prev, [userId]: true }));
    try {
      const result = await setAffiliateUserApproval(userId, approved);
      if (!result.success) {
        toast.error(result.error || 'تعذر تحديث حالة الموافقة');
        return;
      }

      toast.success(approved ? 'تمت الموافقة على حساب الأفلييت' : 'تم إلغاء الموافقة على حساب الأفلييت');
      await loadData();
    } finally {
      setSavingByUser((prev) => ({ ...prev, [userId]: false }));
    }
  };

  const handleTransfer = async (userId: string) => {
    setTransferringByUser((prev) => ({ ...prev, [userId]: true }));
    try {
      const result = await transferAffiliateDeliveredCommissions(userId);
      if (!result.success) {
        toast.error(result.error || 'تعذر تحويل العمولات');
        return;
      }

      toast.success(`تم تحويل ${formatAmount(result.data?.transfer?.amount)} إلى المستخدم`);
      await loadData();
    } finally {
      setTransferringByUser((prev) => ({ ...prev, [userId]: false }));
    }
  };

  const handleEdit = (user: AffiliateUserRow) => {
    setEditId(user.id);
    setFormData({
      username: user.username,
      email: user.email,
      phone: user.phone || '',
      notes: user.notes || '',
      password: '',
      jobTitle: user.jobTitle || '',
      accountType: (['ADMIN', 'MANAGER', 'STAFF', 'AFFILIATE'].includes(String(user.accountType).toUpperCase())
        ? String(user.accountType).toUpperCase()
        : 'AFFILIATE') as z.infer<typeof userSchema>['accountType'],
      isAffiliate: Boolean(user.isAffiliate),
      permissions: user.permission?.id || '',
      salesCommissionPercent: Number(user.salesCommissionPercent || 0),
      wage: Number(user.wage || 0),
    });
    setIsEditOpen(true);
  };

  const handleSubmit = async (data: z.infer<typeof userSchema>) => {
    if (!editId) return;

    const loadingToast = toast.loading('جاري تحديث بيانات الحساب...');
    try {
      const result = await updateuser(editId, data);
      if (!result?.success) {
        toast.error(result?.error || 'فشل في تحديث بيانات المستخدم');
        return;
      }

      toast.success('تم تحديث بيانات المستخدم بنجاح');
      handleCloseEdit();
      await loadData();
    } catch {
      toast.error('حدث خطأ غير متوقع أثناء التحديث');
    } finally {
      toast.dismiss(loadingToast);
    }
  };

  const handleDelete = async (userId: string) => {
    const confirmed = window.confirm('هل أنت متأكد من حذف هذا المستخدم؟');
    if (!confirmed) return;

    const loadingToast = toast.loading('جاري حذف المستخدم...');
    try {
      const result = await deleteuser(userId);
      if (!result.success) {
        toast.error(result.error || 'فشل في حذف المستخدم');
        return;
      }

      toast.success('تم حذف المستخدم بنجاح');
      await loadData();
    } catch {
      toast.error('فشل في حذف المستخدم');
    } finally {
      toast.dismiss(loadingToast);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white">مستخدمو الأفلييت</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">أي حساب أفلييت جديد يبقى بانتظار موافقة الأدمن قبل أن يتمكن من تسجيل الدخول أو استخدام روابط الأفلييت.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400">إجمالي حسابات الأفلييت</div>
          <div className="mt-2 text-3xl font-black text-slate-900 dark:text-white">{payload.summary.total}</div>
        </div>
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/20">
          <div className="text-xs font-bold text-amber-700 dark:text-amber-300">بانتظار الموافقة</div>
          <div className="mt-2 text-3xl font-black text-amber-800 dark:text-amber-200">{payload.summary.pending}</div>
        </div>
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <div className="text-xs font-bold text-emerald-700 dark:text-emerald-300">تمت الموافقة</div>
          <div className="mt-2 text-3xl font-black text-emerald-800 dark:text-emerald-200">{payload.summary.approved}</div>
        </div>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-black text-slate-900 dark:text-white">قائمة الطلبات</h2>
          {loading ? <span className="text-sm text-slate-500">جاري التحميل...</span> : null}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-right text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <th className="px-3 py-3">المستخدم</th>
                <th className="px-3 py-3">الوظيفة</th>
                <th className="px-3 py-3">الهاتف</th>
                <th className="px-3 py-3">تاريخ الطلب</th>
                <th className="px-3 py-3">تاريخ الموافقة</th>
                <th className="px-3 py-3">عدد الروابط</th>
                <th className="px-3 py-3">طلبات مسلمة</th>
                <th className="px-3 py-3">عمولات مستحقة</th>
                <th className="px-3 py-3">تم تحويله</th>
                <th className="px-3 py-3">قابل للتحويل</th>
                <th className="px-3 py-3">الحالة</th>
                <th className="px-3 py-3">الإجراء</th>
              </tr>
            </thead>
            <tbody>
              {payload.users.map((user) => (
                <tr key={user.id} className="border-b border-slate-100 dark:border-slate-800/80">
                  <td className="px-3 py-4">
                    <div className="font-black text-slate-900 dark:text-white">{user.username}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{user.email}</div>
                    {user.notes ? <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{user.notes}</div> : null}
                  </td>
                  <td className="px-3 py-4">{user.jobTitle || '-'}</td>
                  <td className="px-3 py-4">{user.phone || '-'}</td>
                  <td className="px-3 py-4">{formatDate(user.affiliateRequestedAt || user.createdAt)}</td>
                  <td className="px-3 py-4">{formatDate(user.affiliateApprovedAt)}</td>
                  <td className="px-3 py-4">{Array.isArray(user.affiliateLinks) ? user.affiliateLinks.length : 0}</td>
                  <td className="px-3 py-4">{Number(user.deliveredOrdersCount || 0)}</td>
                  <td className="px-3 py-4 font-bold text-emerald-700 dark:text-emerald-300">{formatAmount(user.deliveredCommissionTotal)}</td>
                  <td className="px-3 py-4">
                    <div className="font-bold text-slate-700 dark:text-slate-200">{formatAmount(user.transferredTotal)}</div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {Number(user.walletTransfersCount || 0)} تحويلة
                      {user.lastTransferAt ? ` - آخرها ${formatDate(user.lastTransferAt)}` : ''}
                    </div>
                  </td>
                  <td className="px-3 py-4 font-bold text-sky-700 dark:text-sky-300">{formatAmount(user.availableTransferAmount)}</td>
                  <td className="px-3 py-4">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${user.affiliateApproved ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'}`}>
                      {user.affiliateApproved ? 'موافق عليه' : 'معلق'}
                    </span>
                  </td>
                  <td className="px-3 py-4">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleApprovalChange(user.id, true)}
                        disabled={savingByUser[user.id] || user.affiliateApproved}
                        className="rounded-xl border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        موافقة
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApprovalChange(user.id, false)}
                        disabled={savingByUser[user.id] || !user.affiliateApproved}
                        className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        إلغاء الموافقة
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTransfer(user.id)}
                        disabled={transferringByUser[user.id] || !user.affiliateApproved || Number(user.availableTransferAmount || 0) <= 0}
                        className="rounded-xl border border-sky-200 px-3 py-2 text-xs font-bold text-sky-700 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        تحويل العمولات
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEdit(user)}
                        className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        تعديل
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(user.id)}
                        className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-300 dark:hover:bg-rose-950/30"
                      >
                        حذف
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && payload.users.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">لا توجد حسابات أفلييت حتى الآن.</p>
        ) : null}
      </section>

      <AppModal title="تعديل بيانات حساب الأفلييت" isOpen={isEditOpen} onClose={handleCloseEdit}>
        <div className="max-h-[80vh] p-2">
          <DynamicForm
            schema={userSchema}
            onSubmit={handleSubmit}
            defaultValues={formData}
            key={editId || 'affiliate-edit'}
            submitLabel="تحديث البيانات"
          >
            {({ register, control, formState: { errors } }) => (
              <div className="grid gap-4">
                <FormInput className="text-gray-800 dark:text-white" label="اسم المستخدم" {...register('username')} error={errors.username?.message as string} />
                <FormInput className="text-gray-800 dark:text-white" label="البريد الإلكتروني" {...register('email')} error={errors.email?.message as string} />
                <FormInput className="text-gray-800 dark:text-white" label="ملاحظات المستخدم" {...register('notes')} error={errors.notes?.message as string} />
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold dark:text-slate-300">رقم الهاتف</label>
                  <div className="dir-ltr">
                    <Controller
                      name="phone"
                      control={control}
                      render={({ field: { onChange, value } }) => (
                        <PhoneInput
                          international
                          withCountryCallingCode
                          defaultCountry="SY"
                          value={typeof value === 'string' ? value : undefined}
                          onChange={(nextValue) => onChange(nextValue ?? '')}
                          className="PhoneInputCustom"
                          numberInputProps={{
                            className: 'w-full rounded-md border border-gray-300 bg-white p-3 text-gray-900 outline-none transition-all focus:ring-2 focus:ring-blue-500/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200',
                          }}
                        />
                      )}
                    />
                  </div>
                  {errors.phone && <p className="text-xs text-red-500">{errors.phone.message as string}</p>}
                </div>
                <FormInput className="text-gray-800 dark:text-white" label="كلمة المرور" type="password" {...register('password')} placeholder="اتركها فارغة لعدم التغيير" error={errors.password?.message as string} />
                <FormInput className="text-gray-800 dark:text-white" label="المسمى الوظيفي" {...register('jobTitle')} error={errors.jobTitle?.message as string} />
                <FormInput
                  className="text-gray-800 dark:text-white"
                  label="نسبة عمولة المبيعات (%)"
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]+([.,][0-9]+)?"
                  min={0}
                  {...register('salesCommissionPercent')}
                  error={errors.salesCommissionPercent?.message as string}
                />
                <FormInput
                  className="text-gray-800 dark:text-white"
                  label="البدل الثابت"
                  type="number"
                  step="1"
                  min={0}
                  {...register('wage')}
                  error={errors.wage?.message as string}
                />
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold dark:text-slate-300">نوع الحساب</label>
                  <select className={selectClasses} {...register('accountType')}>
                    <option value="ADMIN">مشرف نظام</option>
                    <option value="MANAGER">مدير</option>
                    <option value="STAFF">موظف</option>
                    <option value="AFFILIATE">أفلييت</option>
                  </select>
                </div>
                <label className="flex items-center gap-3 rounded-md border border-slate-200 px-3 py-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-300">
                  <input type="checkbox" className="h-4 w-4" {...register('isAffiliate')} />
                  <span>هذا الحساب أفلييت ويحتاج موافقة الأدمن قبل الاستخدام</span>
                </label>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold dark:text-slate-300">مجموعة الصلاحيات</label>
                  <select className={selectClasses} {...register('permissions')}>
                    <option value="">اختر الصلاحية...</option>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>{role.roleName}</option>
                    ))}
                  </select>
                  {errors.permissions && <p className="text-xs text-red-500">{errors.permissions.message as string}</p>}
                </div>
              </div>
            )}
          </DynamicForm>
        </div>
      </AppModal>
    </div>
  );
}