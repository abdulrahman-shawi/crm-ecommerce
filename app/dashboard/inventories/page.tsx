'use client';
import { DynamicForm } from '@/components/shared/dynamic-form';
import { AppModal } from '@/components/ui/app-modal';
import { Button } from '@/components/ui/button';
import { FormInput } from '@/components/ui/form-input';
import { FormSelect } from '@/components/ui/select-form';
import { useAuth } from '@/context/AuthContext';
import { hasPermission } from '@/lib/utils';
import { createCountry, deleteCountry, getCountries, updateCountry } from '@/server/country';
import { createCity, deleteCity, getCities } from '@/server/city';
import { createWarehouse, deleteWarehouse, getWarehouse, updateWarehouse } from '@/server/warehouse';
import { AnimatePresence, motion } from 'framer-motion';
import { Edit, Trash2 } from 'lucide-react';
import * as React from 'react';
import toast from 'react-hot-toast';
import z from 'zod';

interface ICategoriesLayoutProps { }

const warehouseSchema = z.object({
    name: z.string().min(3, "اسم المستودع مطلوب"),
    countryId: z.string().min(1, "بلد المستودع مطلوب"),
    cityId: z.string().min(1, "مدينة المستودع مطلوبة"),
});

const countrySchema = z.object({
    name: z.string().min(2, "اسم البلد مطلوب"),
});


