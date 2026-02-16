'use server'

import { prisma } from "@/lib/prisma"

const SOLD_ORDER_STATUSES = new Set(["تم تسليم الطلب", "تم التسليم", "مدفوعة"]);

const isSoldOrderStatus = (status: string) => SOLD_ORDER_STATUSES.has(status);

export async function getOrders() {
    const order = await prisma.order.findMany({
        orderBy:{id:"desc"},
        include:{
            user:{
                include:{
                    orders:true
                }
            },
            items:{
                include:{
                    product:true
                }
            },
            customer:true
        }
    })

    return {success:true , data:order}
}

export async function getOrdersByUser(userId: any) {
    const orders = await prisma.order.findMany({
        where: {
            // هنا يكمن السر: تصفية النتائج حسب معرف المستخدم
            customerId: userId 
        },
        orderBy: { createdAt: "desc" },
        include: {
            items: { include: { product: true } },
            customer: true
        }
    })
    return { success: true, data: orders }
}

export async function createOrder(data: any, items: any[], user: any) {
    try {
        const orderNumber = `ORD-${Date.now()}`;

        // استخدام Transaction لضمان سلامة البيانات
        const result = await prisma.$transaction(async (tx) => {
            
            // 1. إنشاء الطلب
            const newOrder = await tx.order.create({
                data: {
                    orderNumber,
                    totalAmount: data.grandTotal + data.overallDiscount,
                    discount: data.overallDiscount,
                    finalAmount: data.grandTotal,
                    status: data.status,
                    paymentMethod: data.paymentMethod || "عند الاستلام",
                    receiverName: data.receiverName,
                    // ضمان أن receiverPhone مصفوفة حتى لو جاءت قيمة واحدة أو فارغة
                    receiverPhone: Array.isArray(data.receiverPhone) 
                        ? data.receiverPhone 
                        : data.receiverPhone ? [data.receiverPhone] : [],
                    country: data.country,
                    city: data.city,
                    municipality: data.municipality,
                    fullAddress: data.fullAddress,
                    googleMapsLink: data.googleMapsLink,
                    amount: data.amount,
                    amountBank: String(data.amountBank),
                    deliveryMethod: data.deliveryMethod,
                    deliveryNotes: data.deliveryNotes,
                    customer: { connect: { id: data.customerId } },
                    user: { connect: { id: user } },
                    items: {
                        create: items.map((item: any) => ({
                            productId: parseInt(item.productId),
                            quantity: parseInt(item.quantity),
                            price: parseFloat(item.price),
                            discount: parseFloat(item.discount || 0),
                        }))
                    }
                }
            });

            // 2. تحديث المخزون داخل نفس العملية
            for (const item of items) {
                const productId = parseInt(item.productId);
                const quantityToSubtract = parseInt(item.quantity);

                const product = await tx.product.findUnique({ where: { id: productId } });
                
                if (!product) throw new Error(`المنتج ذو الرقم ${productId} غير موجود`);

                const currentQty = parseInt(product.quantity || "0");
                const newQty = (currentQty - quantityToSubtract).toString();

                // التحقق من عدم وجود كمية سالبة (اختياري حسب منطق عملك)
                if (parseInt(newQty) < 0) throw new Error(`الكمية المطلوبة للمنتج ${product.name} غير متوفرة`);

                await tx.product.update({
                    where: { id: productId },
                    data: { quantity: newQty }
                });
            }

            if (isSoldOrderStatus(data.status)) {
                await tx.customer.update({
                    where: { id: data.customerId },
                    data: { status: "تم البيع" }
                });
            }

            return newOrder;
        });

        return { success: true, order: result };
    } catch (error: any) {
        console.error("Error creating order:", error);
        return { success: false, error: error.message };
    }
}

