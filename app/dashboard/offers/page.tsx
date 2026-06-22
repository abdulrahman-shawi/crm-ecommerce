'use client';

import * as React from 'react';
import { z } from 'zod';
import { Controller } from 'react-hook-form';
import { Edit, Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

import { DynamicForm } from '@/components/shared/dynamic-form';
import { DataTable } from '@/components/shared/DataTable';
import { AppModal } from '@/components/ui/app-modal';
import { Button } from '@/components/ui/button';
import { FormInput } from '@/components/ui/form-input';
import { FormCheckbox } from '@/components/ui/formcheck';
import { useAuth } from '@/context/AuthContext';
import { isAdmin } from '@/lib/utils';
import { createOffer, deleteOffer, getOffers, updateOffer } from '@/server/offer';

const offerSchema = z.object({
  title: z.string().optional(),
  subtitle: z.string().optional(),
  description: z.string().optional(),
  badgeText: z.string().optional(),
  image: z.string().optional(),
  ctaText: z.string().optional(),
  ctaLink: z.string().optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  countdownEndsAt: z.string().optional(),
  sortOrder: z.coerce.number().default(0),
  isActive: z.boolean().default(true),
});

type OfferFormValues = z.infer<typeof offerSchema>;

const PAGE_SIZE = 10;

function toDateTimeLocal(value?: string | null) {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

export default function OffersPage() {
  const { user } = useAuth();
  const isUserAdmin = Boolean(user && isAdmin(user));

  const [offers, setOffers] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [isOpen, setIsOpen] = React.useState(false);
  const [editId, setEditId] = React.useState<string | null>(null);
  const [formData, setFormData] = React.useState<OfferFormValues | null>(null);

  const loadOffers = async () => {
    setIsLoading(true);
    try {
      const res = await getOffers();
      if (res.success) {
        setOffers(res.data || []);
      } else {
        toast.error((res as any).error || 'فشل في جلب العروض');
      }
    } catch (error) {
      toast.error('حدث خطأ أثناء جلب العروض');
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    loadOffers();
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    setEditId(null);
    setFormData(null);
  };

  const handleAdd = () => {
    setEditId(null);
    setFormData({
      title: '',
      subtitle: '',
      description: '',
      badgeText: '',
      image: '',
      ctaText: '',
      ctaLink: '',
      startsAt: '',
      endsAt: '',
      countdownEndsAt: '',
      sortOrder: 0,
      isActive: true,
    });
    setIsOpen(true);
  };

  const handleEdit = (offer: any) => {
    setEditId(offer.id);
    setFormData({
      title: offer.title || '',
      subtitle: offer.subtitle || '',
      description: offer.description || '',
      badgeText: offer.badgeText || '',
      image: offer.image || '',
      ctaText: offer.ctaText || '',
      ctaLink: offer.ctaLink || '',
      startsAt: toDateTimeLocal(offer.startsAt),
      endsAt: toDateTimeLocal(offer.endsAt),
      countdownEndsAt: toDateTimeLocal(offer.countdownEndsAt),
      sortOrder: offer.sortOrder || 0,
      isActive: offer.isActive,
    });
    setIsOpen(true);
  };

  const handleDelete = async (offer: any) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا العرض؟')) return;

    const loadingToast = toast.loading('جاري حذف العرض...');
    try {
      const res = await deleteOffer(offer.id);
      if (res.success) {
        toast.success('تم حذف العرض بنجاح');
      } else {
        toast.error((res as any).error || 'فشل في حذف العرض');
      }
    } catch (error) {
      toast.error('حدث خطأ أثناء حذف العرض');
    } finally {
      toast.dismiss(loadingToast);
      loadOffers();
    }
  };

  const onSubmit = async (data: OfferFormValues) => {
    const loadingToast = toast.loading(editId ? 'جاري تحديث العرض...' : 'جاري إنشاء العرض...');
    try {
      const payload = new FormData();
      payload.append('title', data.title || '');
      payload.append('subtitle', data.subtitle || '');
      payload.append('description', data.description || '');
      payload.append('badgeText', data.badgeText || '');
      payload.append('image', data.image || '');
      payload.append('ctaText', data.ctaText || '');
      payload.append('ctaLink', data.ctaLink || '');
      payload.append('startsAt', data.startsAt || '');
      payload.append('endsAt', data.endsAt || '');
      payload.append('countdownEndsAt', data.countdownEndsAt || '');
      payload.append('sortOrder', String(data.sortOrder || 0));
      payload.append('isActive', data.isActive ? 'true' : 'false');

      const res = editId ? await updateOffer(editId, payload) : await createOffer(payload);

      if (res.success) {
        toast.success(editId ? 'تم تحديث العرض بنجاح' : 'تم إنشاء العرض بنجاح');
        handleClose();
      } else {
        toast.error((res as any).error || 'فشل في حفظ العرض');
      }
    } catch (error) {
      toast.error('حدث خطأ غير متوقع');
    } finally {
      toast.dismiss(loadingToast);
      loadOffers();
    }
  };

  if (!isUserAdmin) {
    return (
      <div className="p-4" dir="rtl">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">إدارة العروض</h1>
        <p className="mt-4 text-sm text-slate-500">لا تملك صلاحية عرض هذه الصفحة.</p>
      </div>
    );
  }

  const columns = [
    {
      header: 'العنوان',
      accessor: (item: any) => (
        <div>
          <p className="font-bold text-slate-900 dark:text-white">{item.title || '-'}</p>
          <p className="text-xs text-slate-500">{item.subtitle || '-'}</p>
        </div>
      ),
    },
    {
      header: 'CTA',
      accessor: (item: any) => (
        <div>
          <p className="text-sm text-slate-700 dark:text-slate-300">{item.ctaText || '-'}</p>
          <p className="text-xs text-blue-600">{item.ctaLink || '-'}</p>
        </div>
      ),
    },
    {
      header: 'الترتيب',
      accessor: (item: any) => <span className="text-sm">{item.sortOrder}</span>,
    },
    {
      header: 'الحالة',
      accessor: (item: any) =>
        item.isActive ? (
          <div className="flex items-center gap-1 text-green-600">
            <Eye size={14} />
            <span className="text-sm">نشط</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-slate-400">
            <EyeOff size={14} />
            <span className="text-sm">معطل</span>
          </div>
        ),
    },
    {
      header: 'الفترة',
      accessor: (item: any) => (
        <div className="text-xs text-slate-500">
          <p>{item.startsAt ? new Date(item.startsAt).toLocaleString('ar-SY') : 'بدون بداية'}</p>
          <p>{item.endsAt ? new Date(item.endsAt).toLocaleString('ar-SY') : 'بدون نهاية'}</p>
        </div>
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
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">إدارة العروض</h1>
          <p className="text-sm text-slate-500 mt-1">إعداد العروض العامة (العنوان، الـ CTA، المدة، العد التنازلي)</p>
        </div>
        <Button onClick={handleAdd} className="bg-blue-600 hover:bg-blue-700 text-white px-6">
          <Plus size={16} className="ml-2" />
          إضافة عرض
        </Button>
      </div>

      <DataTable
        data={offers}
        columns={columns}
        actions={actions}
        isLoading={isLoading}
        totalCount={offers.length}
        pageSize={PAGE_SIZE}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
      />

      <AppModal
        title={editId ? 'تعديل العرض' : 'إضافة عرض جديد'}
        isOpen={isOpen}
        onClose={handleClose}
        size="xl"
      >
        <div className="p-2">
          <DynamicForm
            schema={offerSchema}
            onSubmit={onSubmit}
            defaultValues={formData || undefined}
            submitLabel={editId ? 'تحديث العرض' : 'إنشاء العرض'}
          >
            {({ register, control, formState: { errors } }) => (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormInput label="عنوان العرض" {...register('title')} error={errors.title?.message as string} />
                <FormInput label="عنوان فرعي" {...register('subtitle')} error={errors.subtitle?.message as string} />
                <FormInput label="النص التعريفي" {...register('description')} error={errors.description?.message as string} />
                <FormInput label="شارة العرض" {...register('badgeText')} error={errors.badgeText?.message as string} />
                <FormInput label="رابط الصورة" {...register('image')} error={errors.image?.message as string} />
                <FormInput label="نص الزر" {...register('ctaText')} error={errors.ctaText?.message as string} />
                <FormInput label="رابط الزر" {...register('ctaLink')} error={errors.ctaLink?.message as string} />
                <FormInput type="datetime-local" label="بداية العرض" {...register('startsAt')} error={errors.startsAt?.message as string} />
                <FormInput type="datetime-local" label="نهاية العرض" {...register('endsAt')} error={errors.endsAt?.message as string} />
                <FormInput type="datetime-local" label="نهاية العد التنازلي" {...register('countdownEndsAt')} error={errors.countdownEndsAt?.message as string} />
                <FormInput type="number" label="ترتيب العرض" {...register('sortOrder')} error={errors.sortOrder?.message as string} />

                <div className="md:col-span-2">
                  <Controller
                    name="isActive"
                    control={control}
                    render={({ field }) => (
                      <FormCheckbox
                        label="تفعيل العرض"
                        description="يمكن تعطيل العرض مؤقتًا دون حذفه"
                        checked={field.value}
                        onChange={(e) => field.onChange(e.target.checked)}
                      />
                    )}
                  />
                </div>
              </div>
            )}
          </DynamicForm>
        </div>
      </AppModal>
    </div>
  );
}
