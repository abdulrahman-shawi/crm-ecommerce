"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getCurrentSessionUser } from "@/server/order";

type WarrantyPayload = {
  type: "REPLACEMENT" | "MAINTENANCE" | "DAMAGED";
  productId: number;
  customerId?: string | null;
  warehouseId?: number | null;
  quantity?: number;
  maintenanceLaborCost?: number | null;
  shippingCost?: number | null;
  notes?: string | null;
};

const typeLabel: Record<WarrantyPayload["type"], string> = {
  REPLACEMENT: "تبديل",
  MAINTENANCE: "صيانة",
  DAMAGED: "تالف",
};

export async function getWarrantyData() {
  try {
    const [records, products, customers, warehouses] = await Promise.all([
      prisma.warranty.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          product: { select: { id: true, name: true } },
          customer: { select: { id: true, name: true } },
          warehouse: { select: { id: true, name: true, location: true } },
          order: { select: { id: true, orderNumber: true } },
        },
      }),
      prisma.product.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
      prisma.customer.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
      prisma.warehouse.findMany({ select: { id: true, name: true, location: true }, orderBy: { name: "asc" } }),
    ]);

    return { success: true, data: { records, products, customers, warehouses } };
  } catch (error: any) {
    return { success: false, error: error?.message || "تعذر جلب بيانات الكفالة" };
  }
}

export async function createWarrantyAction(payload: WarrantyPayload) {
  try {
    if (!payload.productId || !payload.type) {
      return { success: false, error: "البيانات الأساسية غير مكتملة" };
    }

    if (payload.type === "REPLACEMENT" && !payload.customerId) {
      return { success: false, error: "يرجى اختيار العميل لتسجيل طلب التبديل" };
    }

    if (!payload.warehouseId) {
      return { success: false, error: "يرجى اختيار المستودع" };
    }

    if (!payload.quantity || Number(payload.quantity) <= 0) {
      return { success: false, error: "يرجى إدخال كمية صحيحة" };
    }

    const currentUser = await getCurrentSessionUser();

    const result = await prisma.$transaction(async (tx) => {
      const productId = Number(payload.productId);
      const warehouseId = Number(payload.warehouseId);
      const quantity = Math.max(1, Number(payload.quantity || 1));

      const currentStock = await tx.productStock.findUnique({
        where: {
          productId_warehouseId: {
            productId,
            warehouseId,
          },
        },
      });

      if (!currentStock || currentStock.quantity < quantity) {
        throw new Error("الكمية غير كافية في المخزون لتنفيذ حركة الكفالة");
      }

      await tx.productStock.update({
        where: {
          productId_warehouseId: {
            productId,
            warehouseId,
          },
        },
        data: {
          quantity: { decrement: quantity },
        },
      });

      await tx.stockMovement.create({
        data: {
          productId,
          warehouseId,
          quantity,
          type: "OUT",
          reason: `${typeLabel[payload.type]} - كفالة${payload.notes ? `: ${payload.notes}` : ""}`,
        },
      });

      let orderId: number | null = null;

      if (payload.type === "REPLACEMENT") {
        const [warehouse, customer] = await Promise.all([
          tx.warehouse.findUnique({
            where: { id: warehouseId },
            select: { id: true, location: true },
          }),
          payload.customerId
            ? tx.customer.findUnique({
                where: { id: payload.customerId },
                select: { id: true, name: true },
              })
            : null,
        ]);

        if (!warehouse) {
          throw new Error("المستودع المختار غير موجود");
        }

        if (!customer) {
          throw new Error("العميل المختار غير موجود");
        }

        const price = Number(currentStock.price || 0);
        const discount = Number(currentStock.discount || 0);
        const totalAmount = price * quantity;
        const orderNumber = `ORD-${Date.now()}`;

        const newOrder = await tx.order.create({
          data: {
            orderNumber,
            status: "طلب جديد",
            paymentMethod: "عند الاستلام",
            totalAmount,
            discount: totalAmount,
            finalAmount: 0,
            receiverName: customer.name || null,
            receiverPhone: [],
            country: warehouse.location,
            customer: { connect: { id: payload.customerId! } },
            ...(currentUser ? { user: { connect: { id: currentUser.id } } } : {}),
            warehouse: { connect: { id: warehouseId } },
            items: {
              create: [
                {
                  productId,
                  quantity,
                  price,
                  discount,
                },
              ],
            },
          },
        });

        orderId = newOrder.id;
      }

      const warranty = await tx.warranty.create({
        data: {
          type: payload.type,
          productId,
          customerId: payload.customerId || null,
          warehouseId,
          orderId,
          quantity,
          maintenanceLaborCost:
            payload.type === "MAINTENANCE" && payload.maintenanceLaborCost != null
              ? Number(payload.maintenanceLaborCost)
              : null,
          shippingCost: payload.shippingCost != null ? Number(payload.shippingCost) : null,
          notes: payload.notes?.trim() || null,
        },
      });

      return warranty;
    });

    revalidatePath("/dashboard/warranty");
    revalidatePath("/dashboard/inventories");
    if (result.orderId) {
      revalidatePath("/dashboard/orders");
    }
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message || "تعذر حفظ حركة الكفالة" };
  }
}

