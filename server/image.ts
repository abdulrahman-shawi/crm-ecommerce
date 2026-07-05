'use server';

import { put, del } from '@vercel/blob';
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

/**
 * دالة مساعدة لتنظيف اسم الملف من الحروف الخاصة والعربية
 */
function sanitizeFileName(fileName: string) {
    return fileName
        .replace(/[^a-z0-9.]/gi, '_')
        .toLowerCase();
}

function slugify(name: string) {
    return name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\u0621-\u064a\u0660-\u0669]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

async function generateSeoSlug(name: string) {
    const base = slugify(name) || 'product';

    // إذا كان الـ slug الأساسي غير مستخدم، استخدمه مباشرة
    const existing = await prisma.product.findFirst({
        where: { seoSlug: base },
        select: { id: true }
    });

    if (!existing) {
        return base;
    }

    // إذا كان مستخدمًا، أضف رقم تسلسلي
    let counter = 2;
    while (true) {
        const candidate = `${base}-${counter}`;
        const conflict = await prisma.product.findFirst({
            where: { seoSlug: candidate },
            select: { id: true }
        });
        if (!conflict) {
            return candidate;
        }
        counter++;
    }
}

async function uploadSingleFile(file: File) {
    const fileName = `${Date.now()}-${sanitizeFileName(file.name)}`;
    
    const blob = await put(fileName, file, {
        access: 'public',
    });
    
    return {
        url: blob.url,
        type: file.type
    };
}

export async function uploadUserAvatar(file: File) {
    const fileName = `users/${Date.now()}-${sanitizeFileName(file.name)}`;
    
    const blob = await put(fileName, file, {
        access: 'public',
    });
    
    return {
        url: blob.url,
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
        const metaTitle = String(formData.get('metaTitle') || '').trim() || null;
        const metaDescription = String(formData.get('metaDescription') || '').trim() || null;
        const metaKeywords = String(formData.get('metaKeywords') || '').trim() || null;
        const isActive = formData.get('isActive') === 'true';
        const affiliatePrice = Number(formData.get('affiliatePrice') || 0);
        const affiliateCommissionRateRaw = formData.get('affiliateCommissionRate');
        const affiliateCommissionRate = affiliateCommissionRateRaw == null || String(affiliateCommissionRateRaw).trim() === ''
            ? null
            : Number(affiliateCommissionRateRaw);
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

        if (Number.isNaN(affiliatePrice) || affiliatePrice < 0) {
            return { success: false, error: "سعر الأفلييت غير صالح" };
        }

        if (affiliateCommissionRate !== null && (Number.isNaN(affiliateCommissionRate) || affiliateCommissionRate < 0)) {
            return { success: false, error: "نسبة عمولة الأفلييت غير صالحة" };
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

        // 2. توليد seoSlug فريد
        const seoSlug = await generateSeoSlug(normalizedName);

        // 3. حفظ البيانات في Prisma
        // تم استخدام transaction لضمان عدم إنشاء منتج إذا فشلت عملية ربط الصور (اختياري ولكن أفضل)
        const product = await prisma.product.create({
            data: {
                name: normalizedName,
                description,
                metaTitle,
                metaDescription,
                metaKeywords,
                isActive,
                seoSlug,
                affiliatePrice,
                affiliateCommissionRate,
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
        const metaTitle = String(formData.get('metaTitle') || '').trim() || null;
        const metaDescription = String(formData.get('metaDescription') || '').trim() || null;
        const metaKeywords = String(formData.get('metaKeywords') || '').trim() || null;
        const isActive = formData.get('isActive') === 'true';
        const affiliatePrice = Number(formData.get('affiliatePrice') || 0);
        const affiliateCommissionRateRaw = formData.get('affiliateCommissionRate');
        const affiliateCommissionRate = affiliateCommissionRateRaw == null || String(affiliateCommissionRateRaw).trim() === ''
            ? null
            : Number(affiliateCommissionRateRaw);
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

        if (Number.isNaN(affiliatePrice) || affiliatePrice < 0) {
            return { success: false, error: "سعر الأفلييت غير صالح" };
        }

        if (affiliateCommissionRate !== null && (Number.isNaN(affiliateCommissionRate) || affiliateCommissionRate < 0)) {
            return { success: false, error: "نسبة عمولة الأفلييت غير صالحة" };
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
        const newFiles = allEntries.filter((entry): entry is File => entry instanceof File && entry.size > 0);

        // 2. جلب قائمة الملفات النهائية المرسلة من الواجهة (بعد الحذف/الإضافة)
        let existingFiles: Array<{ clientId?: string; url?: string | null; type?: string; isNew?: boolean }> = [];
        const existingFilesRaw = formData.get('existingFiles') as string | null;
        if (existingFilesRaw) {
            try {
                existingFiles = JSON.parse(existingFilesRaw);
            } catch {
                existingFiles = [];
            }
        }

        const newFileClientIds = formData.getAll('newFileClientIds').map((entry) => String(entry || '').trim());

        // 3. جلب الملفات الحالية في قاعدة البيانات
        const currentProduct = await prisma.product.findUnique({
            where: { id: productId },
            include: { images: true }
        });

        const currentImages = currentProduct?.images || [];
        const keptFileUrls = new Set(existingFiles.map(f => f.url).filter(Boolean));

        // 4. تحديد الملفات المحذوفة (موجودة في DB وليست في القائمة النهائية)
        const removedImages = currentImages.filter(img => !keptFileUrls.has(img.url));

        // 5. حذف الملفات المحذوفة من Vercel Blob
        for (const img of removedImages) {
            try {
                await del(img.url);
            } catch (err) {
                console.error(`Could not delete blob: ${img.url}`, err);
            }
        }

        // 6. رفع الملفات الجديدة
        let newFileDataArray: Array<{ clientId: string; url: string; type: string }> = [];
        if (newFiles.length > 0) {
            const uploadedFiles = await Promise.all(newFiles.map(uploadSingleFile));
            newFileDataArray = uploadedFiles.map((file, index) => ({
                clientId: newFileClientIds[index] || `new-${index}`,
                url: file.url,
                type: file.type,
            }));
        }

        const uploadedFilesByClientId = new Map(newFileDataArray.map((file) => [file.clientId, file]));

        // 7. بناء قائمة الملفات النهائية للحفظ
        const finalImages = existingFiles
            .map((file) => {
                if (file.isNew) {
                    const uploadedFile = uploadedFilesByClientId.get(String(file.clientId || ''));
                    if (!uploadedFile) {
                        return null;
                    }

                    return { url: uploadedFile.url, type: uploadedFile.type };
                }

                if (!file.url) {
                    return null;
                }

                return {
                    url: file.url,
                    type: file.type || 'application/octet-stream',
                };
            })
            .filter((file): file is { url: string; type: string } => Boolean(file?.url));

        // 8. تحديث البيانات في Prisma
        const product = await prisma.product.update({
            where: { id: productId },
            data: {
                name,
                description,
                metaTitle,
                metaDescription,
                metaKeywords,
                isActive,
                affiliatePrice,
                affiliateCommissionRate,
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
                images: {
                    deleteMany: {},
                    create: finalImages.map(file => ({
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

        // 2. حذف الصور من Vercel Blob
        if (product.images && product.images.length > 0) {
            for (const img of product.images) {
                try {
                    await del(img.url);
                } catch (err) {
                    console.error(`فشل حذف الصورة: ${img.url}`, err);
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
                    await del(img.url);
                } catch (err) {
                    console.error(`فشل حذف الصورة: ${img.url}`, err);
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