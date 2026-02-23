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
        const price = parseFloat(formData.get('price') as string) || 0;
        const discount = parseFloat(formData.get('discount') as string) || 0;
        const categoryId = parseInt(formData.get('categoryId') as string);
        const description = (formData.get('description') as string) || null;
        const quantity = (formData.get('quantity') as string) || null;

        const existingByName = await prisma.product.findFirst({
            where: {
                name: {
                    equals: name.trim(),
                    mode: 'insensitive',
                }
            },
            select: { id: true }
        });

        if (existingByName) {
            return { success: false, error: "اسم المنتج موجود بالفعل" };
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
                name,
                price,
                discount,
                description,
                quantity,
                // التأكد من إرسالcategoryId فقط إذا كان رقماً صحيحاً
                ...(categoryId ? { categoryId } : {}),
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
        const price = parseFloat(formData.get('price') as string) || 0;
        const discount = parseFloat(formData.get('discount') as string) || 0;
        const categoryId = parseInt(formData.get('categoryId') as string);
        const description = (formData.get('description') as string) || null;

        const existingByName = await prisma.product.findFirst({
            where: {
                name: {
                    equals: name.trim(),
                    mode: 'insensitive',
                },
                NOT: { id: productId }
            },
            select: { id: true }
        });

        if (existingByName) {
            return { success: false, error: "اسم المنتج موجود بالفعل" };
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
                price,
                discount,
                description,
                ...(categoryId ? { categoryId } : {}),
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