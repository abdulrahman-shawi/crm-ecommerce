'use server'

import { decrypt } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getOrders } from "@/server/order";

const DELIVERED_STATUSES = new Set(["تم تسليم الطلب", "تم التسليم", "مدفوعة"]);

const normalizeNumber = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const DEFAULT_TURKEY_EXCHANGE_RATE = 44;

const resolveOrderExchangeRate = (orderLike: any) => {
  const snapshotRate = Number(orderLike?.usdToTryRateAtOrder || 0);
  return snapshotRate > 0 ? snapshotRate : DEFAULT_TURKEY_EXCHANGE_RATE;
};

const convertToUSD = (value: unknown, orderLike: any) => {
  const amount = normalizeNumber(value);
  const isTurkey = String(orderLike?.warehouse?.location || "").trim() === "تركيا";
  if (!isTurkey) return amount;
  const rate = resolveOrderExchangeRate(orderLike);
  return rate > 0 ? amount / rate : amount;
};

const getShippingCharge = (orderLike: any) => {
  return Math.max(0, convertToUSD(orderLike?.shippingPrice ?? orderLike?.shipping?.price, orderLike));
};

const getBankTransferReceivedAmount = (orderLike: any) => {
  const paymentMethod = String(orderLike?.paymentMethod || "").trim();
  if (paymentMethod === "تحويل بنكي") {
    return Math.max(0, convertToUSD(orderLike?.finalAmount, orderLike));
  }

  if (paymentMethod === "مختلطة") {
    return Math.max(0, convertToUSD(orderLike?.amount, orderLike));
  }

  return 0;
};

const getCarrierCollectionBaseAmount = (orderLike: any) => {
  const paymentMethod = String(orderLike?.paymentMethod || "").trim();
  if (paymentMethod === "تحويل بنكي") {
    return 0;
  }

  if (paymentMethod === "مختلطة") {
    return Math.max(0, convertToUSD(orderLike?.amountBank, orderLike));
  }

  return Math.max(0, convertToUSD(orderLike?.finalAmount, orderLike));
};

const getCarrierCollectionWithShipping = (orderLike: any) => {
  return getCarrierCollectionBaseAmount(orderLike) + getShippingCharge(orderLike);
};

const getCarrierCollectionNetReceived = (orderLike: any) => {
  return Math.max(0, getCarrierCollectionBaseAmount(orderLike) - getShippingCharge(orderLike));
};

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

