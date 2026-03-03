"use client";
import { DynamicForm } from "@/components/shared/dynamic-form";
import { AppModal } from "@/components/ui/app-modal";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { hasPermission } from "@/lib/utils";
import { createshipping, deletshipping, getshipping, updateshipping } from "@/server/shipping";
import { AnimatePresence, motion } from "framer-motion";
import { Edit, Trash2 } from "lucide-react";
import React from "react";
import toast from "react-hot-toast";
import z from "zod";
import { FormInput } from "@/components/ui/form-input";

const shippingSchema = z.object({
    name: z.string().min(3, "اسم شركة الشحن مطلوب"),
    price: z.number().min(0, "السعر لا يمكن أن يكون سالب"),
});
export default function ShippingPage() {
    const [isOpen, setIsOpen] = React.useState(false);
    const [editId, setEditId] = React.useState<string | null>(null);
    const [formData, setFormData] = React.useState<any>(null);
    const [shipping, setshipping] = React.useState<any[]>([]);
    const { user } = useAuth()


    const getData = async () => {
        try {
            const res = await getshipping();
            if (res.success) {
                setshipping(res.data);
            } else {
                toast.error("حدث خطأ أثناء جلب بيانات شركات الشحن");
            }
        } catch (error) {
            toast.error("حدث خطأ غير متوقع أثناء جلب بيانات شركات الشحن");
        }
    };
    React.useEffect(() => {
        getData();
    }, []);
    const handleClose = () => {
        setIsOpen(false);
        setEditId(null);
        setFormData(null);
    };

    const handleEdit = (data: any) => {
        setEditId(data.id);
        setFormData({
            name: data.name
        });
        setIsOpen(true);
    }

    const handledelete = async (data: any) => {
        const loadingToast = toast.loading('جاري حذف شركة الشحن...');
        try {
            const res = await deletshipping(data.id);
            if (res.success) {
                toast.success("تم حذف شركة الشحن بنجاح");
                getData();
            } else {
                toast.error("حدث خطأ أثناء حذف شركة الشحن");
            }
        } catch (error) {
            toast.error("حدث خطأ غير متوقع أثناء حذف شركة الشحن");
        } finally {    
                            toast.dismiss(loadingToast);
        }
    };

    const onSubmit = async (data: z.infer<typeof shippingSchema>) => {
        const loadingToast = toast.loading(editId ? 'جاري تحديث البيانات...' : 'جاري إنشاء شركة الشحن...');
        try {
            if (editId) {
                const res = await updateshipping(editId, data);
                if (res.success) {
                    toast.success("تم تحديث شركة الشحن بنجاح");
                } else {
                    toast.error("حدث خطأ أثناء تحديث شركة الشحن");
                }

            } else {
                const res = await createshipping(data);
                if (res.success) {
                    toast.success("تم إنشاء شركة الشحن بنجاح");
                } else {
                    toast.error("حدث خطأ أثناء إنشاء شركة الشحن");
                }
            }
        } catch (error) {
            toast.error("حدث خطأ غير متوقع");
        } finally {
            toast.dismiss(loadingToast);
            // قم بإعادة جلب بيانات شركات الشحن لتحديث القائمة
            getData();
        }
    };

        return (
            <div className="p-4">
                <div className="flex justify-between items-center mb-6">
                    <div className="text-xl font-bold">إدارة شركات الشحن</div>
                    {
                        user && hasPermission(user, "addCategories") && (
                            <Button
                                onClick={() => { setEditId(null); setFormData(null); setIsOpen(true); }}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-6"
                            >
                                إضافة شركة شحن جديدة
                            </Button>
                        )
                    }
                </div>

                <AnimatePresence>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {shipping.map((e: any) => (
                            <motion.div
                                key={e.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm group hover:border-blue-500 transition-all"
                            >
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-bold text-xl text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors">
                                            {e.name}
                                        </h3>
                                        <p className="text-sm text-slate-500 mt-1">
                                            {e.price} سعر الشحن
                                        </p>
                                    </div>

                                    <div className="flex gap-2">
                                        {user && hasPermission(user, "editCategories") && (
                                            <button
                                                onClick={() => handleEdit(e)}
                                                className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-blue-600 hover:bg-blue-600 hover:text-white transition-all"
                                            >
                                                <Edit size={16} />
                                            </button>
                                        )}
                                        {user && hasPermission(user, "deleteCategories") && (
                                            <button
                                                onClick={() => handledelete(e)}
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
                            schema={shippingSchema}
                            onSubmit={onSubmit}
                            defaultValues={formData}
                            key={editId || 'create'}
                            submitLabel={editId ? 'تحديث البيانات' : 'إرسال البيانات'}
                        >
                            {({ register, formState: { errors } }) => (
                                <div className="grid gap-4">
                                    <FormInput
                                        className='text-gray-800 dark:text-white'
                                        label="اسم الفئة"
                                        {...register("name")}
                                        error={errors.name?.message as string}
                                    />
                                    <FormInput
                                        className='text-gray-800 dark:text-white'
                                        label="سعر الشحن"   
                                        type="number"
                                        step="0.01"
                                        {...register("price", { valueAsNumber: true })}
                                        error={errors.price?.message as string}
                                    />
                                </div>
                            )}
                        </DynamicForm>
                    </div>
                </AppModal>
            </div>
        );
    }
