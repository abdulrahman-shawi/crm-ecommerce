'use server'

import { decrypt } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasAnyPermission, hasPermission, isAdmin } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

const STOCK_RETURN_STATUSES = new Set(["فشل التسليم مرتجع", "تم الغاء الطلب"]);

const parseOptionalDate = (value: unknown) => {
  if (!value) return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const parseWarehouseId = (value: unknown) => {
  const parsed = Number(value || 0);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
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

const isStockReturnStatus = (status: string) => STOCK_RETURN_STATUSES.has(String(status || "").trim());

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

function canViewWholesaleOrders(user: any) {
  if (!user) return false;
  return hasAnyPermission(user, [
    "viewWholesaleOrders",
    "addWholesaleOrders",
    "editWholesaleOrders",
    "deleteWholesaleOrders",
  ]);
}

function canAddWholesaleOrders(user: any) {
  if (!user) return false;
  return isAdmin(user) || hasPermission(user, "addWholesaleOrders");
}

function canEditWholesaleOrders(user: any) {
  if (!user) return false;
  return isAdmin(user) || hasPermission(user, "editWholesaleOrders");
}

function canDeleteWholesaleOrders(user: any) {
  if (!user) return false;
  return isAdmin(user) || hasPermission(user, "deleteWholesaleOrders");
}

async function getScopedUserIds(userId: string) {
  const rows = await prisma.user.findMany({
    where: {
      OR: [{ id: userId }, { parentId: userId }],
    },
    select: { id: true },
  });

  return rows.map((row) => row.id);
}

async function buildWholesaleOrderScope(user: any) {
  if (isAdmin(user)) return {};

  const scopedUserIds = await getScopedUserIds(String(user.id));
  const allowedUserIds = scopedUserIds.length > 0 ? scopedUserIds : [String(user.id)];

  return {
    OR: [
      { userId: { in: allowedUserIds } },
      { wholesaleCustomer: { assignedUserId: String(user.id) } },
      { wholesaleCustomer: { visits: { some: { userId: String(user.id) } } } },
    ],
  };
}

async function ensureAccessibleWholesaleOrder(orderId: number, user: any) {
  const scope = await buildWholesaleOrderScope(user);
  return prisma.wholesaleOrder.findFirst({
    where: {
      id: orderId,
      ...scope,
    },
    select: { id: true },
  });
}

async function applyWholesaleOrderStockChange(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  order: { warehouseId?: number | null; warehouse?: { location?: string | null } | null; items: Array<{ productId: number; quantity: number }> },
  direction: "restore" | "reserve"
) {
  const warehouseId = Number(order.warehouseId || 0) > 0 ? Number(order.warehouseId) : null;
  const stockCountry = String(order.warehouse?.location || "").trim();

  for (const item of order.items) {
    const quantity = Number(item.quantity || 0);
    if (quantity <= 0) continue;

    const stock = warehouseId
      ? await tx.productStock.findFirst({
          where: {
            productId: item.productId,
            warehouseId,
          },
          orderBy: { quantity: "desc" },
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

      if (warehouseId) {
        await tx.productStock.create({
          data: {
            productId: item.productId,
            warehouseId,
            quantity,
          },
        });
      }

      continue;
    }

    const stocks = warehouseId
      ? await tx.productStock.findMany({
          where: {
            productId: item.productId,
            warehouseId,
          },
          orderBy: { quantity: "desc" },
        })
      : stockCountry
        ? await tx.productStock.findMany({
            where: {
              productId: item.productId,
              warehouse: { location: stockCountry },
            },
            orderBy: { quantity: "desc" },
          })
        : [];

    if (stocks.length === 0) {
      throw new Error(`لا يمكن حجز المنتج ${item.productId} لأنه غير موجود في المخزن`);
    }

    const totalAvailable = stocks.reduce((sum, currentStock) => sum + (Number(currentStock.quantity) || 0), 0);
    if (totalAvailable < quantity) {
      throw new Error(`كمية المنتج ${item.productId} في المخزن غير كافية`);
    }

    let remaining = quantity;
    for (const currentStock of stocks) {
      if (remaining <= 0) break;

      const currentQuantity = Number(currentStock.quantity) || 0;
      const consumed = Math.min(currentQuantity, remaining);
      remaining -= consumed;

      await tx.productStock.update({
        where: { id: currentStock.id },
        data: { quantity: currentQuantity - consumed },
      });
    }
  }
}

function resolveTierPrice(tiers: any[], quantity: number) {
  const matchedTier = tiers
    .filter((tier) => {
      const minQuantity = Number(tier?.minQuantity || 0);
      const maxQuantity = tier?.maxQuantity == null ? null : Number(tier.maxQuantity);
      if (quantity < minQuantity) return false;
      if (maxQuantity != null && quantity > maxQuantity) return false;
      return true;
    })
    .sort((first, second) => Number(second?.minQuantity || 0) - Number(first?.minQuantity || 0))[0];

  return matchedTier ? Number(matchedTier.price || 0) : 0;
}

async function normalizeWholesaleItems(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  items: any[],
  warehouseId: number
) {
  const normalizedItems = [] as Array<{ productId: number; quantity: number; price: number; discount: number }>;

  for (const rawItem of items) {
    const productId = Number(rawItem?.productId || 0);
    const quantity = Number(rawItem?.quantity || 0);
    const discount = Math.max(0, Number(rawItem?.discount || 0));

    if (!Number.isInteger(productId) || productId <= 0) {
      throw new Error("معرف المنتج غير صالح");
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error("كمية المنتج يجب أن تكون أكبر من صفر");
    }

    const product = await tx.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        wholesalePrice: true,
        wholesalePricingTiers: {
          orderBy: { minQuantity: "asc" },
          select: {
            minQuantity: true,
            maxQuantity: true,
            price: true,
          },
        },
        stocks: {
          where: { warehouseId },
          orderBy: { quantity: "desc" },
          select: {
            price: true,
            wholesalePrice: true,
          },
        },
      },
    });

    if (!product) {
      throw new Error(`المنتج رقم ${productId} غير موجود`);
    }

    const tierPrice = resolveTierPrice(product.wholesalePricingTiers, quantity);
    const productWholesalePrice = Number(product.wholesalePrice || 0);
    const stockWholesalePrice = Number(product.stocks?.[0]?.wholesalePrice || 0);
    const fallbackStockPrice = Number(product.stocks?.[0]?.price || 0);
    const resolvedPrice = tierPrice > 0
      ? tierPrice
      : productWholesalePrice > 0
        ? productWholesalePrice
        : stockWholesalePrice > 0
          ? stockWholesalePrice
          : fallbackStockPrice;

    normalizedItems.push({
      productId,
      quantity,
      price: Number(resolvedPrice || 0),
      discount,
    });
  }

  return normalizedItems;
}