const CategoriesLayout: React.FunctionComponent<ICategoriesLayoutProps> = (props) => {
    const [isWarehouseOpen, setIsWarehouseOpen] = React.useState(false);
    const [warehouseEditId, setWarehouseEditId] = React.useState<string | null>(null);
    const [warehouseFormData, setWarehouseFormData] = React.useState<any>(null);
    const [warehouses, setWarehouses] = React.useState<any[]>([]);
    const [countries, setCountries] = React.useState<any[]>([]);
    const [cities, setCities] = React.useState<any[]>([]);
    const [isCountryOpen, setIsCountryOpen] = React.useState(false);
    const [countryEditId, setCountryEditId] = React.useState<string | null>(null);
    const [countryFormData, setCountryFormData] = React.useState<any>(null);
    const { user } = useAuth()
    const isAdminUser = user?.accountType === 'ADMIN';
    const countryOptions = countries.map((country) => ({
        value: String(country.id),
        label: country.name,
    }));
    const cityOptions = (countryId: string) => cities
        .filter((city) => String(city.countryId) === countryId)
        .map((city) => ({
            value: String(city.id),
            label: city.name,
        }));

    const handleWarehouseClose = () => {
        setIsWarehouseOpen(false);
        setWarehouseEditId(null);
        setWarehouseFormData(null);
    };

    const handleCountryClose = () => {
        setIsCountryOpen(false);
        setCountryEditId(null);
        setCountryFormData(null);
    };

    const handleEdit = (data: any) => {
        setWarehouseEditId(String(data.id));
        setWarehouseFormData({
            name: data.name,
            countryId: data.countryId ? String(data.countryId) : '',
            cityId: data.cityId ? String(data.cityId) : ''
        });
        setIsWarehouseOpen(true);
    }

    const handleCountryEdit = (data: any) => {
        setCountryEditId(String(data.id));
        setCountryFormData({
            name: data.name,
        });
        setIsCountryOpen(true);
    };

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
    const handleCountryDelete = async (data: any) => {
        const loadingToast = toast.loading('جاري حذف البلد...');
        const confirmed = confirm('هل أنت متأكد من حذف هذا البلد؟');
        if (confirmed) {
            try {
                const res = await deleteCountry(String(data.id));
                if (res.success) {
                    toast.success('تم حذف البلد بنجاح');
                } else {
                    toast.error(res.error || 'تعذر حذف البلد');
                }
            } catch (error: any) {
                toast.error('حدث خطأ أثناء حذف البلد');
                console.error(error);
            } finally {
                toast.dismiss(loadingToast);
                getData();
            }
        } else {
            toast.dismiss(loadingToast);
        }
    };

    const onWarehouseSubmit = async (data: z.infer<typeof warehouseSchema>) => {
        const loadingToast = toast.loading(warehouseEditId ? 'جاري تحديث البيانات...' : 'جاري إنشاء المستودع...');
        try {
            if (warehouseEditId) {
                const result = await updateWarehouse(warehouseEditId, data);
                if (result.success) {
                    toast.success('تم تحديث بيانات المستودع بنجاح');
                    handleWarehouseClose();
                } else {
                    toast.error(result.error || 'فشل في تحديث بيانات المستودع');
                }
            } else {
                const result = await createWarehouse(data);
                if (result.success) {
                    toast.success('تم إنشاء المستودع بنجاح');
                    handleWarehouseClose();
                } else {
                    toast.error(result.error || 'فشل في إنشاء المستودع، يرجى التحقق من المدخلات');
                }
            }
        } catch (error) {
            toast.error('حدث خطأ غير متوقع');
            console.error(error);
        } finally {
            toast.dismiss(loadingToast);
            getData();
        }
    };

    const onCountrySubmit = async (data: z.infer<typeof countrySchema>) => {
        const loadingToast = toast.loading(countryEditId ? 'جاري تحديث البلد...' : 'جاري إنشاء البلد...');
        try {
            if (countryEditId) {
                const result = await updateCountry(countryEditId, data);
                if (result.success) {
                    toast.success('تم تحديث البلد بنجاح');
                    handleCountryClose();
                } else {
                    toast.error(result.error || 'فشل في تحديث البلد');
                }
            } else {
                const result = await createCountry(data);
                if (result.success) {
                    toast.success('تم إنشاء البلد بنجاح');
                    handleCountryClose();
                } else {
                    toast.error(result.error || 'فشل في إنشاء البلد');
                }
            }
        } catch (error) {
            toast.error('حدث خطأ غير متوقع');
            console.error(error);
        } finally {
            toast.dismiss(loadingToast);
            getData();
        }
    };

    const getData = async () => {
        const [warehouseRows, countryRows, cityRows] = await Promise.all([
            getWarehouse(),
            getCountries(),
            getCities(),
        ]);

        setWarehouses(warehouseRows);
        setCountries(countryRows);
        setCities(cityRows);
    }

    React.useEffect(() => { getData(); }, []);

    return (
        <div className="p-4">
            <div className="flex justify-between items-center mb-6">
                <div className="text-xl font-bold">إدارة البلدان</div>
                {isAdminUser && (
                    <Button
                        onClick={() => { setCountryEditId(null); setCountryFormData(null); setIsCountryOpen(true); }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-6"
                    >
                        إضافة بلد جديدة
                    </Button>
                )}
            </div>

            <AnimatePresence>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
                    {countries.map((country: any) => (
                        <motion.div
                            key={country.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm group hover:border-emerald-500 transition-all"
                        >
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-bold text-xl text-slate-900 dark:text-white group-hover:text-emerald-600 transition-colors">
                                        {country.name}
                                    </h3>
                                    <p className="text-sm text-slate-500 mt-1">
                                        {(country._count?.warehouses || 0)} مستودع مرتبط
                                    </p>
                                </div>

                                {isAdminUser && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleCountryEdit(country)}
                                            className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all"
                                        >
                                            <Edit size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleCountryDelete(country)}
                                            className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-red-500 hover:bg-red-500 hover:text-white transition-all"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    ))}
                </div>
            </AnimatePresence>

            <div className="flex justify-between items-center mb-6">
                <div className="text-xl font-bold">إدارة المستودعات

                </div>
                {
                    user && hasPermission(user, "addCategories") && (
                        <Button
                            onClick={() => {
                                if (countries.length === 0) {
                                    toast.error('أضف بلدًا واحدًا على الأقل قبل إنشاء مستودع');
                                    return;
                                }
                                setWarehouseEditId(null);
                                setWarehouseFormData(null);
                                setIsWarehouseOpen(true);
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6"
                        >
                            إضافة مستودع جديدة
                        </Button>
                    )
                }
            </div>

            <AnimatePresence>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {warehouses.map((cat: any) => (
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
                                    <p className="text-sm text-slate-500 mt-1">{cat.location}</p>
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
                title={warehouseEditId ? "تعديل بيانات المستودع" : "إضافة مستودع جديدة"}
                isOpen={isWarehouseOpen}
                onClose={handleWarehouseClose}
            >
                <div className="p-2 max-h-[80vh]">
                    <DynamicForm
                        schema={warehouseSchema}
                        onSubmit={onWarehouseSubmit}
                        defaultValues={warehouseFormData}
                        key={warehouseEditId || 'create'}
                        submitLabel={warehouseEditId ? 'تحديث البيانات' : 'إرسال البيانات'}
                    >
                        {({ register, watch, setValue, formState: { errors } }) => {
                            const selectedCountryId = watch('countryId');
                            const availableCities = cityOptions(selectedCountryId);
                            return (
                                <div className="grid gap-4">
                                    <FormInput
                                        className='text-gray-800 dark:text-white'
                                        label="اسم المستودع"
                                        {...register("name")}
                                        error={errors.name?.message as string}
                                    />
                                    <FormSelect
                                        options={countryOptions}
                                        className='text-gray-800 dark:text-white'
                                        label="بلد المستودع"
                                        {...register("countryId", {
                                            onChange: () => setValue('cityId', ''),
                                        })}
                                        error={errors.countryId?.message as string}
                                    />
                                    <FormSelect
                                        options={availableCities}
                                        className='text-gray-800 dark:text-white'
                                        label="مدينة المستودع"
                                        {...register("cityId")}
                                        error={errors.cityId?.message as string}
                                    />
                                </div>
                            );
                        }}
                    </DynamicForm>
                </div>
            </AppModal>
            <AppModal
                title={countryEditId ? 'تعديل البلد' : 'إضافة بلد جديدة'}
                isOpen={isCountryOpen}
                onClose={handleCountryClose}
            >
                <div className="p-2 max-h-[80vh]">
                    <DynamicForm
                        schema={countrySchema}
                        onSubmit={onCountrySubmit}
                        defaultValues={countryFormData}
                        key={countryEditId || 'country-create'}
                        submitLabel={countryEditId ? 'تحديث البلد' : 'إرسال البيانات'}
                    >
                        {({ register, formState: { errors } }) => (
                            <div className="grid gap-4">
                                <FormInput
                                    className='text-gray-800 dark:text-white'
                                    label="اسم البلد"
                                    {...register('name')}
                                    error={errors.name?.message as string}
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