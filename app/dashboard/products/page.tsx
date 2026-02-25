'use client';

import { DataTable } from '@/components/shared/DataTable';
import { DynamicForm } from '@/components/shared/dynamic-form';
import { AppModal } from '@/components/ui/app-modal';
import { Button } from '@/components/ui/button';
import { FormInput } from '@/components/ui/form-input';
import { FormSelect } from '@/components/ui/select-form';
import { MultiFileUpload, FileItem } from '@/components/ui/ImageUpload';
import { useAuth } from '@/context/AuthContext';
import { getallcategory } from '@/server/category';
import { deleteProduct, saveProductWithFiles, updateProductWithFiles } from '@/server/image';
import { getProduct } from '@/server/product';
import { getWarehouse } from '@/server/warehouse';
import { error } from 'console';
import { image } from 'framer-motion/client';
import { Mail, Plus, Warehouse } from 'lucide-react';
import * as React from 'react';
import { Controller } from 'react-hook-form';
import toast from 'react-hot-toast';
import z from 'zod';
import { ta } from 'zod/v4/locales';

const productschama = z.object({
    name: z.string().min(3, "اسم المنتج مطلوب"),
    description: z.string().optional().nullable(),
    price: z.coerce.number().min(0, "السعر يجب أن يكون رقم موجب"),
    categoryId: z.coerce.number().min(1, "يرجى اختيار فئة"),
    warehouseId: z.coerce.number().min(1, "يرجى اختيار مستودع"),
    quantity: z.coerce.string().min(1, "يرجى اختيار كمية المنتج"),
    discount: z.coerce.number().min(0, "الخصم يجب أن يكون رقم موجب").optional().default(0),
    files: z.array(z.any()).optional().default([]), // استخدام any هنا لتسهيل التعامل مع File objects
});


