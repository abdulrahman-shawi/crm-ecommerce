'use server';

import fs from 'fs/promises';
import path from 'path';
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

/**
 * دالة مساعدة لتنظيف اسم الملف من الحروف الخاصة والعربية لضمان عدم حدوث خطأ في المسار
 */
function sanitizeFileName(fileName: string) {
    return fileName
        .replace(/[^a-z0-9.]/gi, '_') // استبدال أي حرف غير إنجليزي أو رقم بـ "_"
        .toLowerCase();
}

async function uploadSingleFile(file: File) {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // استخدام المسار المطلق لضمان الوصول للمجلد في بيئات التشغيل المختلفة
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    
    try { 
        await fs.access(uploadDir); 
    } catch { 
        await fs.mkdir(uploadDir, { recursive: true }); 
    }

    // إضافة طابع زمني + اسم منظف لتجنب تكرار الأسماء أو أخطاء الحروف العربية
    const fileName = `${Date.now()}-${sanitizeFileName(file.name)}`;
    const uploadPath = path.join(uploadDir, fileName);
    
    await fs.writeFile(uploadPath, buffer);
    
    return {
        url: `/uploads/${fileName}`,
        type: file.type
    };
}

export async function uploadUserAvatar(file: File) {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'users');

    try {
        await fs.access(uploadDir);
    } catch {
        await fs.mkdir(uploadDir, { recursive: true });
    }

    const fileName = `${Date.now()}-${sanitizeFileName(file.name)}`;
    const uploadPath = path.join(uploadDir, fileName);

    await fs.writeFile(uploadPath, buffer);

    return {
        url: `/uploads/users/${fileName}`,
        type: file.type
    };
}

export async function saveProductWithFiles(formData: FormData) {
    try {
        // تحويل البيانات مع إضافة قيم افتراضية للحماية من null
        const name = formData.get('name') as string;
        const normalizedName = name.trim();
        const categoryId = parseInt(formData.get('categoryId') as string);
        const description = (formData.get('description') as string) || null;
        const warehouseStocksRaw = formData.get('warehouseStocks') as string | null;
        let warehouseStocks: Array<{ warehouseId: number; quantity: number; stockPrice: number; stockDiscount: number }> = [];

        if (warehouseStocksRaw) {
            try {
                const parsed = JSON.parse(warehouseStocksRaw);
                if (Array.isArray(parsed)) {
                    warehouseStocks = parsed.map((item: any) => ({
                        warehouseId: Number(item?.warehouseId),
                        quantity: Number(item?.quantity ?? 0),
                        stockPrice: Number(item?.stockPrice ?? 0),
                        stockDiscount: Number(item?.stockDiscount ?? 0),
                    }));
                }
            } catch {
                return { success: false, error: "تنسيق بيانات المخزون غير صالح" };
            }
        }

        if (!warehouseStocks.length) {
            const warehouseId = parseInt(formData.get('warehouseId') as string);
            const quantity = parseInt(formData.get('quantity') as string) || 0;
            if (Number.isInteger(warehouseId) && warehouseId > 0) {
                warehouseStocks = [{ warehouseId, quantity, stockPrice: 0, stockDiscount: 0 }];
            }
        }

        if (!warehouseStocks.length) {
            return { success: false, error: "يرجى إضافة مستودع واحد على الأقل" };
        }

        const hasInvalidWarehouseStock = warehouseStocks.some(
            (item) => !Number.isInteger(item.warehouseId) || item.warehouseId <= 0 || item.quantity < 0 || item.stockPrice < 0 || item.stockDiscount < 0 || item.stockDiscount > item.stockPrice
        );

        if (hasInvalidWarehouseStock) {
            return { success: false, error: "تحقق من بيانات المستودعات والكمية والسعر" };
        }

        const uniqueWarehouseIds = new Set(warehouseStocks.map((item) => item.warehouseId));
        if (uniqueWarehouseIds.size !== warehouseStocks.length) {
            return { success: false, error: "لا يمكن تكرار نفس المستودع أكثر من مرة" };
        }

        const submittedWarehouseIds = warehouseStocks.map((item) => item.warehouseId);

        const existingByNameAndWarehouse = await prisma.product.findFirst({
            where: {
                name: {
                    equals: normalizedName,
                    mode: 'insensitive',
                },
                stocks: {
                    some: {
                        warehouseId: {
                            in: submittedWarehouseIds,
                        }
                    }
                }
            },
            select: { id: true }
        });

        if (existingByNameAndWarehouse) {
            return { success: false, error: "لا يمكن إضافة نفس المنتج في نفس المستودع أكثر من مرة" };
        }
        
        // جلب الملفات والتأكد أنها من نوع File فعلاً
        const allEntries = formData.getAll('files');
        const files = allEntries.filter((entry): entry is File => entry instanceof File && entry.size > 0);

        // 1. رفع الملفات بالتوازي
        const fileDataArray = await Promise.all(files.map(uploadSingleFile));

        // 2. حفظ البيانات في Prisma
        // تم استخدام transaction لضمان عدم إنشاء منتج إذا فشلت عملية ربط الصور (اختياري ولكن أفضل)
        const product = await prisma.product.create({
            data: {
                name: normalizedName,
                description,
                // التأكد من إرسالcategoryId فقط إذا كان رقماً صحيحاً
                ...(categoryId ? { categoryId } : {}),
                stocks: {
                    create: warehouseStocks.map((item) => ({
                        warehouseId: item.warehouseId,
                        quantity: item.quantity,
                        price: item.stockPrice,
                        discount: item.stockDiscount,
                    }))
                },
                images: {
                    create: fileDataArray.map(file => ({
                        url: file.url,
                        type: file.type,
                    }))
                }
            },
            include: { images: true }
        });

        revalidatePath('/dashboard/products');

        return { success: true, product };
    } catch (error: any) {
        console.error("Critical Error during product save:", error);
        // إرجاع رسالة خطأ أكثر تفصيلاً للمطور
        return { 
            success: false, 
            error: error.message || "حدث خطأ أثناء حفظ المنتج" 
        };
    }
}

