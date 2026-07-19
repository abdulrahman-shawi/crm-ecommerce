'use client';

import * as React from 'react';
import z from 'zod';
import toast from 'react-hot-toast';
import { Edit, Trash2 } from 'lucide-react';
import { DynamicForm } from '@/components/shared/dynamic-form';
import { AppModal } from '@/components/ui/app-modal';
import { FormInput } from '@/components/ui/form-input';
import { FormTextArea } from '@/components/ui/textera-form';
import {
  deleteAffiliateWalletTransferAdmin,
  getAffiliateWalletTransfersAdminList,
  updateAffiliateWalletTransferAdmin,
} from '@/server/affiliate';

const walletTransferSchema = z.object({
  userId: z.string().min(1, 'يرجى اختيار مستخدم أفلييت'),
  amount: z.preprocess(
    (value) => (typeof value === 'string' ? value.replace(/[٫,]/g, '.') : value),
    z.coerce.number().positive('قيمة التحويلة يجب أن تكون أكبر من صفر')
  ),
  status: z.enum(['PENDING', 'RECEIVED']),
  reference: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
  transferredAt: z.string().min(1, 'تاريخ التحويل مطلوب'),
  receivedAt: z.string().optional().or(z.literal('')),
});

type WalletTransferRow = {
  id: string;
  userId: string;
  amount: number;
  status: 'PENDING' | 'RECEIVED';
  reference?: string | null;
  notes?: string | null;
  transferredAt: string | Date;
  receivedAt?: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  user: {
    id: string;
    username: string;
    email?: string | null;
    phone?: string | null;
    affiliateApproved?: boolean | null;
  };
};

type AffiliateUserOption = {
  id: string;
  username: string;
  email?: string | null;
  affiliateApproved?: boolean | null;
};

type WalletTransferPayload = {
  transfers: WalletTransferRow[];
  affiliateUsers: AffiliateUserOption[];
  summary: {
    total: number;
    pending: number;
    received: number;
    totalAmount: number;
  };
};

const emptyPayload: WalletTransferPayload = {
  transfers: [],
  affiliateUsers: [],
  summary: {
    total: 0,
    pending: 0,
    received: 0,
    totalAmount: 0,
  },
};

const formatDate = (value?: string | Date | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('ar');
};

const formatDateTimeLocal = (value?: string | Date | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const timezoneOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
};

const formatAmount = (value?: number | null) => Number(value || 0).toFixed(2);