const ProductLayout = () => {
    const [isOpen, setIsOpen] = React.useState(false);
    const [editId, setEditId] = React.useState<string | number | null>(null);
    const [categories, setCategories] = React.useState<any[]>([]);
    const [products, setProducts] = React.useState<any[]>([]);
    const [warehouses, setWarehouses] = React.useState<any[]>([]);
    const [tab, setTab] = React.useState<'table' | "grid">('grid');
    const [selectedProduct, setSelectedProduct] = React.useState<any>(null);
    const [isPreviewOpen, setIsPreviewOpen] = React.useState(false);
    const [forData, setFormData] = React.useState<any>(null);
    const [page, setPage] = React.useState(1);
        const [selectedWarehouseFilter, setSelectedWarehouseFilter] = React.useState<string>('all');
    const {user} = useAuth()
  const PAGE_SIZE = 10;
    React.useEffect(() => {
        getallcategory().then(setCategories).catch(console.error);
        getProduct().then((products) => {
            setProducts(products);
            console.log("Products loaded:", products);
        }).catch(console.error);
        getWarehouse().then(setWarehouses).catch(console.error);

    }, []);

    React.useEffect(() => {
        const syriaWarehouse = warehouses.find(
            (warehouse) => typeof warehouse?.name === 'string' && warehouse.name.includes('سوريا')
        );

        if (syriaWarehouse) {
            setSelectedWarehouseFilter(syriaWarehouse.name);
        }
    }, [warehouses]);

    const handleClose = () => {
        setIsOpen(false);
        setEditId(null);
    };

    const handleShowDetails = (product: any) => {
        setSelectedProduct(product);
        setIsPreviewOpen(true);
    };

    const onSubmit = async (data: z.infer<typeof productschama>) => {
        const loadingToast = toast.loading(editId ? 'جاري تحديث المنتج...' : 'جاري اضافة المنتج...');
        try {
            if (editId) {
                const formData = new FormData();
                formData.append('name', data.name);
                formData.append('price', data.price.toString());
                formData.append('categoryId', data.categoryId.toString());
                formData.append('description', data.description || '');
                formData.append('discount', (data.discount || 0).toString());
                formData.append('quantity', (data.quantity || 0).toString());
                formData.append('warehouseId', data.warehouseId.toString());

                // معالجة الملفات - استخراج الملف الحقيقي rawFile
                if (data.files && data.files.length > 0) {
                    data.files.forEach((fileItem: any) => {
                        if (fileItem.rawFile instanceof File) {
                            formData.append('files', fileItem.rawFile);
                        }
                    });
                }
                const res = await updateProductWithFiles(Number(editId), formData);
                if (res.success) {
                    toast.success("تم تحديث المنتج بنجاح")
                    handleClose();
                    getallcategory().then(setCategories).catch(console.error);
                    getProduct().then((products) => {
                        setProducts(products);
                        console.log("Products loaded:", products);
                    }).catch(console.error);
                } else {
                    toast.error(`خطأ ${res.error}`)
                    alert("خطأ: " + res.error);
                }
            } else {
                const formData = new FormData();
                formData.append('name', data.name);
                formData.append('price', data.price.toString());
                formData.append('categoryId', data.categoryId.toString());
                formData.append('description', data.description || '');
                formData.append('discount', (data.discount || 0).toString());
                formData.append('quantity', (data.quantity || 0).toString());
                formData.append('warehouseId', data.warehouseId.toString());

                // معالجة الملفات - استخراج الملف الحقيقي rawFile
                if (data.files && data.files.length > 0) {
                    data.files.forEach((fileItem: any) => {
                        if (fileItem.rawFile instanceof File) {
                            formData.append('files', fileItem.rawFile);
                        }
                    });
                }

                // طباعة للتأكد من المحتوى قبل الإرسال
                console.log("Files to upload:", formData.getAll('files'));

                const result = await saveProductWithFiles(formData);

                if (result.success) {
                    toast.success("تم الحفظ بنجاح")
                    handleClose();
                    getallcategory().then(setCategories).catch(console.error);
                    getProduct().then((products) => {
                        setProducts(products);
                        console.log("Products loaded:", products);
                    }).catch(console.error);
                } else {
                    toast.error("خطأ: " + result.error);
                }
            }
        } catch (error) {
            toast.error(` خطأ ${error}`);
        } finally {
            toast.dismiss(loadingToast);
        }
    };

    const handleEdit = (id: string | number) => {
        setEditId(id);
        setIsOpen(true);
    }

    const filteredProducts = React.useMemo(() => {
        if (selectedWarehouseFilter === 'all') return products;

        return products.filter((product) =>
            product.stocks?.some((stock: any) => stock.warehouse?.name === selectedWarehouseFilter)
        );
    }, [products, selectedWarehouseFilter]);

    const tableActions: any[] = [
        (user && (user.accountType === "ADMIN" || user.permission?.editProducts === true) ) &&
        {
            label: "تعديل",
            icon: <Mail size={14} />,
            onClick: (data: any) => {
                setEditId(data.id);
                setFormData({
                    name: data.name,
                    price: data.price,
                    categoryId: data.categoryId,
                    description: data.description,
                    discount: data.discount,
                    quantity: data.stocks?.[0]?.quantity ?? data.quantity,
                    warehouseId: data.stocks?.[0]?.warehouseId ?? data.warehouseId,
                    // تمرير الصور الحالية إذا كان المكون يدعم عرضها كـ Preview
                    files: data.images || []
                });
                console.log("data", data);
                setIsOpen(true);
            }
        },
        (user && (user.accountType === "ADMIN" || user.permission?.deleteProducts === true)) &&
        {
            label: "حذف",
            icon: <Plus className="rotate-45" size={14} />,
            variant: "danger",
            onClick: async (data: any) => {
                const confirm = window.confirm("هل أنت متأكد من حذف هذا المنتج");
                if (confirm) {
                    const loadingToast = toast.loading('جاري الحذف...');
                    try {
                        const res = await deleteProduct(data.id)
                        if (res.success) {
                            toast.success("تم حذف المنتج بنجاح")
                        }
                    } catch (error) {
                        toast.error('فشل في حذف المستخدم');
                    } finally {
                        toast.dismiss(loadingToast);
                    }
                }
            }
        },
    ].filter(Boolean);

    return (
        <div className="p-4" dir="rtl">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-xl font-bold">إدارة المنتجات</h1>
                {(user && (user.accountType === "ADMIN" || user.permission?.addProducts === true ))
                && (
                    <Button onClick={() => setIsOpen(true)}>إضافة منتج جديد</Button>
                )
                }
                
            </div>
            <div className="flex flex-wrap justify-between items-center gap-3">
                <div className="flex gap-4 mb-4">
                <Button onClick={() => setTab("grid")} >قائمة</Button>
                <Button onClick={() => setTab("table")} >جدول</Button>
            </div>

            <div className="mb-4 max-w-xs">
                <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-200">
                    عرض حسب المستودع
                </label>
                <select
                    value={selectedWarehouseFilter}
                    onChange={(e) => {
                        setSelectedWarehouseFilter(e.target.value);
                        setPage(1);
                    }}
                    className="h-10 w-full border rounded-md px-3 bg-white dark:bg-slate-950 dark:border-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                >
                    <option value="all">كل المستودعات</option>
                    {warehouses.map((warehouse) => (
                        <option key={warehouse.id} value={warehouse.name}>{warehouse.name}</option>
                    ))}
                </select>
            </div>
            </div>

            {tab === 'grid' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredProducts.map((product) => (
                        <div
                            key={product.id}
                            className="group relative bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 hover:shadow-xl transition-all duration-300 flex flex-col"
                        >
                            {/* Image Section */}
                            <div className="relative aspect-square overflow-hidden bg-slate-100 dark:bg-slate-800">
                                {product.images && product.images.length > 0 ? (
                                    <img
                                        src={product.images[0].url}
                                        alt={product.name}
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <img src="/uploads/icon.png" className="w-16 opacity-20" alt="no-image" />
                                    </div>
                                )}
                                {product.discount > 0 && (
                                    <span className="absolute top-3 right-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                                        خصم {product.discount} $
                                    </span>
                                )}
                            </div>

                            {/* Content Section */}
                            <div className="p-4 flex flex-col flex-grow">
                                <div className="flex justify-between items-start mb-2">
                                    <h2 className="font-bold text-lg line-clamp-1 text-slate-800 dark:text-slate-100">{product.name}</h2>
                                </div>

                                <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-4 h-10">
                                    {product.description ? product.description : "لا يوجد وصف لهذا المنتج."}
                                </p>

                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 font-bold">
                                    المخزون: {product.stocks?.[0]?.quantity ?? product.quantity ?? 0}
                                </p>

                                <div className="mt-auto flex items-center justify-between">
                                    <div>
                                        {product.discount > 0 ? (
                                            <div className="flex flex-col">
                                                <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                                                    {Number(product.price) - Number(product.discount)} <span className="text-xs font-normal">$</span>
                                                </p>
                                                <span className="text-xs text-slate-400 line-through">
                                                    {product.price} $
                                                </span>
                                            </div>
                                        ) : (
                                            <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                                                {product.price} <span className="text-xs font-normal">$</span>
                                            </p>
                                        )}
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleShowDetails(product)}
                                        className="rounded-full hover:bg-blue-600 hover:text-white transition-colors"
                                    >
                                        تفاصيل
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* --- مودال عرض تفاصيل المنتج --- */}
            <AppModal
                title="تفاصيل المنتج"
                isOpen={isPreviewOpen}
                onClose={() => setIsPreviewOpen(false)}
            >
                {selectedProduct && (
                    <div className="p-6 grid md:grid-cols-2 gap-8 text-right" dir="rtl">
                        {/* Gallery Preview */}
                        <div className="space-y-4">
                            <div className="aspect-square rounded-xl overflow-hidden bg-slate-100 border dark:border-slate-800">
                                <img
                                    src={selectedProduct.images?.[0]?.url || "/uploads/icon.png"}
                                    className="w-full h-full object-contain"
                                    alt={selectedProduct.name}
                                />
                            </div>
                            <div className="flex gap-2 overflow-x-auto pb-2">
                                {selectedProduct.images?.map((img: any, idx: number) => (
                                    <img key={idx} src={img.url} className="w-16 h-16 rounded-md object-cover border cursor-pointer hover:border-blue-500" />
                                ))}
                            </div>
                        </div>

                        {/* Info Section */}
                        <div className="flex flex-col gap-4">
                            <div>
                                <span className="text-xs text-blue-600 font-semibold bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded">
                                    {categories.find(c => c.id === selectedProduct.categoryId)?.name || "تصنيف عام"}
                                </span>
                                <h1 className="text-2xl font-bold mt-2 text-slate-900 dark:text-white">{selectedProduct.name}</h1>
                            </div>

                            <div className="text-3xl font-bold text-blue-600">
                                {Number(selectedProduct.price) - Number(selectedProduct.discount)} $
                                {selectedProduct.discount > 0 && (
                                    <span className="text-sm text-slate-400 line-through mr-3 font-normal">
                                        {selectedProduct.price} $
                                    </span>
                                )}
                            </div>

                            <div className="border-t border-b py-4 dark:border-slate-800">
                                <h3 className="font-semibold mb-2">الوصف:</h3>
                                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                                    {selectedProduct.description || "لا يوجد وصف لهذا المنتج حالياً."}
                                </p>
                            </div>

                            <div className="mt-auto pt-4 flex gap-2">
                                <Button className="flex-1" onClick={() => {
                                    setEditId(selectedProduct.id);
                                    setIsOpen(true);
                                    setIsPreviewOpen(false);
                                }}>
                                    تعديل البيانات
                                </Button>
                                <Button variant="outline" onClick={() => setIsPreviewOpen(false)}>إغلاق</Button>
                            </div>
                        </div>
                    </div>
                )}
            </AppModal>
            {tab === 'table' && (
                <DataTable
                    data={filteredProducts}
                     totalCount={filteredProducts.length} // لنفترض وجود 150 عميل في الداتا بيز
                pageSize={PAGE_SIZE}
                currentPage={page}
                onPageChange={(newPage) => setPage(newPage)}
                    actions={tableActions}
                    columns={[
                        {
                            header: "المنتج",
                            accessor: (row: any) => (
                                <div className="flex items-center gap-2">
                                    <img
                                        src={row.images?.[0]?.url || "/uploads/icon.png"}
                                        alt=""
                                        className="w-8 h-8 rounded object-cover border"
                                    />
                                    <span>{row.name}</span>
                                </div>
                            )
                        },
                        {
                            header: "التصنيف",
                            accessor: (row: any) => {
                                const category = categories.find(c => c.id === row.categoryId);
                                return category ? category.name : "غير محدد";
                            }
                        },
                        {
                            header: "السعر",
                            accessor: (row: any) => (
                                row.discount > 0 ? (
                                    <div className="flex flex-col">
                                        <span className="font-bold text-slate-800 dark:text-slate-100">
                                            {Number(row.price) - Number(row.discount)} $
                                        </span>
                                        <span className="text-xs text-slate-400 line-through">
                                            {row.price} $
                                        </span>
                                    </div>
                                ) : (
                                    `${row.price} $`
                                )
                            )
                        },
                        {
                            header: "الخصم",
                            accessor: (row: any) => row.discount > 0 ? `${row.discount} $` : "—"
                        },

                    ]}
                />
            )}

            <AppModal title={editId ? "تعديل منتج" : "منتج جديد"} isOpen={isOpen} onClose={handleClose}>
                <div className="p-4">
                    <DynamicForm
                        schema={productschama}
                        onSubmit={onSubmit}
                        defaultValues={forData}
                        submitLabel={editId ? "تعديل المنتج" : "حفظ المنتج"}
                    >
                        {({ register, control, formState: { errors } }) => (
                            <div className="grid gap-4 md:grid-cols-2">
                                <FormInput className='col-span-2' label="اسم المنتج" {...register("name")} error={errors.name?.message as string} />

                                <div className="flex flex-col gap-1.5">
                                    <label className="text-sm text-right font-medium text-slate-800 dark:text-slate-200">التصنيف</label>
                                    <select
                                        {...register("categoryId")}
                                        className="h-10 border rounded-md px-3 bg-white dark:bg-slate-950 dark:border-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    >
                                        <option value="">اختر التصنيف</option>
                                        {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                                    </select>
                                    {errors.categoryId && <p className="text-xs text-red-500">{errors.categoryId.message as string}</p>}
                                </div>

                                <FormInput className='text-slate-900 dark:text-slate-100' type="number" label="السعر" {...register("price")} error={errors.price?.message as string} />
                                <FormInput className='text-slate-900 dark:text-slate-100' type="number" label="الخصم" {...register("discount")} error={errors.discount?.message as string} />
                                <FormSelect
                                    label="المستودع"
                                    placeholder="اختر المستودع"
                                    options={warehouses.map((warehouse) => ({
                                        value: warehouse.id,
                                        label: warehouse.name,
                                    }))}
                                    {...register("warehouseId")}
                                    error={errors.warehouseId?.message as string}
                                />
                                <FormInput className='text-slate-900 dark:text-slate-100' type="number" label="الكمية" {...register("quantity")} error={errors.quantity?.message as string} />
                                <textarea {...register("description")} placeholder='الوصف' className='col-span-2 border border-slate-400/30 bg-transparent text-slate-900 dark:text-slate-100' rows={5}></textarea>
                                <div className="md:col-span-2 border-t pt-4">
                                    <Controller
                                        name="files"
                                        control={control}
                                        render={({ field }) => (
                                            <MultiFileUpload
                                                label="صور وملفات المنتج"
                                                value={field.value}
                                                onChange={field.onChange}
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
};

export default ProductLayout;