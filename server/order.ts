'use server'

import { decrypt } from "@/lib/auth";
import { prisma } from "@/lib/prisma"
import { cookies } from "next/headers";

const AFFILIATE_COOKIE_NAME = 'affiliate-code';

const SOLD_ORDER_STATUSES = new Set(["تم تسليم الطلب", "تم التسليم", "مدفوعة"]);
const STOCK_RETURN_STATUSES = new Set(["فشل التسليم مرتجع", "تم الغاء الطلب"]);
const DEFAULT_TURKEY_EXCHANGE_RATE = 44;

const isSoldOrderStatus = (status: string) => SOLD_ORDER_STATUSES.has(status);
const isStockReturnStatus = (status: string) => STOCK_RETURN_STATUSES.has(status);
const WAREHOUSE_ROLE_NAME = "مستودع";

const normalizeWarehouseLocation = (location?: string | null) => {
    const value = String(location || "").trim().toLowerCase();
    if (!value) return "";

    if (value === "سوريا" || value === "syria") return "سوريا";
    if (value === "تركيا" || value === "turkey") return "تركيا";
    return String(location || "").trim();
};

const parseOptionalDate = (value: any) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date;
};

const getOrderSortTimestamp = (orderLike: any) => {
    const dateValue = orderLike?.manualCreatedAt || orderLike?.createdAt;
    const parsed = new Date(dateValue);
    if (Number.isNaN(parsed.getTime())) return 0;
    return parsed.getTime();
};

const sortOrdersByDisplayDateDesc = <T extends { manualCreatedAt?: Date | null; createdAt?: Date | null }>(orders: T[]) => {
    return [...orders].sort((a, b) => getOrderSortTimestamp(b) - getOrderSortTimestamp(a));
};

async function applyOrderStockChange(
    tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
    order: { warehouseId?: number | null; warehouse?: { location?: string | null } | null; items: Array<{ productId: number; quantity: number }> },
    direction: "restore" | "reserve"
) {
    const stockCountry = String(order.warehouse?.location || "").trim();

    for (const item of order.items) {
        const quantity = Number(item.quantity || 0);
        if (quantity <= 0) continue;

        const stock = order.warehouseId
            ? await tx.productStock.findFirst({
                where: {
                    productId: item.productId,
                    warehouseId: order.warehouseId,
                },
            })
            : stockCountry
                ? await tx.productStock.findFirst({
                    where: {
                        productId: item.productId,
                        warehouse: { location: stockCountry },
                    },
                    orderBy: { quantity: "desc" },
                })
                : null;

        if (direction === "restore") {
            if (stock) {
                await tx.productStock.update({
                    where: { id: stock.id },
                    data: { quantity: (Number(stock.quantity) || 0) + quantity },
                });
                continue;
            }

            if (order.warehouseId) {
                await tx.productStock.create({
                    data: {
                        productId: item.productId,
                        warehouseId: order.warehouseId,
                        quantity,
                    },
                });
            }

            continue;
        }

        if (!stock) {
            throw new Error(`لا يمكن إعادة حجز المنتج ${item.productId} لأنه غير موجود في المخزن`);
        }

        const currentQuantity = Number(stock.quantity) || 0;
        if (currentQuantity < quantity) {
            throw new Error(`كمية المنتج ${item.productId} في المخزن غير كافية لإعادة الطلب إلى حالة نشطة`);
        }

        await tx.productStock.update({
            where: { id: stock.id },
            data: { quantity: currentQuantity - quantity },
        });
    }
}

function isWarehouseRole(user: any) {
    const roleName = String(user?.permission?.roleName || "").trim();
    return roleName.includes(WAREHOUSE_ROLE_NAME);
}

function canViewOrders(user: any) {
    if (!user) return false;
    if (user.accountType === "ADMIN") return true;
    if (isWarehouseRole(user)) return true;
    return Boolean(user?.permission?.viewOrders);
}

