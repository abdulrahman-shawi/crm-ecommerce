'use client';
import { DynamicForm } from '@/components/shared/dynamic-form';
import { AppModal } from '@/components/ui/app-modal';
import { Button } from '@/components/ui/button';
import { FormCheckbox } from '@/components/ui/formcheck';
// تأكد من استيراد FormInput من المكان الصحيح في مكوناتك وليس من lucide-react
import { FormInput } from '@/components/ui/form-input';
import { MultiFileUpload, FileItem } from '@/components/ui/ImageUpload';
import { useAuth } from '@/context/AuthContext';
import { hasPermission } from '@/lib/utils';
import { createcategory, deletecategory, getallcategory, updatecategory } from '@/server/category';
import { AnimatePresence, motion } from 'framer-motion';
import { Edit, Trash2 } from 'lucide-react';
import * as React from 'react';
import { Controller } from 'react-hook-form';
import toast from 'react-hot-toast';
import z from 'zod';

interface ICategoriesLayoutProps { }

const categorySchema = z.object({
    name: z.string().min(3, "اسم الفئة مطلوب"),
    files: z.array(z.any()).optional().default([]),
    isVisible: z.boolean().default(false),
});

const emptyCategoryForm = {
    name: '',
    files: [],
    isVisible: false,
};

const CategoriesLayout: React.FunctionComponent<ICategoriesLayoutProps> = (props) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const [editId, setEditId] = React.useState<string | null>(null);
    const [formData, setFormData] = React.useState<any>(null);
    const [category, setCategory] = React.useState<any[]>([]);
    const { user } = useAuth()

    const handleClose = () => {
        setIsOpen(false);
        setEditId(null);
        setFormData(null);
    }; // تم إغلاق الدالة هنا

    const handleEdit = (data: any) => {
        setEditId(data.id);
        const existingImage: FileItem[] = data.image
            ? [{ url: data.image, type: 'image/*', name: 'category-image' }]
            : [];
        setFormData({
            name: data.name,
            files: existingImage,
            isVisible: Boolean(data.isVisible),
        });
        setIsOpen(true);
    }

    const handledelete = async (data: any) => {
        const loadingToast = toast.loading('جاري حذف الفئة...');
        try {
            const res = await deletecategory(data.id)
            if (res.success) {
                toast.success("تم حذف الفئة بنجاح")
            } else {
                toast.error("حدث خطأ أثناء حذف الفئة")
            }
        } catch (error: any) {
            toast.error("خطأ", error)
        } finally {
            toast.dismiss(loadingToast)
            getData()
        }
    }
    const onSubmit = async (data: z.infer<typeof categorySchema>) => {
        const loadingToast = toast.loading(editId ? 'جاري تحديث البيانات...' : 'جاري إنشاء الفئة...');
        try {
            const formData = new FormData();
            formData.append('name', data.name);
            formData.append('isVisible', String(data.isVisible));

            const fileItem = data.files?.[0];
            if (fileItem?.rawFile instanceof File && fileItem.rawFile.size > 0) {
                formData.append('image', fileItem.rawFile);
            }

            if (editId) {
                const result = await updatecategory(editId, formData);
                if (result.success) {
                    toast.success("تم تحديث بيانات الفئة بنجاح");
                    handleClose();
                } else {
                    toast.error(result.error || "فشل في تحديث بيانات الفئة");
                }
            } else {
                const result = await createcategory(formData);
                if (result.success) {
                    toast.success("تم إنشاء الفئة بنجاح");
                    handleClose();
                } else {
                    toast.error(result.error || "فشل في إنشاء الفئة");
                }
            }
        } catch (error) {
            toast.error("حدث خطأ غير متوقع");
            console.error(error);
        } finally {
            toast.dismiss(loadingToast);
            getData();
        }
    };

    const getData = async () => {
        const cat = await getallcategory()
        setCategory(cat);
    }

    React.useEffect(() => { getData(); }, []);

    return (
        <div className="p-4">
            <div className="flex justify-between items-center mb-6">
                <div className="text-xl font-bold">إدارة الفئات</div>
                {
                    user && hasPermission(user, "addCategories") && (
                        <Button
                            onClick={() => { setEditId(null); setFormData(emptyCategoryForm); setIsOpen(true); }}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6"
                        >
                            إضافة فئة جديدة
                        </Button>
                    )
                }
            </div>

            <AnimatePresence>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {category.map((cat: any) => (
                        <motion.div
                            key={cat.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm group hover:border-blue-500 transition-all"
                        >
                            {cat.image && (
                                <div className="mb-4 aspect-video overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
                                    <img
                                        src={cat.image}
                                        alt={cat.name}
                                        className="h-full w-full object-cover"
                                    />
                                </div>
                            )}
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-bold text-xl text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors">
                                        {cat.name}
                                    </h3>
                                    <p className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-medium ${cat.isVisible ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                                        {cat.isVisible ? 'ظاهر' : 'مخفي'}
                                    </p>
                                    <p className="text-sm text-slate-500 mt-1">
                                        {(cat.products?.length || 0)} منتج مرتبط
                                    </p>
                                </div>

                                <div className="flex gap-2">
                                    {user && hasPermission(user, "editCategories") && (
                                        <button
                                        onClick={() => handleEdit(cat)}
                                        className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-blue-600 hover:bg-blue-600 hover:text-white transition-all"
                                    >
                                        <Edit size={16} />
                                    </button>
                                    )}
                                    {user && hasPermission(user, "deleteCategories") && (
                                        <button
                                        onClick={() => handledelete(cat)}
                                        className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-red-500 hover:bg-red-500 hover:text-white transition-all"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </AnimatePresence>
            <AppModal
                title={editId ? "تعديل بيانات الفئة" : "إضافة فئة جديدة"}
                isOpen={isOpen}
                onClose={handleClose}
            >
                <div className="p-2 max-h-[80vh]">
                    <DynamicForm
                        schema={categorySchema}
                        onSubmit={onSubmit}
                        defaultValues={formData ?? emptyCategoryForm}
                        key={editId || 'create'}
                        submitLabel={editId ? 'تحديث البيانات' : 'إرسال البيانات'}
                    >
                        {({ register, control, formState: { errors } }) => (
                            <div className="grid gap-4">
                                <FormInput
                                    className='text-gray-800 dark:text-white'
                                    label="اسم الفئة"
                                    {...register("name")}
                                    error={errors.name?.message as string}
                                />
                                <Controller
                                    name="files"
                                    control={control}
                                    render={({ field }) => (
                                        <MultiFileUpload
                                            label="صورة الفئة"
                                            value={field.value}
                                            onChange={(val) => field.onChange(val.slice(0, 1))}
                                        />
                                    )}
                                />
                                <Controller
                                    name="isVisible"
                                    control={control}
                                    render={({ field }) => (
                                        <FormCheckbox
                                            label="تفعيل الظهور"
                                            description="عند التفعيل، يمكن إظهار هذا القسم في الواجهات العامة المرتبطة به"
                                            checked={Boolean(field.value)}
                                            onChange={(event) => field.onChange(event.target.checked)}
                                        />
                                    )}
                                />
                            </div>
                        )}
                    </DynamicForm>
                </div>
            </AppModal>
        </div>
    );
};

export default CategoriesLayout;