export async function updateOrder(data: any, id: any, items: any) {
    try {
        // 1. جلب البيانات الأساسية خارج الـ Transaction لتقليل وقت القفل
        const oldOrder = await prisma.order.findUnique({
            where: { id },
            include: { items: true }
        });

        if (!oldOrder) return { success: false, error: "الطلب غير موجود" };

        return await prisma.$transaction(async (tx) => {
            // أ - إرجاع المخزون القديم يدوياً (تحويل النص لرقم)
            for (const oldItem of oldOrder.items) {
                const product = await tx.product.findUnique({ where: { id: oldItem.productId } });
                if (product) {
                    const restoredQty = (parseInt(product.quantity || "0") + oldItem.quantity).toString();
                    await tx.product.update({
                        where: { id: oldItem.productId },
                        data: { quantity: restoredQty }
                    });
                }
            }

            // ب - تحديث بيانات الطلب الرئيسية والعناصر (حذف وإضافة)
            const updatedOrder = await tx.order.update({
                where: { id },
                data: {
                    totalAmount: data.grandTotal + data.overallDiscount,
                    discount: data.overallDiscount,
                    finalAmount: data.grandTotal,
                    status: data.status,
                    paymentMethod: data.paymentMethod || "عند الاستلام",
                    receiverName: data.receiverName,
                    receiverPhone: data.receiverPhone,
                    country: data.country,
                    city: data.city,
                    municipality: data.municipality,
                    fullAddress: data.fullAddress,
                    googleMapsLink: data.googleMapsLink,
                    amountBank: data.amountBank,
                    amount: data.amount,
                    deliveryMethod: data.deliveryMethod,
                    deliveryNotes: data.deliveryNotes,
                    customer: { connect: { id: data.customerId } },
                    items: {
                        deleteMany: {}, // حذف العناصر السابقة
                        create: items.map((item: any) => ({
                            productId: parseInt(item.productId),
                            quantity: parseInt(item.quantity),
                            price: parseFloat(item.price),
                            discount: parseFloat(item.discount || 0),
                        }))
                    }
                }
            });

            if (isSoldOrderStatus(data.status)) {
                await tx.customer.update({
                    where: { id: data.customerId },
                    data: { status: "تم البيع" }
                });
            }

            // ج - خصم المخزون الجديد
            for (const newItem of items) {
                const product = await tx.product.findUnique({ where: { id: parseInt(newItem.productId) } });
                if (product) {
                    const newQty = (parseInt(product.quantity || "0") - parseInt(newItem.quantity)).toString();
                    // يمكنك هنا إضافة شرط للتأكد من أن المخزون لا يصبح سالباً
                    await tx.product.update({
                        where: { id: parseInt(newItem.productId) },
                        data: { quantity: newQty }
                    });
                }
            }

            return { success: true, data: updatedOrder };
        }, {
            maxWait: 5000, // الوقت الأقصى لانتظار بريزما للحصول على اتصال
            timeout: 20000 // وقت تنفيذ العملية بالكامل (20 ثانية)
        });

    } catch (error: any) {
        console.error("Critical Update Error:", error);
        return { success: false, error: "حدث خطأ في قاعدة البيانات، يرجى المحاولة مرة أخرى" };
    }
}

export async function deleteOrder(id: any) {
    try {
        // 1. جلب البيانات خارج الـ Transaction لتقليل وقت القفل
        const oldOrder = await prisma.order.findUnique({
            where: { id },
            include: { items: true }
        });

        if (!oldOrder) return { success: false, error: "الطلب غير موجود" };

        return await prisma.$transaction(async (tx) => {
            // أ - إرجاع المخزون (التعامل مع الحقل النصي)
            for (const item of oldOrder.items) {
                const product = await tx.product.findUnique({ 
                    where: { id: item.productId } 
                });
                
                if (product) {
                    const currentQty = parseInt(product.quantity || "0");
                    const restoredQty = (currentQty + item.quantity).toString();
                    
                    await tx.product.update({
                        where: { id: item.productId },
                        data: { quantity: restoredQty }
                    });
                }
            }

            // ب - حذف الطلب
            // ملاحظة: سيحذف العناصر المرتبطة تلقائياً إذا كان الـ Schema يدعم Cascade Delete
            await tx.order.delete({
                where: { id }
            });

            return { success: true };
        }, {
            maxWait: 5000,
            timeout: 20000
        });

    } catch (error: any) {
        console.error("Delete Order Error:", error);
        return { 
            success: false, 
            error: error.message || "حدث خطأ أثناء محاولة حذف الطلب" 
        };
    }
}

export async function updateStaus(status:any , id:any){
    const updatestutas = await prisma.order.update({
        where:{id:id},
        data:{
            status:status
        },
        select: {
            id: true,
            customerId: true,
            status: true
        }
    })

    if (isSoldOrderStatus(updatestutas.status)) {
        await prisma.customer.update({
            where: { id: updatestutas.customerId },
            data: { status: "تم البيع" }
        });
    }
    return {success :true , data:updatestutas}
}