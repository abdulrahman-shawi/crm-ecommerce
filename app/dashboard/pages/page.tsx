'use client';

import * as React from 'react';
import { useAuth } from '@/context/AuthContext';
import { hasPermission } from '@/lib/utils';
import { DynamicForm } from '@/components/shared/dynamic-form';
import { DataTable } from '@/components/shared/DataTable';
import { AppModal } from '@/components/ui/app-modal';
import { Button } from '@/components/ui/button';
import { FormInput } from '@/components/ui/form-input';
import { FormCheckbox } from '@/components/ui/formcheck';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { createPage, updatePage, deletePage, getAllPages } from '@/server/page';
import { Edit, Trash2, FileText, Eye, EyeOff } from 'lucide-react';
import { Controller } from 'react-hook-form';
import toast from 'react-hot-toast';
import { z } from 'zod';

const pageSchema = z.object({
  title: z.string().min(1, 'عنوان الصفحة مطلوب'),
  slug: z.string().optional(),
  content: z.string().min(1, 'محتوى الصفحة مطلوب'),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  isPublished: z.boolean().default(true),
});

type PageFormValues = z.infer<typeof pageSchema>;

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\u0621-\u064A\-_]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

interface PageFormFieldsProps {
  control: any;
  register: any;
  errors: any;
  editId: string | null;
}

function PageFormFields({ control, register, errors, editId }: PageFormFieldsProps) {
  const titleValue = control._formValues?.title || '';
  const setValue = control.setValue;

  React.useEffect(() => {
    if (!editId && titleValue) {
      const currentSlug = control._formValues?.slug || '';
      const generatedSlug = slugify(titleValue);
      if (!currentSlug || currentSlug === generatedSlug) {
        setValue('slug', generatedSlug, { shouldValidate: false });
      }
    }
  }, [titleValue, editId, control, setValue]);

  return (
    <div className="grid gap-4">
      <FormInput
        label="عنوان الصفحة"
        placeholder="مثال: من نحن"
        {...register('title')}
        error={errors.title?.message as string}
      />

      <FormInput
        label="الرابط المختصر (slug)"
        placeholder="مثال: about"
        {...register('slug')}
        error={errors.slug?.message as string}
      />

      <Controller
        name="content"
        control={control}
        render={({ field }) => (
          <RichTextEditor
            label="محتوى الصفحة"
            placeholder="اكتب محتوى الصفحة هنا..."
            value={field.value || ''}
            onChange={field.onChange}
            error={errors.content?.message as string}
          />
        )}
      />

      <FormInput
        label="عنوان SEO (اختياري)"
        placeholder="يظهر في نتائج البحث"
        {...register('metaTitle')}
        error={errors.metaTitle?.message as string}
      />

      <FormInput
        label="وصف SEO (اختياري)"
        placeholder="وصف مختصر للصفحة"
        {...register('metaDescription')}
        error={errors.metaDescription?.message as string}
      />

      <Controller
        name="isPublished"
        control={control}
        render={({ field }) => (
          <FormCheckbox
            label="نشر الصفحة"
            description="إلغاء التحديد يجعل الصفحة مسودة وغير مرئية للزوار"
            checked={field.value}
            onChange={(e) => field.onChange(e.target.checked)}
          />
        )}
      />
    </div>
  );
}

