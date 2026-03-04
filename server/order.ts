'use server'

import { decrypt } from "@/lib/auth";
import { prisma } from "@/lib/prisma"
import { cookies } from "next/headers";

const SOLD_ORDER_STATUSES = new Set(["تم تسليم الطلب", "تم التسليم", "مدفوعة"]);
const DEFAULT_TURKEY_EXCHANGE_RATE = 44;

const isSoldOrderStatus = (status: string) => SOLD_ORDER_STATUSES.has(status);
const WAREHOUSE_ROLE_NAME = "المستودع";

async function getCurrentSessionUser() {
    try {
        const session = cookies().get("skynova")?.value;
        if (!session) return null;

        const decoded = await decrypt(session);
        if (!decoded?.userId) return null;

        return await prisma.user.findUnique({
            where: { id: String(decoded.userId) },
            include: { permission: true },
        });
    } catch {
        return null;
    }
}

function canManageOrderShipping(user: any) {
    if (!user) return false;
    if (user.accountType === "ADMIN") return true;

    const roleName = String(user?.permission?.roleName || "").trim();
    return roleName === WAREHOUSE_ROLE_NAME;
}

export async function getOrders() {
    const order = await prisma.order.findMany({
        orderBy:{createdAt:"desc"},
        include:{
            warehouse:true,
            shipping:true,
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
            warehouse: true,
            shipping: true,
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
            const existingOrdersCount = await tx.order.count({
                where: { customerId: data.customerId }
            });

            const stockCountry = String(data.stockCountry || "").trim();
            if (!stockCountry) {
                throw new Error("يرجى اختيار بلد المخزون");
            }

            const inputExchangeRate = Number(data.usdToTryRateAtOrder || 0);
            const usdToTryRateAtOrder = stockCountry === "تركيا"
                ? (inputExchangeRate > 0 ? inputExchangeRate : DEFAULT_TURKEY_EXCHANGE_RATE)
                : null;
            const shippingId = Number(data.shippingId || 0);

            const orderWarehouse = await tx.warehouse.findFirst({
                where: { location: stockCountry },
                orderBy: { id: "asc" },
                select: { id: true }
            });
            
            // 1. إنشاء الطلب
            const newOrder = await tx.order.create({
                data: {
                    orderNumber,
                    usdToTryRateAtOrder,
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
                    ...(shippingId > 0 ? { shipping: { connect: { id: shippingId } } } : {}),
                    ...(orderWarehouse ? { warehouse: { connect: { id: orderWarehouse.id } } } : {}),
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
                let remaining = parseInt(item.quantity);

                const stocks = await tx.productStock.findMany({
                    where: {
                        productId,
                        warehouse: { location: stockCountry }
                    },
                    orderBy: { quantity: "desc" }
                });

                const totalAvailable = stocks.reduce((sum, stock) => sum + (Number(stock.quantity) || 0), 0);
                if (totalAvailable < remaining) {
                    throw new Error(`الكمية المطلوبة للمنتج رقم ${productId} غير متوفرة في ${stockCountry}`);
                }

                for (const stock of stocks) {
                    if (remaining <= 0) break;
                    const currentQty = Number(stock.quantity) || 0;
                    const consumed = Math.min(currentQty, remaining);
                    remaining -= consumed;

                    await tx.productStock.update({
                        where: { id: stock.id },
                        data: { quantity: currentQty - consumed }
                    });
                }
            }

            await tx.customer.update({
                where: { id: data.customerId },
                data: { status: "تم البيع" }
            });

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
            include: { items: true, warehouse: true }
        });

        if (!oldOrder) return { success: false, error: "الطلب غير موجود" };

        return await prisma.$transaction(async (tx) => {
            const stockCountry = String(data.stockCountry || oldOrder.warehouse?.location || "").trim();
            const oldOrderSavedRate = Number((oldOrder as any)?.usdToTryRateAtOrder || 0);
            const inputExchangeRate = Number(data.usdToTryRateAtOrder || 0);
            const usdToTryRateAtOrder = stockCountry === "تركيا"
                ? (inputExchangeRate > 0
                    ? inputExchangeRate
                    : (oldOrderSavedRate > 0
                        ? oldOrderSavedRate
                        : DEFAULT_TURKEY_EXCHANGE_RATE))
                : null;
            const shippingId = Number(data.shippingId || 0);

            const orderWarehouse = stockCountry
                ? await tx.warehouse.findFirst({
                    where: { location: stockCountry },
                    orderBy: { id: "asc" },
                    select: { id: true }
                })
                : null;

            if (stockCountry) {
                for (const oldItem of oldOrder.items) {
                    const stock = await tx.productStock.findFirst({
                        where: {
                            productId: oldItem.productId,
                            warehouse: { location: stockCountry }
                        },
                        orderBy: { quantity: "desc" }
                    });

                    if (stock) {
                        await tx.productStock.update({
                            where: { id: stock.id },
                            data: { quantity: (Number(stock.quantity) || 0) + oldItem.quantity }
                        });
                    }
                }
            }

            // ب - تحديث بيانات الطلب الرئيسية والعناصر (حذف وإضافة)
            const updatedOrder = await tx.order.update({
                where: { id },
                data: {
                    usdToTryRateAtOrder,
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
                    amountBank: String(data.amountBank),
                    amount: data.amount,
                    deliveryMethod: data.deliveryMethod,
                    deliveryNotes: data.deliveryNotes,
                    customer: { connect: { id: data.customerId } },
                    shipping: shippingId > 0
                        ? { connect: { id: shippingId } }
                        : { disconnect: true },
                    ...(orderWarehouse ? { warehouse: { connect: { id: orderWarehouse.id } } } : {}),
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
            if (stockCountry) {
                for (const newItem of items) {
                    const productId = parseInt(newItem.productId);
                    let remaining = parseInt(newItem.quantity);

                    const stocks = await tx.productStock.findMany({
                        where: {
                            productId,
                            warehouse: { location: stockCountry }
                        },
                        orderBy: { quantity: "desc" }
                    });

                    const totalAvailable = stocks.reduce((sum, stock) => sum + (Number(stock.quantity) || 0), 0);
                    if (totalAvailable < remaining) {
                        throw new Error(`الكمية المطلوبة للمنتج رقم ${productId} غير متوفرة في ${stockCountry}`);
                    }

                    for (const stock of stocks) {
                        if (remaining <= 0) break;
                        const currentQty = Number(stock.quantity) || 0;
                        const consumed = Math.min(currentQty, remaining);
                        remaining -= consumed;

                        await tx.productStock.update({
                            where: { id: stock.id },
                            data: { quantity: currentQty - consumed }
                        });
                    }
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
            include: { items: true, warehouse: true }
        });

        if (!oldOrder) return { success: false, error: "الطلب غير موجود" };

        return await prisma.$transaction(async (tx) => {
            const stockCountry = String(oldOrder.warehouse?.location || "").trim();

            if (stockCountry) {
                for (const item of oldOrder.items) {
                    const stock = await tx.productStock.findFirst({
                        where: {
                            productId: item.productId,
                            warehouse: { location: stockCountry }
                        },
                        orderBy: { quantity: "desc" }
                    });

                    if (stock) {
                        await tx.productStock.update({
                            where: { id: stock.id },
                            data: { quantity: (Number(stock.quantity) || 0) + item.quantity }
                        });
                    }
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

export async function updateOrderShippingFromTable(orderId: number, shippingId: number | null, shippingPrice: number) {
    try {
        const user = await getCurrentSessionUser();
        if (!canManageOrderShipping(user)) {
            return { success: false, error: "غير مصرح لك بتعديل بيانات الشحن" };
        }

        const parsedOrderId = Number(orderId);
        const parsedShippingId = Number(shippingId || 0);
        const parsedShippingPrice = Number(shippingPrice || 0);

        if (!Number.isInteger(parsedOrderId) || parsedOrderId <= 0) {
            return { success: false, error: "معرّف الطلب غير صالح" };
        }

        if (Number.isNaN(parsedShippingPrice) || parsedShippingPrice < 0) {
            return { success: false, error: "سعر الشحن غير صالح" };
        }

        const existingOrder = await prisma.order.findUnique({
            where: { id: parsedOrderId },
            select: { id: true },
        });

        if (!existingOrder) {
            return { success: false, error: "الطلب غير موجود" };
        }

        if (parsedShippingId <= 0) {
            const updated = await prisma.order.update({
                where: { id: parsedOrderId },
                data: { shipping: { disconnect: true } },
                include: { shipping: true, warehouse: true },
            });
            return { success: true, data: updated };
        }

        const shipping = await prisma.shipping.findUnique({
            where: { id: parsedShippingId },
            select: { id: true, price: true },
        });

        if (!shipping) {
            return { success: false, error: "شركة الشحن غير موجودة" };
        }

        if (Number(shipping.price) !== parsedShippingPrice) {
            await prisma.shipping.update({
                where: { id: parsedShippingId },
                data: { price: parsedShippingPrice },
            });
        }

        const updatedOrder = await prisma.order.update({
            where: { id: parsedOrderId },
            data: {
                shipping: { connect: { id: parsedShippingId } },
            },
            include: { shipping: true, warehouse: true },
        });

        return { success: true, data: updatedOrder };
    } catch (error) {
        console.error("Update Order Shipping Error:", error);
        return { success: false, error: "حدث خطأ أثناء تعديل بيانات الشحن" };
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