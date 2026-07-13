'use server';

import { decrypt } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, isAdmin } from "@/lib/utils";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

type WholesaleCustomerPayload = {
  name: string;
  category?: string;
  activityKey?: string;
  categoryOther?: string;
  contactName?: string;
  phone?: string[];
  whatsappPhone?: string;
  country?: string;
  city?: string;
  area?: string;
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
  googleMapsLink?: string;
  assignedUserId?: string | null;
  notes?: string;
  preferredVisitAt?: string | null;
  nextFollowUpAt?: string | null;
  visitStatus?: string;
  isActive?: boolean;
};

type WholesaleVisitPayload = {
  wholesaleCustomerId: string;
  userId?: string | null;
  visitedAt?: string | null;
  result: string;
  status?: string;
  rejectionReasonCode?: string;
  rejectionReasonOther?: string;
  voiceNote?: string;
  notes?: string;
  photoUrls?: string[];
  latitude?: number | null;
  longitude?: number | null;
  nextFollowUpAt?: string | null;
  followUpNotes?: string;
  orderPlaced?: boolean;
};

const wholesaleCustomerSelect = {
  id: true,
  name: true,
  category: true,
  contactName: true,
  phone: true,
  whatsappPhone: true,
  country: true,
  city: true,
  area: true,
  address: true,
  latitude: true,
  longitude: true,
  googleMapsLink: true,
  notes: true,
  preferredVisitAt: true,
  lastVisitAt: true,
  nextFollowUpAt: true,
  lastVisitResult: true,
  visitStatus: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  assignedUserId: true,
  assignedUser: {
    select: {
      id: true,
      username: true,
      email: true,
      avatar: true,
      accountType: true,
    },
  },
  visits: {
    orderBy: {
      visitedAt: 'desc' as const,
    },
    select: {
      id: true,
      visitedAt: true,
      result: true,
      status: true,
      notes: true,
      voiceNote: true,
      photoUrls: true,
      latitude: true,
      longitude: true,
      nextFollowUpAt: true,
      followUpNotes: true,
      orderPlaced: true,
      syncedAt: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          username: true,
          avatar: true,
        },
      },
    },
  },
  _count: {
    select: {
      visits: true,
    },
  },
} as const;

const NOTE_META_PREFIX = "\n<!-- skynova-wholesale-meta:";
const NOTE_META_SUFFIX = "-->";
const FOLLOW_UP_RESULTS = new Set(["VERY_INTERESTED", "INTERESTED", "THINKING"]);