const wholesaleOrderItemSelect = {
  id: true,
  quantity: true,
  price: true,
  discount: true,
  productId: true,
  product: {
    select: {
      id: true,
      name: true,
      modelNumber: true,
    },
  },
} as const;

const wholesaleOrderSelect = {
  id: true,
  orderNumber: true,
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
  additionalNotes: true,
  status: true,
  wholesaleCustomerId: true,
  userId: true,
  warehouseId: true,
  manualCreatedAt: true,
  createdAt: true,
  updatedAt: true,
  warehouse: {
    select: {
      id: true,
      name: true,
      location: true,
    },
  },
  user: {
    select: {
      id: true,
      username: true,
      phone: true,
    },
  },
  wholesaleCustomer: {
    select: {
      id: true,
      name: true,
      phone: true,
      city: true,
      country: true,
      assignedUserId: true,
      assignedUser: {
        select: {
          id: true,
          username: true,
        },
      },
    },
  },
  items: {
    select: wholesaleOrderItemSelect,
  },
} as const;

export async function getWholesaleOrders() {
  const currentUser = await getCurrentSessionUser();
  if (!canViewWholesaleOrders(currentUser)) {
    return { success: false, error: "غير مصرح لك بعرض طلبات الجملة" };
  }

  const scope = await buildWholesaleOrderScope(currentUser);
  const orders = await prisma.wholesaleOrder.findMany({
    where: scope,
    orderBy: { createdAt: "desc" },
    select: wholesaleOrderSelect,
  });

  return { success: true, data: sortOrdersByDisplayDateDesc(orders) };
}

