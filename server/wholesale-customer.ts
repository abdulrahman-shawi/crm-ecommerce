'use server';

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

type WholesaleCustomerPayload = {
  name: string;
  category?: string;
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
    const data = await prisma.wholesaleCustomer.findMany({
      orderBy: [{ nextFollowUpAt: 'asc' }, { createdAt: 'desc' }],
      select: wholesaleCustomerSelect,
    });

    return { success: true, data };
  } catch (error) {
    console.error('Error fetching wholesale customers:', error);
    return { success: false, error: 'تعذر جلب عملاء الجملة' };
  }
}

export async function getWholesaleSalesReps() {
  try {
    const users = await prisma.user.findMany({
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
    const name = String(payload.name ?? '').trim();
    if (name.length < 3) {
      return { success: false, error: 'اسم العميل يجب أن يكون 3 أحرف على الأقل' };
    }

    const created = await prisma.wholesaleCustomer.create({
      data: {
        name,
        category: (payload.category as any) || 'PHARMACY',
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
        assignedUserId: normalizeString(payload.assignedUserId),
        notes: normalizeString(payload.notes),
        preferredVisitAt: normalizeDate(payload.preferredVisitAt),
        nextFollowUpAt: normalizeDate(payload.nextFollowUpAt),
        visitStatus: (payload.visitStatus as any) || 'PLANNED',
        isActive: payload.isActive ?? true,
      },
      select: wholesaleCustomerSelect,
    });

    revalidatePath('/dashboard/wholesale-customers');
    return { success: true, data: created };
  } catch (error) {
    console.error('Error creating wholesale customer:', error);
    return { success: false, error: 'تعذر إنشاء عميل الجملة' };
  }
}

export async function updateWholesaleCustomer(id: string, payload: WholesaleCustomerPayload) {
  try {
    const name = String(payload.name ?? '').trim();
    if (name.length < 3) {
      return { success: false, error: 'اسم العميل يجب أن يكون 3 أحرف على الأقل' };
    }

    const updated = await prisma.wholesaleCustomer.update({
      where: { id },
      data: {
        name,
        category: (payload.category as any) || 'PHARMACY',
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
        assignedUserId: normalizeString(payload.assignedUserId),
        notes: normalizeString(payload.notes),
        preferredVisitAt: normalizeDate(payload.preferredVisitAt),
        nextFollowUpAt: normalizeDate(payload.nextFollowUpAt),
        visitStatus: (payload.visitStatus as any) || 'PLANNED',
        isActive: payload.isActive ?? true,
      },
      select: wholesaleCustomerSelect,
    });

    revalidatePath('/dashboard/wholesale-customers');
    return { success: true, data: updated };
  } catch (error) {
    console.error('Error updating wholesale customer:', error);
    return { success: false, error: 'تعذر تحديث عميل الجملة' };
  }
}

export async function deleteWholesaleCustomer(id: string) {
  try {
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
    if (!payload.wholesaleCustomerId) {
      return { success: false, error: 'العميل غير محدد' };
    }

    if (!payload.result) {
      return { success: false, error: 'نتيجة الزيارة مطلوبة' };
    }

    const visitedAt = normalizeDate(payload.visitedAt) ?? new Date();
    const nextFollowUpAt = normalizeDate(payload.nextFollowUpAt);
    const status = (payload.status as any) || 'VISITED';

    const result = await prisma.$transaction(async (tx) => {
      const visit = await tx.wholesaleVisit.create({
        data: {
          wholesaleCustomerId: payload.wholesaleCustomerId,
          userId: normalizeString(payload.userId),
          visitedAt,
          result: payload.result as any,
          status,
          voiceNote: normalizeString(payload.voiceNote),
          notes: normalizeString(payload.notes),
          photoUrls: normalizePhoneList(payload.photoUrls),
          latitude: normalizeFloat(payload.latitude),
          longitude: normalizeFloat(payload.longitude),
          nextFollowUpAt,
          followUpNotes: normalizeString(payload.followUpNotes),
          orderPlaced: Boolean(payload.orderPlaced),
        },
      });

      await tx.wholesaleCustomer.update({
        where: { id: payload.wholesaleCustomerId },
        data: {
          lastVisitAt: visitedAt,
          lastVisitResult: payload.result as any,
          nextFollowUpAt,
          visitStatus: nextFollowUpAt ? 'FOLLOW_UP_REQUIRED' : status,
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
