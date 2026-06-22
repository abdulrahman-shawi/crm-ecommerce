'use client';

import * as React from 'react';
import { z } from 'zod';
import { Controller } from 'react-hook-form';
import { Edit, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

import { DynamicForm } from '@/components/shared/dynamic-form';
import { DataTable } from '@/components/shared/DataTable';
import { AppModal } from '@/components/ui/app-modal';
import { Button } from '@/components/ui/button';
import { FormCheckbox } from '@/components/ui/formcheck';
import { FormInput } from '@/components/ui/form-input';
import { FormSelect } from '@/components/ui/select-form';
import { useAuth } from '@/context/AuthContext';
import { isAdmin } from '@/lib/utils';
import {
  createOfferDiscount,
  deleteOfferDiscount,
  getOfferDiscountFormMeta,
  getOfferDiscounts,
  updateOfferDiscount,
} from '@/server/offer';

const optionalNumber = z.preprocess((value) => {
  if (value === '' || value === null || value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}, z.number().optional());

const optionalInt = z.preprocess((value) => {
  if (value === '' || value === null || value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : undefined;
}, z.number().int().optional());

const offerDiscountSchema = z.object({
  offerId: z.string().min(1, 'يجب اختيار العرض'),
  productId: optionalInt,
  categoryId: optionalInt,
  discountType: z.enum(['PERCENTAGE', 'FIXED']).default('PERCENTAGE'),
  discountValue: optionalNumber,
  maxDiscountValue: optionalNumber,
  minOrderAmount: optionalNumber,
  usageLimit: optionalInt,
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  isActive: z.boolean().default(true),
});

type OfferDiscountFormValues = z.infer<typeof offerDiscountSchema>;

const PAGE_SIZE = 10;

function toDateTimeLocal(value?: string | null) {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

export default function OfferDiscountsPage() {
  const { user } = useAuth();
  const isUserAdmin = Boolean(user && isAdmin(user));

  const [rows, setRows] = React.useState<any[]>([]);
  const [offers, setOffers] = React.useState<any[]>([]);
  const [products, setProducts] = React.useState<any[]>([]);
  const [categories, setCategories] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [isOpen, setIsOpen] = React.useState(false);
  const [editId, setEditId] = React.useState<string | null>(null);
  const [formData, setFormData] = React.useState<OfferDiscountFormValues | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [discountRes, metaRes] = await Promise.all([getOfferDiscounts(), getOfferDiscountFormMeta()]);

      if (discountRes.success) {
        setRows(discountRes.data || []);
      } else {
        toast.error((discountRes as any).error || 'فشل في جلب قواعد الخصم');
      }

      if (metaRes.success) {
        setOffers((metaRes.data as any).offers || []);
        setProducts((metaRes.data as any).products || []);
        setCategories((metaRes.data as any).categories || []);
      } else {
        toast.error((metaRes as any).error || 'فشل في جلب بيانات النماذج');
      }
    } catch (error) {
      toast.error('حدث خطأ أثناء تحميل البيانات');
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    loadData();
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    setEditId(null);
    setFormData(null);
  };

  const handleAdd = () => {
    setEditId(null);
    setFormData({
      offerId: '',
      productId: undefined,
      categoryId: undefined,
      discountType: 'PERCENTAGE',
      discountValue: undefined,
      maxDiscountValue: undefined,
      minOrderAmount: undefined,
      usageLimit: undefined,
      startsAt: '',
      endsAt: '',
      isActive: true,
    });
    setIsOpen(true);
  };

  const handleEdit = (row: any) => {
    setEditId(row.id);
    setFormData({
      offerId: row.offerId,
      productId: row.productId ?? undefined,
      categoryId: row.categoryId ?? undefined,
      discountType: row.discountType,
      discountValue: row.discountValue ?? undefined,
      maxDiscountValue: row.maxDiscountValue ?? undefined,
      minOrderAmount: row.minOrderAmount ?? undefined,
      usageLimit: row.usageLimit ?? undefined,
      startsAt: toDateTimeLocal(row.startsAt),
      endsAt: toDateTimeLocal(row.endsAt),
      isActive: row.isActive,
    });
    setIsOpen(true);
  };

  const handleDelete = async (row: any) => {
    if (!window.confirm('هل أنت متأكد من حذف قاعدة الخصم؟')) return;

    const loadingToast = toast.loading('جاري حذف قاعدة الخصم...');
    try {
      const res = await deleteOfferDiscount(row.id);
      if (res.success) {
        toast.success('تم حذف قاعدة الخصم بنجاح');
      } else {
        toast.error((res as any).error || 'فشل في حذف قاعدة الخصم');
      }
    } catch (error) {
      toast.error('حدث خطأ أثناء حذف قاعدة الخصم');
    } finally {
      toast.dismiss(loadingToast);
      loadData();
    }
  };

  const onSubmit = async (data: OfferDiscountFormValues) => {
    const loadingToast = toast.loading(editId ? 'جاري تحديث قاعدة الخصم...' : 'جاري إنشاء قاعدة الخصم...');
    try {
      const payload = new FormData();
      payload.append('offerId', data.offerId);
      payload.append('productId', data.productId != null ? String(data.productId) : '');
      payload.append('categoryId', data.categoryId != null ? String(data.categoryId) : '');
      payload.append('discountType', data.discountType);
      payload.append('discountValue', data.discountValue != null ? String(data.discountValue) : '');
      payload.append('maxDiscountValue', data.maxDiscountValue != null ? String(data.maxDiscountValue) : '');
      payload.append('minOrderAmount', data.minOrderAmount != null ? String(data.minOrderAmount) : '');
      payload.append('usageLimit', data.usageLimit != null ? String(data.usageLimit) : '');
      payload.append('startsAt', data.startsAt || '');
      payload.append('endsAt', data.endsAt || '');
      payload.append('isActive', data.isActive ? 'true' : 'false');

      const res = editId ? await updateOfferDiscount(editId, payload) : await createOfferDiscount(payload);

      if (res.success) {
        toast.success(editId ? 'تم تحديث قاعدة الخصم بنجاح' : 'تم إنشاء قاعدة الخصم بنجاح');
        handleClose();
      } else {
        toast.error((res as any).error || 'فشل في حفظ قاعدة الخصم');
      }
    } catch (error) {
      toast.error('حدث خطأ غير متوقع');
    } finally {
      toast.dismiss(loadingToast);
      loadData();
    }
  };

  if (!isUserAdmin) {
    return (
      <div className="p-4" dir="rtl">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">قواعد خصومات العروض</h1>
        <p className="mt-4 text-sm text-slate-500">لا تملك صلاحية عرض هذه الصفحة.</p>
      </div>
    );
  }

  const offerOptions = offers.map((offer: any) => ({
    value: offer.id,
    label: offer.title || offer.subtitle || `عرض ${offer.id.slice(-6)}`,
  }));

  const productOptions = products.map((product: any) => ({
    value: product.id,
    label: product.name,
  }));

  const categoryOptions = categories.map((category: any) => ({
    value: category.id,
    label: category.name,
  }));

  const columns = [
    {
      header: 'العرض',
      accessor: (row: any) => <span className="font-semibold">{row.offer?.title || '-'}</span>,
    },
    {
      header: 'الاستهداف',
      accessor: (row: any) => (
        <div className="text-xs text-slate-600 dark:text-slate-300">
          <p>منتج: {row.product?.name || 'الكل'}</p>
          <p>تصنيف: {row.category?.name || 'الكل'}</p>
        </div>
      ),
    },
    {
      header: 'الخصم',
      accessor: (row: any) => (
        <div>
          <p className="text-sm font-medium">{row.discountType === 'PERCENTAGE' ? 'نسبة مئوية' : 'مبلغ ثابت'}</p>
          <p className="text-xs text-slate-500">القيمة: {row.discountValue ?? '-'}</p>
        </div>
      ),
    },
    {
      header: 'الاستخدام',
      accessor: (row: any) => (
        <div className="text-xs text-slate-600 dark:text-slate-300">
          <p>الحد: {row.usageLimit ?? 'غير محدود'}</p>
          <p>المستخدم: {row.usedCount ?? 0}</p>
        </div>
      ),
    },
    {
      header: 'الحالة',
      accessor: (row: any) => (
        <span className={row.isActive ? 'text-green-600 text-sm font-semibold' : 'text-slate-500 text-sm'}>
          {row.isActive ? 'نشط' : 'معطل'}
        </span>
      ),
    },
  ];

  const actions = [
    { label: 'تعديل', icon: <Edit size={16} />, onClick: handleEdit },
    { label: 'حذف', icon: <Trash2 size={16} />, onClick: handleDelete, variant: 'danger' as const },
  ];

  return (
    <div className="p-4" dir="rtl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">قواعد خصومات العروض</h1>
          <p className="text-sm text-slate-500 mt-1">تعريف نوع الخصم وقيمته وصلاحيته وربطه بعرض/منتج/تصنيف</p>
        </div>
        <Button onClick={handleAdd} className="bg-blue-600 hover:bg-blue-700 text-white px-6">
          <Plus size={16} className="ml-2" />
          إضافة قاعدة خصم
        </Button>
      </div>

      <DataTable
        data={rows}
        columns={columns}
        actions={actions}
        isLoading={isLoading}
        totalCount={rows.length}
        pageSize={PAGE_SIZE}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
      />

      <AppModal
        title={editId ? 'تعديل قاعدة الخصم' : 'إضافة قاعدة خصم جديدة'}
        isOpen={isOpen}
        onClose={handleClose}
        size="xl"
      >
        <div className="p-2">
          <DynamicForm
            schema={offerDiscountSchema}
            onSubmit={onSubmit}
            defaultValues={formData || undefined}
            submitLabel={editId ? 'تحديث القاعدة' : 'إنشاء القاعدة'}
          >
            {({ register, control, watch, formState: { errors } }) => {
              const discountType = watch('discountType');

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Controller
                    name="offerId"
                    control={control}
                    render={({ field }) => (
                      <FormSelect
                        label="العرض"
                        value={field.value || ''}
                        onChange={field.onChange}
                        options={offerOptions}
                        placeholder="اختر العرض"
                        error={errors.offerId?.message as string}
                      />
                    )}
                  />

                  <Controller
                    name="discountType"
                    control={control}
                    render={({ field }) => (
                      <FormSelect
                        label="نوع الخصم"
                        value={field.value}
                        onChange={field.onChange}
                        options={[
                          { label: 'نسبة مئوية', value: 'PERCENTAGE' },
                          { label: 'مبلغ ثابت', value: 'FIXED' },
                        ]}
                        error={errors.discountType?.message as string}
                      />
                    )}
                  />

                  <Controller
                    name="productId"
                    control={control}
                    render={({ field }) => (
                      <FormSelect
                        label="المنتج (اختياري)"
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                        options={productOptions}
                        placeholder="الكل"
                        error={errors.productId?.message as string}
                      />
                    )}
                  />

                  <Controller
                    name="categoryId"
                    control={control}
                    render={({ field }) => (
                      <FormSelect
                        label="التصنيف (اختياري)"
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                        options={categoryOptions}
                        placeholder="الكل"
                        error={errors.categoryId?.message as string}
                      />
                    )}
                  />

                  <FormInput
                    type="number"
                    step="0.01"
                    label={discountType === 'PERCENTAGE' ? 'قيمة الخصم (%)' : 'قيمة الخصم (مبلغ)'}
                    {...register('discountValue')}
                    error={errors.discountValue?.message as string}
                  />

                  <FormInput type="number" step="0.01" label="أقصى خصم (اختياري)" {...register('maxDiscountValue')} error={errors.maxDiscountValue?.message as string} />
                  <FormInput type="number" step="0.01" label="أدنى مبلغ طلب (اختياري)" {...register('minOrderAmount')} error={errors.minOrderAmount?.message as string} />
                  <FormInput type="number" label="حد الاستخدام (اختياري)" {...register('usageLimit')} error={errors.usageLimit?.message as string} />
                  <FormInput type="datetime-local" label="بداية الصلاحية" {...register('startsAt')} error={errors.startsAt?.message as string} />
                  <FormInput type="datetime-local" label="نهاية الصلاحية" {...register('endsAt')} error={errors.endsAt?.message as string} />

                  <div className="md:col-span-2">
                    <Controller
                      name="isActive"
                      control={control}
                      render={({ field }) => (
                        <FormCheckbox
                          label="تفعيل قاعدة الخصم"
                          description="تعطيل القاعدة يلغي تطبيقها دون حذفها"
                          checked={field.value}
                          onChange={(e) => field.onChange(e.target.checked)}
                        />
                      )}
                    />
                  </div>
                </div>
              );
            }}
          </DynamicForm>
        </div>
      </AppModal>
    </div>
  );
}