export async function getWholesaleOrderById(orderId: string | number) {
  const currentUser = await getCurrentSessionUser();
  if (!canViewWholesaleOrders(currentUser)) {
    return { success: false, error: "غير مصرح لك بعرض طلبات الجملة" };
  }

  const normalizedOrderId = Number(orderId);
  if (!Number.isInteger(normalizedOrderId) || normalizedOrderId <= 0) {
    return { success: false, error: "معرف الطلب غير صالح" };
  }

  if (!isAdmin(currentUser)) {
    const accessibleOrder = await ensureAccessibleWholesaleOrder(normalizedOrderId, currentUser);
    if (!accessibleOrder) {
      return { success: false, error: "غير مصرح لك بعرض هذا الطلب" };
    }
  }

  const order = await prisma.wholesaleOrder.findUnique({
    where: { id: normalizedOrderId },
    select: wholesaleOrderSelect,
  });

  if (!order) {
    return { success: false, error: "طلب الجملة غير موجود" };
  }

  return { success: true, data: order };
}

export async function getWholesaleOrdersByCustomer(wholesaleCustomerId: string) {
  const currentUser = await getCurrentSessionUser();
  if (!canViewWholesaleOrders(currentUser)) {
    return { success: false, error: "غير مصرح لك بعرض طلبات الجملة" };
  }

  const scope = await buildWholesaleOrderScope(currentUser);
  const orders = await prisma.wholesaleOrder.findMany({
    where: {
      wholesaleCustomerId: String(wholesaleCustomerId || ""),
      ...scope,
    },
    orderBy: { createdAt: "desc" },
    select: wholesaleOrderSelect,
  });

  return { success: true, data: sortOrdersByDisplayDateDesc(orders) };
}

export async function createWholesaleOrder(data: any, items: any[]) {
  try {
    const currentUser = await getCurrentSessionUser();
    if (!currentUser || !canAddWholesaleOrders(currentUser)) {
      return { success: false, error: "لا تملك صلاحية إضافة طلب جملة" };
    }
    const currentUserId = String(currentUser.id);

    const warehouseId = parseWarehouseId(data?.warehouseId);
    if (!warehouseId) {
      return { success: false, error: "يرجى اختيار المستودع" };
    }

    const wholesaleCustomerId = String(data?.wholesaleCustomerId || "").trim();
    if (!wholesaleCustomerId) {
      return { success: false, error: "يرجى اختيار عميل الجملة" };
    }

    const orderNumber = `WHS-${Date.now()}`;
    const manualCreatedAt = parseOptionalDate(data?.manualCreatedAt);

    const createdOrder = await prisma.$transaction(async (tx) => {
      const warehouse = await tx.warehouse.findUnique({
        where: { id: warehouseId },
        select: { id: true, location: true },
      });

      if (!warehouse) {
        throw new Error("المستودع المحدد غير موجود");
      }

      const wholesaleCustomer = await tx.wholesaleCustomer.findUnique({
        where: { id: wholesaleCustomerId },
        select: { id: true },
      });

      if (!wholesaleCustomer) {
        throw new Error("عميل الجملة المحدد غير موجود");
      }

      const normalizedItems = await normalizeWholesaleItems(tx, items, warehouseId);
      if (normalizedItems.length === 0) {
        throw new Error("يجب إضافة منتج واحد على الأقل");
      }

      const subtotal = normalizedItems.reduce((sum, item) => sum + ((item.price - item.discount) * item.quantity), 0);
      const overallDiscount = Math.max(0, Number(data?.overallDiscount || 0));
      const finalAmount = Math.max(0, subtotal - overallDiscount);

      const newOrder = await tx.wholesaleOrder.create({
        data: {
          orderNumber,
          totalAmount: subtotal,
          discount: overallDiscount,
          finalAmount,
          paymentMethod: String(data?.paymentMethod || "عند الاستلام"),
          receiverName: String(data?.receiverName || "").trim() || null,
          receiverPhone: Array.isArray(data?.receiverPhone) ? data.receiverPhone.filter(Boolean) : [],
          country: String(data?.country || "").trim() || null,
          city: String(data?.city || "").trim() || null,
          municipality: String(data?.municipality || "").trim() || null,
          fullAddress: String(data?.fullAddress || "").trim() || null,
          deliveryNotes: String(data?.deliveryNotes || "").trim() || null,
          googleMapsLink: String(data?.googleMapsLink || "").trim() || null,
          additionalNotes: String(data?.additionalNotes || "").trim() || null,
          status: String(data?.status || "طلب جديد"),
          manualCreatedAt,
          wholesaleCustomer: { connect: { id: wholesaleCustomerId } },
          user: { connect: { id: currentUserId } },
          warehouse: { connect: { id: warehouse.id } },
          items: {
            create: normalizedItems.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.price,
              discount: item.discount,
            })),
          },
        },
      });

      await applyWholesaleOrderStockChange(tx, {
        warehouseId: warehouse.id,
        warehouse: { location: warehouse.location },
        items: normalizedItems,
      }, "reserve");

      return newOrder;
    });

    revalidatePath("/dashboard/wholesale-orders");
    revalidatePath("/dashboard/wholesale-customers");
    return { success: true, data: createdOrder };
  } catch (error: any) {
    console.error("Error creating wholesale order:", error);
    return { success: false, error: error?.message || "تعذر إنشاء طلب الجملة" };
  }
}