export default function AffiliateWalletTransfersPage() {
  const [payload, setPayload] = React.useState<WalletTransferPayload>(emptyPayload);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [isEditOpen, setIsEditOpen] = React.useState(false);
  const [editId, setEditId] = React.useState<string | null>(null);
  const [formData, setFormData] = React.useState<z.infer<typeof walletTransferSchema> | null>(null);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const result = await getAffiliateWalletTransfersAdminList();
      if (!result.success || !result.data) {
        toast.error(result.error || 'تعذر جلب تحويلات المحفظة');
        setPayload(emptyPayload);
        return;
      }

      setPayload(result.data as WalletTransferPayload);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleCloseEdit = () => {
    setIsEditOpen(false);
    setEditId(null);
    setFormData(null);
  };

  const handleEdit = (transfer: WalletTransferRow) => {
    setEditId(transfer.id);
    setFormData({
      userId: transfer.userId,
      amount: Number(transfer.amount || 0),
      status: transfer.status,
      reference: transfer.reference || '',
      notes: transfer.notes || '',
      transferredAt: formatDateTimeLocal(transfer.transferredAt),
      receivedAt: formatDateTimeLocal(transfer.receivedAt),
    });
    setIsEditOpen(true);
  };

  const handleDelete = async (transfer: WalletTransferRow) => {
    const confirmed = window.confirm(`هل تريد حذف التحويلة الخاصة بالمستخدم ${transfer.user?.username || ''}؟`);
    if (!confirmed) return;

    setDeletingId(transfer.id);
    const loadingToast = toast.loading('جاري حذف التحويلة...');
    try {
      const result = await deleteAffiliateWalletTransferAdmin(transfer.id);
      if (!result.success) {
        toast.error(result.error || 'تعذر حذف التحويلة');
        return;
      }

      toast.success('تم حذف التحويلة بنجاح');
      await loadData();
    } finally {
      toast.dismiss(loadingToast);
      setDeletingId(null);
    }
  };

  const onSubmit = async (values: z.infer<typeof walletTransferSchema>) => {
    if (!editId) return;

    setSaving(true);
    const loadingToast = toast.loading('جاري تحديث التحويلة...');
    try {
      const result = await updateAffiliateWalletTransferAdmin(editId, values);
      if (!result.success) {
        toast.error(result.error || 'تعذر تحديث التحويلة');
        return;
      }

      toast.success('تم تحديث التحويلة بنجاح');
      handleCloseEdit();
      await loadData();
    } finally {
      toast.dismiss(loadingToast);
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-3xl font-black text-slate-900 dark:text-white">تحويلات محفظة الأفلييت</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">عرض وتعديل وحذف عمليات تحويل رصيد عمولات الأفلييت من قاعدة البيانات مباشرة.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400">إجمالي التحويلات</div>
          <div className="mt-2 text-3xl font-black text-slate-900 dark:text-white">{payload.summary.total}</div>
        </div>
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/20">
          <div className="text-xs font-bold text-amber-700 dark:text-amber-300">بانتظار الاستلام</div>
          <div className="mt-2 text-3xl font-black text-amber-800 dark:text-amber-200">{payload.summary.pending}</div>
        </div>
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <div className="text-xs font-bold text-emerald-700 dark:text-emerald-300">تم الاستلام</div>
          <div className="mt-2 text-3xl font-black text-emerald-800 dark:text-emerald-200">{payload.summary.received}</div>
        </div>
        <div className="rounded-3xl border border-blue-200 bg-blue-50 p-5 shadow-sm dark:border-blue-900/40 dark:bg-blue-950/20">
          <div className="text-xs font-bold text-blue-700 dark:text-blue-300">إجمالي المبالغ</div>
          <div className="mt-2 text-3xl font-black text-blue-800 dark:text-blue-200">{formatAmount(payload.summary.totalAmount)}</div>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-950/70">
              <tr className="text-right text-xs font-black text-slate-500 dark:text-slate-400">
                <th className="px-4 py-4">المستخدم</th>
                <th className="px-4 py-4">المبلغ</th>
                <th className="px-4 py-4">الحالة</th>
                <th className="px-4 py-4">المرجع</th>
                <th className="px-4 py-4">تاريخ التحويل</th>
                <th className="px-4 py-4">تاريخ الاستلام</th>
                <th className="px-4 py-4">ملاحظات</th>
                <th className="px-4 py-4">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm font-bold text-slate-500">
                    جاري تحميل التحويلات...
                  </td>
                </tr>
              ) : payload.transfers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm font-bold text-slate-500">
                    لا توجد تحويلات محفوظة حالياً.
                  </td>
                </tr>
              ) : (
                payload.transfers.map((transfer) => (
                  <tr key={transfer.id} className="text-sm text-slate-700 dark:text-slate-200">
                    <td className="px-4 py-4">
                      <div className="font-black text-slate-900 dark:text-white">{transfer.user?.username || '-'}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{transfer.user?.email || '-'}</div>
                    </td>
                    <td className="px-4 py-4 font-black">{formatAmount(transfer.amount)}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${transfer.status === 'RECEIVED' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'}`}>
                        {transfer.status === 'RECEIVED' ? 'تم الاستلام' : 'قيد الانتظار'}
                      </span>
                    </td>
                    <td className="px-4 py-4">{transfer.reference || '-'}</td>
                    <td className="px-4 py-4">{formatDate(transfer.transferredAt)}</td>
                    <td className="px-4 py-4">{formatDate(transfer.receivedAt)}</td>
                    <td className="max-w-xs px-4 py-4 text-xs text-slate-500 dark:text-slate-400">{transfer.notes || '-'}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleEdit(transfer)}
                          className="rounded-xl bg-slate-100 p-2.5 text-blue-600 transition hover:bg-blue-600 hover:text-white dark:bg-slate-800"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(transfer)}
                          disabled={deletingId === transfer.id}
                          className="rounded-xl bg-slate-100 p-2.5 text-red-500 transition hover:bg-red-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-800"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AppModal title="تعديل تحويلة المحفظة" isOpen={isEditOpen} onClose={handleCloseEdit}>
        <div className="p-2">
          <DynamicForm
            schema={walletTransferSchema}
            onSubmit={onSubmit}
            defaultValues={formData || undefined}
            key={editId || 'wallet-transfer-edit'}
            submitLabel={saving ? 'جاري الحفظ...' : 'تحديث التحويلة'}
          >
            {({ register, formState: { errors }, watch }) => {
              const currentStatus = watch('status');

              return (
                <div className="grid gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">المستخدم</label>
                    <select
                      className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
                      {...register('userId')}
                    >
                      <option value="">اختر مستخدم أفلييت</option>
                      {payload.affiliateUsers.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.username}{user.affiliateApproved ? '' : ' - غير معتمد'}
                        </option>
                      ))}
                    </select>
                    {errors.userId && <p className="text-xs text-red-500">{errors.userId.message as string}</p>}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <FormInput
                      className="text-gray-800 dark:text-white"
                      label="المبلغ"
                      type="number"
                      step="0.01"
                      {...register('amount', { valueAsNumber: true })}
                      error={errors.amount?.message as string}
                    />

                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">الحالة</label>
                      <select
                        className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
                        {...register('status')}
                      >
                        <option value="PENDING">قيد الانتظار</option>
                        <option value="RECEIVED">تم الاستلام</option>
                      </select>
                      {errors.status && <p className="text-xs text-red-500">{errors.status.message as string}</p>}
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <FormInput
                      className="text-gray-800 dark:text-white"
                      label="تاريخ التحويل"
                      type="datetime-local"
                      {...register('transferredAt')}
                      error={errors.transferredAt?.message as string}
                    />

                    <FormInput
                      className="text-gray-800 dark:text-white"
                      label="تاريخ الاستلام"
                      type="datetime-local"
                      disabled={currentStatus !== 'RECEIVED'}
                      {...register('receivedAt')}
                      error={errors.receivedAt?.message as string}
                    />
                  </div>

                  <FormInput
                    className="text-gray-800 dark:text-white"
                    label="المرجع"
                    {...register('reference')}
                    error={errors.reference?.message as string}
                  />

                  <FormTextArea
                    label="ملاحظات"
                    rows={4}
                    {...register('notes')}
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