function getAllowedWarehouseLocations(user: any) {
    const locations: string[] = [];
    if (user?.permission?.accessSyria === true) locations.push("سوريا");
    if (user?.permission?.accessTurkey === true) locations.push("تركيا");
    return locations;
}

export async function getCurrentSessionUser() {
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

const roundToTwoDecimals = (value: number) => Number(value.toFixed(2));

async function resolveAffiliateCodeFromServerAction(inputCode?: string | null) {
    const normalizedInputCode = String(inputCode || '').trim();
    if (normalizedInputCode) {
        return normalizedInputCode;
    }

    try {
        const cookieValue = cookies().get(AFFILIATE_COOKIE_NAME)?.value;
        return String(cookieValue || '').trim();
    } catch {
        return '';
    }
}

async function applyAffiliateAttribution(
    tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
    orderId: number,
    items: any[],
    affiliateCode?: string | null,
) {
    const resolvedCode = await resolveAffiliateCodeFromServerAction(affiliateCode);
    if (!resolvedCode) {
        return;
    }

    const affiliateLink = await tx.affiliateLink.findUnique({
        where: { uniqueCode: resolvedCode },
        include: {
            product: {
                select: {
                    id: true,
                    affiliatePrice: true,
                    affiliateCommissionRate: true,
                },
            },
        },
    });

    if (!affiliateLink) {
        return;
    }

    let conversionsToAdd = 0;

    for (const rawItem of items) {
        const productId = Number(rawItem?.productId || 0);
        if (productId !== affiliateLink.productId) {
            continue;
        }

        const quantity = Number(rawItem?.quantity || 0);
        if (quantity <= 0) {
            continue;
        }

        const orderItem = await tx.orderItem.findFirst({
            where: {
                orderId,
                productId,
                affiliateLinkId: null,
            },
            orderBy: { id: 'asc' },
        });

        if (!orderItem) {
            continue;
        }

        const orderPrice = Number(rawItem?.price || 0);
        const productAffiliatePrice = Number(affiliateLink.product?.affiliatePrice || 0);
        const basePrice = productAffiliatePrice > 0 ? productAffiliatePrice : orderPrice;
        const rateFromProduct = affiliateLink.product?.affiliateCommissionRate;
        const commissionRate = rateFromProduct != null
            ? Number(rateFromProduct)
            : Number(affiliateLink.commissionRate || 0);
        const commissionAmount = roundToTwoDecimals((basePrice * quantity * commissionRate) / 100);

        await tx.orderItem.update({
            where: { id: orderItem.id },
            data: {
                affiliateLinkId: affiliateLink.id,
            },
        });

        await tx.commission.create({
            data: {
                affiliateLinkId: affiliateLink.id,
                orderId,
                amount: commissionAmount,
                status: 'PENDING',
            },
        });

        conversionsToAdd += 1;
    }

    if (conversionsToAdd > 0) {
        await tx.affiliateLink.update({
            where: { id: affiliateLink.id },
            data: {
                conversions: {
                    increment: conversionsToAdd,
                },
            },
        });
    }
}

function canManageOrderShipping(user: any) {
    if (!user) return false;
    if (user.accountType === "ADMIN") return true;
    return isWarehouseRole(user);
}

/**
 * ترجع قائمة معرفات المستخدمين ضمن نطاق المستخدم الحالي:
 * نفسه + الموظفون المرتبطون به مباشرة عبر parentId.
 */
async function getScopedUserIds(userId: string) {
    const rows = await prisma.user.findMany({
        where: {
            OR: [
                { id: userId },
                { parentId: userId },
            ],
        },
        select: { id: true },
    });

    return rows.map((row) => row.id);
}

const orderItemSelect = {
    id: true,
    quantity: true,
    price: true,
    discount: true,
    productId: true,
    product: {
        select: {
            id: true,
            name: true,
        },
    },
} as const;

const orderBaseSelect = {
    id: true,
    orderNumber: true,
    usdToTryRateAtOrder: true,
    totalAmount: true,
    discount: true,
    finalAmount: true,
    paymentMethod: true,
    receiverName: true,
    receiverPhone: true,
    country: true,
    city: true,
    municipality: true,
    fullAddress: true,
    deliveryNotes: true,
    googleMapsLink: true,
    amount: true,
    amountBank: true,
    deliveryMethod: true,
    additionalNotes: true,
    status: true,
    userId: true,
    customerId: true,
    shippingId: true,
    shippingPrice: true,
    moneyTransferCommission: true,
    otherCommissions: true,
    createdAt: true,
    manualCreatedAt: true,
    updatedAt: true,
    warehouse: {
        select: {
            id: true,
            location: true,
        },
    },
    shipping: {
        select: {
            id: true,
            name: true,
            price: true,
        },
    },
    user: {
        select: {
            id: true,
            username: true,
            phone: true,
        },
    },
    customer: {
        select: {
            id: true,
            name: true,
            phone: true,
            countryCode: true,
        },
    },
} as const;

const orderListSelect = {
    ...orderBaseSelect,
} as const;

const orderDetailsSelect = {
    ...orderBaseSelect,
    items: {
        select: orderItemSelect,
    },
} as const;

export async function getOrders() {
    const currentUser = await getCurrentSessionUser();
    if (!currentUser) {
        return { success: false, error: "غير مصرح لك بعرض الطلبات" };
    }

    if (!canViewOrders(currentUser)) {
        return { success: false, error: "غير مصرح لك بعرض الطلبات" };
    }

    const isAdminUser = currentUser.accountType === "ADMIN";
    const isWarehouseUser = isWarehouseRole(currentUser);
    const allowedWarehouseLocations = getAllowedWarehouseLocations(currentUser);

    const where: any = {};

    if (!isAdminUser) {
        if (isWarehouseUser) {
            if (allowedWarehouseLocations.length === 0) {
                return { success: true, data: [] };
            }

            where.warehouse = {
                location: {
                    in: allowedWarehouseLocations,
                },
            };
        } else {
            const scopedUserIds = await getScopedUserIds(currentUser.id);
            where.userId = {
                in: scopedUserIds.length > 0 ? scopedUserIds : [currentUser.id],
            };
        }
    }

    const order = await prisma.order.findMany({
        where,
        orderBy:{createdAt:"desc"},
        select: orderListSelect,
    })

    return {success:true , data:sortOrdersByDisplayDateDesc(order)}
}

export async function getOrdersByUser(userId: any) {
    const orders = await prisma.order.findMany({
        where: {
            // هنا يكمن السر: تصفية النتائج حسب معرف المستخدم
            customerId: userId 
        },
        orderBy: { createdAt: "desc" },
        select: orderDetailsSelect,
    })
    return { success: true, data: sortOrdersByDisplayDateDesc(orders) }
}

export async function getOrderById(orderId: string | number) {
    const currentUser = await getCurrentSessionUser();
    if (!currentUser) {
        return { success: false, error: "غير مصرح لك بعرض الطلبات" };
    }

    if (!canViewOrders(currentUser)) {
        return { success: false, error: "غير مصرح لك بعرض الطلبات" };
    }

    const normalizedOrderId = Number(orderId);
    if (Number.isNaN(normalizedOrderId)) {
        return { success: false, error: "معرف الطلب غير صالح" };
    }

    const order = await prisma.order.findUnique({
        where: { id: normalizedOrderId },
        select: orderDetailsSelect,
    });

    if (!order) {
        return { success: false, error: "الطلب غير موجود" };
    }

    const isAdminUser = currentUser.accountType === "ADMIN";
    const isWarehouseUser = isWarehouseRole(currentUser);

    if (!isAdminUser) {
        if (isWarehouseUser) {
            const allowedWarehouseLocations = getAllowedWarehouseLocations(currentUser);
            const orderWarehouseLocation = normalizeWarehouseLocation(order?.warehouse?.location);
            const canAccessWarehouse = allowedWarehouseLocations
                .map((location) => normalizeWarehouseLocation(location))
                .includes(orderWarehouseLocation);

            if (!canAccessWarehouse) {
                return { success: false, error: "غير مصرح لك بعرض هذا الطلب" };
            }
        } else {
            const scopedUserIds = await getScopedUserIds(currentUser.id);
            const allowedUserIds = scopedUserIds.length > 0 ? scopedUserIds : [currentUser.id];
            if (!allowedUserIds.includes(String(order.userId))) {
                return { success: false, error: "غير مصرح لك بعرض هذا الطلب" };
            }
        }
    }

    return { success: true, data: order };
}

export async function getOrdersByIds(orderIds: Array<string | number>) {
    const currentUser = await getCurrentSessionUser();
    if (!currentUser) {
        return { success: false, error: "غير مصرح لك بعرض الطلبات" };
    }

    if (!canViewOrders(currentUser)) {
        return { success: false, error: "غير مصرح لك بعرض الطلبات" };
    }

    const normalizedIds = Array.from(
        new Set(
            orderIds
                .map((orderId) => Number(orderId))
                .filter((orderId) => !Number.isNaN(orderId))
        )
    );

    if (normalizedIds.length === 0) {
        return { success: true, data: [] };
    }

    const isAdminUser = currentUser.accountType === "ADMIN";
    const isWarehouseUser = isWarehouseRole(currentUser);
    const allowedWarehouseLocations = getAllowedWarehouseLocations(currentUser);

    const where: any = {
        id: {
            in: normalizedIds,
        },
    };

    if (!isAdminUser) {
        if (isWarehouseUser) {
            if (allowedWarehouseLocations.length === 0) {
                return { success: true, data: [] };
            }

            where.warehouse = {
                location: {
                    in: allowedWarehouseLocations,
                },
            };
        } else {
            const scopedUserIds = await getScopedUserIds(currentUser.id);
            where.userId = {
                in: scopedUserIds.length > 0 ? scopedUserIds : [currentUser.id],
            };
        }
    }

    const orders = await prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        select: orderDetailsSelect,
    });

    return { success: true, data: sortOrdersByDisplayDateDesc(orders) };
}