export async function updateWarrantyAction(id: string, payload: WarrantyPayload) {
  try {
    if (!id) {
      return { success: false, error: "معرف الكفالة غير صالح" };
    }

    if (!payload.productId || !payload.type) {
      return { success: false, error: "البيانات الأساسية غير مكتملة" };
    }

    if (payload.type === "REPLACEMENT" && !payload.customerId) {
      return { success: false, error: "يرجى اختيار العميل لتسجيل طلب التبديل" };
    }

    if (!payload.warehouseId) {
      return { success: false, error: "يرجى اختيار المستودع" };
    }

    if (!payload.quantity || Number(payload.quantity) <= 0) {
      return { success: false, error: "يرجى إدخال كمية صحيحة" };
    }

    const currentUser = await getCurrentSessionUser();

    const existing = await prisma.warranty.findUnique({
      where: { id },
      include: {
        product: { select: { id: true, name: true } },
        warehouse: { select: { id: true, name: true, location: true } },
        order: {
          include: {
            items: { select: { productId: true, quantity: true } },
          },
        },
      },
    });

    if (!existing) {
      return { success: false, error: "سجل الكفالة غير موجود" };
    }

    const newProductId = Number(payload.productId);
    const newWarehouseId = Number(payload.warehouseId);
    const newQuantity = Math.max(1, Number(payload.quantity || 1));

    const stockChanged =
      existing.type !== payload.type ||
      existing.productId !== newProductId ||
      existing.warehouseId !== newWarehouseId ||
      existing.quantity !== newQuantity;

    const result = await prisma.$transaction(async (tx) => {
      let orderId: number | null = existing.orderId;

      if (stockChanged) {
        // إرجاع الآثار القديمة على المخزون
        if (existing.type === "REPLACEMENT" && existing.orderId && existing.order) {
          // إعادة كميات الطلب المرتبط إلى المستودع ثم حذفه
          for (const item of existing.order.items) {
            await tx.productStock.upsert({
              where: {
                productId_warehouseId: {
                  productId: item.productId,
                  warehouseId: existing.warehouseId!,
                },
              },
              update: {
                quantity: { increment: item.quantity },
              },
              create: {
                productId: item.productId,
                warehouseId: existing.warehouseId!,
                quantity: item.quantity,
              },
            });
          }

          await tx.order.delete({
            where: { id: existing.orderId },
          });
          orderId = null;
        } else if (existing.warehouseId) {
          // إعادة الكمية إلى المستودع المرتبط
          await tx.productStock.upsert({
            where: {
              productId_warehouseId: {
                productId: existing.productId,
                warehouseId: existing.warehouseId,
              },
            },
            update: {
              quantity: { increment: existing.quantity },
            },
            create: {
              productId: existing.productId,
              warehouseId: existing.warehouseId,
              quantity: existing.quantity,
            },
          });

          await tx.stockMovement.create({
            data: {
              productId: existing.productId,
              warehouseId: existing.warehouseId,
              quantity: existing.quantity,
              type: "RETURN",
              reason: `تعديل كفالة - إرجاع مخزون ${typeLabel[existing.type]}${existing.notes ? `: ${existing.notes}` : ""}`,
            },
          });
        }

        // تطبيق الآثار الجديدة على المخزون
        const currentStock = await tx.productStock.findUnique({
          where: {
            productId_warehouseId: {
              productId: newProductId,
              warehouseId: newWarehouseId,
            },
          },
        });

        if (!currentStock || currentStock.quantity < newQuantity) {
          throw new Error("الكمية غير كافية في المخزون لتنفيذ حركة الكفالة");
        }

        await tx.productStock.update({
          where: {
            productId_warehouseId: {
              productId: newProductId,
              warehouseId: newWarehouseId,
            },
          },
          data: {
            quantity: { decrement: newQuantity },
          },
        });

        await tx.stockMovement.create({
          data: {
            productId: newProductId,
            warehouseId: newWarehouseId,
            quantity: newQuantity,
            type: "OUT",
            reason: `${typeLabel[payload.type]} - كفالة${payload.notes ? `: ${payload.notes}` : ""}`,
          },
        });

        // إنشاء طلب جديد في حالة التبديل
        if (payload.type === "REPLACEMENT") {
          const [warehouse, customer] = await Promise.all([
            tx.warehouse.findUnique({
              where: { id: newWarehouseId },
              select: { id: true, location: true },
            }),
            payload.customerId
              ? tx.customer.findUnique({
                  where: { id: payload.customerId },
                  select: { id: true, name: true },
                })
              : null,
          ]);

          if (!warehouse) {
            throw new Error("المستودع المختار غير موجود");
          }

          if (!customer) {
            throw new Error("العميل المختار غير موجود");
          }

          const price = Number(currentStock.price || 0);
          const discount = Number(currentStock.discount || 0);
          const totalAmount = price * newQuantity;
          const orderNumber = `ORD-${Date.now()}`;

          const newOrder = await tx.order.create({
            data: {
              orderNumber,
              status: "طلب جديد",
              paymentMethod: "عند الاستلام",
              totalAmount,
              discount: totalAmount,
              finalAmount: 0,
              receiverName: customer.name || null,
              receiverPhone: [],
              country: warehouse.location,
              customer: { connect: { id: payload.customerId! } },
              ...(currentUser ? { user: { connect: { id: currentUser.id } } } : {}),
              warehouse: { connect: { id: newWarehouseId } },
              items: {
                create: [
                  {
                    productId: newProductId,
                    quantity: newQuantity,
                    price,
                    discount,
                  },
                ],
              },
            },
          });

          orderId = newOrder.id;
        }
      } else if (
        payload.type === "REPLACEMENT" &&
        existing.type === "REPLACEMENT" &&
        payload.customerId &&
        existing.customerId !== payload.customerId &&
        existing.orderId
      ) {
        // تغيّر العميل فقط لكفالة تبديل: تحديث الطلب المرتبط
        const customer = await tx.customer.findUnique({
          where: { id: payload.customerId },
          select: { id: true, name: true },
        });

        if (!customer) {
          throw new Error("العميل المختار غير موجود");
        }

        await tx.order.update({
          where: { id: existing.orderId },
          data: {
            receiverName: customer.name || null,
            customer: { connect: { id: payload.customerId } },
          },
        });
      }

      const warranty = await tx.warranty.update({
        where: { id },
        data: {
          type: payload.type,
          productId: newProductId,
          customerId: payload.customerId || null,
          warehouseId: newWarehouseId,
          orderId,
          quantity: newQuantity,
          maintenanceLaborCost:
            payload.type === "MAINTENANCE" && payload.maintenanceLaborCost != null
              ? Number(payload.maintenanceLaborCost)
              : null,
          shippingCost: payload.shippingCost != null ? Number(payload.shippingCost) : null,
          notes: payload.notes?.trim() || null,
        },
      });

      return warranty;
    });

    revalidatePath("/dashboard/warranty");
    revalidatePath("/dashboard/inventories");
    if (result.orderId) {
      revalidatePath("/dashboard/orders");
    }
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message || "تعذر تحديث حركة الكفالة" };
  }
}