export async function updateProductWithFiles(productId: number, formData: FormData) {
    try {
        const name = formData.get('name') as string;
        const categoryId = parseInt(formData.get('categoryId') as string);
        const description = (formData.get('description') as string) || null;
        const warehouseStocksRaw = formData.get('warehouseStocks') as string | null;
        let warehouseStocks: Array<{ warehouseId: number; quantity: number; stockPrice: number; stockDiscount: number }> = [];

        if (warehouseStocksRaw) {
            try {
                const parsed = JSON.parse(warehouseStocksRaw);
                if (Array.isArray(parsed)) {
                    warehouseStocks = parsed.map((item: any) => ({
                        warehouseId: Number(item?.warehouseId),
                        quantity: Number(item?.quantity ?? 0),
                        stockPrice: Number(item?.stockPrice ?? 0),
                        stockDiscount: Number(item?.stockDiscount ?? 0),
                    }));
                }
            } catch {
                return { success: false, error: "تنسيق بيانات المخزون غير صالح" };
            }
        }

        if (!warehouseStocks.length) {
            const warehouseId = parseInt(formData.get('warehouseId') as string);
            const quantity = parseInt(formData.get('quantity') as string) || 0;
            if (Number.isInteger(warehouseId) && warehouseId > 0) {
                warehouseStocks = [{ warehouseId, quantity, stockPrice: 0, stockDiscount: 0 }];
            }
        }

        if (!warehouseStocks.length) {
            return { success: false, error: "يرجى إضافة مستودع واحد على الأقل" };
        }

        const hasInvalidWarehouseStock = warehouseStocks.some(
            (item) => !Number.isInteger(item.warehouseId) || item.warehouseId <= 0 || item.quantity < 0 || item.stockPrice < 0 || item.stockDiscount < 0 || item.stockDiscount > item.stockPrice
        );

        if (hasInvalidWarehouseStock) {
            return { success: false, error: "تحقق من بيانات المستودعات والكمية والسعر" };
        }

        const uniqueWarehouseIds = new Set(warehouseStocks.map((item) => item.warehouseId));
        if (uniqueWarehouseIds.size !== warehouseStocks.length) {
            return { success: false, error: "لا يمكن تكرار نفس المستودع أكثر من مرة" };
        }

        const submittedWarehouseIds = warehouseStocks.map((item) => item.warehouseId);

        const existingByNameAndWarehouse = await prisma.product.findFirst({
            where: {
                name: {
                    equals: name.trim(),
                    mode: 'insensitive',
                },
                NOT: { id: productId },
                stocks: {
                    some: {
                        warehouseId: {
                            in: submittedWarehouseIds,
                        }
                    }
                }
            },
            select: { id: true }
        });

        if (existingByNameAndWarehouse) {
            return { success: false, error: "لا يمكن إضافة نفس المنتج في نفس المستودع أكثر من مرة" };
        }

        // 1. جلب الملفات الجديدة من الـ FormData
        const allEntries = formData.getAll('files');
        const files = allEntries.filter((entry): entry is File => entry instanceof File && entry.size > 0);

        let fileDataArray: any[] = [];

        // 2. إذا وجد ملفات جديدة، نقوم بعملية التنظيف والإضافة
        if (files.length > 0) {
            // أ. رفع الملفات الجديدة أولاً
            fileDataArray = await Promise.all(files.map(uploadSingleFile));

            // ب. جلب بيانات الصور القديمة لحذف الملفات الفيزيائية
            const currentProduct = await prisma.product.findUnique({
                where: { id: productId },
                include: { images: true }
            });

            if (currentProduct?.images) {
                for (const img of currentProduct.images) {
                    try {
                        // بناء المسار المطلق للملف في مجلد public
                        const filePath = path.join(process.cwd(), 'public', img.url);
                        // حذف الملف من الهارد ديسك
                        await fs.unlink(filePath);
                    } catch (err) {
                        console.error(`Could not delete file: ${img.url}`, err);
                        // نكمل العملية حتى لو فشل حذف ملف واحد (ربما الملف غير موجود أصلاً)
                    }
                }
            }
        }

        // 3. تحديث البيانات في Prisma
        const product = await prisma.product.update({
            where: { id: productId },
            data: {
                name,
                description,
                ...(categoryId ? { categoryId } : {}),
                stocks: {
                    deleteMany: {},
                    create: warehouseStocks.map((item) => ({
                        warehouseId: item.warehouseId,
                        quantity: item.quantity,
                        price: item.stockPrice,
                        discount: item.stockDiscount,
                    })),
                },
                // تحديث الصور فقط إذا تم رفع صور جديدة
                ...(files.length > 0 ? {
                    images: {
                        deleteMany: {}, // حذف السجلات القديمة من قاعدة البيانات
                        create: fileDataArray.map(file => ({
                            url: file.url,
                            type: file.type,
                        }))
                    }
                } : {})
            },
            include: { images: true }
        });

        revalidatePath('/dashboard/products');
        return { success: true, product };

    } catch (error: any) {
        console.error("Critical Error during product update:", error);
        return { 
            success: false, 
            error: error.message || "حدث خطأ أثناء تحديث المنتج" 
        };
    }
}

