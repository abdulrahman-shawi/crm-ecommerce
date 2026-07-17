'use client';

import { DynamicForm } from '@/components/shared/dynamic-form';
import { AppModal } from '@/components/ui/app-modal';
import { Button } from '@/components/ui/button';
import { FormInput } from '@/components/ui/form-input';
import { FormSelect } from '@/components/ui/select-form';
import { useAuth } from '@/context/AuthContext';
import { createCity, deleteCity, getCities, updateCity } from '@/server/city';
import { getCountries } from '@/server/country';
import { hasPermission } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import { Edit, Trash2 } from 'lucide-react';
import * as React from 'react';
import toast from 'react-hot-toast';
import z from 'zod';

const citySchema = z.object({
    name: z.string().min(2, 'اسم المدينة مطلوب'),
    countryId: z.string().min(1, 'بلد المدينة مطلوب'),
});

export default function CitiesPage() {
    const [isOpen, setIsOpen] = React.useState(false);
    const [editId, setEditId] = React.useState<string | null>(null);
    const [formData, setFormData] = React.useState<any>(null);
    const [cities, setCities] = React.useState<any[]>([]);
    const [countries, setCountries] = React.useState<any[]>([]);
    const { user } = useAuth();

    const canAdd = Boolean(user && hasPermission(user, 'addCategories'));
    const canEdit = Boolean(user && hasPermission(user, 'editCategories'));
    const canDelete = Boolean(user && hasPermission(user, 'deleteCategories'));

    const countryOptions = countries.map((country) => ({
        value: String(country.id),
        label: country.name,
    }));

    const loadData = React.useCallback(async () => {
        const [cityRows, countryRows] = await Promise.all([getCities(), getCountries()]);
        setCities(cityRows);
        setCountries(countryRows);
    }, []);

    React.useEffect(() => {
        void loadData();
    }, [loadData]);

    const handleClose = () => {
        setIsOpen(false);
        setEditId(null);
        setFormData(null);
    };

    const handleEdit = (city: any) => {
        setEditId(String(city.id));
        setFormData({
            name: city.name,
            countryId: city.countryId ? String(city.countryId) : '',
        });
        setIsOpen(true);
    };

    const handleDelete = async (city: any) => {
        const loadingToast = toast.loading('جاري حذف المدينة...');
        const confirmed = confirm('هل أنت متأكد من حذف هذه المدينة؟');

        if (!confirmed) {
            toast.dismiss(loadingToast);
            return;
        }

        try {
            const result = await deleteCity(String(city.id));
            if (result.success) {
                toast.success('تم حذف المدينة بنجاح');
            } else {
                toast.error(result.error || 'تعذر حذف المدينة');
            }
        } catch (error) {
            console.error(error);
            toast.error('حدث خطأ أثناء حذف المدينة');
        } finally {
            toast.dismiss(loadingToast);
            void loadData();
        }
    };

    const onSubmit = async (data: z.infer<typeof citySchema>) => {
        const loadingToast = toast.loading(editId ? 'جاري تحديث المدينة...' : 'جاري إنشاء المدينة...');

        try {
            const result = editId
                ? await updateCity(editId, data)
                : await createCity(data);

            if (result.success) {
                toast.success(editId ? 'تم تحديث المدينة بنجاح' : 'تم إنشاء المدينة بنجاح');
                handleClose();
            } else {
                toast.error(result.error || 'تعذر حفظ المدينة');
            }
        } catch (error) {
            console.error(error);
            toast.error('حدث خطأ غير متوقع');
        } finally {
            toast.dismiss(loadingToast);
            void loadData();
        }
    };

    return (
        <div className="p-4">
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <div className="text-xl font-bold">إدارة المدن</div>
                    <p className="mt-1 text-sm text-slate-500">اربط كل مدينة ببلد واحد، ويمكن لكل بلد أن يحتوي على عدة مدن.</p>
                </div>
                {canAdd && (
                    <Button
                        onClick={() => {
                            if (countries.length === 0) {
                                toast.error('أضف بلدًا واحدًا على الأقل قبل إنشاء مدينة');
                                return;
                            }

                            setEditId(null);
                            setFormData(null);
                            setIsOpen(true);
                        }}
                        className="bg-blue-600 px-6 text-white hover:bg-blue-700"
                    >
                        إضافة مدينة جديدة
                    </Button>
                )}
            </div>

            <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-right">
                        <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                            <tr>
                                <th className="px-6 py-4">اسم المدينة</th>
                                <th className="px-6 py-4">البلد</th>
                                <th className="px-6 py-4">تاريخ الإنشاء</th>
                                <th className="px-6 py-4">إجراء</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            <AnimatePresence initial={false}>
                                {cities.map((city) => (
                                    <motion.tr
                                        key={city.id}
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -8 }}
                                        className="hover:bg-slate-50 dark:hover:bg-slate-800/30"
                                    >
                                        <td className="px-6 py-5 font-bold text-slate-900 dark:text-white">{city.name}</td>
                                        <td className="px-6 py-5 text-slate-600 dark:text-slate-300">{city.country?.name || '—'}</td>
                                        <td className="px-6 py-5 text-slate-500 dark:text-slate-400">{new Date(city.createdAt).toLocaleDateString('ar-EG')}</td>
                                        <td className="px-6 py-5">
                                            <div className="flex gap-2">
                                                {canEdit && (
                                                    <button
                                                        onClick={() => handleEdit(city)}
                                                        className="rounded-xl bg-slate-50 p-2.5 text-blue-600 transition-all hover:bg-blue-600 hover:text-white dark:bg-slate-800"
                                                    >
                                                        <Edit size={16} />
                                                    </button>
                                                )}
                                                {canDelete && (
                                                    <button
                                                        onClick={() => handleDelete(city)}
                                                        className="rounded-xl bg-slate-50 p-2.5 text-red-500 transition-all hover:bg-red-500 hover:text-white dark:bg-slate-800"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </motion.tr>
                                ))}
                            </AnimatePresence>
                        </tbody>
                    </table>
                </div>
            </div>

            <AppModal
                title={editId ? 'تعديل المدينة' : 'إضافة مدينة جديدة'}
                isOpen={isOpen}
                onClose={handleClose}
            >
                <div className="max-h-[80vh] p-2">
                    <DynamicForm
                        schema={citySchema}
                        onSubmit={onSubmit}
                        defaultValues={formData}
                        key={editId || 'city-create'}
                        submitLabel={editId ? 'تحديث المدينة' : 'إرسال البيانات'}
                    >
                        {({ register, formState: { errors } }) => (
                            <div className="grid gap-4">
                                <FormInput
                                    className="text-gray-800 dark:text-white"
                                    label="اسم المدينة"
                                    {...register('name')}
                                    error={errors.name?.message as string}
                                />
                                <FormSelect
                                    options={countryOptions}
                                    className="text-gray-800 dark:text-white"
                                    label="بلد المدينة"
                                    {...register('countryId')}
                                    error={errors.countryId?.message as string}
                                />
                            </div>
                        )}
                    </DynamicForm>
                </div>
            </AppModal>
        </div>
    );
}