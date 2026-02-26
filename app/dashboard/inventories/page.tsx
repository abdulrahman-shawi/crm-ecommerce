'use client';
import { DynamicForm } from '@/components/shared/dynamic-form';
import { AppModal } from '@/components/ui/app-modal';
import { Button } from '@/components/ui/button';
// تأكد من استيراد FormInput من المكان الصحيح في مكوناتك وليس من lucide-react
import { FormInput } from '@/components/ui/form-input';
import { FormSelect } from '@/components/ui/select-form';
import { useAuth } from '@/context/AuthContext';
import { hasPermission } from '@/lib/utils';
import { createcategory, deletecategory, getallcategory, updatecategory } from '@/server/category';
import { createWarehouse, deleteWarehouse, getWarehouse, updateWarehouse } from '@/server/warehouse';
import { AnimatePresence, motion } from 'framer-motion';
import { Edit, Trash2 } from 'lucide-react';
import * as React from 'react';
import toast from 'react-hot-toast';
import z, { set } from 'zod';

interface ICategoriesLayoutProps { }

const categorySchema = z.object({
    name: z.string().min(3, "اسم المستودع مطلوب"),
    location: z.string().min(3, "موقع المستودع مطلوب")
});

const locationOptions = [
    { value: 'سوريا', label: 'سوريا' },
    { value: 'تركيا', label: 'تركيا' },
];


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
        setFormData({
            name: data.name,
            location: data.location
        });
        setIsOpen(true);
    }

    const handledelete = async (data: any) => {
        const loadingToast = toast.loading('جاري حذف المستودع...');
        const confirmed = confirm("هل أنت متأكد من حذف هذا المستودع؟");
        if (confirmed) {
            try {
                const res = await deleteWarehouse(data.id)
                if (res.success) {
                    toast.success("تم حذف المستودع بنجاح")
                } else {
                    toast.error("حدث خطأ أثناء حذف المستودع: " + (res.error || "فشل في حذف المستودع، قد يكون مرتبطًا بسجلات أخرى"))
                }
            } catch (error: any) {
                toast.error("خطأ", error)
            } finally {
                toast.dismiss(loadingToast)
                getData()
            }
        }
    }
    const onSubmit = async (data: z.infer<typeof categorySchema>) => {
        const loadingToast = toast.loading(editId ? 'جاري تحديث البيانات...' : 'جاري إنشاء الحساب...');
        try {
            if (editId) {
                console.log("تعديل:", editId);
                updateWarehouse(editId, data).then((result) => {
                    if (result.success) {
                        toast.success("تم تحديث بيانات المستودع بنجاح");
                        handleClose(); // نغلق المودال فقط عند النجاح
                    } else {
                        toast.error(result.error || "فشل في تحديث بيانات المستودع");
                    }
                });
            } else {
                createWarehouse(data).then((result) => {
                    if (result.success) {
                        toast.success("تم إنشاء المستودع بنجاح");
                        handleClose(); // نغلق المودال فقط عند النجاح
                    } else {
                        toast.error(result.error || "فشل في إنشاء المستودع، يرجى التحقق من المدخلات");
                    }
                });
            }
        } catch (error) {
            toast.error("حدث خطأ غير متوقع");
            console.error(error);
        } finally {
            toast.dismiss(loadingToast);
            getData(); // تحديث البيانات بعد الإنشاء أو التعديل
        }
    };

    const getData = async () => {
        const cat = await getWarehouse();
        setCategory(cat);
    }

    React.useEffect(() => { getData(); }, []);

    return (
        <div className="p-4">
            <div className="flex justify-between items-center mb-6">
                <div className="text-xl font-bold">إدارة المستودعات

                </div>
                {
                    user && hasPermission(user, "addCategories") && (
                        <Button
                            onClick={() => { setEditId(null); setFormData(null); setIsOpen(true); }}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6"
                        >
                            إضافة مستودع جديدة
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
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-bold text-xl text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors">
                                        {cat.name}
                                    </h3>
                                    <p className="text-sm text-slate-500 mt-1">
                                        {(cat._count?.stocks || 0)} منتج مرتبط
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
                title={editId ? "تعديل بيانات المستودع" : "إضافة مستودع جديدة"}
                isOpen={isOpen}
                onClose={handleClose}
            >
                <div className="p-2 max-h-[80vh]">
                    <DynamicForm
                        schema={categorySchema}
                        onSubmit={onSubmit}
                        defaultValues={formData}
                        key={editId || 'create'}
                        submitLabel={editId ? 'تحديث البيانات' : 'إرسال البيانات'}
                    >
                        {({ register, formState: { errors } }) => (
                            <div className="grid gap-4">
                                <FormInput
                                    className='text-gray-800 dark:text-white'
                                    label="اسم المستودع"
                                    {...register("name")}
                                    error={errors.name?.message as string}
                                />
                                <FormSelect
                                    options={locationOptions}
                                    className='text-gray-800 dark:text-white'
                                    label="موقع المستودع"
                                    {...register("location")}
                                    error={errors.location?.message as string}
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