export async function deleteProduct(productId: number) {
    try {
        // 1. جلب المنتج مع الصور أولاً لنتمكن من معرفة المسارات قبل حذف السجل
        const product = await prisma.product.findUnique({
            where: { id: productId },
            include: { images: true }
        });

        if (!product) {
            return { success: false, error: "المنتج غير موجود" };
        }

        // 2. حذف الملفات الفيزيائية من الهارد ديسك
        if (product.images && product.images.length > 0) {
            for (const img of product.images) {
                try {
                    // بناء المسار: لاحظ أن img.url يبدأ عادة بـ /uploads/
                    // لذا نستخدم path.join بحذر لضمان المسار الصحيح
                    const filePath = path.join(process.cwd(), 'public', img.url);
                    await fs.unlink(filePath);
                } catch (err) {
                    console.error(`فشل حذف الملف: ${img.url}`, err);
                    // نستمر في الحلقة حتى لو فشل حذف ملف واحد
                }
            }
        }

        // 3. حذف سجل المنتج من قاعدة البيانات
        // ملاحظة: إذا كان لديك "OnDelete: Cascade" في الـ Schema، سيتم حذف الصور تلقائياً من DB
        await prisma.product.delete({
            where: { id: productId }
        });

        // 4. تحديث الكاش
        revalidatePath('/dashboard/products');

        return { success: true, message: "تم حذف المنتج وجميع ملفاته بنجاح" };

    } catch (error: any) {
        console.error("Error during product deletion:", error);
        return { 
            success: false, 
            error: error.message || "حدث خطأ أثناء حذف المنتج" 
        };
    }
}

export async function deleteProductFromWarehouse(productId: number, warehouseId: number) {
    try {
        if (!Number.isInteger(productId) || productId <= 0 || !Number.isInteger(warehouseId) || warehouseId <= 0) {
            return { success: false, error: "بيانات الحذف غير صحيحة" };
        }

        const result = await prisma.$transaction(async (tx) => {
            await tx.productStock.delete({
                where: {
                    productId_warehouseId: {
                        productId,
                        warehouseId,
                    }
                }
            });

            const remainingStocks = await tx.productStock.count({ where: { productId } });

            if (remainingStocks === 0) {
                const product = await tx.product.findUnique({
                    where: { id: productId },
                    include: { images: true }
                });

                if (product) {
                    await tx.product.delete({ where: { id: productId } });
                    return { deletedProduct: true, images: product.images };
                }
            }

            return { deletedProduct: false, images: [] as Array<{ url: string }> };
        });

        if (result.deletedProduct && result.images.length > 0) {
            for (const img of result.images) {
                try {
                    const filePath = path.join(process.cwd(), 'public', img.url);
                    await fs.unlink(filePath);
                } catch (err) {
                    console.error(`فشل حذف الملف: ${img.url}`, err);
                }
            }
        }

        revalidatePath('/dashboard/products');
        return { success: true, deletedProduct: result.deletedProduct };
    } catch (error: any) {
        console.error("Error deleting product from warehouse:", error);
        return {
            success: false,
            error: error.message || "حدث خطأ أثناء حذف المنتج من المستودع"
        };
    }
}