export async function createOrder(data: any, items: any[], user: any) {
    try {
        const orderNumber = `ORD-${Date.now()}`;
        const manualCreatedAt = parseOptionalDate(data?.manualCreatedAt);
        const affiliateCode = await resolveAffiliateCodeFromServerAction(data?.affiliateCode);

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
            const selectedShipping = shippingId > 0
                ? await tx.shipping.findUnique({ where: { id: shippingId }, select: { price: true } })
                : null;

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
                    manualCreatedAt,
                    amount: data.amount,
                    amountBank: String(data.amountBank),
                    deliveryMethod: data.deliveryMethod,
                    deliveryNotes: data.deliveryNotes,
                    customer: { connect: { id: data.customerId } },
                    user: { connect: { id: user } },
                    shippingPrice: selectedShipping ? Number(selectedShipping.price || 0) : null,
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

            await applyAffiliateAttribution(tx, newOrder.id, items, affiliateCode);

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
            const selectedShipping = shippingId > 0
                ? await tx.shipping.findUnique({ where: { id: shippingId }, select: { price: true } })
                : null;
            const manualCreatedAt = parseOptionalDate(data?.manualCreatedAt);

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
                    shippingPrice: selectedShipping ? Number(selectedShipping.price || 0) : null,
                    manualCreatedAt,
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

export async function updateOrderShippingFromTable(
    orderId: number,
    shippingCompanyName: string,
    shippingPrice: number,
    moneyTransferCommission: number,
    otherCommissions: number,
) {
    try {
        const user = await getCurrentSessionUser();
        if (!canManageOrderShipping(user)) {
            return { success: false, error: "غير مصرح لك بتعديل بيانات الشحن" };
        }

        const parsedOrderId = Number(orderId);
        const parsedShippingPrice = Number(shippingPrice || 0);
        const parsedMoneyTransferCommission = Number(moneyTransferCommission || 0);
        const parsedOtherCommissions = Number(otherCommissions || 0);
        const normalizedShippingCompanyName = String(shippingCompanyName || "").trim();

        if (!Number.isInteger(parsedOrderId) || parsedOrderId <= 0) {
            return { success: false, error: "معرّف الطلب غير صالح" };
        }

        if (!normalizedShippingCompanyName) {
            return { success: false, error: "يرجى إدخال اسم شركة الشحن" };
        }

        if (Number.isNaN(parsedShippingPrice) || parsedShippingPrice < 0) {
            return { success: false, error: "سعر الشحن غير صالح" };
        }

        if (Number.isNaN(parsedMoneyTransferCommission) || parsedMoneyTransferCommission < 0) {
            return { success: false, error: "عمولة تحويل الأموال غير صالحة" };
        }

        if (Number.isNaN(parsedOtherCommissions) || parsedOtherCommissions < 0) {
            return { success: false, error: "العمولات الأخرى غير صالحة" };
        }

        const existingOrder = await prisma.order.findUnique({
            where: { id: parsedOrderId },
            select: { id: true },
        });

        if (!existingOrder) {
            return { success: false, error: "الطلب غير موجود" };
        }

        let shipping = await prisma.shipping.findFirst({
            where: { name: normalizedShippingCompanyName },
            select: { id: true },
        });

        if (!shipping) {
            shipping = await prisma.shipping.create({
                data: {
                    name: normalizedShippingCompanyName,
                    price: parsedShippingPrice,
                },
                select: { id: true },
            });
        } else {
            await prisma.shipping.update({
                where: { id: shipping.id },
                data: { price: parsedShippingPrice },
            });
        }

        const updatedOrder = await prisma.order.update({
            where: { id: parsedOrderId },
            data: {
                shipping: { connect: { id: shipping.id } },
                shippingPrice: parsedShippingPrice,
                moneyTransferCommission: parsedMoneyTransferCommission,
                otherCommissions: parsedOtherCommissions,
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
    try {
        const nextStatus = String(status || "").trim();
        const orderId = Number(id);

        if (!nextStatus) {
            return { success: false, error: "حالة الطلب غير صالحة" };
        }

        if (!Number.isFinite(orderId)) {
            return { success: false, error: "معرف الطلب غير صالح" };
        }

        const updatedStatus = await prisma.$transaction(async (tx) => {
            const existingOrder = await tx.order.findUnique({
                where: { id: orderId },
                include: {
                    items: {
                        select: {
                            productId: true,
                            quantity: true,
                        },
                    },
                    warehouse: {
                        select: {
                            location: true,
                        },
                    },
                },
            });

            if (!existingOrder) {
                throw new Error("الطلب غير موجود");
            }

            const previousStatus = String(existingOrder.status || "").trim();
            const wasReturned = isStockReturnStatus(previousStatus);
            const willBeReturned = isStockReturnStatus(nextStatus);

            if (!wasReturned && willBeReturned) {
                await applyOrderStockChange(tx, existingOrder, "restore");
            }

            if (wasReturned && !willBeReturned) {
                await applyOrderStockChange(tx, existingOrder, "reserve");
            }

            const nextOrder = await tx.order.update({
                where: { id: orderId },
                data: {
                    status: nextStatus,
                },
                select: {
                    id: true,
                    customerId: true,
                    status: true,
                },
            });

            if (isSoldOrderStatus(nextOrder.status)) {
                await tx.customer.update({
                    where: { id: nextOrder.customerId },
                    data: { status: "تم البيع" },
                });
            }

            return nextOrder;
        });

        return {success :true , data:updatedStatus}
    } catch (error: any) {
        return { success: false, error: error?.message || "فشل تحديث حالة الطلب" };
    }
}