function toNullableString(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function withWholesaleMeta(text: unknown, meta: Record<string, unknown>) {
  const cleanedText = toNullableString(text) ?? "";
  const compactMeta = Object.fromEntries(
    Object.entries(meta).filter(([, value]) => {
      if (value === null || value === undefined) return false;
      if (typeof value === "string") return value.trim().length > 0;
      return true;
    })
  );

  if (Object.keys(compactMeta).length === 0) {
    return cleanedText || null;
  }

  const separator = cleanedText ? "\n\n" : "";
  return `${cleanedText}${separator}${NOTE_META_PREFIX}${JSON.stringify(compactMeta)}${NOTE_META_SUFFIX}`;
}

function extractWholesaleMeta(value: unknown) {
  const raw = String(value ?? "");
  const markerIndex = raw.lastIndexOf(NOTE_META_PREFIX);

  if (markerIndex === -1) {
    return {
      text: toNullableString(raw),
      meta: {} as Record<string, unknown>,
    };
  }

  const jsonStart = markerIndex + NOTE_META_PREFIX.length;
  const jsonEnd = raw.indexOf(NOTE_META_SUFFIX, jsonStart);
  if (jsonEnd === -1) {
    return {
      text: toNullableString(raw),
      meta: {} as Record<string, unknown>,
    };
  }

  const textPart = raw.slice(0, markerIndex).trim();
  const metaPart = raw.slice(jsonStart, jsonEnd);

  try {
    const parsed = JSON.parse(metaPart) as Record<string, unknown>;
    return {
      text: toNullableString(textPart),
      meta: parsed,
    };
  } catch {
    return {
      text: toNullableString(raw),
      meta: {} as Record<string, unknown>,
    };
  }
}

function normalizeActivityCategory(category: unknown) {
  switch (String(category ?? "").trim()) {
    case "PHARMACY":
      return "PHARMACY";
    case "DISTRIBUTOR":
      return "DISTRIBUTOR";
    case "MARKET":
      return "MARKET";
    case "CLINIC":
      return "CLINIC";
    default:
      return "OTHER";
  }
}

function normalizeVisitResult(result: unknown) {
  const value = String(result ?? "").trim();
  if (["VERY_INTERESTED", "INTERESTED", "THINKING", "NOT_INTERESTED", "PURCHASED"].includes(value)) {
    return value;
  }
  return null;
}

function serializeWholesaleCustomer(customer: any) {
  const customerNotes = extractWholesaleMeta(customer.notes);
  const activityKey = toNullableString(customerNotes.meta.activityKey) ?? customer.category;
  const categoryOther = toNullableString(customerNotes.meta.categoryOther);

  return {
    ...customer,
    category: activityKey,
    categoryOther,
    notes: customerNotes.text,
    visits: customer.visits.map((visit: any) => {
      const visitNotes = extractWholesaleMeta(visit.notes);
      return {
        ...visit,
        notes: visitNotes.text,
        rejectionReasonCode: toNullableString(visitNotes.meta.rejectionReasonCode),
        rejectionReasonOther: toNullableString(visitNotes.meta.rejectionReasonOther),
      };
    }),
  };
}

async function getSessionUser() {
  const session = cookies().get("skynova")?.value;
  const decoded = session ? await decrypt(session) : null;
  const userId = String(decoded?.userId || "").trim();

  if (!userId) return null;

  return prisma.user.findUnique({
    where: { id: userId },
    include: { permission: true },
  });
}

function hasWholesaleAccess(user: any) {
  if (!user) return false;
  return isAdmin(user)
    || hasPermission(user, "viewWholesaleCustomers")
    || hasPermission(user, "addWholesaleCustomers")
    || hasPermission(user, "editWholesaleCustomers")
    || hasPermission(user, "deleteWholesaleCustomers");
}

function getScopedWholesaleWhere(user: any) {
  if (isAdmin(user)) return {};

  return {
    OR: [
      { assignedUserId: user.id },
      { visits: { some: { userId: user.id } } },
    ],
  };
}

async function getAccessibleCustomerId(id: string, user: any) {
  const customer = await prisma.wholesaleCustomer.findFirst({
    where: {
      id,
      ...getScopedWholesaleWhere(user),
    },
    select: { id: true, assignedUserId: true },
  });

  return customer ?? null;
}

function normalizeString(value: unknown) {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

function normalizePhoneList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item ?? '').trim())
    .filter(Boolean);
}

function normalizeDate(value: unknown) {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeFloat(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function getWholesaleCustomers() {
  try {
    const currentUser = await getSessionUser();
    if (!hasWholesaleAccess(currentUser)) {
      return { success: false, error: 'لا تملك صلاحية عرض عملاء الجملة' };
    }

    const data = await prisma.wholesaleCustomer.findMany({
      where: getScopedWholesaleWhere(currentUser),
      orderBy: [{ nextFollowUpAt: 'asc' }, { createdAt: 'desc' }],
      select: wholesaleCustomerSelect,
    });

    return { success: true, data: data.map(serializeWholesaleCustomer) };
  } catch (error) {
    console.error('Error fetching wholesale customers:', error);
    return { success: false, error: 'تعذر جلب عملاء الجملة' };
  }
}

export async function getWholesaleSalesReps() {
  try {
    const currentUser = await getSessionUser();
    if (!hasWholesaleAccess(currentUser)) {
      return { success: false, error: 'لا تملك صلاحية عرض المستخدمين' };
    }

    const users = await prisma.user.findMany({
      where: {
        accountType: {
          not: 'AFFILIATE',
        },
      },
      orderBy: { username: 'asc' },
      select: {
        id: true,
        username: true,
        email: true,
        avatar: true,
        accountType: true,
      },
    });

    return { success: true, data: users };
  } catch (error) {
    console.error('Error fetching sales reps:', error);
    return { success: false, error: 'تعذر جلب المستخدمين' };
  }
}

export async function createWholesaleCustomer(payload: WholesaleCustomerPayload) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser || (!isAdmin(currentUser) && !hasPermission(currentUser, 'addWholesaleCustomers'))) {
      return { success: false, error: 'لا تملك صلاحية إضافة عميل جملة' };
    }

    const name = String(payload.name ?? '').trim();
    if (name.length < 3) {
      return { success: false, error: 'اسم العميل يجب أن يكون 3 أحرف على الأقل' };
    }

    const activityKey = toNullableString(payload.activityKey) ?? toNullableString(payload.category) ?? 'PHARMACY';
    const categoryOther = activityKey === 'OTHER' ? toNullableString(payload.categoryOther) : null;
    if (activityKey === 'OTHER' && !categoryOther) {
      return { success: false, error: 'اكتب نوع النشاط عند اختيار أخرى' };
    }

    const assignedUserId = isAdmin(currentUser)
      ? normalizeString(payload.assignedUserId)
      : currentUser.id;

    const created = await prisma.wholesaleCustomer.create({
      data: {
        name,
        category: normalizeActivityCategory(payload.category),
        contactName: normalizeString(payload.contactName),
        phone: normalizePhoneList(payload.phone),
        whatsappPhone: normalizeString(payload.whatsappPhone),
        country: normalizeString(payload.country),
        city: normalizeString(payload.city),
        area: normalizeString(payload.area),
        address: normalizeString(payload.address),
        latitude: normalizeFloat(payload.latitude),
        longitude: normalizeFloat(payload.longitude),
        googleMapsLink: normalizeString(payload.googleMapsLink),
        assignedUserId,
        notes: withWholesaleMeta(payload.notes, { activityKey, categoryOther }),
        preferredVisitAt: normalizeDate(payload.preferredVisitAt),
        nextFollowUpAt: normalizeDate(payload.nextFollowUpAt),
        visitStatus: (payload.visitStatus as any) || 'PLANNED',
        isActive: payload.isActive ?? true,
      },
      select: wholesaleCustomerSelect,
    });

    revalidatePath('/dashboard/wholesale-customers');
    return { success: true, data: serializeWholesaleCustomer(created) };
  } catch (error) {
    console.error('Error creating wholesale customer:', error);
    return { success: false, error: 'تعذر إنشاء عميل الجملة' };
  }
}

