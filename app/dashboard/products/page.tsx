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
import { deleteProductFromWarehouse, saveProductWithFiles, updateProductWithFiles } from '@/server/image';
import { getProduct } from '@/server/product';
import { getWarehouse } from '@/server/warehouse';
import { error } from 'console';
import { image } from 'framer-motion/client';
import { FileDown, Mail, Plus, Warehouse } from 'lucide-react';
import * as React from 'react';
import { Controller, useFieldArray } from 'react-hook-form';
import toast from 'react-hot-toast';
import z from 'zod';
import { ta } from 'zod/v4/locales';
import * as XLSX from 'xlsx';

const productschama = z.object({
    name: z.string().min(3, "اسم المنتج مطلوب"),
    description: z.string().optional().nullable(),
    categoryId: z.coerce.number().min(1, "يرجى اختيار فئة"),
    warehouseStocks: z.array(
        z.object({
            warehouseId: z.coerce.number().min(1, "يرجى اختيار مستودع"),
            quantity: z.coerce.number().min(0, "يرجى إدخال كمية صحيحة"),
            stockPrice: z.coerce.number().min(0, "يرجى إدخال سعر صحيح").optional().default(0),
            stockDiscount: z.coerce.number().min(0, "يرجى إدخال خصم صحيح").optional().default(0),
        })
    ).min(1, "يجب إضافة مستودع واحد على الأقل"),
    files: z.array(z.any()).optional().default([]), // استخدام any هنا لتسهيل التعامل مع File objects
});

const WarehouseStocksFields = ({ control, register, errors, warehouses }: any) => {
    const { fields, append, remove } = useFieldArray({
        control,
        name: 'warehouseStocks'
    });

    return (
        <div className="md:col-span-2 border rounded-lg p-3 border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-slate-800 dark:text-slate-200">المخزون حسب المستودع</h3>
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => append({ warehouseId: '', quantity: 0, stockPrice: 0, stockDiscount: 0 })}
                >
                    إضافة مستودع
                </Button>
            </div>

            <div className="grid gap-3">
                {fields.map((field, index) => (
                    <div key={field.id} className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end border border-slate-200 dark:border-slate-800 rounded-md p-2">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm text-right font-medium text-slate-800 dark:text-slate-200">المستودع</label>
                            <select
                                {...register(`warehouseStocks.${index}.warehouseId`)}
                                className="h-10 border rounded-md px-3 bg-white dark:bg-slate-950 dark:border-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            >
                                <option value="">اختر المستودع</option>
                                {warehouses.map((warehouse: any) => (
                                    <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                                ))}
                            </select>
                            {errors?.warehouseStocks?.[index]?.warehouseId && (
                                <p className="text-xs text-red-500">{errors.warehouseStocks[index].warehouseId.message as string}</p>
                            )}
                        </div>

                        <FormInput
                            className='text-slate-900 dark:text-slate-100'
                            type="number"
                            label="الكمية"
                            {...register(`warehouseStocks.${index}.quantity`)}
                            error={errors?.warehouseStocks?.[index]?.quantity?.message as string}
                        />

                        <FormInput
                            className='text-slate-900 dark:text-slate-100'
                            type="number"
                            step="0.01"
                            label="سعر المنتج"
                            {...register(`warehouseStocks.${index}.stockPrice`)}
                            error={errors?.warehouseStocks?.[index]?.stockPrice?.message as string}
                        />

                        <FormInput
                            className='text-slate-900 dark:text-slate-100'
                            type="number"
                            step="0.01"
                            label="خصم المنتج"
                            {...register(`warehouseStocks.${index}.stockDiscount`)}
                            error={errors?.warehouseStocks?.[index]?.stockDiscount?.message as string}
                        />

                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => remove(index)}
                            disabled={fields.length === 1}
                        >
                            حذف
                        </Button>
                    </div>
                ))}
            </div>
        </div>
    );
};