export async function deleteWarrantyAction(id: string) {
  try {
    const warranty = await prisma.warranty.findUnique({
      where: { id },
      include: {
        product: { select: { id: true, name: true } },
        warehouse: { select: { id: true, name: true, location: true } },
        order: {
          include: {
            items: { select: { productId: true, quantity: true } },
          },
        },
      },
    });

    if (!warranty) {
      return { success: false, error: "سجل الكفالة غير موجود" };
    }

    await prisma.$transaction(async (tx) => {
      if (warranty.type === "REPLACEMENT" && warranty.orderId && warranty.order) {
        // إعادة كميات الطلب المرتبط إلى المستودع المحدد في الكفالة ثم حذف الطلب
        for (const item of warranty.order.items) {
          await tx.productStock.upsert({
            where: {
              productId_warehouseId: {
                productId: item.productId,
                warehouseId: warranty.warehouseId!,
              },
            },
            update: {
              quantity: { increment: item.quantity },
            },
            create: {
              productId: item.productId,
              warehouseId: warranty.warehouseId!,
              quantity: item.quantity,
            },
          });
        }

        await tx.order.delete({
          where: { id: warranty.orderId },
        });
      } else if (warranty.warehouseId) {
        // إعادة الكمية إلى المستودع المرتبط
        await tx.productStock.upsert({
          where: {
            productId_warehouseId: {
              productId: warranty.productId,
              warehouseId: warranty.warehouseId,
            },
          },
          update: {
            quantity: { increment: warranty.quantity },
          },
          create: {
            productId: warranty.productId,
            warehouseId: warranty.warehouseId,
            quantity: warranty.quantity,
          },
        });

        await tx.stockMovement.create({
          data: {
            productId: warranty.productId,
            warehouseId: warranty.warehouseId,
            quantity: warranty.quantity,
            type: "RETURN",
            reason: `إلغاء كفالة - ${typeLabel[warranty.type]}${warranty.notes ? `: ${warranty.notes}` : ""}`,
          },
        });
      }

      await tx.warranty.delete({ where: { id } });
    });

    revalidatePath("/dashboard/warranty");
    revalidatePath("/dashboard/inventories");
    if (warranty.orderId) {
      revalidatePath("/dashboard/orders");
    }
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message || "تعذر حذف سجل الكفالة" };
  }
}