export async function updateWholesaleCustomer(id: string, payload: WholesaleCustomerPayload) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser || (!isAdmin(currentUser) && !hasPermission(currentUser, 'editWholesaleCustomers'))) {
      return { success: false, error: 'لا تملك صلاحية تعديل عميل الجملة' };
    }

    const name = String(payload.name ?? '').trim();
    if (name.length < 3) {
      return { success: false, error: 'اسم العميل يجب أن يكون 3 أحرف على الأقل' };
    }

    const accessibleCustomer = await getAccessibleCustomerId(id, currentUser);
    if (!accessibleCustomer) {
      return { success: false, error: 'هذا العميل غير متاح لك' };
    }

    const activityKey = toNullableString(payload.activityKey) ?? toNullableString(payload.category) ?? 'PHARMACY';
    const categoryOther = activityKey === 'OTHER' ? toNullableString(payload.categoryOther) : null;
    if (activityKey === 'OTHER' && !categoryOther) {
      return { success: false, error: 'اكتب نوع النشاط عند اختيار أخرى' };
    }

    const assignedUserId = isAdmin(currentUser)
      ? normalizeString(payload.assignedUserId)
      : (accessibleCustomer.assignedUserId ?? currentUser.id);

    const updated = await prisma.wholesaleCustomer.update({
      where: { id },
      data: {
        name,
        category: normalizeActivityCategory(payload.category),
        contactName: normalizeString(payload.contactName),
        phone: normalizePhoneList(payload.phone),
        whatsappPhone: normalizeString(payload.whatsappPhone),
        country: normalizeString(payload.country),
        city: normalizeString(payload.city),
        area: normalizeString(payload.area),
        address: normalizeString(payload.address),
        latitude: normalizeFloat(payload.latitude),
        longitude: normalizeFloat(payload.longitude),
        googleMapsLink: normalizeString(payload.googleMapsLink),
        assignedUserId,
        notes: withWholesaleMeta(payload.notes, { activityKey, categoryOther }),
        preferredVisitAt: normalizeDate(payload.preferredVisitAt),
        nextFollowUpAt: normalizeDate(payload.nextFollowUpAt),
        visitStatus: (payload.visitStatus as any) || 'PLANNED',
        isActive: payload.isActive ?? true,
      },
      select: wholesaleCustomerSelect,
    });

    revalidatePath('/dashboard/wholesale-customers');
    return { success: true, data: serializeWholesaleCustomer(updated) };
  } catch (error) {
    console.error('Error updating wholesale customer:', error);
    return { success: false, error: 'تعذر تحديث عميل الجملة' };
  }
}