async function hasCarrierCollectionColumns() {
  const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND lower(table_name) = lower('Order')
        AND lower(column_name) = lower('carrierCollectionReceivedAt')
    ) AS exists
  `;

  return Boolean(rows?.[0]?.exists);
}

async function getCarrierCollectionTrackingMap(orderIds: number[]) {
  if (orderIds.length === 0) {
    return { supported: false, entries: new Map<number, any>() };
  }

  const supported = await hasCarrierCollectionColumns();
  if (!supported) {
    return { supported: false, entries: new Map<number, any>() };
  }

  const rows = await prisma.$queryRaw<Array<{
    id: number;
    carrierCollectionReceivedAt: Date | null;
    carrierCollectionReceivedAmount: number | null;
    carrierCollectionNotes: string | null;
  }>>(Prisma.sql`
    SELECT
      "id",
      "carrierCollectionReceivedAt",
      "carrierCollectionReceivedAmount",
      "carrierCollectionNotes"
    FROM "Order"
    WHERE "id" IN (${Prisma.join(orderIds)})
  `);

  return {
    supported: true,
    entries: new Map(rows.map((row) => [Number(row.id), row])),
  };
}

const canManageCollections = (user: any) => {
  if (!user) return false;
  if (user.accountType === "ADMIN") return true;
  return Boolean(user?.permission?.editOrders);
};

export async function getCollectionsDashboardData() {
  const ordersResult = await getOrders();
  if (!ordersResult.success) {
    return ordersResult;
  }

  const orders = Array.isArray(ordersResult.data) ? ordersResult.data : [];
  const orderIds = orders.map((order: any) => Number(order.id)).filter((id) => Number.isFinite(id));
  const tracking = await getCarrierCollectionTrackingMap(orderIds);

  const bankTransfers = orders
    .map((order: any) => {
      const receivedAmount = getBankTransferReceivedAmount(order);
      if (receivedAmount <= 0) return null;

      return {
        ...order,
        collectionAmount: receivedAmount,
      };
    })
    .filter(Boolean);

  const carrierCollectionsBase = orders
    .filter((order: any) => DELIVERED_STATUSES.has(String(order?.status || "").trim()))
    .map((order: any) => {
      const baseAmount = getCarrierCollectionBaseAmount(order);
      if (baseAmount <= 0) return null;

      const trackingEntry = tracking.entries.get(Number(order.id));
      const shippingCharge = getShippingCharge(order);

      return {
        ...order,
        collectionBaseAmount: baseAmount,
        shippingCharge,
        collectionWithShipping: baseAmount + shippingCharge,
        collectionNetReceived: getCarrierCollectionNetReceived(order),
        carrierCollectionReceivedAt: trackingEntry?.carrierCollectionReceivedAt || null,
        carrierCollectionReceivedAmount: trackingEntry?.carrierCollectionReceivedAmount ?? null,
        carrierCollectionNotes: trackingEntry?.carrierCollectionNotes ?? null,
      };
    })
    .filter(Boolean);

  const carrierCollectionsPending = carrierCollectionsBase.filter(
    (order: any) => !order.carrierCollectionReceivedAt
  );

  const carrierCollectionsReceived = carrierCollectionsBase.filter(
    (order: any) => Boolean(order.carrierCollectionReceivedAt)
  );

  return {
    success: true,
    data: {
      supportsCarrierCollectionTracking: tracking.supported,
      bankTransfers,
      carrierCollectionsPending,
      carrierCollectionsReceived,
      summaries: {
        bankTransfersTotal: bankTransfers.reduce((sum: number, order: any) => sum + normalizeNumber(order.collectionAmount), 0),
        carrierPendingTotal: carrierCollectionsPending.reduce((sum: number, order: any) => sum + normalizeNumber(order.collectionWithShipping), 0),
        carrierReceivedTotal: carrierCollectionsReceived.reduce((sum: number, order: any) => {
          const overrideAmount = order.carrierCollectionReceivedAmount;
          return sum + (overrideAmount != null ? normalizeNumber(overrideAmount) : normalizeNumber(order.collectionNetReceived));
        }, 0),
      },
    },
  };
}

export async function markCarrierCollectionReceived(orderId: number, receivedAmount?: number | null, notes?: string | null) {
  const currentUser = await getCurrentSessionUser();
  if (!currentUser || !canManageCollections(currentUser)) {
    return { success: false, error: "غير مصرح لك بتعديل التحصيلات" };
  }

  const supported = await hasCarrierCollectionColumns();
  if (!supported) {
    return { success: false, error: "يجب تنفيذ ترحيل Prisma أولاً لتفعيل تتبع التحصيلات المستلمة" };
  }

  const normalizedOrderId = Number(orderId);
  if (!Number.isFinite(normalizedOrderId)) {
    return { success: false, error: "معرف الطلب غير صالح" };
  }

  await prisma.$executeRaw(Prisma.sql`
    UPDATE "Order"
    SET
      "carrierCollectionReceivedAt" = NOW(),
      "carrierCollectionReceivedAmount" = ${receivedAmount == null ? null : normalizeNumber(receivedAmount)},
      "carrierCollectionNotes" = ${notes == null ? null : String(notes).trim() || null}
    WHERE "id" = ${normalizedOrderId}
  `);

  revalidatePath("/dashboard/collections");
  return { success: true };
}

export async function clearCarrierCollectionReceived(orderId: number) {
  const currentUser = await getCurrentSessionUser();
  if (!currentUser || !canManageCollections(currentUser)) {
    return { success: false, error: "غير مصرح لك بتعديل التحصيلات" };
  }

  const supported = await hasCarrierCollectionColumns();
  if (!supported) {
    return { success: false, error: "يجب تنفيذ ترحيل Prisma أولاً لتفعيل تتبع التحصيلات المستلمة" };
  }

  const normalizedOrderId = Number(orderId);
  if (!Number.isFinite(normalizedOrderId)) {
    return { success: false, error: "معرف الطلب غير صالح" };
  }

  await prisma.$executeRaw(Prisma.sql`
    UPDATE "Order"
    SET
      "carrierCollectionReceivedAt" = NULL,
      "carrierCollectionReceivedAmount" = NULL,
      "carrierCollectionNotes" = NULL
    WHERE "id" = ${normalizedOrderId}
  `);

  revalidatePath("/dashboard/collections");
  return { success: true };
}