const ProductLayout = () => {
    const [isOpen, setIsOpen] = React.useState(false);
    const [editId, setEditId] = React.useState<string | number | null>(null);
    const [categories, setCategories] = React.useState<any[]>([]);
    const [products, setProducts] = React.useState<any[]>([]);
    const [warehouses, setWarehouses] = React.useState<any[]>([]);
    const [tab, setTab] = React.useState<'table' | "grid">('table');
    const [selectedProduct, setSelectedProduct] = React.useState<any>(null);
    const [isPreviewOpen, setIsPreviewOpen] = React.useState(false);
    const [forData, setFormData] = React.useState<any>(null);
    const [page, setPage] = React.useState(1);
    const [selectedWarehouseFilter, setSelectedWarehouseFilter] = React.useState<string>('all');
    const [nameFilter, setNameFilter] = React.useState('');
    const [categoryFilter, setCategoryFilter] = React.useState<string>('all');
    const { user } = useAuth()
    const PAGE_SIZE = 10;
    React.useEffect(() => {
        getallcategory().then(setCategories).catch(console.error);
        getProduct().then((products) => {
            setProducts(products);
            console.log("Products loaded:", products);
        }).catch(console.error);
        getWarehouse().then(setWarehouses).catch(console.error);

    }, []);

    const locationOptions = React.useMemo(() => {
        return Array.from(
            new Set(
                warehouses
                    .map((warehouse: any) => String(warehouse?.location || '').trim())
                    .filter((location: string) => location.length > 0)
            )
        );
    }, [warehouses]);

    const handleClose = () => {
        setIsOpen(false);
        setEditId(null);
        setFormData(null);
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
                formData.append('categoryId', data.categoryId.toString());
                formData.append('description', data.description || '');
                formData.append('warehouseStocks', JSON.stringify(data.warehouseStocks || []));

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
                formData.append('categoryId', data.categoryId.toString());
                formData.append('description', data.description || '');
                formData.append('warehouseStocks', JSON.stringify(data.warehouseStocks || []));

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



    const displayProducts = React.useMemo(() => {
        const normalizedNameFilter = nameFilter.trim().toLowerCase();

        return products.flatMap((product: any) => {
            const stocks = Array.isArray(product?.stocks) ? product.stocks : [];

            const matchesName = !normalizedNameFilter || String(product?.name || '').toLowerCase().includes(normalizedNameFilter);
            const matchesCategory = categoryFilter === 'all' || String(product?.categoryId || '') === categoryFilter;
            if (!matchesName || !matchesCategory) {
                return [];
            }

            return stocks
                .filter((stock: any) => selectedWarehouseFilter === 'all' || String(stock?.warehouse?.location || '') === selectedWarehouseFilter)
                .map((stock: any) => ({
                    ...product,
                    __stock: stock,
                    __rowId: `${product.id}-${stock.warehouseId}`,
                }));
        });
    }, [products, selectedWarehouseFilter, nameFilter, categoryFilter]);

    const ExportToExcel = () => {
        // تجهيز البيانات بشكل مقروء
        const excelData = displayProducts.map((stock: any) => ({
            "اسم المنتج": stock.name,
            "المستودع": stock.__stock.warehouse.name,
            "التصنيف": stock.categoryId ? (categories.find(c => c.id === stock.categoryId)?.name || "غير محدد") : "غير محدد",
            "الكمية الحالية": stock.__stock.quantity,
            "السعر": stock.__stock.price,
            "الخصم": stock.__stock.discount,
            "تاريخ الجرد": new Date().toLocaleDateString('ar-EG')
        }));
        const worksheet = XLSX.utils.json_to_sheet(excelData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "المخزون الحالي");
        
            // تحسين: ضبط عرض الأعمدة تلقائياً
            const maxWidth = 20;
            worksheet["!cols"] = [
              { wch: maxWidth }, { wch: maxWidth }, { wch: maxWidth }, { wch: maxWidth }, { wch: maxWidth }, { wch: maxWidth }, { wch: maxWidth }
            ];
        
            XLSX.writeFile(workbook, `inventory_${new Date().getTime()}.xlsx`);
        // يمكنك إضافة منطق التصدير هنا إذا رغبت
    };

    const tableActions: any[] = [
        (user && (user.accountType === "ADMIN" || user.permission?.editProducts === true)) &&
        {
            label: "تعديل",
            icon: <Mail size={14} />,
            onClick: (data: any) => {
                setEditId(data.id);
                setFormData({
                    name: data.name,
                    categoryId: data.categoryId,
                    description: data.description,
                    warehouseStocks: data.stocks?.length
                        ? data.stocks.map((stock: any) => ({
                            warehouseId: stock.warehouseId,
                            quantity: stock.quantity,
                            stockPrice: stock.price ?? 0,
                            stockDiscount: stock.discount ?? 0,
                        }))
                        : [{ warehouseId: '', quantity: 0, stockPrice: 0, stockDiscount: 0 }],
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
                const warehouseName = data?.__stock?.warehouse?.name || "المستودع";
                const confirm = window.confirm(`هل أنت متأكد من حذف هذا المنتج من ${warehouseName}؟`);
                if (confirm) {
                    const loadingToast = toast.loading('جاري الحذف...');
                    try {
                        const res = await deleteProductFromWarehouse(Number(data.id), Number(data?.__stock?.warehouseId))
                        if (res.success) {
                            toast.success("تم حذف المنتج من المستودع بنجاح")
                            getProduct().then((products) => {
                                setProducts(products);
                            }).catch(console.error);
                        } else {
                            toast.error(res.error || "فشل حذف المنتج من المستودع")
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

    React.useEffect(() => {
        setPage(1);
    }, [selectedWarehouseFilter, nameFilter, categoryFilter]);


    return (
        <div className="p-4" dir="rtl">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-xl font-bold">إدارة المنتجات</h1>
                {(user && (user.accountType === "ADMIN" || user.permission?.addProducts === true))
                    && (
                        <Button onClick={() => { setEditId(null); setFormData(null); setIsOpen(true); }}>إضافة منتج جديد</Button>
                    )
                }

            </div>
            <div className="flex flex-wrap justify-between items-center gap-3">
                <div className="flex gap-4 mb-4">
                    <Button onClick={() => setTab("grid")} >قائمة</Button>
                    <Button onClick={() => setTab("table")} >جدول</Button>
                    <button
                        onClick={ExportToExcel}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition"
                    >
                        <FileDown size={18} />
                    </button>
                </div>

                <div className="flex items-center gap-3">
                    <div className="mb-4 max-w-xs">
                    <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-200">
                        بحث بالاسم
                    </label>
                    <input
                        type="text"
                        value={nameFilter}
                        onChange={(e) => {
                            setNameFilter(e.target.value);
                            setPage(1);
                        }}
                        placeholder="اسم المنتج"
                        className="h-10 w-full border rounded-md px-3 bg-white dark:bg-slate-950 dark:border-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    />
                </div>

                <div className="mb-4 max-w-xs">
                    <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-200">
                        عرض حسب التصنيف
                    </label>
                    <select
                        value={categoryFilter}
                        onChange={(e) => {
                            setCategoryFilter(e.target.value);
                            setPage(1);
                        }}
                        className="h-10 w-full border rounded-md px-3 bg-white dark:bg-slate-950 dark:border-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    >
                        <option value="all">كل التصنيفات</option>
                        {categories.map((category: any) => (
                            <option key={category.id} value={String(category.id)}>{category.name}</option>
                        ))}
                    </select>
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
                        {locationOptions.map((location) => (
                            <option key={location} value={location}>{location}</option>
                        ))}
                    </select>
                </div>
                </div>
            </div>

            {tab === 'grid' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {displayProducts.map((product: any) => (
                        <div
                            key={product.__rowId}
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
                                {Number(product?.__stock?.discount || 0) > 0 && (
                                    <span className="absolute top-3 right-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                                        خصم {Number(product?.__stock?.discount || 0)} $
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
                                    المخزون: {Number(product?.__stock?.quantity || 0)} | المستودع: {product?.__stock?.warehouse?.name || "غير محدد"}
                                </p>

                                <div className="mt-auto flex items-center justify-between">
                                    <div>
                                        {Number(product?.__stock?.discount || 0) > 0 ? (
                                            <div className="flex flex-col">
                                                <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                                                    {Number(product?.__stock?.price || 0) - Number(product?.__stock?.discount || 0)} <span className="text-xs font-normal">$</span>
                                                </p>
                                                <span className="text-xs text-slate-400 line-through">
                                                    {Number(product?.__stock?.price || 0)} $
                                                </span>
                                            </div>
                                        ) : (
                                            <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                                                {Number(product?.__stock?.price || 0)} <span className="text-xs font-normal">$</span>
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
                                {Number(selectedProduct?.__stock?.price || 0) - Number(selectedProduct?.__stock?.discount || 0)} $
                                {Number(selectedProduct?.__stock?.discount || 0) > 0 && (
                                    <span className="text-sm text-slate-400 line-through mr-3 font-normal">
                                        {Number(selectedProduct?.__stock?.price || 0)} $
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
                    data={displayProducts}
                    rowKey={"__rowId"}
                    totalCount={displayProducts.length} // لنفترض وجود 150 عميل في الداتا بيز
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
                                Number(row?.__stock?.discount || 0) > 0 ? (
                                    <div className="flex flex-col">
                                        <span className="font-bold text-slate-800 dark:text-slate-100">
                                            {Number(row?.__stock?.price || 0) - Number(row?.__stock?.discount || 0)} $
                                        </span>
                                        <span className="text-xs text-slate-400 line-through">
                                            {Number(row?.__stock?.price || 0)} $
                                        </span>
                                    </div>
                                ) : (
                                    `${Number(row?.__stock?.price || 0)} $`
                                )
                            )
                        },
                        {
                            header: "الخصم",
                            accessor: (row: any) => Number(row?.__stock?.discount || 0) > 0 ? `${Number(row?.__stock?.discount || 0)} $` : "—"
                        },
                        {
                            header: "المخزون",
                            accessor: (row: any) => Number(row?.__stock?.quantity || 0)
                        },
                        {
                            header: "المستودع",
                            accessor: (row: any) => {
                                return row?.__stock?.warehouse?.name || "غير محدد";
                            }
                        },

                    ]}
                />
            )}

            <AppModal title={editId ? "تعديل منتج" : "منتج جديد"} isOpen={isOpen} onClose={handleClose}>
                <div className="p-4">
                    <DynamicForm
                        schema={productschama}
                        onSubmit={onSubmit}
                        defaultValues={forData || { warehouseStocks: [{ warehouseId: '', quantity: 0, stockPrice: 0, stockDiscount: 0 }] }}
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
                                <WarehouseStocksFields
                                    control={control}
                                    register={register}
                                    errors={errors}
                                    warehouses={warehouses}
                                />
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