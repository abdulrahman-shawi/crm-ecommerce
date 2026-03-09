"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

type WarrantyPayload = {
  type: "REPLACEMENT" | "MAINTENANCE" | "DAMAGED";
  productId: number;
  customerId: string;
  warehouseId?: number | null;
  quantity?: number;
  maintenanceLaborCost?: number | null;
  shippingCost?: number | null;
  notes?: string | null;
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
    if (!payload.customerId || !payload.productId || !payload.type) {
      return { success: false, error: "البيانات الأساسية غير مكتملة" };
    }

    if (payload.type === "DAMAGED") {
      if (!payload.warehouseId) {
        return { success: false, error: "يرجى اختيار المستودع لحركة التالف" };
      }
      if (!payload.quantity || Number(payload.quantity) <= 0) {
        return { success: false, error: "يرجى إدخال كمية صحيحة للتالف" };
      }
    }

    await prisma.$transaction(async (tx) => {
      const quantity = Math.max(1, Number(payload.quantity || 1));

      if (payload.type === "DAMAGED") {
        const currentStock = await tx.productStock.findUnique({
          where: {
            productId_warehouseId: {
              productId: Number(payload.productId),
              warehouseId: Number(payload.warehouseId),
            },
          },
        });

        if (!currentStock || currentStock.quantity < quantity) {
          throw new Error("الكمية غير كافية في المخزون لتنفيذ حركة التالف");
        }

        await tx.productStock.update({
          where: {
            productId_warehouseId: {
              productId: Number(payload.productId),
              warehouseId: Number(payload.warehouseId),
            },
          },
          data: {
            quantity: { decrement: quantity },
          },
        });

        await tx.stockMovement.create({
          data: {
            productId: Number(payload.productId),
            warehouseId: Number(payload.warehouseId),
            quantity,
            type: "OUT",
            reason: `تالف - كفالة${payload.notes ? `: ${payload.notes}` : ""}`,
          },
        });
      }

      await tx.warranty.create({
        data: {
          type: payload.type,
          productId: Number(payload.productId),
          customerId: payload.customerId,
          warehouseId: payload.warehouseId ? Number(payload.warehouseId) : null,
          quantity,
          maintenanceLaborCost:
            payload.type === "MAINTENANCE" && payload.maintenanceLaborCost != null
              ? Number(payload.maintenanceLaborCost)
              : null,
          shippingCost: payload.shippingCost != null ? Number(payload.shippingCost) : null,
          notes: payload.notes?.trim() || null,
        },
      });
    });

    revalidatePath("/dashboard/warranty");
    revalidatePath("/dashboard/inventories");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message || "تعذر حفظ حركة الكفالة" };
  }
}

export async function deleteWarrantyAction(id: string) {
  try {
    await prisma.warranty.delete({ where: { id } });
    revalidatePath("/dashboard/warranty");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message || "تعذر حذف سجل الكفالة" };
  }
}