export async function updateWholesaleOrder(data: any, orderId: string | number, items: any[]) {
  try {
    const currentUser = await getCurrentSessionUser();
    if (!currentUser || !canEditWholesaleOrders(currentUser)) {
      return { success: false, error: "لا تملك صلاحية تعديل طلب الجملة" };
    }
    const currentUserId = String(currentUser.id);

    const normalizedOrderId = Number(orderId);
    if (!Number.isInteger(normalizedOrderId) || normalizedOrderId <= 0) {
      return { success: false, error: "معرف الطلب غير صالح" };
    }

    if (!isAdmin(currentUser)) {
      const accessibleOrder = await ensureAccessibleWholesaleOrder(normalizedOrderId, currentUser);
      if (!accessibleOrder) {
        return { success: false, error: "غير مصرح لك بتعديل هذا الطلب" };
      }
    }

    const oldOrder = await prisma.wholesaleOrder.findUnique({
      where: { id: normalizedOrderId },
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

    if (!oldOrder) {
      return { success: false, error: "طلب الجملة غير موجود" };
    }

    const warehouseId = parseWarehouseId(data?.warehouseId) ?? oldOrder.warehouseId ?? null;
    if (!warehouseId) {
      return { success: false, error: "يرجى اختيار المستودع" };
    }

    const wholesaleCustomerId = String(data?.wholesaleCustomerId || oldOrder.wholesaleCustomerId || "").trim();
    if (!wholesaleCustomerId) {
      return { success: false, error: "يرجى اختيار عميل الجملة" };
    }

    const updatedOrder = await prisma.$transaction(async (tx) => {
      const warehouse = await tx.warehouse.findUnique({
        where: { id: warehouseId },
        select: { id: true, location: true },
      });

      if (!warehouse) {
        throw new Error("المستودع المحدد غير موجود");
      }

      const wholesaleCustomer = await tx.wholesaleCustomer.findUnique({
        where: { id: wholesaleCustomerId },
        select: { id: true },
      });

      if (!wholesaleCustomer) {
        throw new Error("عميل الجملة المحدد غير موجود");
      }

      const normalizedItems = await normalizeWholesaleItems(tx, items, warehouseId);
      if (normalizedItems.length === 0) {
        throw new Error("يجب إضافة منتج واحد على الأقل");
      }

      const subtotal = normalizedItems.reduce((sum, item) => sum + ((item.price - item.discount) * item.quantity), 0);
      const overallDiscount = Math.max(0, Number(data?.overallDiscount || 0));
      const finalAmount = Math.max(0, subtotal - overallDiscount);
      const manualCreatedAt = parseOptionalDate(data?.manualCreatedAt);

      await applyWholesaleOrderStockChange(tx, oldOrder, "restore");

      const nextOrder = await tx.wholesaleOrder.update({
        where: { id: normalizedOrderId },
        data: {
          totalAmount: subtotal,
          discount: overallDiscount,
          finalAmount,
          paymentMethod: String(data?.paymentMethod || "عند الاستلام"),
          receiverName: String(data?.receiverName || "").trim() || null,
          receiverPhone: Array.isArray(data?.receiverPhone) ? data.receiverPhone.filter(Boolean) : [],
          country: String(data?.country || "").trim() || null,
          city: String(data?.city || "").trim() || null,
          municipality: String(data?.municipality || "").trim() || null,
          fullAddress: String(data?.fullAddress || "").trim() || null,
          deliveryNotes: String(data?.deliveryNotes || "").trim() || null,
          googleMapsLink: String(data?.googleMapsLink || "").trim() || null,
          additionalNotes: String(data?.additionalNotes || "").trim() || null,
          status: String(data?.status || oldOrder.status || "طلب جديد"),
          manualCreatedAt,
          wholesaleCustomer: { connect: { id: wholesaleCustomerId } },
          user: { connect: { id: currentUserId } },
          warehouse: { connect: { id: warehouse.id } },
          items: {
            deleteMany: {},
            create: normalizedItems.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.price,
              discount: item.discount,
            })),
          },
        },
      });

      await applyWholesaleOrderStockChange(tx, {
        warehouseId: warehouse.id,
        warehouse: { location: warehouse.location },
        items: normalizedItems,
      }, "reserve");

      return nextOrder;
    });

    revalidatePath("/dashboard/wholesale-orders");
    revalidatePath("/dashboard/wholesale-customers");
    return { success: true, data: updatedOrder };
  } catch (error: any) {
    console.error("Error updating wholesale order:", error);
    return { success: false, error: error?.message || "تعذر تعديل طلب الجملة" };
  }
}