export default function PagesManagementPage() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = React.useState(false);
  const [editId, setEditId] = React.useState<string | null>(null);
  const [formData, setFormData] = React.useState<PageFormValues | null>(null);
  const [pages, setPages] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [currentPage, setCurrentPage] = React.useState(1);
  const pageSize = 10;

  const loadPages = async () => {
    setIsLoading(true);
    try {
      const res = await getAllPages();
      if (res.success) {
        setPages(res.data || []);
      } else {
        toast.error(res.error || 'فشل في جلب الصفحات');
      }
    } catch (error) {
      toast.error('حدث خطأ أثناء جلب الصفحات');
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    loadPages();
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
      slug: '',
      content: '',
      metaTitle: '',
      metaDescription: '',
      isPublished: true,
    });
    setIsOpen(true);
  };

  const handleEdit = (page: any) => {
    setEditId(page.id);
    setFormData({
      title: page.title,
      slug: page.slug,
      content: page.content,
      metaTitle: page.metaTitle || '',
      metaDescription: page.metaDescription || '',
      isPublished: page.isPublished,
    });
    setIsOpen(true);
  };

  const handleDelete = async (page: any) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه الصفحة؟')) return;

    const loadingToast = toast.loading('جاري حذف الصفحة...');
    try {
      const res = await deletePage(page.id);
      if (res.success) {
        toast.success('تم حذف الصفحة بنجاح');
      } else {
        toast.error(res.error || 'فشل في حذف الصفحة');
      }
    } catch (error) {
      toast.error('حدث خطأ أثناء حذف الصفحة');
    } finally {
      toast.dismiss(loadingToast);
      loadPages();
    }
  };

  const onSubmit = async (data: PageFormValues) => {
    const loadingToast = toast.loading(editId ? 'جاري تحديث الصفحة...' : 'جاري إنشاء الصفحة...');
    try {
      const formData = new FormData();
      formData.append('title', data.title);
      formData.append('slug', data.slug || slugify(data.title));
      formData.append('content', data.content);
      formData.append('metaTitle', data.metaTitle || '');
      formData.append('metaDescription', data.metaDescription || '');
      formData.append('isPublished', data.isPublished ? 'true' : 'false');

      let res;
      if (editId) {
        res = await updatePage(editId, formData);
      } else {
        res = await createPage(formData);
      }

      if (res.success) {
        toast.success(editId ? 'تم تحديث الصفحة بنجاح' : 'تم إنشاء الصفحة بنجاح');
        handleClose();
      } else {
        toast.error(res.error || 'فشل في حفظ الصفحة');
      }
    } catch (error) {
      toast.error('حدث خطأ غير متوقع');
    } finally {
      toast.dismiss(loadingToast);
      loadPages();
    }
  };

  const canAdd = user && hasPermission(user, 'addPages');
  const canEdit = user && hasPermission(user, 'editPages');
  const canDelete = user && hasPermission(user, 'deletePages');

  const columns = [
    {
      header: 'الصفحة',
      accessor: (item: any) => (
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
            <FileText size={18} className="text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-white">{item.title}</p>
            <p className="text-xs text-slate-500">/{item.slug}</p>
          </div>
        </div>
      ),
    },
    {
      header: 'الحالة',
      accessor: (item: any) => (
        <div className="flex items-center gap-1.5">
          {item.isPublished ? (
            <>
              <Eye size={14} className="text-green-500" />
              <span className="text-sm text-green-600 font-medium">منشور</span>
            </>
          ) : (
            <>
              <EyeOff size={14} className="text-slate-400" />
              <span className="text-sm text-slate-500">مسودة</span>
            </>
          )}
        </div>
      ),
    },
    {
      header: 'آخر تعديل',
      accessor: (item: any) => (
        <span className="text-sm text-slate-500">
          {new Date(item.updatedAt).toLocaleDateString('ar-SY')}
        </span>
      ),
    },
  ];

  const actions = [
    ...(canEdit ? [{
      label: 'تعديل',
      icon: <Edit size={16} />,
      onClick: handleEdit,
    }] : []),
    ...(canDelete ? [{
      label: 'حذف',
      icon: <Trash2 size={16} />,
      onClick: handleDelete,
      variant: 'danger' as const,
    }] : []),
  ];

  return (
    <div className="p-4" dir="rtl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">إدارة الصفحات الثابتة</h1>
          <p className="text-sm text-slate-500 mt-1">إنشاء وتحرير صفحات مثل من نحن وسياسة الخصوصية</p>
        </div>
        {canAdd && (
          <Button onClick={handleAdd} className="bg-blue-600 hover:bg-blue-700 text-white px-6">
            إضافة صفحة جديدة
          </Button>
        )}
      </div>

      <DataTable
        data={pages}
        columns={columns}
        actions={actions.length > 0 ? actions : undefined}
        isLoading={isLoading}
        totalCount={pages.length}
        pageSize={pageSize}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
      />

      <AppModal
        title={editId ? 'تعديل الصفحة' : 'إضافة صفحة جديدة'}
        isOpen={isOpen}
        onClose={handleClose}
        size="xl"
      >
        <div className="p-2">
          <DynamicForm
            schema={pageSchema}
            onSubmit={onSubmit}
            defaultValues={formData || undefined}
            submitLabel={editId ? 'تحديث الصفحة' : 'إنشاء الصفحة'}
          >
            {({ register, control, formState: { errors } }) => (
              <PageFormFields
                control={control}
                register={register}
                errors={errors}
                editId={editId}
              />
            )}
          </DynamicForm>
        </div>
      </AppModal>
    </div>
  );
}