export async function deleteWholesaleCustomer(id: string) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser || (!isAdmin(currentUser) && !hasPermission(currentUser, 'deleteWholesaleCustomers'))) {
      return { success: false, error: 'لا تملك صلاحية حذف عميل الجملة' };
    }

    const accessibleCustomer = await getAccessibleCustomerId(id, currentUser);
    if (!accessibleCustomer) {
      return { success: false, error: 'هذا العميل غير متاح لك' };
    }

    await prisma.wholesaleCustomer.delete({
      where: { id },
    });

    revalidatePath('/dashboard/wholesale-customers');
    return { success: true };
  } catch (error) {
    console.error('Error deleting wholesale customer:', error);
    return { success: false, error: 'تعذر حذف عميل الجملة' };
  }
}

export async function createWholesaleVisit(payload: WholesaleVisitPayload) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser || (!isAdmin(currentUser) && !hasPermission(currentUser, 'editWholesaleCustomers') && !hasPermission(currentUser, 'addWholesaleCustomers'))) {
      return { success: false, error: 'لا تملك صلاحية تسجيل زيارة' };
    }

    if (!payload.wholesaleCustomerId) {
      return { success: false, error: 'العميل غير محدد' };
    }

    const resultKey = normalizeVisitResult(payload.result);
    if (!resultKey) {
      return { success: false, error: 'نتيجة الزيارة مطلوبة' };
    }

    const accessibleCustomer = await getAccessibleCustomerId(payload.wholesaleCustomerId, currentUser);
    if (!accessibleCustomer) {
      return { success: false, error: 'هذا العميل غير متاح لك' };
    }

    const visitedAt = normalizeDate(payload.visitedAt) ?? new Date();
    const nextFollowUpAt = normalizeDate(payload.nextFollowUpAt);
    const isFollowUpResult = FOLLOW_UP_RESULTS.has(resultKey);
    const isRejectedResult = resultKey === 'NOT_INTERESTED';
    const rejectionReasonCode = isRejectedResult ? toNullableString(payload.rejectionReasonCode) : null;
    const rejectionReasonOther = rejectionReasonCode === 'OTHER' ? toNullableString(payload.rejectionReasonOther) : null;
    const followUpNotes = isFollowUpResult ? normalizeString(payload.followUpNotes) : null;

    if (isFollowUpResult && !nextFollowUpAt) {
      return { success: false, error: 'حدد موعد المتابعة للفرص والمتابعات' };
    }

    if (isFollowUpResult && !followUpNotes) {
      return { success: false, error: 'حدد الإجراء القادم للمتابعة' };
    }

    if (isRejectedResult && !rejectionReasonCode) {
      return { success: false, error: 'حدد سبب عدم التعاون' };
    }

    if (rejectionReasonCode === 'OTHER' && !rejectionReasonOther) {
      return { success: false, error: 'اكتب سبب عدم التعاون' };
    }

    const status = isRejectedResult || resultKey === 'PURCHASED'
      ? 'CLOSED'
      : isFollowUpResult
        ? 'FOLLOW_UP_REQUIRED'
        : ((payload.status as any) || 'VISITED');

    const result = await prisma.$transaction(async (tx) => {
      const visit = await tx.wholesaleVisit.create({
        data: {
          wholesaleCustomerId: payload.wholesaleCustomerId,
          userId: isAdmin(currentUser) ? normalizeString(payload.userId) : currentUser.id,
          visitedAt,
          result: resultKey as any,
          status,
          voiceNote: normalizeString(payload.voiceNote),
          notes: withWholesaleMeta(payload.notes, {
            rejectionReasonCode,
            rejectionReasonOther,
          }),
          photoUrls: normalizePhoneList(payload.photoUrls),
          latitude: normalizeFloat(payload.latitude),
          longitude: normalizeFloat(payload.longitude),
          nextFollowUpAt: isFollowUpResult ? nextFollowUpAt : null,
          followUpNotes,
          orderPlaced: resultKey === 'PURCHASED' || Boolean(payload.orderPlaced),
        },
      });

      await tx.wholesaleCustomer.update({
        where: { id: payload.wholesaleCustomerId },
        data: {
          lastVisitAt: visitedAt,
          lastVisitResult: resultKey as any,
          nextFollowUpAt: isFollowUpResult ? nextFollowUpAt : null,
          visitStatus: status,
        },
      });

      return visit;
    });

    revalidatePath('/dashboard/wholesale-customers');
    return { success: true, data: result };
  } catch (error) {
    console.error('Error creating wholesale visit:', error);
    return { success: false, error: 'تعذر حفظ الزيارة' };
  }
}