export async function deleteWholesaleOrder(orderId: string | number) {
  try {
    const currentUser = await getCurrentSessionUser();
    if (!canDeleteWholesaleOrders(currentUser)) {
      return { success: false, error: "لا تملك صلاحية حذف طلب الجملة" };
    }

    const normalizedOrderId = Number(orderId);
    if (!Number.isInteger(normalizedOrderId) || normalizedOrderId <= 0) {
      return { success: false, error: "معرف الطلب غير صالح" };
    }

    if (!isAdmin(currentUser)) {
      const accessibleOrder = await ensureAccessibleWholesaleOrder(normalizedOrderId, currentUser);
      if (!accessibleOrder) {
        return { success: false, error: "غير مصرح لك بحذف هذا الطلب" };
      }
    }

    const oldOrder = await prisma.wholesaleOrder.findUnique({
      where: { id: normalizedOrderId },
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

    if (!oldOrder) {
      return { success: false, error: "طلب الجملة غير موجود" };
    }

    await prisma.$transaction(async (tx) => {
      await applyWholesaleOrderStockChange(tx, oldOrder, "restore");
      await tx.wholesaleOrder.delete({ where: { id: normalizedOrderId } });
    });

    revalidatePath("/dashboard/wholesale-orders");
    revalidatePath("/dashboard/wholesale-customers");
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting wholesale order:", error);
    return { success: false, error: error?.message || "تعذر حذف طلب الجملة" };
  }
}

export async function updateWholesaleOrderStatus(status: string, orderId: string | number) {
  try {
    const currentUser = await getCurrentSessionUser();
    if (!canEditWholesaleOrders(currentUser)) {
      return { success: false, error: "لا تملك صلاحية تعديل حالة الطلب" };
    }

    const normalizedOrderId = Number(orderId);
    if (!Number.isInteger(normalizedOrderId) || normalizedOrderId <= 0) {
      return { success: false, error: "معرف الطلب غير صالح" };
    }

    if (!isAdmin(currentUser)) {
      const accessibleOrder = await ensureAccessibleWholesaleOrder(normalizedOrderId, currentUser);
      if (!accessibleOrder) {
        return { success: false, error: "غير مصرح لك بتعديل هذا الطلب" };
      }
    }

    const nextStatus = String(status || "").trim();
    if (!nextStatus) {
      return { success: false, error: "حالة الطلب غير صالحة" };
    }

    const updatedOrder = await prisma.$transaction(async (tx) => {
      const existingOrder = await tx.wholesaleOrder.findUnique({
        where: { id: normalizedOrderId },
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
        throw new Error("طلب الجملة غير موجود");
      }

      const previousStatus = String(existingOrder.status || "").trim();
      const wasReturned = isStockReturnStatus(previousStatus);
      const willBeReturned = isStockReturnStatus(nextStatus);

      if (!wasReturned && willBeReturned) {
        await applyWholesaleOrderStockChange(tx, existingOrder, "restore");
      }

      if (wasReturned && !willBeReturned) {
        await applyWholesaleOrderStockChange(tx, existingOrder, "reserve");
      }

      return tx.wholesaleOrder.update({
        where: { id: normalizedOrderId },
        data: { status: nextStatus },
        select: wholesaleOrderSelect,
      });
    });

    revalidatePath("/dashboard/wholesale-orders");
    return { success: true, data: updatedOrder };
  } catch (error: any) {
    console.error("Error updating wholesale order status:", error);
    return { success: false, error: error?.message || "تعذر تعديل حالة الطلب" };
  }
}